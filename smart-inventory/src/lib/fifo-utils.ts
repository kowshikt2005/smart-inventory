import { PrismaClient, StockMovementType } from '@/generated/prisma';
import type { Prisma } from '@/generated/prisma';

/**
 * FIFO (First-In-First-Out) utilities for ledger management
 *
 * FIFO Principle:
 * - Oldest transactions are processed first
 * - Sorting: date ASC, createdAt ASC
 * - Used for: Payment allocation, stock valuation, aging reports
 */

// ============================================
// CUSTOMER LEDGER FIFO
// ============================================

/**
 * Get customer ledger entries in FIFO order (oldest first)
 */
export async function getCustomerLedgerFIFO(
  db: PrismaClient,
  customerId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.CustomerLedgerWhereInput = {
    customerId,
  };

  if (options?.startDate || options?.endDate) {
    where.date = {};
    if (options.startDate) {
      where.date.gte = options.startDate;
    }
    if (options.endDate) {
      where.date.lte = options.endDate;
    }
  }

  return db.customerLedger.findMany({
    where,
    orderBy: [
      { date: 'asc' },      // FIFO: oldest date first
      { createdAt: 'asc' }, // Within same date, earliest created first
    ],
    skip: options?.offset,
    take: options?.limit,
  });
}

/**
 * Get outstanding invoices for a customer in FIFO order
 * Returns unpaid/partially paid invoices sorted by date (oldest first)
 */
