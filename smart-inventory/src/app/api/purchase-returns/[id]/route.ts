import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculatePurchaseLineItem, calculatePurchaseTotals } from '@/lib/purchase-utils';

// GET /api/purchase-returns/[id] - Get a single purchase return
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const purchaseReturn = await db.purchaseReturn.findUnique({
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
          },
        },
        purchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            totalAmount: true,
            status: true,
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
      },
    });

    if (!purchaseReturn) {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(purchaseReturn);
  } catch (error) {
    console.error('Error fetching purchase return:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase return' },
      { status: 500 }
    );
  }
}

// PUT /api/purchase-returns/[id] - Update a purchase return
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Find existing return
    const existingReturn = await db.purchaseReturn.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingReturn) {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    // Only allow editing OPEN returns
    if (existingReturn.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Only OPEN returns can be edited' },
        { status: 400 }
      );
    }

    // Validate vendor if being updated
    let vendor = null;
    if (body.vendorId && body.vendorId !== existingReturn.vendorId) {
      vendor = await db.vendor.findUnique({
        where: { id: body.vendorId },
      });

      if (!vendor) {
        return NextResponse.json(
          { error: 'Vendor not found' },
          { status: 404 }
        );
      }
    }

    // Validate items if being updated
    let returnItems: any[] = [];
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
      returnItems = body.items.map((returnItem: any) => {
        const item = items.find((i) => i.id === returnItem.itemId)!;
        const taxRate = returnItem.taxRate ?? Number(item.gstRate);
        const { amount, taxAmount } = calculatePurchaseLineItem(
          returnItem.quantity,
          returnItem.rate,
          taxRate
        );

        return {
          itemId: returnItem.itemId,
          quantity: returnItem.quantity,
          rate: returnItem.rate,
          taxRate,
          taxAmount,
          amount,
        };
      });
    }

    // Update return in a transaction
    const purchaseReturn = await db.$transaction(async (tx) => {
      // Delete existing items if new items provided
      if (returnItems.length > 0) {
        await tx.purchaseReturnItem.deleteMany({
          where: { purchaseReturnId: id },
        });
      }

      // Calculate totals
      const itemsToCalculate = returnItems.length > 0 ? returnItems : existingReturn.items.map(item => ({
        amount: Number(item.amount),
        taxAmount: Number(item.taxAmount),
      }));
      const { subtotal, totalTax, totalAmount } = calculatePurchaseTotals(itemsToCalculate);

      // Update the return
      const updatedReturn = await tx.purchaseReturn.update({
        where: { id },
        data: {
          vendorId: body.vendorId || existingReturn.vendorId,
          vendorName: vendor?.name || existingReturn.vendorName,
          date: body.date ? new Date(body.date) : existingReturn.date,
          amount: returnItems.length > 0 ? subtotal : existingReturn.amount,
          taxAmount: returnItems.length > 0 ? totalTax : existingReturn.taxAmount,
          totalAmount: returnItems.length > 0 ? totalAmount : existingReturn.totalAmount,
          reason: body.reason !== undefined ? body.reason : existingReturn.reason,
          notes: body.notes !== undefined ? body.notes : existingReturn.notes,
          ...(returnItems.length > 0 && {
            items: {
              create: returnItems,
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

      return updatedReturn;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(purchaseReturn);
  } catch (error: unknown) {
    console.error('Error updating purchase return:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase return';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-returns/[id] - Delete a purchase return
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find existing return
    const existingReturn = await db.purchaseReturn.findUnique({
      where: { id },
    });

    if (!existingReturn) {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    // Only allow deleting OPEN or CANCELLED returns
    if (existingReturn.status !== 'OPEN' && existingReturn.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Only OPEN or CANCELLED returns can be deleted' },
        { status: 400 }
      );
    }

    // Delete the return (items will be cascade deleted)
    await db.purchaseReturn.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Purchase return deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting purchase return:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete purchase return';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
