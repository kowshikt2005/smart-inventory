import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
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
    const validStatuses = ['OPEN', 'HOLD', 'REJECTED'];
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
    const updatedOrder = await transaction(async (tx) => {
      // Handle REJECTED status - release reservations
      if (newStatus === 'REJECTED') {
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
    OPEN: 'HOLD or REJECTED',
    HOLD: 'OPEN or REJECTED',
    REJECTED: 'None (terminal state)',
  };
  return transitions[currentStatus] || 'None';
}
