import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryCache } from './cache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache(100);
  });

  it('stores and retrieves values', () => {
    cache.set('key1', { data: 'hello' }, 60_000);
    expect(cache.get('key1')).toEqual({ data: 'hello' });
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value', 1000);
    expect(cache.get('key1')).toBe('value');

    vi.advanceTimersByTime(1001);
    expect(cache.get('key1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('has() returns true for valid entries and false for expired', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value', 1000);
    expect(cache.has('key1')).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(cache.has('key1')).toBe(false);
    vi.useRealTimers();
  });

  it('invalidates a single key', () => {
    cache.set('key1', 'value', 60_000);
    expect(cache.invalidate('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('invalidates by prefix pattern', () => {
    cache.set('news:list:1', 'a', 60_000);
    cache.set('news:list:2', 'b', 60_000);
    cache.set('team:stats:rm', 'c', 60_000);

    const count = cache.invalidatePattern('news:');
    expect(count).toBe(2);
    expect(cache.get('news:list:1')).toBeUndefined();
    expect(cache.get('news:list:2')).toBeUndefined();
    expect(cache.get('team:stats:rm')).toBe('c');
  });

  it('evicts oldest entry when at max capacity', () => {
    const smallCache = new InMemoryCache(3);
    smallCache.set('a', 1, 60_000);
    smallCache.set('b', 2, 60_000);
    smallCache.set('c', 3, 60_000);

    // Adding a 4th should evict 'a' (the oldest)
    smallCache.set('d', 4, 60_000);
    expect(smallCache.get('a')).toBeUndefined();
    expect(smallCache.get('d')).toBe(4);
    expect(smallCache.size).toBe(3);
  });

  it('does not evict when updating an existing key', () => {
    const smallCache = new InMemoryCache(3);
    smallCache.set('a', 1, 60_000);
    smallCache.set('b', 2, 60_000);
    smallCache.set('c', 3, 60_000);

    // Updating 'a' should not evict anything
    smallCache.set('a', 10, 60_000);
    expect(smallCache.get('a')).toBe(10);
    expect(smallCache.size).toBe(3);
  });

  it('tracks hit/miss stats', () => {
    cache.set('hit', 'yes', 60_000);
    cache.get('hit');   // hit
    cache.get('miss');  // miss
    cache.get('hit');   // hit

    const stats = cache.stats;
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });

  it('clear() resets everything', () => {
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});
