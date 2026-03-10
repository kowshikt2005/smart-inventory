import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/purchase-invoices/[id] - Get a single purchase invoice
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_invoices', 'view');
    if (error) return error;
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

// PUT /api/purchase-invoices/[id] - Update a purchase invoice
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_invoices', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    // Find existing invoice with items and payments
    const existingInvoice = await (db.purchaseInvoice.findUnique as any)({
      where: { id },
      include: { items: true, vendorPayments: true },
    }) as any;

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    // Only allow editing PENDING invoices with no payments
    if (existingInvoice.status !== 'PENDING' && existingInvoice.status !== 'OVERDUE') {
      return NextResponse.json(
        { error: 'Only PENDING or OVERDUE invoices can be edited' },
        { status: 400 }
      );
    }

    if (existingInvoice.vendorPayments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot edit invoice with payments' },
        { status: 400 }
      );
    }

    // If items are provided, do a full update with item replacement
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const updatedInvoice = await transaction(async (tx) => {
        // Reverse old inventory changes
        for (const oldItem of existingInvoice.items) {
          const inventory = await tx.inventory.findUnique({
            where: { itemId: oldItem.itemId },
          });
          if (inventory) {
            await tx.inventory.update({
              where: { itemId: oldItem.itemId },
              data: {
                physicalStock: { decrement: Number(oldItem.quantity) },
              },
            });
          }
        }

        // Delete old stock movements
        await tx.stockMovement.deleteMany({
          where: { referenceType: 'PURCHASE_INVOICE', referenceId: id },
        });

        // Delete old items
        await tx.purchaseInvoiceItem.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        // Calculate new items
        const newItems = body.items.map((item: any) => {
          const amount = Number(item.quantity) * Number(item.rate);
          const taxAmount = amount * (Number(item.taxRate) / 100);
          return {
            itemId: item.itemId,
            quantity: Number(item.quantity),
            rate: Number(item.rate),
            taxRate: Number(item.taxRate),
            taxAmount: Math.round(taxAmount * 100) / 100,
            amount: Math.round(amount * 100) / 100,
          };
        });

        const subtotal = newItems.reduce((sum: number, item: any) => sum + item.amount, 0);
        const totalTax = newItems.reduce((sum: number, item: any) => sum + item.taxAmount, 0);
        const totalAmount = subtotal + totalTax;

        // Look up vendor for name
        let vendorName = existingInvoice.vendorName;
        const vendorId = body.vendorId || existingInvoice.vendorId;
        if (body.vendorId && body.vendorId !== existingInvoice.vendorId) {
          const vendor = await tx.vendor.findUnique({ where: { id: body.vendorId } });
          if (vendor) vendorName = vendor.name;
        }

        // Update invoice
        const updated = await tx.purchaseInvoice.update({
          where: { id },
          data: {
            vendorId,
            vendorName,
            date: body.date ? new Date(body.date) : existingInvoice.date,
            dueDate: body.dueDate ? new Date(body.dueDate) : existingInvoice.dueDate,
            notes: body.notes !== undefined ? body.notes : existingInvoice.notes,
            amount: Math.round(subtotal * 100) / 100,
            taxAmount: Math.round(totalTax * 100) / 100,
            totalAmount: Math.round(totalAmount * 100) / 100,
            balanceAmount: Math.round(totalAmount * 100) / 100,
            items: { create: newItems },
          },
          include: {
            vendor: { select: { id: true, vendorNumber: true, name: true } },
            items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
          },
        });

        // Re-apply inventory changes for new items
        for (const newItem of newItems) {
          const inventory = await tx.inventory.findUnique({
            where: { itemId: newItem.itemId },
          });
          let inv = inventory;
          if (inv) {
            await tx.inventory.update({
              where: { itemId: newItem.itemId },
              data: {
                physicalStock: { increment: newItem.quantity },
              },
            });
          } else {
            inv = await tx.inventory.create({
              data: {
                itemId: newItem.itemId,
                physicalStock: newItem.quantity,
              },
            });
          }

          await tx.stockMovement.create({
            data: {
              inventoryId: inv.id,
              itemId: newItem.itemId,
              type: 'PURCHASE',
              quantity: newItem.quantity,
              referenceType: 'PURCHASE_INVOICE',
              referenceId: id,
              notes: `Purchase Invoice ${updated.invoiceNumber} (edited)`,
            },
          });
        }

        // Update vendor ledger (only if vendor is linked)
        if (vendorId) {
          await tx.vendorLedger.deleteMany({
            where: { referenceType: 'purchase_invoice', referenceId: id },
          });

          const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
          const openingBalance = vendor ? Number(vendor.openingBalance) : 0;
          const priorEntries = await tx.vendorLedger.findMany({
            where: { vendorId },
            orderBy: { createdAt: 'asc' },
          });

          let runningBalance = openingBalance;
          for (const entry of priorEntries) {
            runningBalance = runningBalance + Number(entry.credit) - Number(entry.debit);
          }

          const newBalance = runningBalance + Math.round(totalAmount * 100) / 100;

          await tx.vendorLedger.create({
            data: {
              vendorId,
              date: body.date ? new Date(body.date) : existingInvoice.date,
              description: `Purchase Invoice ${updated.invoiceNumber}`,
              type: 'PURCHASE_INVOICE',
              credit: Math.round(totalAmount * 100) / 100,
              debit: 0,
              balance: newBalance,
              referenceType: 'purchase_invoice',
              referenceId: id,
            },
          });
        }

        return updated;
      }, { maxWait: 10000, timeout: 30000 });

      return NextResponse.json(updatedInvoice);
    }

    // Simple update (only notes, due date, ref)
    const updatedInvoice = await (db.purchaseInvoice.update as any)({
      where: { id },
      data: {
        dueDate: body.dueDate ? new Date(body.dueDate) : existingInvoice.dueDate,
        notes: body.notes !== undefined ? body.notes : existingInvoice.notes,
        ref: body.ref !== undefined ? (body.ref || null) : existingInvoice.ref,
      },
      include: {
        vendor: { select: { id: true, vendorNumber: true, name: true } },
        items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
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
    const { error } = await checkPermission('purchases_invoices', 'edit');
    if (error) return error;
    const { id } = await params;

    // Find existing invoice
    const existingInvoice = await (db.purchaseInvoice.findUnique as any)({
      where: { id },
      include: {
        items: true,
        vendorPayments: true,
        purchaseReturns: true,
      },
    }) as any;

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
    await transaction(async (tx) => {
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

      // Delete the ledger entry and recalculate (only if vendor is linked)
      if (existingInvoice.vendorId) {
        await tx.vendorLedger.deleteMany({
          where: {
            referenceType: 'purchase_invoice',
            referenceId: id,
          },
        });

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
