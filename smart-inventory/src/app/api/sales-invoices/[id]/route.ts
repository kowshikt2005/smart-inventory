import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';

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
        salesReturns: {
          select: {
            id: true,
            returnNumber: true,
            status: true,
            returnDate: true,
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

// PUT /api/sales-invoices/[id] - Update invoice
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { items: true, allocations: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Only allow updating if not paid or cancelled
    if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot update paid or cancelled invoice' },
        { status: 400 }
      );
    }

    // If items are provided, do a full update
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      // Check no payments have been made
      if (invoice.allocations.length > 0 || Number(invoice.paidAmount) > 0) {
        return NextResponse.json(
          { error: 'Cannot edit invoice with payments' },
          { status: 400 }
        );
      }

      const updatedInvoice = await transaction(async (tx) => {
        // Reverse old inventory changes - restore stock
        for (const oldItem of invoice.items) {
          const inventory = await tx.inventory.findUnique({
            where: { itemId: oldItem.itemId },
          });
          if (inventory) {
            await tx.inventory.update({
              where: { itemId: oldItem.itemId },
              data: { physicalStock: { increment: Number(oldItem.quantity) } },
            });
          }
        }

        // Delete old stock movements for this invoice
        await tx.stockMovement.deleteMany({
          where: { referenceType: 'INVOICE', referenceId: id },
        });

        // Delete old items
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });

        // Calculate new items
        const newItems = body.items.map((item: any) => {
          const amount = Number(item.quantity) * Number(item.rate);
          const taxRate = Number(item.taxRate);
          const taxAmount = amount * (taxRate / 100);
          const cgst = taxAmount / 2;
          const sgst = taxAmount / 2;
          return {
            itemId: item.itemId,
            quantity: Number(item.quantity),
            rate: Number(item.rate),
            taxRate,
            taxAmount: Math.round(taxAmount * 100) / 100,
            cgst: Math.round(cgst * 100) / 100,
            sgst: Math.round(sgst * 100) / 100,
            amount: Math.round(amount * 100) / 100,
          };
        });

        const subtotal = newItems.reduce((sum: number, item: any) => sum + item.amount, 0);
        const totalCgst = newItems.reduce((sum: number, item: any) => sum + item.cgst, 0);
        const totalSgst = newItems.reduce((sum: number, item: any) => sum + item.sgst, 0);
        const totalTax = totalCgst + totalSgst;
        const rawTotal = subtotal + totalTax;
        const roundOff = Math.round(rawTotal) - rawTotal;
        const totalAmount = Math.round(rawTotal);

        // Update invoice
        const updated = await tx.invoice.update({
          where: { id },
          data: {
            notes: body.notes !== undefined ? body.notes : invoice.notes,
            dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
            subtotal: Math.round(subtotal * 100) / 100,
            cgst: Math.round(totalCgst * 100) / 100,
            sgst: Math.round(totalSgst * 100) / 100,
            taxAmount: Math.round(totalTax * 100) / 100,
            roundOff: Math.round(roundOff * 100) / 100,
            totalAmount,
            balanceAmount: totalAmount,
            items: { create: newItems },
          },
          include: {
            customer: { select: { id: true, customerNumber: true, name: true } },
          },
        });

        // Re-apply inventory changes - reduce stock for new items
        for (const newItem of newItems) {
          const inventory = await tx.inventory.findUnique({
            where: { itemId: newItem.itemId },
          });
          if (inventory) {
            await tx.inventory.update({
              where: { itemId: newItem.itemId },
              data: { physicalStock: { decrement: newItem.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                inventoryId: inventory.id,
                itemId: newItem.itemId,
                type: 'SALE',
                quantity: newItem.quantity,
                referenceType: 'INVOICE',
                referenceId: id,
                notes: `Sales Invoice ${updated.invoiceNumber} (edited)`,
              },
            });
          }
        }

        // Update customer ledger
        await tx.customerLedger.deleteMany({
          where: { referenceType: 'SALES_INVOICE', referenceId: id },
        });

        await tx.customerLedger.create({
          data: {
            customerId: invoice.customerId,
            date: invoice.invoiceDate,
            description: `Sales Invoice ${updated.invoiceNumber}`,
            type: 'SALES_INVOICE',
            debit: totalAmount,
            credit: 0,
            balance: 0,
            referenceType: 'SALES_INVOICE',
            referenceId: id,
          },
        });

        return updated;
      }, { maxWait: 10000, timeout: 30000 });

      return NextResponse.json(updatedInvoice);
    }

    // Simple update (only notes and due date)
    const updatedInvoice = await db.invoice.update({
      where: { id },
      data: {
        notes: body.notes !== undefined ? body.notes : invoice.notes,
        dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
      },
      include: {
        customer: { select: { id: true, customerNumber: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
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
    await transaction(async (tx) => {
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
