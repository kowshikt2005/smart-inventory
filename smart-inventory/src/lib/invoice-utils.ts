import { PrismaClient } from '@/generated/prisma';

// Prisma interactive transaction client
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
type DbOrTxClient = PrismaClient | TxClient;
type RawNumberClient = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

function parseMaxSequence(rows: Array<{ max_num: bigint | number | null }>): number {
  const raw = rows?.[0]?.max_num;
  if (typeof raw === 'bigint') return Number(raw);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getMaxInvoiceSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(invoiceNumber, 5) AS UNSIGNED)) AS max_num
      FROM invoices
      WHERE invoiceNumber REGEXP '^INV-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

async function getMaxDummyInvoiceSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(invoiceNumber, 4) AS UNSIGNED)) AS max_num
      FROM invoices
      WHERE invoiceNumber REGEXP '^DI-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

async function getMaxPaymentSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(paymentNumber, 5) AS UNSIGNED)) AS max_num
      FROM payments
      WHERE paymentNumber REGEXP '^PAY-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

async function getMaxReturnSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(returnNumber, 4) AS UNSIGNED)) AS max_num
      FROM sales_returns
      WHERE returnNumber REGEXP '^SR-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

async function getMaxJournalSequence(client: RawNumberClient): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ max_num: bigint | number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING(journalNumber, 4) AS UNSIGNED)) AS max_num
      FROM stock_journals
      WHERE journalNumber REGEXP '^SJ-[0-9]+$'
    `
  );
  return parseMaxSequence(rows);
}

/**
 * Run a callback while holding a named MySQL lock.
 * Uses $transaction to guarantee GET_LOCK, the callback, and RELEASE_LOCK
 * all execute on the SAME pooled connection. Without this, Prisma's pool
 * may assign different connections to each query, leaving stale locks.
 */
export async function withNumberLock<T>(
  db: DbOrTxClient,
  lockName: string,
  fn: (tx: DbOrTxClient) => Promise<T>
): Promise<T> {
  const runWithConnection = async (conn: DbOrTxClient): Promise<T> => {
    // Release any stale lock this session may hold from a previously crashed request.
    // RELEASE_LOCK is a no-op (returns 0) if this session does not currently hold it,
    // so this is safe to call unconditionally before acquiring.
    await conn.$queryRawUnsafe(`SELECT RELEASE_LOCK(?)`, lockName);

    const result = await conn.$queryRawUnsafe<{ lock_result: bigint | number | null }[]>(
      `SELECT GET_LOCK(?, 10) as lock_result`, lockName
    );
    // Prisma 6 + MySQL returns BigInt for raw numeric results. Use Number() to
    // normalise before comparing — 1n !== 1 in JS strict equality.
    if (!result[0] || Number(result[0].lock_result) !== 1) {
      throw new Error(`Failed to acquire lock for ${lockName} generation`);
    }
    try {
      return await fn(conn);
    } finally {
      await conn.$queryRawUnsafe(`SELECT RELEASE_LOCK(?)`, lockName);
    }
  };

  if ('$transaction' in db && typeof db.$transaction === 'function') {
    return db.$transaction(async (tx) => runWithConnection(tx as DbOrTxClient), {
      maxWait: 10000, // match db.ts transaction helper — needed for AWS RDS pool latency
      timeout: 15000,
    });
  }

  return runWithConnection(db);
}

/**
 * Generate the next invoice number in sequence (INV-0001, INV-0002, etc.)
 */
export async function generateInvoiceNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `INV-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withNumberLock(db, 'inv_number_lock', async (tx) => {
      const maxNum = await getMaxInvoiceSequence(tx as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('INV number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxInvoiceSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Generate the next dummy invoice number in sequence (DI-0001, DI-0002, etc.)
 */
export async function generateDummyInvoiceNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `DI-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withNumberLock(db, 'di_number_lock', async (tx) => {
      const maxNum = await getMaxDummyInvoiceSequence(tx as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('DI number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxDummyInvoiceSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Generate the next payment number in sequence (PAY-0001, PAY-0002, etc.)
 */
export async function generatePaymentNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `PAY-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withNumberLock(db, 'pay_number_lock', async (tx) => {
      const maxNum = await getMaxPaymentSequence(tx as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('PAY number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxPaymentSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Generate the next sales return number in sequence (SR-0001, SR-0002, etc.)
 */
export async function generateReturnNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `SR-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withNumberLock(db, 'sr_number_lock', async (tx) => {
      const maxNum = await getMaxReturnSequence(tx as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('SR number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxReturnSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
}

/**
 * Generate the next stock journal number in sequence (SJ-0001, SJ-0002, etc.)
 */
export async function generateJournalNumber(db: DbOrTxClient): Promise<string> {
  const format = (num: number) => `SJ-${String(num + 1).padStart(4, '0')}`;
  try {
    return await withNumberLock(db, 'sj_number_lock', async (tx) => {
      const maxNum = await getMaxJournalSequence(tx as unknown as RawNumberClient);
      return format(maxNum);
    });
  } catch (error) {
    console.error('SJ number lock path failed, using unlocked fallback:', error);
    const maxNum = await getMaxJournalSequence(db as unknown as RawNumberClient);
    return format(maxNum);
  }
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
export async function getCustomerBalance(db: DbOrTxClient, customerId: string): Promise<number> {
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
