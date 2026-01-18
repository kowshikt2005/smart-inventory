import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/purchase-invoices/[id] - Get a single purchase invoice
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const purchaseInvoice = await db.purchaseInvoice.findUnique({
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
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            date: true,
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
        vendorPayments: {
          select: {
            id: true,
            paymentNumber: true,
            date: true,
            amount: true,
            mode: true,
            reference: true,
          },
          orderBy: { date: 'desc' },
        },
        purchaseReturns: {
          select: {
            id: true,
            returnNumber: true,
            date: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!purchaseInvoice) {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(purchaseInvoice);
  } catch (error) {
    console.error('Error fetching purchase invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase invoice' },
      { status: 500 }
    );
  }
}

// PUT /api/purchase-invoices/[id] - Update a purchase invoice (only notes and due date)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Find existing invoice
    const existingInvoice = await db.purchaseInvoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    // Only allow editing PENDING invoices (limited fields)
    if (existingInvoice.status !== 'PENDING' && existingInvoice.status !== 'OVERDUE') {
      return NextResponse.json(
        { error: 'Only PENDING or OVERDUE invoices can be edited' },
        { status: 400 }
      );
    }

    // Update the invoice (only notes and due date can be updated)
    const updatedInvoice = await db.purchaseInvoice.update({
      where: { id },
      data: {
        dueDate: body.dueDate ? new Date(body.dueDate) : existingInvoice.dueDate,
        notes: body.notes !== undefined ? body.notes : existingInvoice.notes,
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

    return NextResponse.json(updatedInvoice);
  } catch (error: unknown) {
    console.error('Error updating purchase invoice:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase invoice';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-invoices/[id] - Delete a purchase invoice
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find existing invoice
    const existingInvoice = await db.purchaseInvoice.findUnique({
      where: { id },
      include: {
        items: true,
        vendorPayments: true,
        purchaseReturns: true,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    // Only allow deleting PENDING invoices with no payments
    if (existingInvoice.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only PENDING invoices can be deleted' },
        { status: 400 }
      );
    }

    // Check if there are payments
    if (existingInvoice.vendorPayments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with payments. Delete payments first.' },
        { status: 400 }
      );
    }

    // Check if there are returns
    if (existingInvoice.purchaseReturns.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with returns. Delete returns first.' },
        { status: 400 }
      );
    }

    // Delete invoice and reverse inventory/ledger in a transaction
    await db.$transaction(async (tx) => {
      // Reverse inventory changes - decrease physical stock
      for (const invoiceItem of existingInvoice.items) {
        const inventory = await tx.inventory.findUnique({
          where: { itemId: invoiceItem.itemId },
        });

        if (inventory) {
          await tx.inventory.update({
            where: { itemId: invoiceItem.itemId },
            data: {
              physicalStock: {
                decrement: Number(invoiceItem.quantity),
              },
            },
          });

          // Delete the stock movement
          await tx.stockMovement.deleteMany({
            where: {
              referenceType: 'PURCHASE_INVOICE',
              referenceId: id,
            },
          });
        }
      }

      // Delete the ledger entry
      await tx.vendorLedger.deleteMany({
        where: {
          referenceType: 'purchase_invoice',
          referenceId: id,
        },
      });

      // Recalculate subsequent ledger balances
      const remainingEntries = await tx.vendorLedger.findMany({
        where: { vendorId: existingInvoice.vendorId },
        orderBy: { createdAt: 'asc' },
      });

      let runningBalance = 0;
      const vendor = await tx.vendor.findUnique({
        where: { id: existingInvoice.vendorId },
      });
      if (vendor) {
        runningBalance = Number(vendor.openingBalance);
      }

      for (const entry of remainingEntries) {
        runningBalance = runningBalance + Number(entry.credit) - Number(entry.debit);
        await tx.vendorLedger.update({
          where: { id: entry.id },
          data: { balance: runningBalance },
        });
      }

      // Delete the invoice (items will be cascade deleted)
      await tx.purchaseInvoice.delete({
        where: { id },
      });
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({ message: 'Purchase invoice deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting purchase invoice:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete purchase invoice';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
