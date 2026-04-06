import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { calculatePurchaseLineItem, calculatePurchaseTotals } from '@/lib/purchase-utils';
import { checkPermission } from '@/lib/api-auth';

// GET /api/purchase-orders/[id] - Get a single purchase order
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_orders', 'view');
    if (error) return error;
    const { id } = await params;

    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            vendorNumber: true,
            name: true,
            gstin: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
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
                unit: true,
                hsnCode: true,
                gstRate: true,
                purchasePrice: true,
              },
            },
          },
        },
        purchaseInvoices: {
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

// PUT /api/purchase-orders/[id] - Update a purchase order
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_orders', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    // Find existing order
    const existingOrder = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Only allow editing OPEN orders
    if (existingOrder.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Only OPEN orders can be edited' },
        { status: 400 }
      );
    }

    // Validate vendor if being updated
    let vendor = null;
    if (body.vendorId && body.vendorId !== existingOrder.vendorId) {
      vendor = await db.vendor.findUnique({
        where: { id: body.vendorId },
      });

      if (!vendor) {
        return NextResponse.json(
          { error: 'Vendor not found' },
          { status: 404 }
        );
      }

      if (!vendor.isActive) {
        return NextResponse.json(
          { error: 'Cannot assign order to inactive vendor' },
          { status: 400 }
        );
      }
    }

    // Validate dates if being updated
    if (body.date) {
      const orderDate = new Date(body.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (orderDate > today) {
        return NextResponse.json(
          { error: 'Order date cannot be in the future' },
          { status: 400 }
        );
      }

      // Validate expected delivery date is not before order date
      if (body.expectedDelivery) {
        const expectedDelivery = new Date(body.expectedDelivery);
        if (expectedDelivery < orderDate) {
          return NextResponse.json(
            { error: 'Expected delivery date cannot be before order date' },
            { status: 400 }
          );
        }
      }
    } else if (body.expectedDelivery) {
      // If only expectedDelivery is being updated, compare with existing order date
      const expectedDelivery = new Date(body.expectedDelivery);
      const orderDate = new Date(existingOrder.date);
      if (expectedDelivery < orderDate) {
        return NextResponse.json(
          { error: 'Expected delivery date cannot be before order date' },
          { status: 400 }
        );
      }
    }

    // Validate items if being updated
    let orderItems: any[] = [];
    if (body.items && Array.isArray(body.items)) {
      if (body.items.length === 0) {
        return NextResponse.json(
          { error: 'At least one item is required' },
          { status: 400 }
        );
      }

      const itemIds = body.items.map((item: any) => item.itemId);
      const items = await db.item.findMany({
        where: { id: { in: itemIds } },
      });

      if (items.length !== itemIds.length) {
        return NextResponse.json(
          { error: 'One or more items not found' },
          { status: 400 }
        );
      }

      // Calculate item totals
      orderItems = body.items.map((orderItem: any) => {
        const item = items.find((i) => i.id === orderItem.itemId)!;
        const taxRate = orderItem.taxRate ?? Number(item.gstRate);
        const { amount, taxAmount } = calculatePurchaseLineItem(
          orderItem.quantity,
          orderItem.rate,
          taxRate
        );

        return {
          itemId: orderItem.itemId,
          quantity: orderItem.quantity,
          rate: orderItem.rate,
          taxRate,
          taxAmount,
          amount,
        };
      });
    }

    // Update order in a transaction
    const purchaseOrder = await transaction(async (tx) => {
      // Delete existing items if new items provided
      if (orderItems.length > 0) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      // Calculate totals
      const itemsToCalculate = orderItems.length > 0 ? orderItems : existingOrder.items.map(item => ({
        amount: Number(item.amount),
        taxAmount: Number(item.taxAmount),
      }));
      const { subtotal, totalTax, totalAmount } = calculatePurchaseTotals(itemsToCalculate);

      // Update the order
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: {
          vendorId: body.vendorId || existingOrder.vendorId,
          vendorName: vendor?.name || existingOrder.vendorName,
          date: body.date ? new Date(body.date) : existingOrder.date,
          expectedDelivery: body.expectedDelivery !== undefined
            ? (body.expectedDelivery ? new Date(body.expectedDelivery) : null)
            : existingOrder.expectedDelivery,
          amount: orderItems.length > 0 ? subtotal : existingOrder.amount,
          taxAmount: orderItems.length > 0 ? totalTax : existingOrder.taxAmount,
          totalAmount: orderItems.length > 0 ? totalAmount : existingOrder.totalAmount,
          notes: body.notes !== undefined ? body.notes : existingOrder.notes,
          ...(orderItems.length > 0 && {
            items: {
              create: orderItems,
            },
          }),
        },
        include: {
          vendor: {
            select: {
              id: true,
              vendorNumber: true,
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

      return updatedOrder;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(purchaseOrder);
  } catch (error: unknown) {
    console.error('Error updating purchase order:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase order';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-orders/[id] - Delete a purchase order
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_orders', 'edit');
    if (error) return error;
    const { id } = await params;

    // Find existing order
    const existingOrder = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        purchaseInvoices: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Only allow deleting OPEN or CANCELLED orders
    if (existingOrder.status !== 'OPEN' && existingOrder.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Only OPEN or CANCELLED orders can be deleted' },
        { status: 400 }
      );
    }

    // Check if there are linked invoices
    if (existingOrder.purchaseInvoices.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete order with linked invoices' },
        { status: 400 }
      );
    }

    // Delete the order (items will be cascade deleted)
    await db.purchaseOrder.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Purchase order deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting purchase order:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete purchase order';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
