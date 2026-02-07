import { PrismaClient, Prisma } from '@/generated/prisma'

/**
 * Prisma Client Singleton for Prisma 7+
 * Prevents multiple instances in development due to hot-reloading
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  // Reduce logging overhead - only log errors (queries were adding latency)
  log: ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Interactive transaction wrapper with timeouts appropriate for remote DB (Railway).
// Prisma's default interactive transaction timeout is 5s — too low when each query
// round-trips over the network. All $transaction calls should use this helper.
export async function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> {
  return db.$transaction(fn, { maxWait: 10000, timeout: 30000, ...options })
}

export default db