export async function getOutstandingInvoicesFIFO(
  db: PrismaClient,
  customerId: string
) {
  return db.invoice.findMany({
    where: {
      customerId,
      balanceAmount: {
        gt: 0,
      },
      paymentStatus: {
        in: ['PENDING', 'PARTIAL', 'OVERDUE'],
      },
    },
    orderBy: [
      { invoiceDate: 'asc' },  // FIFO: oldest invoice first
      { createdAt: 'asc' },
    ],
    include: {
      customer: {
        select: {
          id: true,
          customerNumber: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Allocate payment to invoices using FIFO
 * Pays oldest invoices first until payment amount is exhausted
 */
export async function allocatePaymentFIFO(
  db: PrismaClient,
  customerId: string,
  paymentAmount: number,
  _paymentId: string,
  _paymentDate: Date
): Promise<{
  allocations: Array<{ invoiceId: string; amount: number }>;
  remainingAmount: number;
}> {
  // Get outstanding invoices in FIFO order
  const invoices = await getOutstandingInvoicesFIFO(db, customerId);

  const allocations: Array<{ invoiceId: string; amount: number }> = [];
  let remainingAmount = paymentAmount;

  for (const invoice of invoices) {
    if (remainingAmount <= 0) break;

    const invoiceBalance = Number(invoice.balanceAmount);
    const allocationAmount = Math.min(remainingAmount, invoiceBalance);

    allocations.push({
      invoiceId: invoice.id,
      amount: allocationAmount,
    });

    remainingAmount -= allocationAmount;
  }

  return {
    allocations,
    remainingAmount,
  };
}

// ============================================
// VENDOR LEDGER FIFO
// ============================================

/**
 * Get vendor ledger entries in FIFO order (oldest first)
 */
export async function getVendorLedgerFIFO(
  db: PrismaClient,
  vendorId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.VendorLedgerWhereInput = {
    vendorId,
  };

  if (options?.startDate || options?.endDate) {
    where.date = {};
    if (options.startDate) {
      where.date.gte = options.startDate;
    }
    if (options.endDate) {
      where.date.lte = options.endDate;
    }
  }

  return db.vendorLedger.findMany({
    where,
    orderBy: [
      { date: 'asc' },      // FIFO: oldest date first
      { createdAt: 'asc' }, // Within same date, earliest created first
    ],
    skip: options?.offset,
    take: options?.limit,
  });
}

/**
 * Get outstanding purchase invoices for a vendor in FIFO order
 */
export async function getOutstandingPurchaseInvoicesFIFO(
  db: PrismaClient,
  vendorId: string
) {
  return db.purchaseInvoice.findMany({
    where: {
      vendorId,
      balanceAmount: {
        gt: 0,
      },
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
    },
    orderBy: [
      { date: 'asc' },      // FIFO: oldest invoice first
      { createdAt: 'asc' },
    ],
    include: {
      vendor: {
        select: {
          id: true,
          vendorNumber: true,
          name: true,
        },
      },
    },
  });
}

// ============================================
// STOCK LEDGER FIFO
// ============================================

/**
 * Get stock movements for an item in FIFO order
 * Used for stock valuation and tracking
 */
export async function getStockMovementsFIFO(
  db: PrismaClient,
  itemId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.StockMovementWhereInput = {
    itemId,
  };

  if (options?.type) {
    where.type = options.type as StockMovementType;
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  return db.stockMovement.findMany({
    where,
    orderBy: [
      { createdAt: 'asc' }, // FIFO: oldest movement first
    ],
    skip: options?.offset,
    take: options?.limit,
    include: {
      item: {
        select: {
          id: true,
          itemCode: true,
          name: true,
          unit: true,
        },
      },
    },
  });
}

/**
 * Calculate FIFO cost of goods sold
 * Uses FIFO method to calculate cost based on purchase order
 */
export async function calculateFIFOCost(
  db: PrismaClient,
  itemId: string,
  quantitySold: number
): Promise<{
  totalCost: number;
  averageCost: number;
  movements: Array<{
    quantity: number;
    rate: number;
    cost: number;
  }>;
}> {
  // Get all purchase movements in FIFO order
  const purchases = await db.stockMovement.findMany({
    where: {
      itemId,
      type: 'PURCHASE',
    },
    orderBy: [
      { createdAt: 'asc' }, // FIFO: oldest purchase first
    ],
  });

  const movements: Array<{
    quantity: number;
    rate: number;
    cost: number;
  }> = [];

  let remainingQty = quantitySold;
  let totalCost = 0;

  for (const purchase of purchases) {
    if (remainingQty <= 0) break;

    const purchaseQty = Number(purchase.quantity);
    const qtyToUse = Math.min(remainingQty, purchaseQty);

    // Note: We'd need to store purchase rate in stock movements
    // For now, assume we have it or fetch from purchase invoice
    const rate = 0; // TODO: Fetch actual purchase rate

    const cost = qtyToUse * rate;

    movements.push({
      quantity: qtyToUse,
      rate,
      cost,
    });

    totalCost += cost;
    remainingQty -= qtyToUse;
  }

  const averageCost = quantitySold > 0 ? totalCost / quantitySold : 0;

  return {
    totalCost,
    averageCost,
    movements,
  };
}

// ============================================
// AGING REPORTS (FIFO-based)
// ============================================

/**
 * Generate customer aging report using FIFO
 * Groups outstanding invoices by age buckets
 */
export async function getCustomerAgingReportFIFO(
  db: PrismaClient,
  customerId: string,
  asOfDate: Date = new Date()
) {
  const invoices = await getOutstandingInvoicesFIFO(db, customerId);

  const aging = {
    current: 0,      // 0-30 days
    days31to60: 0,   // 31-60 days
    days61to90: 0,   // 61-90 days
    over90: 0,       // > 90 days
    total: 0,
  };

  for (const invoice of invoices) {
    const balance = Number(invoice.balanceAmount);
    const invoiceDate = new Date(invoice.invoiceDate);
    const daysOld = Math.floor(
      (asOfDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysOld <= 30) {
      aging.current += balance;
    } else if (daysOld <= 60) {
      aging.days31to60 += balance;
    } else if (daysOld <= 90) {
      aging.days61to90 += balance;
    } else {
      aging.over90 += balance;
    }

    aging.total += balance;
  }

  return {
    customerId,
    asOfDate,
    aging,
    invoices: invoices.map((inv) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      amount: inv.totalAmount,
      balance: inv.balanceAmount,
      daysOld: Math.floor(
        (asOfDate.getTime() - new Date(inv.invoiceDate).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    })),
  };
}

/**
 * Get ledger balance at a specific date (FIFO order)
 */
export async function getCustomerBalanceAtDate(
  db: PrismaClient,
  customerId: string,
  asOfDate: Date
): Promise<number> {
  const entries = await db.customerLedger.findMany({
    where: {
      customerId,
      date: {
        lte: asOfDate,
      },
    },
    orderBy: [
      { date: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Return the last balance in FIFO order
  if (entries.length === 0) return 0;
  return Number(entries[entries.length - 1].balance);
}
