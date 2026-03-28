import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCache, type RedisClient } from '../../services/redis-cache';

// ---------------------------------------------------------------------------
// Mock Redis client — injected directly into RedisCache constructor
// ---------------------------------------------------------------------------

function createMockRedisClient(): RedisClient & { _listeners: Record<string, Array<(...args: unknown[]) => void>> } {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    _listeners: listeners,
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    scan: vi.fn(),
    quit: vi.fn(),
    on(event: string, callback: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },
  };
}

describe('RedisCache', () => {
  let cache: RedisCache;
  let mockClient: ReturnType<typeof createMockRedisClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockRedisClient();
    cache = new RedisCache(mockClient);
    // Simulate connection
    mockClient._listeners['connect']?.forEach((cb) => cb());
  });

  describe('get', () => {
    it('returns parsed value on cache hit', async () => {
      (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ data: 'hello' }));
      const result = await cache.get<{ data: string }>('mykey');
      expect(result).toEqual({ data: 'hello' });
      expect(mockClient.get).toHaveBeenCalledWith('sk:mykey');
    });

    it('returns undefined on cache miss', async () => {
      (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await cache.get('missing');
      expect(result).toBeUndefined();
    });

    it('returns undefined on Redis error', async () => {
      (mockClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));
      const result = await cache.get('key');
      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('serializes value and sets with PX expiry', async () => {
      (mockClient.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      await cache.set('key1', { value: 42 }, 5000);
      expect(mockClient.set).toHaveBeenCalledWith(
        'sk:key1',
        JSON.stringify({ value: 42 }),
        'PX',
        5000,
      );
    });

    it('silently fails on Redis error', async () => {
      (mockClient.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('write error'));
      await expect(cache.set('key', 'val', 1000)).resolves.toBeUndefined();
    });
  });

  describe('has', () => {
    it('returns true when key exists', async () => {
      (mockClient.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      expect(await cache.has('key')).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      (mockClient.exists as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      expect(await cache.has('nope')).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('returns true when key was deleted', async () => {
      (mockClient.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      expect(await cache.invalidate('key')).toBe(true);
    });

    it('returns false when key was not found', async () => {
      (mockClient.del as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      expect(await cache.invalidate('nope')).toBe(false);
    });
  });

  describe('invalidatePattern', () => {
    it('scans and deletes matching keys', async () => {
      (mockClient.scan as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['0', ['sk:news:1', 'sk:news:2']]);
      (mockClient.del as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const count = await cache.invalidatePattern('news:');
      expect(count).toBe(2);
      expect(mockClient.scan).toHaveBeenCalledWith(
        '0', 'MATCH', 'sk:news:*', 'COUNT', 100,
      );
    });

    it('returns 0 on error', async () => {
      (mockClient.scan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('scan fail'));
      expect(await cache.invalidatePattern('x:')).toBe(0);
    });
  });

  describe('clear', () => {
    it('scans and deletes all prefixed keys', async () => {
      (mockClient.scan as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['0', ['sk:a', 'sk:b']]);
      (mockClient.del as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await cache.clear();
      expect(mockClient.scan).toHaveBeenCalled();
      expect(mockClient.del).toHaveBeenCalledWith('sk:a', 'sk:b');
    });
  });

  describe('stats', () => {
    it('tracks hits and misses', async () => {
      (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify('val'));
      await cache.get('hit');

      (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await cache.get('miss');

      (mockClient.scan as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['0', []]);

      const stats = await cache.stats;
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('50.0%');
      expect(stats.maxEntries).toBe(-1);
    });
  });

  describe('disconnect', () => {
    it('calls quit on the Redis client', async () => {
      (mockClient.quit as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      await cache.disconnect();
      expect(mockClient.quit).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('returns true after connect event', () => {
      expect(cache.isConnected).toBe(true);
    });

    it('returns false after error event', () => {
      mockClient._listeners['error']?.forEach((cb) => cb(new Error('fail')));
      expect(cache.isConnected).toBe(false);
    });

    it('returns false after close event', () => {
      mockClient._listeners['close']?.forEach((cb) => cb());
      expect(cache.isConnected).toBe(false);
    });
  });
});
