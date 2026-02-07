import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { calculateLineItemV2, calculateOrderTotals } from '@/lib/order-utils';
import { calculateStockAllocation, getOrderAllocation, calculateOrderStockStatus } from '@/lib/stock-allocation';

// GET /api/sales-orders/[id] - Get a single sales order
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const salesOrder = await db.salesOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
            gstin: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            creditLimit: true,
            creditDays: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                description: true,
                unit: true,
                hsnCode: true,
                gstRate: true,
                sellingPrice: true,
                purchasePrice: true,
                mrp: true,
                discountPercent: true,
                inventory: {
                  select: {
                    physicalStock: true,
                    reservedQuantity: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        statusHistory: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            changedAt: 'desc',
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!salesOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Calculate priority-based stock allocation
    const allocationResult = await calculateStockAllocation(db);
    const allocations = getOrderAllocation(salesOrder.id, allocationResult);
    const allocationMap = new Map(
      allocations.map((a) => [a.itemId, a])
    );

    // Calculate stock status based on allocation
    const stockStatus = calculateOrderStockStatus(allocations);

    // Calculate detailed stock status for each item
    const itemsWithStock = salesOrder.items.map((orderItem) => {
      const physicalStock = Number(orderItem.item.inventory?.physicalStock || 0);
      const reservedQuantity = Number(orderItem.item.inventory?.reservedQuantity || 0);
      const quantity = Number(orderItem.quantity);

      const allocation = allocationMap.get(orderItem.itemId);
      const allocatedQty = allocation?.allocatedQty || 0;
      const shortfall = allocation?.shortfallQty || 0;
      const hasStock = shortfall === 0;

      return {
        ...orderItem,
        hasStock,
        stockInfo: {
          physicalStock,
          reservedQuantity,
          availableStock: physicalStock - reservedQuantity,
          requiredQuantity: quantity,
          allocatedQty,
          canFulfill: allocatedQty,
          shortfall,
          stockStatus: hasStock ? 'Available' : allocatedQty > 0 ? 'Partial' : 'Unavailable',
        },
      };
    });

    // Create summary for stock
    const stockSummary = {
      totalItems: itemsWithStock.length,
      availableItems: itemsWithStock.filter((item) => item.hasStock).length,
      partialItems: itemsWithStock.filter(
        (item) => !item.hasStock && item.stockInfo.allocatedQty > 0
      ).length,
      unavailableItems: itemsWithStock.filter(
        (item) => item.stockInfo.allocatedQty === 0
      ).length,
    };

    return NextResponse.json({
      ...salesOrder,
      stockStatus,
      stockSummary,
      items: itemsWithStock,
    });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales order' },
      { status: 500 }
    );
  }
}

