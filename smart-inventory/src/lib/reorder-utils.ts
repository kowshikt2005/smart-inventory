import {
  calculateStockAllocation,
  calculateOrderStockStatus,
} from '@/lib/stock-allocation';
import { withNumberLock } from '@/lib/invoice-utils';

export interface ScanResult {
  skipped?: boolean;
  reorderId: string | null;
  reorderNumber?: string;
  shortfallCount: number;
  affectedOrderIds: string[];
  message: string;
}

type RawQueryClient = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

function parseMaxSequence(rows: Array<{ max_num: bigint | number | null }>): number {
  const raw = rows?.[0]?.max_num;
  if (typeof raw === 'bigint') return Number(raw);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getMaxReorderSequence(client: RawQueryClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(reorderNumber, 4) AS UNSIGNED)) AS max_num
      FROM stock_reorders
      WHERE reorderNumber REGEXP '^RO-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

/**
 * Generate the next reorder number in sequence (RO-0001, RO-0002, etc.)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function generateReorderNumber(db: any): Promise<string> {
  const format = (num: number) => `RO-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withNumberLock(db, 'reorder_number_lock', async (tx) => {
      const maxNum = await getMaxReorderSequence(tx as RawQueryClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('RO number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxReorderSequence(db as RawQueryClient);
    return format(maxNum);
  }
}

/**
 * Run the stock shortfall scan and create a StockReorder if shortfalls exist.
 * - Idempotent: skips if a non-CANCELLED reorder was already created today.
 * - Consolidates shortfall quantities across all Partial/Unavailable orders per item.
 */
export async function runStockScan(db: any): Promise<ScanResult> {
  const runCore = async (tx: any): Promise<ScanResult> => {
    // Idempotency: only one scan per calendar day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingToday = await tx.stockReorder.findFirst({
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
    const allocationResult = await calculateStockAllocation(tx);

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
    const itemRecords = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, purchasePrice: true },
    });
    const priceMap = new Map<string, number>((itemRecords as any[]).map((i) => [i.id, Number(i.purchasePrice)]));

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
    const itemToReorderItemId = new Map<string, string>(
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

    return {
      reorderId: created.id,
      reorderNumber: created.reorderNumber,
      shortfallCount: shortfallMap.size,
      affectedOrderIds,
      message: `Reorder ${created.reorderNumber} created with ${shortfallMap.size} item(s) across ${affectedOrderIds.length} order(s).`,
    } satisfies ScanResult;
  };

  try {
    return await withNumberLock(db, 'stock_scan_lock', runCore);
  } catch (error) {
    // Keep the feature available even if GET_LOCK is unavailable/contended.
    console.error('Stock scan lock path failed, using unlocked fallback:', error);
    return runCore(db);
  }
}
