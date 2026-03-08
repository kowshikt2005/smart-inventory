import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import {
  generatePurchaseOrderNumber,
  calculatePurchaseLineItem,
  calculatePurchaseTotals,
} from '@/lib/purchase-utils';

interface VendorGroup {
  vendorId: string;
  itemIds: string[]; // StockReorderItem IDs
}

// POST /api/reorders/[id]/convert - Convert reorder to purchase orders
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_reorders', 'edit');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const { date, expectedDelivery, notes, vendorGroups } = body as {
      date: string;
      expectedDelivery?: string;
      notes?: string;
      vendorGroups: VendorGroup[];
    };

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    if (!vendorGroups || !Array.isArray(vendorGroups) || vendorGroups.length === 0) {
      return NextResponse.json(
        { error: 'At least one vendor group must be selected' },
        { status: 400 }
      );
    }

    // Validate reorder exists and is PENDING
    const reorder = await db.stockReorder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: {
              select: { id: true, gstRate: true, name: true, itemCode: true, unit: true },
            },
          },
        },
      },
    });

    if (!reorder) {
      return NextResponse.json({ error: 'Reorder not found' }, { status: 404 });
    }

    if (reorder.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only PENDING reorders can be converted' },
        { status: 400 }
      );
    }

    // Build a map of reorderItemId → reorderItem for quick lookup
    const reorderItemMap = new Map<string, any>((reorder.items as any[]).map((ri) => [ri.id, ri]));

    // Validate all itemIds in vendorGroups belong to this reorder
    const allGroupItemIds = vendorGroups.flatMap((g) => g.itemIds);
    for (const itemId of allGroupItemIds) {
      if (!reorderItemMap.has(itemId)) {
        return NextResponse.json(
          { error: `Item ${itemId} does not belong to this reorder` },
          { status: 400 }
        );
      }
    }

    // Validate all vendorIds exist and are active
    const vendorIds = [...new Set(vendorGroups.map((g) => g.vendorId))];
    const vendors = await db.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true, isActive: true },
    });

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    for (const vendorId of vendorIds) {
      const vendor = vendorMap.get(vendorId);
      if (!vendor) {
        return NextResponse.json(
          { error: `Vendor ${vendorId} not found` },
          { status: 400 }
        );
      }
      if (!vendor.isActive) {
        return NextResponse.json(
          { error: `Vendor "${vendor.name}" is inactive` },
          { status: 400 }
        );
      }
    }

    const poDate = new Date(date);
    const poExpectedDelivery = expectedDelivery ? new Date(expectedDelivery) : null;

    // Create all POs in one transaction
    const createdOrders = await transaction(async (tx) => {
      const results: { purchaseOrderId: string; orderNumber: string; vendorName: string; itemCount: number }[] = [];

      for (const group of vendorGroups) {
        if (group.itemIds.length === 0) continue;

        const vendor = vendorMap.get(group.vendorId)!;
        const orderNumber = await generatePurchaseOrderNumber(tx as any);

        // Calculate line items
        const lineItems = group.itemIds.map((reorderItemId) => {
          const ri = reorderItemMap.get(reorderItemId)!;
          const qty = Number(ri.requiredQty);
          const rate = Number(ri.rate);
          const gstRate = Number(ri.item.gstRate);
          const { amount, taxAmount } = calculatePurchaseLineItem(qty, rate, gstRate);

          return {
            itemId: ri.itemId,
            quantity: qty,
            rate,
            taxRate: gstRate,
            taxAmount,
            amount,
          };
        });

        const { subtotal, totalTax, totalAmount } = calculatePurchaseTotals(
          lineItems.map((li) => ({ amount: li.amount, taxAmount: li.taxAmount }))
        );

        const po = await tx.purchaseOrder.create({
          data: {
            orderNumber,
            vendorId: vendor.id,
            vendorName: vendor.name,
            date: poDate,
            expectedDelivery: poExpectedDelivery,
            amount: subtotal,
            taxAmount: totalTax,
            totalAmount,
            status: 'OPEN',
            notes: notes || null,
            items: {
              create: lineItems,
            },
          },
        });

        results.push({
          purchaseOrderId: po.id,
          orderNumber: po.orderNumber,
          vendorName: vendor.name,
          itemCount: lineItems.length,
        });
      }

      // Mark reorder as CONVERTED
      await (tx as any).stockReorder.update({
        where: { id },
        data: { status: 'CONVERTED' },
      });

      return results;
    });

    return NextResponse.json({ createdOrders }, { status: 201 });
  } catch (error) {
    console.error('Error converting reorder:', error);
    return NextResponse.json(
      { error: 'Failed to convert reorder to purchase orders' },
      { status: 500 }
    );
  }
}
