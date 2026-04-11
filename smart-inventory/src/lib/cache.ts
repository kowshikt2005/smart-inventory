/**
 * Simple in-memory cache for API responses
 * For production with multiple instances, consider using Redis instead
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
      // Do not keep the Node.js event loop alive only for cache cleanup.
      this.cleanupInterval.unref?.();
    }
  }

  /**
   * Get a cached value or execute the factory function
   * @param key - Cache key
   * @param factory - Function to generate value if not cached
   * @param ttlSeconds - Time to live in seconds (default: 30)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 30
  ): Promise<T> {
    const now = Date.now();
    const existing = this.cache.get(key) as CacheEntry<T> | undefined;

    if (existing && existing.expiresAt > now) {
      return existing.data;
    }

    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const inFlightPromise = (async () => {
      const data = await factory();
      this.cache.set(key, {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return data;
    })();

    this.inFlight.set(key, inFlightPromise);

    try {
      return await inFlightPromise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /**
   * Manually set a cache value
   */
  set<T>(key: string, data: T, ttlSeconds: number = 30): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    return undefined;
  }

  /**
   * Delete a single cache entry by exact key
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(escapeRegExp(pattern)) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.inFlight.delete(key);
      }
    }
  }

  /**
   * Invalidate all keys with a common prefix.
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        this.inFlight.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance with global persistence in development
const globalForCache = globalThis as unknown as {
  cache: SimpleCache | undefined;
};

export const cache = globalForCache.cache ?? new SimpleCache();

if (process.env.NODE_ENV !== 'production') {
  globalForCache.cache = cache;
}

// Cache key generators for common patterns
export const cacheKeys = {
  rateSheet: (customerId: string) => `rate-sheet:${customerId}`,
  stockAllocation: () => 'stock-allocation',
  customerLedger: (customerId: string) => `customer-ledger:${customerId}`,
  itemLedger: (itemId: string) => `item-ledger:${itemId}`,
  invoiceStats: () => 'invoice-stats',
};

// Cache TTL constants (in seconds)
export const cacheTTL = {
  SHORT: 30,      // 30 seconds - for frequently changing data
  MEDIUM: 300,    // 5 minutes - for moderately changing data
  LONG: 900,      // 15 minutes - for rarely changing data
  RATE_SHEET: 600, // 10 minutes - rate sheets change infrequently
};

export default cache;