// PUT /api/sales-orders/[id] - Update a sales order (only if OPEN)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get existing order
    const existingOrder = await db.salesOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Only allow updates for OPEN orders
    if (existingOrder.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Can only edit orders with OPEN status' },
        { status: 400 }
      );
    }

    // Validate items if provided
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const itemIds = body.items.map((item: any) => item.itemId);
      const items = await db.item.findMany({
        where: { id: { in: itemIds } },
        include: { inventory: true },
      });

      if (items.length !== itemIds.length) {
        return NextResponse.json(
          { error: 'One or more items not found' },
          { status: 400 }
        );
      }

      // Validate quantities and rates
      for (const orderItem of body.items) {
        if (!orderItem.quantity || orderItem.quantity <= 0) {
          return NextResponse.json(
            { error: 'All quantities must be greater than 0' },
            { status: 400 }
          );
        }
        if (!orderItem.rate || orderItem.rate <= 0) {
          return NextResponse.json(
            { error: 'All rates must be greater than 0' },
            { status: 400 }
          );
        }
      }

      // Update in transaction with extended timeout
      const updatedOrder = await transaction(async (tx) => {
        // Release old inventory reservations (only if inventory exists) - OPTIMIZED
        const oldItemIds = existingOrder.items.map(item => item.itemId);
        const newItemIds = body.items.map((item: any) => item.itemId);
        const allItemIds = [...new Set([...oldItemIds, ...newItemIds])];

        // Get all inventory records in one query
        const inventories = await tx.inventory.findMany({
          where: { itemId: { in: allItemIds } },
        });
        const inventoryMap = new Map(inventories.map(inv => [inv.itemId, inv]));

        // Prepare batch operations for releasing old reservations
        const releaseUpdates = existingOrder.items
          .filter((oldItem: any) => inventoryMap.has(oldItem.itemId))
          .map((oldItem: any) => 
            tx.inventory.update({
              where: { itemId: oldItem.itemId },
              data: {
                reservedQuantity: {
                  decrement: Number(oldItem.quantity),
                },
              },
            })
          );

        // Execute release operations and delete old items in parallel
        await Promise.all([
          ...releaseUpdates,
          tx.salesOrderItem.deleteMany({
            where: { salesOrderId: id },
          }),
        ]);

        // Calculate new item totals using V2 which handles both inclusive and exclusive GST
        const orderItems = body.items.map((orderItem: any) => {
          const item = items.find((i) => i.id === orderItem.itemId)!;
          const taxRate = Number(item.gstRate);
          const discountPercent = orderItem.discountPercent || 0;
          const { amount, taxAmount } = calculateLineItemV2(
            orderItem.quantity,
            orderItem.rate,
            taxRate,
            discountPercent
          );

          return {
            itemId: orderItem.itemId,
            quantity: orderItem.quantity,
            rate: orderItem.rate,
            discountPercent,
            taxRate,
            taxAmount,
            amount,
          };
        });

        // Calculate order totals
        const roundOff = body.roundOff || 0;
        const { subtotal, totalTax, totalAmount } = calculateOrderTotals(
          orderItems,
          roundOff
        );

        // Update the order
        const order = await tx.salesOrder.update({
          where: { id },
          data: {
            orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
            expectedDelivery: body.expectedDelivery
              ? new Date(body.expectedDelivery)
              : null,
            referenceNumber: body.referenceNumber,
            subtotal,
            discountAmount: body.discountAmount || 0,
            taxAmount: totalTax,
            totalAmount,
            notes: body.notes,
            terms: body.terms,
            items: {
              create: orderItems,
            },
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

        // Reserve inventory for new items (only if inventory exists) - OPTIMIZED
        const reserveUpdates = orderItems
          .filter((orderItem: any) => inventoryMap.has(orderItem.itemId))
          .map((orderItem: any) => 
            tx.inventory.update({
              where: { itemId: orderItem.itemId },
              data: {
                reservedQuantity: {
                  increment: orderItem.quantity,
                },
              },
            })
          );

        // Execute inventory reservations in parallel
        await Promise.all(reserveUpdates);

        return order;
      }, {
        maxWait: 10000,
        timeout: 30000,
      });

      return NextResponse.json(updatedOrder);
    }

    // Update only non-item fields
    const updateData: any = {};
    if (body.orderDate !== undefined) updateData.orderDate = new Date(body.orderDate);
    if (body.expectedDelivery !== undefined)
      updateData.expectedDelivery = body.expectedDelivery
        ? new Date(body.expectedDelivery)
        : null;
    if (body.referenceNumber !== undefined) updateData.referenceNumber = body.referenceNumber;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.terms !== undefined) updateData.terms = body.terms;

    const updatedOrder = await db.salesOrder.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating sales order:', error);
    return NextResponse.json(
      { error: 'Failed to update sales order' },
      { status: 500 }
    );
  }
}

// DELETE /api/sales-orders/[id] - Delete a sales order (only if OPEN)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get existing order
    const existingOrder = await db.salesOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Only allow deletion for OPEN orders
    if (existingOrder.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Can only delete orders with OPEN status' },
        { status: 400 }
      );
    }

    // Delete in transaction with extended timeout - OPTIMIZED
    await transaction(async (tx) => {
      // Get all inventory records in one query
      const itemIds = existingOrder.items.map(item => item.itemId);
      const inventories = await tx.inventory.findMany({
        where: { itemId: { in: itemIds } },
      });
      const inventoryMap = new Map(inventories.map(inv => [inv.itemId, inv]));

      // Prepare batch operations for releasing reservations
      const releaseUpdates = existingOrder.items
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

      // Execute release operations and delete order in parallel
      await Promise.all([
        ...releaseUpdates,
        tx.salesOrder.delete({
          where: { id },
        }),
      ]);
    }, {
      maxWait: 15000, // Increased timeout for batch operations
      timeout: 45000,
    });

    return NextResponse.json({
      message: 'Sales order deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting sales order:', error);
    return NextResponse.json(
      { error: 'Failed to delete sales order' },
      { status: 500 }
    );
  }
}
