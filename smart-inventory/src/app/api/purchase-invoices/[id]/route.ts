import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import { normalizeRoundOffMode, resolveRoundOff } from '@/lib/rounding-utils';

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

    // If items are provided, do a full update with item replacement
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      // Reject duplicate itemIds
      const incomingItemIds = body.items.map((i: any) => i.itemId).filter(Boolean);
      if (new Set(incomingItemIds).size !== incomingItemIds.length) {
        return NextResponse.json(
          { error: 'Duplicate items found. Each item must appear only once per invoice.' },
          { status: 400 }
        );
      }

      const roundOffSetting = await db.appSetting.findUnique({
        where: { key: 'invoice_roundoff_mode' },
        select: { value: true },
      });
      const effectiveRoundOffMode = normalizeRoundOffMode(body.roundOffMode || roundOffSetting?.value);

      const updatedInvoice = await transaction(async (tx) => {
        // Calculate new items first (needed for validation)
        const newItemsPreview: Record<string, number> = {};
        for (const item of body.items) {
          if (item.itemId) newItemsPreview[item.itemId] = Number(item.quantity);
        }

        // Pre-validate: ensure no item's physicalStock goes negative after this edit
        for (const oldItem of existingInvoice.items) {
          if (!oldItem.itemId) continue;
          const oldQty = Number(oldItem.quantity);
          const newQty = newItemsPreview[oldItem.itemId] ?? 0;
          const netChange = newQty - oldQty;
          if (netChange < 0) {
            const inv = await tx.inventory.findUnique({ where: { itemId: oldItem.itemId } });
            const currentStock = inv ? Number(inv.physicalStock) : 0;
            if (currentStock + netChange < 0) {
              const itm = await tx.item.findUnique({
                where: { id: oldItem.itemId },
                select: { name: true, itemCode: true },
              });
              throw new Error(
                `Cannot reduce quantity for "${itm?.name || oldItem.itemId}": ` +
                `current stock is ${currentStock}, reducing by ${Math.abs(netChange)} would make it negative. ` +
                `Minimum quantity for this item is ${Math.max(0, oldQty - currentStock)}.`
              );
            }
          }
        }

        // Reverse old inventory changes
        for (const oldItem of existingInvoice.items) {
          if (!oldItem.itemId) continue; // skip items without catalog link
          await tx.inventory.updateMany({
            where: { itemId: oldItem.itemId },
            data: { physicalStock: { decrement: Number(oldItem.quantity) } },
          });
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
          const factor = Number(item.uomFactor || 1);
          const baseQuantity = Number(item.quantity) * factor;
          const baseRate = Number(item.rate) / factor;
          const amount = baseQuantity * baseRate;
          const taxAmount = amount * (Number(item.taxRate) / 100);
          return {
            itemId: item.itemId,
            quantity: Math.round(baseQuantity * 1000) / 1000,
            rate: Math.round(baseRate * 100) / 100,
            taxRate: Number(item.taxRate),
            taxAmount: Math.round(taxAmount * 100) / 100,
            amount: Math.round(amount * 100) / 100,
          };
        });

        const subtotal = newItems.reduce((sum: number, item: any) => sum + item.amount, 0);
        const totalTax = newItems.reduce((sum: number, item: any) => sum + item.taxAmount, 0);
        const roundOffDecision = resolveRoundOff(
          subtotal + totalTax,
          effectiveRoundOffMode,
          Number(body.roundOff || 0)
        );
        const totalAmount = subtotal + totalTax + roundOffDecision.roundOff;

        // Validate new total covers already paid amount
        const paidAmount = Number(existingInvoice.paidAmount || 0);
        if (paidAmount > 0 && Math.round(totalAmount * 100) / 100 < paidAmount) {
          throw new Error(`New total (₹${(Math.round(totalAmount * 100) / 100).toFixed(2)}) cannot be less than already paid amount (₹${paidAmount.toFixed(2)})`);
        }

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
            roundOff: roundOffDecision.roundOff,
            totalAmount: Math.round(totalAmount * 100) / 100,
            balanceAmount: Math.round((totalAmount - paidAmount) * 100) / 100,
            items: { create: newItems },
          },
          include: {
            vendor: { select: { id: true, vendorNumber: true, name: true } },
            items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
          },
        });

        // Re-apply inventory changes for new items
        for (const newItem of newItems) {
          const inv = await tx.inventory.upsert({
            where: { itemId: newItem.itemId },
            create: {
              itemId: newItem.itemId,
              physicalStock: newItem.quantity,
              reservedQuantity: 0,
              minStockLevel: 0,
            },
            update: {
              physicalStock: { increment: newItem.quantity },
            },
          });

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
