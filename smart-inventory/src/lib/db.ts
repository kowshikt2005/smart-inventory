import { PrismaClient } from '@/generated/prisma'

/**
 * Prisma Client Singleton for Prisma 7+
 * Prevents multiple instances in development due to hot-reloading
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  transactionOptions: {
    maxWait: 10000, // 10 seconds to acquire a transaction
    timeout: 10000, // 10 seconds for the transaction to complete
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export default db
