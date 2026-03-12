import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { calculateLineItemV2 } from '@/lib/order-utils';
import { checkPermission } from '@/lib/api-auth';

// GET /api/sales-invoices/[id] - Get single invoice
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('sales_invoices', 'view');
    if (error) return error;
    const { id } = await params;

    const invoice = await (db.invoice.findUnique as any)({
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
                mrp: true,
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
        shippingAddress: {
          select: {
            id: true,
            label: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
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
    const { error } = await checkPermission('sales_invoices', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    const invoice = await (db.invoice.findUnique as any)({
      where: { id },
      include: { items: true, allocations: true },
    }) as any;

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
      // Reject duplicate itemIds
      const incomingItemIds = body.items.map((i: { itemId: string }) => i.itemId).filter(Boolean);
      if (new Set(incomingItemIds).size !== incomingItemIds.length) {
        return NextResponse.json(
          { error: 'Duplicate items found. Each item must appear only once per invoice.' },
          { status: 400 }
        );
      }

      const updatedInvoice = await transaction(async (tx) => {
        // Check if negative billing is enabled
        const negativeBillingSetting = await tx.appSetting.findUnique({ where: { key: 'negative_billing' } });
        const negativeBillingEnabled = negativeBillingSetting?.value === 'true';

        if (!negativeBillingEnabled) {
          // Pre-validate: after restoring old sale quantities, ensure new quantities can be fulfilled
          const oldQtyMap: Record<string, number> = {};
          for (const oldItem of invoice.items) {
            if (oldItem.itemId) oldQtyMap[oldItem.itemId] = Number(oldItem.quantity);
          }
          for (const newItem of body.items) {
            const newQty = Number(newItem.quantity);
            const oldQty = oldQtyMap[newItem.itemId] ?? 0;
            const inv = await tx.inventory.findUnique({ where: { itemId: newItem.itemId } });
            const currentStock = inv ? Number(inv.physicalStock) : 0;
            const stockAfterRestore = currentStock + oldQty;
            if (newQty > stockAfterRestore) {
              const itm = await tx.item.findUnique({
                where: { id: newItem.itemId },
                select: { name: true, itemCode: true },
              });
              throw new Error(
                `Insufficient stock for "${itm?.name || newItem.itemId}": ` +
                `available after restoring old sale is ${stockAfterRestore}, but new quantity is ${newQty}.`
              );
            }
          }
        }

        // Reverse old inventory changes - restore stock
        for (const oldItem of invoice.items) {
          if (!oldItem.itemId) continue; // skip items without catalog link
          await tx.inventory.updateMany({
            where: { itemId: oldItem.itemId },
            data: { physicalStock: { increment: Number(oldItem.quantity) } },
          });
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
        const newItems = body.items.map((item: { itemId: string; quantity: number; rate: number; taxRate: number; discountPercent?: number }) => {
          const quantity = Number(item.quantity);
          const rate = Number(item.rate);
          const taxRate = Number(item.taxRate);
          const discountPercent = Number(item.discountPercent || 0);

          const lineItem = calculateLineItemV2(quantity, rate, taxRate, discountPercent);

          return {
            itemId: item.itemId,
            quantity,
            rate,
            discountPercent,
            taxRate,
            taxAmount: lineItem.taxAmount,
            amount: lineItem.amount,
          };
        });

        const subtotal = newItems.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
        const totalTax = newItems.reduce((sum: number, item: { taxAmount: number }) => sum + item.taxAmount, 0);
        const rawTotal = subtotal + totalTax;
        const roundOff = Math.round(rawTotal) - rawTotal;
        const totalAmount = Math.round(rawTotal);

        // Validate new total covers already paid amount
        const paidAmount = Number(invoice.paidAmount || 0);
        if (paidAmount > 0 && totalAmount < paidAmount) {
          throw new Error(`New total (₹${totalAmount.toFixed(2)}) cannot be less than already paid amount (₹${paidAmount.toFixed(2)})`);
        }

        // Update invoice
        const updated = await tx.invoice.update({
          where: { id },
          data: {
            notes: body.notes !== undefined ? body.notes : invoice.notes,
            dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
            subtotal: Math.round(subtotal * 100) / 100,
            cgst: Math.round(totalTax / 2 * 100) / 100,
            sgst: Math.round(totalTax / 2 * 100) / 100,
            taxAmount: Math.round(totalTax * 100) / 100,
            roundOff: Math.round(roundOff * 100) / 100,
            totalAmount,
            balanceAmount: totalAmount - paidAmount,
            items: { create: newItems },
          },
          include: {
            customer: { select: { id: true, customerNumber: true, name: true } },
          },
        });

        // Re-apply inventory changes - reduce stock for new items
        for (const newItem of newItems) {
          const inv = await tx.inventory.upsert({
            where: { itemId: newItem.itemId },
            create: {
              itemId: newItem.itemId,
              physicalStock: -newItem.quantity,
              reservedQuantity: 0,
              minStockLevel: 0,
            },
            update: {
              physicalStock: { decrement: newItem.quantity },
            },
          });

          await tx.stockMovement.create({
            data: {
              inventoryId: inv.id,
              itemId: newItem.itemId,
              type: 'SALE',
              quantity: newItem.quantity,
              referenceType: 'INVOICE',
              referenceId: id,
              notes: `Sales Invoice ${updated.invoiceNumber} (edited)`,
            },
          });
        }

        // Update customer ledger (only if customer is linked)
        if (invoice.customerId) {
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
        }

        return updated;
      }, { maxWait: 10000, timeout: 30000 });

      return NextResponse.json(updatedInvoice);
    }

    // Simple update (only notes, due date, ref)
    const updatedInvoice = await (db.invoice.update as any)({
      where: { id },
      data: {
        notes: body.notes !== undefined ? body.notes : invoice.notes,
        dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
        ref: body.ref !== undefined ? (body.ref || null) : invoice.ref,
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

// DELETE /api/sales-invoices/[id] - Delete invoice
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('sales_invoices', 'edit');
    if (error) return error;
    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        allocations: true,
        items: true,
        salesReturns: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Cannot delete if payments have been made
    if (invoice.allocations.length > 0 || Number(invoice.paidAmount) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with payments. Reverse payments first.' },
        { status: 400 }
      );
    }

    // Cannot delete if returns exist
    if (invoice.salesReturns.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with returns. Delete returns first.' },
        { status: 400 }
      );
    }

    // Delete invoice, restore inventory, and remove ledger entry in transaction
    await transaction(async (tx) => {
      // Restore physical stock for each item
      for (const invoiceItem of invoice.items) {
        if (!invoiceItem.itemId) continue;
        await tx.inventory.updateMany({
          where: { itemId: invoiceItem.itemId },
          data: { physicalStock: { increment: Number(invoiceItem.quantity) } },
        });
      }

      // Delete stock movements
      await tx.stockMovement.deleteMany({
        where: { referenceType: 'INVOICE', referenceId: id },
      });

      // Delete customer ledger entries
      if (invoice.customerId) {
        await tx.customerLedger.deleteMany({
          where: { referenceType: 'SALES_INVOICE', referenceId: id },
        });
      }

      // Hard delete the invoice (items cascade deleted)
      await tx.invoice.delete({ where: { id } });
    });

    return NextResponse.json({ message: 'Invoice deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting invoice:', error);

    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete invoice';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
