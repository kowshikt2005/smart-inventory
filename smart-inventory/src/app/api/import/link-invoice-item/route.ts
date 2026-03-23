import { NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { checkAuth } from '@/lib/api-auth';

// POST /api/import/link-invoice-item
// Links an existing master item to an unlinked imported invoice item.
// Stock is applied for the entire invoice only once all items are resolved.
export async function POST(request: Request) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const body = await request.json();
    const { itemId, invoiceItemId, invoiceType } = body;

    if (!itemId || !invoiceItemId || !invoiceType) {
      return NextResponse.json(
        { error: 'itemId, invoiceItemId, and invoiceType are required' },
        { status: 400 }
      );
    }
    if (invoiceType !== 'SALES' && invoiceType !== 'PURCHASE') {
      return NextResponse.json({ error: 'invoiceType must be SALES or PURCHASE' }, { status: 400 });
    }

    await transaction(async (tx) => {
      if (invoiceType === 'SALES') {
        const invoiceItem = await tx.invoiceItem.findUnique({ where: { id: invoiceItemId } });
        if (!invoiceItem) throw new Error('Invoice item not found');
        if (invoiceItem.itemId) throw new Error('This invoice item is already linked to a master item');

        await tx.invoiceItem.update({ where: { id: invoiceItemId }, data: { itemId } });

        // Check if all items in the invoice are now resolved
        const unresolvedCount = await tx.invoiceItem.count({
          where: { invoiceId: invoiceItem.invoiceId, itemId: null },
        });

        if (unresolvedCount === 0) {
          // All resolved — apply stock for every item in the invoice at once
          const allItems = await tx.invoiceItem.findMany({
            where: { invoiceId: invoiceItem.invoiceId },
            select: { itemId: true, quantity: true },
          });
          for (const li of allItems) {
            if (!li.itemId) continue;
            const inv = await tx.inventory.findUnique({ where: { itemId: li.itemId } });
            if (!inv) continue;
            const qty = Number(li.quantity);
            await tx.inventory.update({
              where: { id: inv.id },
              data: { physicalStock: { decrement: qty } },
            });
            await tx.stockMovement.create({
              data: {
                inventoryId: inv.id,
                itemId: li.itemId,
                quantity: qty,
                type: 'SALE',
                referenceType: 'INVOICE',
                referenceId: invoiceItem.invoiceId,
                notes: 'Applied after all imported invoice items resolved',
              },
            });
          }
        }
      } else {
        const invoiceItem = await (tx.purchaseInvoiceItem.findUnique as any)({ where: { id: invoiceItemId } });
        if (!invoiceItem) throw new Error('Purchase invoice item not found');
        if (invoiceItem.itemId) throw new Error('This invoice item is already linked to a master item');

        await (tx.purchaseInvoiceItem.update as any)({ where: { id: invoiceItemId }, data: { itemId } });

        // Check if all items in the invoice are now resolved
        const unresolvedCount = await (tx.purchaseInvoiceItem.count as any)({
          where: { purchaseInvoiceId: invoiceItem.purchaseInvoiceId, itemId: null },
        });

        if (unresolvedCount === 0) {
          // All resolved — apply stock for every item in the invoice at once
          const allItems = await (tx.purchaseInvoiceItem.findMany as any)({
            where: { purchaseInvoiceId: invoiceItem.purchaseInvoiceId },
            select: { itemId: true, quantity: true },
          });
          for (const li of allItems) {
            if (!li.itemId) continue;
            const inv = await tx.inventory.findUnique({ where: { itemId: li.itemId } });
            if (!inv) continue;
            const qty = Number(li.quantity);
            await tx.inventory.update({
              where: { id: inv.id },
              data: { physicalStock: { increment: qty } },
            });
            await tx.stockMovement.create({
              data: {
                inventoryId: inv.id,
                itemId: li.itemId,
                quantity: qty,
                type: 'PURCHASE',
                referenceType: 'PURCHASE_INVOICE',
                referenceId: invoiceItem.purchaseInvoiceId,
                notes: 'Applied after all imported invoice items resolved',
              },
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Link invoice item error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link invoice item' },
      { status: 500 }
    );
  }
}
