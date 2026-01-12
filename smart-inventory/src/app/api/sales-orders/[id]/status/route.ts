import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidStatusTransition, SYSTEM_USER_ID } from '@/lib/order-utils';

// PATCH /api/sales-orders/[id]/status - Change order status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json(
        { error: 'New status is required' },
        { status: 400 }
      );
    }

    const newStatus = body.status;
    const reason = body.reason || null;

    // Validate status value
    const validStatuses = ['OPEN', 'DELIVER', 'HOLD', 'REJECT', 'DELIVERED'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get existing order
    const existingOrder = await db.salesOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: {
              include: {
                inventory: true,
              },
            },
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    const currentStatus = existingOrder.status;

    // Validate status transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot change status from ${currentStatus} to ${newStatus}`,
          allowedTransitions: getTransitionDescription(currentStatus),
        },
        { status: 400 }
      );
    }

    // Perform status-specific validations and side effects
    const updatedOrder = await db.$transaction(async (tx) => {
      // Handle DELIVER status - validate stock availability
      if (newStatus === 'DELIVER') {
        const insufficientStock = [];
        for (const orderItem of existingOrder.items) {
          const physicalStock = Number(orderItem.item.inventory?.physicalStock || 0);
          const reservedQuantity = Number(orderItem.item.inventory?.reservedQuantity || 0);
          const availableStock = physicalStock - reservedQuantity + Number(orderItem.quantity); // Add back this order's reservation
          const requiredQty = Number(orderItem.quantity);

          if (availableStock < requiredQty) {
            insufficientStock.push({
              itemCode: orderItem.item.itemCode,
              itemName: orderItem.item.name,
              required: requiredQty,
              available: physicalStock,
            });
          }
        }

        if (insufficientStock.length > 0) {
          // Return a warning but allow transition (with body.force = true)
          if (!body.force) {
            return {
              warning: true,
              message: 'Some items have insufficient stock',
              insufficientStock,
            };
          }
        }
      }

      // Handle DELIVERED status - deduct from physical stock, release reservation
      if (newStatus === 'DELIVERED') {
        // Prepare batch operations
        const inventoryUpdates: Promise<any>[] = [];
        const stockMovements: any[] = [];
        
        // Get all inventory records in one query
        const itemIds = existingOrder.items.map(item => item.itemId);
        const inventories = await tx.inventory.findMany({
          where: { itemId: { in: itemIds } },
        });
        const inventoryMap = new Map(inventories.map(inv => [inv.itemId, inv]));

        for (const orderItem of existingOrder.items) {
          const inventory = inventoryMap.get(orderItem.itemId);

          if (inventory) {
            // Add inventory update to batch
            inventoryUpdates.push(
              tx.inventory.update({
                where: { itemId: orderItem.itemId },
                data: {
                  physicalStock: {
                    decrement: Number(orderItem.quantity),
                  },
                  reservedQuantity: {
                    decrement: Number(orderItem.quantity),
                  },
                },
              })
            );

            // Prepare stock movement data
            stockMovements.push({
              inventoryId: inventory.id,
              itemId: orderItem.itemId,
              quantity: -Number(orderItem.quantity),
              type: 'SALE',
              referenceType: 'SALES_ORDER',
              referenceId: id,
              notes: `Delivered via order ${existingOrder.orderNumber}`,
              createdBy: SYSTEM_USER_ID,
            });
          }
        }

        // Execute all operations in parallel
        await Promise.all([
          ...inventoryUpdates,
          stockMovements.length > 0 ? tx.stockMovement.createMany({ data: stockMovements }) : Promise.resolve(),
        ]);
      }

      // Handle REJECT status - release reservations
      if (newStatus === 'REJECT') {
        // Get all inventory records in one query
        const itemIds = existingOrder.items.map(item => item.itemId);
        const inventories = await tx.inventory.findMany({
          where: { itemId: { in: itemIds } },
        });
        const inventoryMap = new Map(inventories.map(inv => [inv.itemId, inv]));

        // Prepare batch updates
        const inventoryUpdates = existingOrder.items
          .filter(orderItem => inventoryMap.has(orderItem.itemId))
          .map(orderItem => 
            tx.inventory.update({
              where: { itemId: orderItem.itemId },
              data: {
                reservedQuantity: {
                  decrement: Number(orderItem.quantity),
                },
              },
            })
          );

        // Execute all updates in parallel
        await Promise.all(inventoryUpdates);
      }

      // Update the order status
      const order = await tx.salesOrder.update({
        where: { id },
        data: {
          status: newStatus,
        },
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              name: true,
            },
          },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
      });

      // Create status history record
      await tx.orderStatusHistory.create({
        data: {
          salesOrderId: id,
          fromStatus: currentStatus,
          toStatus: newStatus,
          reason: reason,
          changedBy: SYSTEM_USER_ID,
        },
      });

      return order;
    }, {
      maxWait: 10000, // 10 seconds max wait to acquire connection
      timeout: 30000, // 30 seconds transaction timeout
    });

    // Check if it's a warning response
    if (updatedOrder && 'warning' in updatedOrder) {
      return NextResponse.json(updatedOrder, { status: 409 });
    }

    return NextResponse.json({
      message: `Status changed from ${currentStatus} to ${newStatus}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error changing order status:', error);
    return NextResponse.json(
      { error: 'Failed to change order status' },
      { status: 500 }
    );
  }
}

function getTransitionDescription(currentStatus: string): string {
  const transitions: Record<string, string> = {
    OPEN: 'DELIVER, HOLD, or REJECT',
    DELIVER: 'DELIVERED or REJECT',
    HOLD: 'DELIVER or REJECT',
    REJECT: 'None (terminal state)',
    DELIVERED: 'None (terminal state)',
  };
  return transitions[currentStatus] || 'None';
}
