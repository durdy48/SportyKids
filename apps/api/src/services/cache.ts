/**
 * In-memory cache with TTL support for API responses.
 *
 * Features:
 * - Per-key TTL (time-to-live)
 * - Max entries eviction (LRU-like, evicts oldest)
 * - Pattern-based invalidation
 * - Statistics tracking
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix pattern.
   * Example: invalidatePattern('news:') removes all keys starting with 'news:'
   */
  invalidatePattern(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.store.size;
  }

  get stats() {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? (this.hits / (this.hits + this.misses) * 100).toFixed(1) + '%'
        : '0%',
    };
  }
}

// Singleton cache instance
export const apiCache = new InMemoryCache(10_000);

// Predefined TTLs (in ms)
export const CACHE_TTL = {
  NEWS: 5 * 60 * 1000,           // 5 minutes
  TEAM_STATS: 60 * 60 * 1000,    // 1 hour
  STICKERS_CATALOG: 24 * 60 * 60 * 1000, // 24 hours
  SOURCES: 10 * 60 * 1000,       // 10 minutes
  TRENDING: 5 * 60 * 1000,       // 5 minutes
  READING_HISTORY: 2 * 60 * 1000, // 2 minutes
} as const;

// Cache key builders
export const CACHE_KEYS = {
  news: (params: string) => `news:${params}`,
  newsItem: (id: string) => `news:item:${id}`,
  teamStats: (team: string) => `team:stats:${team}`,
  stickersCatalog: () => 'stickers:catalog',
  trending: () => 'news:trending',
  sources: () => 'sources:list',
  sourcesCatalog: () => 'sources:catalog',
  readingHistory: (userId: string) => `history:${userId}`,
  recommendations: (id: string) => `recommendations:${id}`,
} as const;

/**
 * Express middleware factory that caches JSON responses.
 * Usage: router.get('/path', withCache('prefix:', CACHE_TTL.NEWS), handler)
 */
import type { Request, Response, NextFunction } from 'express';

export function withCache(keyPrefix: string, ttlMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = keyPrefix + req.originalUrl;
    const cached = apiCache.get<{ body: unknown; status: number }>(cacheKey);

    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    // Monkey-patch res.json to intercept and cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only cache successful responses
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 300) {
        apiCache.set(cacheKey, { body, status: statusCode }, ttlMs);
      }
      return originalJson(body);
    };

    next();
  };
}
