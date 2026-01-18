import { PrismaClient } from '@/generated/prisma'

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

export default db
