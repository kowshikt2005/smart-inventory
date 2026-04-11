import { PrismaClient } from '@/generated/prisma';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
type DbOrTxClient = PrismaClient | TxClient;
type RawNumberClient = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

// System user ID for operations before auth is implemented
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

function parseMaxSequence(rows: Array<{ max_num: bigint | number | null }>): number {
  const raw = rows?.[0]?.max_num;
  if (typeof raw === 'bigint') return Number(raw);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getMaxPurchaseOrderSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(orderNumber, 4) AS UNSIGNED)) AS max_num
      FROM purchase_orders
      WHERE orderNumber REGEXP '^PO-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

async function getMaxPurchaseInvoiceSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(invoiceNumber, 4) AS UNSIGNED)) AS max_num
      FROM purchase_invoices
      WHERE invoiceNumber REGEXP '^PI-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

async function getMaxVendorPaymentSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(paymentNumber, 4) AS UNSIGNED)) AS max_num
      FROM vendor_payments
      WHERE paymentNumber REGEXP '^VP-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

async function getMaxPurchaseReturnSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(returnNumber, 4) AS UNSIGNED)) AS max_num
      FROM purchase_returns
      WHERE returnNumber REGEXP '^PR-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

/**
 * Run number generation while holding a named MySQL lock.
 * For pooled clients we wrap in $transaction to keep lock + read + release
 * on the same physical connection. For tx clients, queries are already pinned.
 */
async function withPurchaseNumberLock<T>(
  db: DbOrTxClient,
  lockName: string,
  fn: (conn: DbOrTxClient) => Promise<T>
): Promise<T> {
  const runWithConnection = async (conn: DbOrTxClient): Promise<T> => {
    const result = await conn.$queryRawUnsafe<{ lock_result: number }[]>(
      `SELECT GET_LOCK(?, 10) as lock_result`,
      lockName
    );
    if (!result[0] || result[0].lock_result !== 1) {
      throw new Error(`Failed to acquire lock for ${lockName} generation`);
    }

    try {
      return await fn(conn);
    } finally {
      await conn.$queryRawUnsafe(`SELECT RELEASE_LOCK(?)`, lockName);
    }
  };

  if ('$transaction' in db && typeof db.$transaction === 'function') {
    return db.$transaction(async (tx) => runWithConnection(tx as DbOrTxClient), { timeout: 15000 });
  }

  return runWithConnection(db);
}

/**
 * Generate the next purchase order number in sequence (PO-0001, PO-0002, etc.)
 */
export async function generatePurchaseOrderNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `PO-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withPurchaseNumberLock(db, 'po_number_lock', async (conn) => {
      const maxNum = await getMaxPurchaseOrderSequence(conn as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('PO number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxPurchaseOrderSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Generate the next purchase invoice number in sequence (PI-0001, PI-0002, etc.)
 */
export async function generatePurchaseInvoiceNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `PI-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withPurchaseNumberLock(db, 'pi_number_lock', async (conn) => {
      const maxNum = await getMaxPurchaseInvoiceSequence(conn as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('PI number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxPurchaseInvoiceSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Generate the next vendor payment number in sequence (VP-0001, VP-0002, etc.)
 */
export async function generateVendorPaymentNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `VP-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withPurchaseNumberLock(db, 'vp_number_lock', async (conn) => {
      const maxNum = await getMaxVendorPaymentSequence(conn as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('VP number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxVendorPaymentSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Generate the next purchase return number in sequence (PR-0001, PR-0002, etc.)
 */
export async function generatePurchaseReturnNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `PR-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withPurchaseNumberLock(db, 'pr_number_lock', async (conn) => {
      const maxNum = await getMaxPurchaseReturnSequence(conn as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('PR number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxPurchaseReturnSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Calculate tax amount based on taxable amount and rate
 */
export function calculateTax(amount: number, taxRate: number): { taxAmount: number; cgst: number; sgst: number } {
  const taxAmount = amount * (taxRate / 100);
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  return {
    taxAmount: Math.round(taxAmount * 1000) / 1000,
    cgst: Math.round(cgst * 1000) / 1000,
    sgst: Math.round(sgst * 1000) / 1000,
  };
}

/**
 * Calculate line item totals for purchase documents
 */
export function calculatePurchaseLineItem(
  quantity: number,
  rate: number,
  taxRate: number
): {
  amount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const amount = quantity * rate;
  const { taxAmount } = calculateTax(amount, taxRate);
  const totalAmount = amount + taxAmount;

  return {
    amount: Math.round(amount * 1000) / 1000,
    taxAmount: Math.round(taxAmount * 1000) / 1000,
    totalAmount: Math.round(totalAmount * 1000) / 1000,
  };
}

/**
 * Calculate purchase document totals from line items
 */
export function calculatePurchaseTotals(
  items: Array<{ amount: number; taxAmount: number }>,
  roundOff: number = 0
): {
  subtotal: number;
  totalTax: number;
  totalAmount: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalAmount = subtotal + totalTax + roundOff;

  return {
    subtotal: Math.round(subtotal * 1000) / 1000,
    totalTax: Math.round(totalTax * 1000) / 1000,
    totalAmount: Math.round(totalAmount * 1000) / 1000,
  };
}

/**
 * Purchase Order status transition validation
 * OPEN -> PARTIAL -> RECEIVED
 * OPEN -> CANCELLED
 * PARTIAL -> CANCELLED (optional)
 */
export const PO_STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['PARTIAL', 'RECEIVED', 'CANCELLED'],
  PARTIAL: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidPOStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = PO_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

/**
 * Purchase Invoice status transition validation
 * PENDING -> PAID
 * PENDING -> OVERDUE (automatic based on due date)
 * PENDING -> CANCELLED
 * OVERDUE -> PAID
 * OVERDUE -> CANCELLED
 */
export const PI_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['PAID', 'CANCELLED'],
  PAID: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidPIStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = PI_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

/**
 * Purchase Return status transition validation
 * OPEN -> COMPLETED
 * OPEN -> CANCELLED
 */
export const PR_STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidPRStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = PR_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
