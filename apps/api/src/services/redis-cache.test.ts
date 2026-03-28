import { describe, it, expect, vi } from 'vitest';
import { RedisCache, RedisClient } from './redis-cache';

function createMockClient(): RedisClient & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const listeners = new Map<string, (...args: unknown[]) => void>();

  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return count;
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    scan: vi.fn(async (_cursor: string, ..._args: (string | number)[]) => {
      // Simple mock: return all matching keys in one pass
      const matchArg = _args.indexOf('MATCH');
      const pattern = matchArg >= 0 ? String(_args[matchArg + 1]) : '*';
      const prefix = pattern.replace('*', '');
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix));
      return ['0', keys] as [string, string[]];
    }),
    quit: vi.fn(async () => 'OK'),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners.set(event, cb);
    }),
  };
}

describe('RedisCache', () => {
  it('get/set round-trip with JSON serialization', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('test-key', { foo: 'bar', num: 42 }, 5000);
    const result = await cache.get<{ foo: string; num: number }>('test-key');

    expect(result).toEqual({ foo: 'bar', num: 42 });
    expect(mock.set).toHaveBeenCalledWith('sk:test-key', JSON.stringify({ foo: 'bar', num: 42 }), 'PX', 5000);
  });

  it('get returns undefined for missing key', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    const result = await cache.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('has returns true for existing key and false for missing', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('exists', 'value', 1000);
    expect(await cache.has('exists')).toBe(true);
    expect(await cache.has('missing')).toBe(false);
  });

  it('invalidate deletes key and returns true', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('to-delete', 'val', 1000);
    const result = await cache.invalidate('to-delete');

    expect(result).toBe(true);
    expect(await cache.has('to-delete')).toBe(false);
  });

  it('invalidate returns false for nonexistent key', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    const result = await cache.invalidate('nope');
    expect(result).toBe(false);
  });

  it('invalidatePattern deletes matching keys', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('news:1', 'a', 1000);
    await cache.set('news:2', 'b', 1000);
    await cache.set('reels:1', 'c', 1000);

    const count = await cache.invalidatePattern('news:');
    expect(count).toBe(2);
    expect(await cache.has('news:1')).toBe(false);
    expect(await cache.has('reels:1')).toBe(true);
  });

  it('clear removes all prefixed keys', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('a', 1, 1000);
    await cache.set('b', 2, 1000);
    await cache.clear();

    expect(await cache.has('a')).toBe(false);
    expect(await cache.has('b')).toBe(false);
  });

  it('stats tracks hits and misses', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('hit-key', 'val', 1000);
    await cache.get('hit-key'); // hit
    await cache.get('miss-key'); // miss
    await cache.get('miss-key2'); // miss

    const stats = await cache.stats;
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBe('33.3%');
  });

  it('size counts prefixed keys', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('x', 1, 1000);
    await cache.set('y', 2, 1000);
    await cache.set('z', 3, 1000);

    const size = await cache.size;
    expect(size).toBe(3);
  });

  it('keys are namespaced with sk: prefix', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    await cache.set('my-key', 'val', 1000);
    expect(mock.store.has('sk:my-key')).toBe(true);
    expect(mock.store.has('my-key')).toBe(false);
  });

  it('handles client errors gracefully in get', async () => {
    const mock = createMockClient();
    const cache = new RedisCache(mock);

    mock.get = vi.fn(async () => { throw new Error('Connection lost'); });

    const result = await cache.get('key');
    expect(result).toBeUndefined();
  });
});
