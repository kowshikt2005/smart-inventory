import { NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { checkAuth } from '@/lib/api-auth';

// POST /api/import/resolve-invoice-item
// Creates a master item from an unlinked imported invoice item, links it,
// then applies stock for the entire invoice once all items are resolved.
export async function POST(request: Request) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const body = await request.json();
    const { invoiceItemId, invoiceType, itemData } = body;

    if (!invoiceItemId || !invoiceType || !itemData) {
      return NextResponse.json(
        { error: 'invoiceItemId, invoiceType, and itemData are required' },
        { status: 400 }
      );
    }
    if (invoiceType !== 'SALES' && invoiceType !== 'PURCHASE') {
      return NextResponse.json({ error: 'invoiceType must be SALES or PURCHASE' }, { status: 400 });
    }
    if (!itemData.name || !itemData.brandId || !itemData.subBrandId) {
      return NextResponse.json(
        { error: 'Item name, brand, and sub-brand are required' },
        { status: 400 }
      );
    }

    await transaction(async (tx) => {
      // 1. Generate item code
      const lastItem = await tx.item.findFirst({
        where: { itemCode: { startsWith: 'item-' } },
        orderBy: { createdAt: 'desc' },
        select: { itemCode: true },
      });
      const lastNum = lastItem ? parseInt(lastItem.itemCode.replace('item-', ''), 10) || 0 : 0;
      const itemCode = `item-${lastNum + 1}`;

      // 2. Create master item
      const item = await (tx.item.create as any)({
        data: {
          itemCode,
          userCode: itemData.userCode || null,
          name: itemData.name,
          brandId: itemData.brandId,
          subBrandId: itemData.subBrandId,
          hsnCode: itemData.hsnCode || null,
          gstRate: itemData.gstRate ?? 0,
          purchasePrice: itemData.purchasePrice ?? 0,
          mrp: itemData.mrp ?? 0,
          sellingPrice: itemData.sellingPrice || itemData.mrp || 0,
          unit: itemData.unit || 'PCS',
          minStock: itemData.minStock ?? 0,
          isActive: true,
        },
      });

      // 3. Create inventory record (starts at 0; stock applied below if all resolved)
      await tx.inventory.create({
        data: {
          itemId: item.id,
          physicalStock: 0,
          reservedQuantity: 0,
          minStockLevel: itemData.minStock ?? 0,
        },
      });

      if (invoiceType === 'SALES') {
        const invoiceItem = await tx.invoiceItem.findUnique({ where: { id: invoiceItemId } });
        if (!invoiceItem) throw new Error('Invoice item not found');
        if (invoiceItem.itemId) throw new Error('This invoice item is already linked to a master item');

        await tx.invoiceItem.update({ where: { id: invoiceItemId }, data: { itemId: item.id } });

        // Check if all items in the invoice are now resolved
        const unresolvedCount = await tx.invoiceItem.count({
          where: { invoiceId: invoiceItem.invoiceId, itemId: null },
        });

        if (unresolvedCount === 0) {
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

        await (tx.purchaseInvoiceItem.update as any)({ where: { id: invoiceItemId }, data: { itemId: item.id } });

        // Check if all items in the invoice are now resolved
        const unresolvedCount = await (tx.purchaseInvoiceItem.count as any)({
          where: { purchaseInvoiceId: invoiceItem.purchaseInvoiceId, itemId: null },
        });

        if (unresolvedCount === 0) {
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
  } catch (error) {
    console.error('Resolve invoice item error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve invoice item' },
      { status: 500 }
    );
  }
}
