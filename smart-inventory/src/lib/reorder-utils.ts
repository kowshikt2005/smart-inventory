import { PrismaClient } from '@/generated/prisma';
import {
  calculateStockAllocation,
  calculateOrderStockStatus,
} from '@/lib/stock-allocation';

export interface ScanResult {
  skipped?: boolean;
  reorderId: string | null;
  reorderNumber?: string;
  shortfallCount: number;
  affectedOrderIds: string[];
  message: string;
}

/**
 * Generate the next reorder number in sequence (RO-0001, RO-0002, etc.)
 */
export async function generateReorderNumber(db: PrismaClient): Promise<string> {
  const last = await db.stockReorder.findFirst({
    orderBy: { reorderNumber: 'desc' },
    select: { reorderNumber: true },
  });

  let nextNum = 1;
  if (last) {
    const match = last.reorderNumber.match(/RO-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  return `RO-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Run the stock shortfall scan and create a StockReorder if shortfalls exist.
 * - Idempotent: skips if a non-CANCELLED reorder was already created today.
 * - Consolidates shortfall quantities across all Partial/Unavailable orders per item.
 */
export async function runStockScan(db: PrismaClient): Promise<ScanResult> {
  // Idempotency: only one scan per calendar day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existingToday = await db.stockReorder.findFirst({
    where: {
      createdAt: { gte: todayStart },
      status: { not: 'CANCELLED' },
    },
    select: { id: true, reorderNumber: true },
  });

  if (existingToday) {
    return {
      skipped: true,
      reorderId: existingToday.id,
      reorderNumber: existingToday.reorderNumber,
      shortfallCount: 0,
      affectedOrderIds: [],
      message: `Scan already ran today (${existingToday.reorderNumber})`,
    };
  }

  // Run FIFO stock allocation
  const allocationResult = await calculateStockAllocation(db);

  // Accumulate shortfalls per item across all Partial/Unavailable orders
  interface ShortfallEntry {
    totalShortfall: number;
    soBreakdown: { salesOrderId: string; shortfallQty: number }[];
  }
  const shortfallMap = new Map<string, ShortfallEntry>();
  const affectedOrderIds: string[] = [];

  for (const [orderId, allocations] of allocationResult.orderAllocations) {
    const status = calculateOrderStockStatus(allocations);
    if (status === 'Available') continue;

    affectedOrderIds.push(orderId);

    for (const alloc of allocations) {
      if (alloc.shortfallQty <= 0) continue;

      if (!shortfallMap.has(alloc.itemId)) {
        shortfallMap.set(alloc.itemId, { totalShortfall: 0, soBreakdown: [] });
      }
      const entry = shortfallMap.get(alloc.itemId)!;
      entry.totalShortfall += alloc.shortfallQty;
      entry.soBreakdown.push({ salesOrderId: orderId, shortfallQty: alloc.shortfallQty });
    }
  }

  if (shortfallMap.size === 0) {
    return {
      reorderId: null,
      shortfallCount: 0,
      affectedOrderIds: [],
      message: 'No shortfalls found. All orders are fully stocked.',
    };
  }

  // Fetch purchase prices for shortfall items
  const itemIds = Array.from(shortfallMap.keys());
  const itemRecords = await db.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, purchasePrice: true },
  });
  const priceMap = new Map(itemRecords.map((i) => [i.id, Number(i.purchasePrice)]));

  // Create StockReorder with items and junction rows in one transaction
  const reorder = await (db as unknown as { $transaction: (fn: (tx: typeof db) => Promise<unknown>) => Promise<unknown> }).$transaction(async (tx) => {
    const reorderNumber = await generateReorderNumber(tx);

    const created = await tx.stockReorder.create({
      data: {
        reorderNumber,
        status: 'PENDING',
        items: {
          create: Array.from(shortfallMap.entries()).map(([itemId, data]) => ({
            itemId,
            requiredQty: data.totalShortfall,
            rate: priceMap.get(itemId) ?? 0,
          })),
        },
      },
      include: {
        items: { select: { id: true, itemId: true } },
      },
    });

    // Map itemId → reorderItemId for junction rows
    const itemToReorderItemId = new Map(
      created.items.map((ri: { id: string; itemId: string }) => [ri.itemId, ri.id])
    );

    const junctionRows: {
      salesOrderId: string;
      reorderId: string;
      reorderItemId: string;
      shortfallQty: number;
    }[] = [];

    for (const [itemId, data] of shortfallMap.entries()) {
      const reorderItemId = itemToReorderItemId.get(itemId);
      if (!reorderItemId) continue;
      for (const { salesOrderId, shortfallQty } of data.soBreakdown) {
        junctionRows.push({
          salesOrderId,
          reorderId: created.id,
          reorderItemId,
          shortfallQty,
        });
      }
    }

    await tx.salesOrderReorder.createMany({ data: junctionRows });

    return created;
  });

  return {
    reorderId: reorder.id,
    reorderNumber: reorder.reorderNumber,
    shortfallCount: shortfallMap.size,
    affectedOrderIds,
    message: `Reorder ${reorder.reorderNumber} created with ${shortfallMap.size} item(s) across ${affectedOrderIds.length} order(s).`,
  };
}
