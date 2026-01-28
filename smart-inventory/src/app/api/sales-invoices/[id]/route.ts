import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sales-invoices/[id] - Get single invoice
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.invoice.findUnique({
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
                sellingPrice: true,
              },
            },
          },
        },
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                paymentNumber: true,
                paymentDate: true,
                amount: true,
                mode: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check effective status
    let effectiveStatus = invoice.paymentStatus;
    const now = new Date();
    if (
      invoice.paymentStatus === 'PENDING' &&
      invoice.dueDate &&
      new Date(invoice.dueDate) < now &&
      Number(invoice.balanceAmount) > 0
    ) {
      effectiveStatus = 'OVERDUE';
    }

    return NextResponse.json({
      ...invoice,
      effectiveStatus,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

// PUT /api/sales-invoices/[id] - Update invoice (limited fields)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const invoice = await db.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Only allow updating notes and due date if not paid
    if (invoice.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot update paid invoice' },
        { status: 400 }
      );
    }

    const updatedInvoice = await db.invoice.update({
      where: { id },
      data: {
        notes: body.notes !== undefined ? body.notes : invoice.notes,
        dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

// DELETE /api/sales-invoices/[id] - Cancel invoice
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        allocations: true,
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

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Cannot cancel if payments have been made
    if (invoice.allocations.length > 0 || Number(invoice.paidAmount) > 0) {
      return NextResponse.json(
        { error: 'Cannot cancel invoice with payments. Reverse payments first.' },
        { status: 400 }
      );
    }

    // Cancel invoice, restore inventory, and reverse ledger entry in transaction
    await db.$transaction(async (tx) => {
      // Update invoice status to cancelled
      await tx.invoice.update({
        where: { id },
        data: {
          paymentStatus: 'CANCELLED',
        },
      });

      // Restore inventory for each item
      const inventoryUpdates: Promise<any>[] = [];
      const stockMovements: any[] = [];

      for (const invoiceItem of invoice.items) {
        const inventory = invoiceItem.item.inventory;
        if (inventory) {
          // Restore physical stock
          inventoryUpdates.push(
            tx.inventory.update({
              where: { id: inventory.id },
              data: {
                physicalStock: {
                  increment: Number(invoiceItem.quantity),
                },
              },
            })
          );

          // Create stock movement entry for the restoration
          stockMovements.push({
            inventoryId: inventory.id,
            itemId: invoiceItem.itemId,
            quantity: Number(invoiceItem.quantity),
            type: 'ADJUSTMENT_IN',
            referenceType: 'INVOICE_CANCELLED',
            referenceId: invoice.id,
            notes: `Invoice cancelled - ${invoice.invoiceNumber}`,
          });
        }
      }

      // Execute all inventory updates in parallel
      await Promise.all(inventoryUpdates);

      // Batch create all stock movements
      if (stockMovements.length > 0) {
        await tx.stockMovement.createMany({
          data: stockMovements,
        });
      }

      // Create reversal ledger entry
      const lastLedgerEntry = await tx.customerLedger.findFirst({
        where: { customerId: invoice.customerId },
        orderBy: { date: 'desc' },
      });

      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : 0;
      const newBalance = previousBalance - Number(invoice.totalAmount);

      await tx.customerLedger.create({
        data: {
          customerId: invoice.customerId,
          date: new Date(),
          description: `Invoice Cancelled - ${invoice.invoiceNumber}`,
          type: 'ADJUSTMENT',
          debit: 0,
          credit: Number(invoice.totalAmount),
          balance: newBalance,
          referenceType: 'sales_invoice',
          referenceId: invoice.id,
        },
      });
    });

    return NextResponse.json({ message: 'Invoice cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invoice' },
      { status: 500 }
    );
  }
}
