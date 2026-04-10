import { PrismaClient } from '@/generated/prisma';

// Prisma interactive transaction client
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Run a callback while holding a named MySQL lock.
 * Uses $transaction to guarantee GET_LOCK, the callback, and RELEASE_LOCK
 * all execute on the SAME pooled connection. Without this, Prisma's pool
 * may assign different connections to each query, leaving stale locks.
 */
export async function withNumberLock<T>(
  db: PrismaClient,
  lockName: string,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    const result = await tx.$queryRawUnsafe<{ lock_result: number }[]>(
      `SELECT GET_LOCK(?, 5) as lock_result`, lockName
    );
    if (!result[0] || result[0].lock_result !== 1) {
      throw new Error(`Failed to acquire lock for ${lockName} generation`);
    }
    try {
      return await fn(tx);
    } finally {
      await tx.$queryRawUnsafe(`SELECT RELEASE_LOCK(?)`, lockName);
    }
  }, { timeout: 15000 });
}

/**
 * Generate the next invoice number in sequence (INV-0001, INV-0002, etc.)
 */
export async function generateInvoiceNumber(db: PrismaClient): Promise<string> {
  return withNumberLock(db, 'inv_number_lock', async (tx) => {
    const lastInvoice = await tx.invoice.findFirst({
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    let nextNum = 1;
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `INV-${String(nextNum).padStart(4, '0')}`;
  });
}

/**
 * Generate the next dummy invoice number in sequence (DI-0001, DI-0002, etc.)
 */
export async function generateDummyInvoiceNumber(db: PrismaClient): Promise<string> {
  return withNumberLock(db, 'di_number_lock', async (tx) => {
    const lastInvoice = await tx.invoice.findFirst({
      where: { invoiceNumber: { startsWith: 'DI-' } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    let nextNum = 1;
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/DI-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `DI-${String(nextNum).padStart(4, '0')}`;
  });
}

/**
 * Generate the next payment number in sequence (PAY-0001, PAY-0002, etc.)
 */
export async function generatePaymentNumber(db: PrismaClient): Promise<string> {
  return withNumberLock(db, 'pay_number_lock', async (tx) => {
    const lastPayment = await tx.payment.findFirst({
      orderBy: { paymentNumber: 'desc' },
      select: { paymentNumber: true },
    });
    let nextNum = 1;
    if (lastPayment) {
      const match = lastPayment.paymentNumber.match(/PAY-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `PAY-${String(nextNum).padStart(4, '0')}`;
  });
}

/**
 * Generate the next sales return number in sequence (SR-0001, SR-0002, etc.)
 */
export async function generateReturnNumber(db: PrismaClient): Promise<string> {
  return withNumberLock(db, 'sr_number_lock', async (tx) => {
    const lastReturn = await tx.salesReturn.findFirst({
      orderBy: { returnNumber: 'desc' },
      select: { returnNumber: true },
    });
    let nextNum = 1;
    if (lastReturn) {
      const match = lastReturn.returnNumber.match(/SR-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `SR-${String(nextNum).padStart(4, '0')}`;
  });
}

/**
 * Generate the next stock journal number in sequence (SJ-0001, SJ-0002, etc.)
 */
export async function generateJournalNumber(db: PrismaClient): Promise<string> {
  return withNumberLock(db, 'sj_number_lock', async (tx) => {
    const lastJournal = await tx.stockJournal.findFirst({
      orderBy: { journalNumber: 'desc' },
      select: { journalNumber: true },
    });
    let nextNum = 1;
    if (lastJournal) {
      const match = lastJournal.journalNumber.match(/SJ-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `SJ-${String(nextNum).padStart(4, '0')}`;
  });
}

/**
 * Calculate due date based on customer credit days
 */
export function calculateDueDate(invoiceDate: Date, creditDays: number): Date {
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + creditDays);
  return dueDate;
}

/**
 * Check if invoice is overdue
 */
export function isInvoiceOverdue(dueDate: Date | null, balanceAmount: number): boolean {
  if (!dueDate || balanceAmount <= 0) return false;
  return new Date() > new Date(dueDate);
}

/**
 * Calculate customer running balance from ledger entries
 */
export async function getCustomerBalance(db: PrismaClient, customerId: string): Promise<number> {
  const result = await db.customerLedger.aggregate({
    where: { customerId },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const totalDebit = Number(result._sum.debit || 0);
  const totalCredit = Number(result._sum.credit || 0);

  return totalDebit - totalCredit;
}
