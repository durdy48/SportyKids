/**
 * Redis-backed cache provider using ioredis.
 *
 * Implements CacheProvider for drop-in replacement of InMemoryCache.
 * All operations are async (returns Promises).
 *
 * Install: npm install ioredis (added as optionalDependency)
 * Config:  CACHE_PROVIDER=redis REDIS_URL=redis://localhost:6379
 */

import type { CacheProvider, CacheStats } from './cache';

const KEY_PREFIX = 'sk:'; // Namespace all keys to avoid collisions

/** Minimal interface for the Redis client methods we use */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, duration: number): Promise<string>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  scan(cursor: string, ...args: (string | number)[]): Promise<[string, string[]]>;
  quit(): Promise<string>;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Create a Redis client from ioredis (loaded dynamically).
 * Throws if ioredis is not installed.
 */
export function createRedisClient(redisUrl: string): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IORedis = require('ioredis');
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
  });
}

export class RedisCache implements CacheProvider {
  private client: RedisClient;
  private hits = 0;
  private misses = 0;
  private connected = false;

  constructor(redisUrlOrClient: string | RedisClient) {
    if (typeof redisUrlOrClient === 'string') {
      this.client = createRedisClient(redisUrlOrClient);
    } else {
      this.client = redisUrlOrClient;
    }

    this.client.on('connect', () => {
      this.connected = true;
      console.log('[redis-cache] Connected');
    });

    this.client.on('error', (err: Error) => {
      this.connected = false;
      console.error('[redis-cache] Error:', err.message);
    });

    this.client.on('close', () => {
      this.connected = false;
    });
  }

  private prefixedKey(key: string): string {
    return KEY_PREFIX + key;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client.get(this.prefixedKey(key));
      if (raw === null) {
        this.misses++;
        return undefined;
      }
      this.hits++;
      return JSON.parse(raw) as T;
    } catch {
      this.misses++;
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.set(this.prefixedKey(key), serialized, 'PX', ttlMs);
    } catch {
      // Silently fail — cache writes are non-critical
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(this.prefixedKey(key));
      return exists === 1;
    } catch {
      return false;
    }
  }

  async invalidate(key: string): Promise<boolean> {
    try {
      const deleted = await this.client.del(this.prefixedKey(key));
      return deleted === 1;
    } catch {
      return false;
    }
  }

  async invalidatePattern(prefix: string): Promise<number> {
    try {
      const pattern = this.prefixedKey(prefix) + '*';
      let cursor = '0';
      let count = 0;

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');

      return count;
    } catch {
      return 0;
    }
  }

  async clear(): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          KEY_PREFIX + '*',
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
      this.hits = 0;
      this.misses = 0;
    } catch {
      // Silently fail
    }
  }

  get size(): Promise<number> {
    return (async () => {
      try {
        let cursor = '0';
        let count = 0;
        do {
          const [nextCursor, keys] = await this.client.scan(
            cursor,
            'MATCH',
            KEY_PREFIX + '*',
            'COUNT',
            100,
          );
          cursor = nextCursor;
          count += keys.length;
        } while (cursor !== '0');
        return count;
      } catch {
        return 0;
      }
    })();
  }

  get stats(): Promise<CacheStats> {
    return (async () => {
      const currentSize = await this.size;
      return {
        size: currentSize,
        maxEntries: -1, // Redis handles its own memory management
        hits: this.hits,
        misses: this.misses,
        hitRate:
          this.hits + this.misses > 0
            ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + '%'
            : '0%',
      };
    })();
  }

  /** Gracefully close the Redis connection */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /** Whether the client is currently connected */
  get isConnected(): boolean {
    return this.connected;
  }
}
