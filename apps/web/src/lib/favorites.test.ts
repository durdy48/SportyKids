import { describe, it, expect, beforeEach } from 'vitest';
import { getFavorites, toggleFavorite, isFavorite } from './favorites';

describe('favorites', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no favorites exist', () => {
    expect(getFavorites()).toEqual([]);
  });

  it('adds a favorite and returns true', () => {
    const result = toggleFavorite('news1');
    expect(result).toBe(true);
    expect(isFavorite('news1')).toBe(true);
  });

  it('removes a favorite and returns false', () => {
    toggleFavorite('news1'); // add
    const result = toggleFavorite('news1'); // remove
    expect(result).toBe(false);
    expect(isFavorite('news1')).toBe(false);
  });

  it('adds newest favorites first (unshift)', () => {
    toggleFavorite('news1');
    toggleFavorite('news2');
    const favs = getFavorites();
    expect(favs[0]).toBe('news2');
    expect(favs[1]).toBe('news1');
  });

  it('limits favorites to 100 items', () => {
    for (let i = 0; i < 105; i++) {
      toggleFavorite(`news${i}`);
    }
    const favs = getFavorites();
    expect(favs).toHaveLength(100);
    // The oldest should have been evicted
    expect(favs).not.toContain('news0');
    expect(favs).toContain('news104');
  });
});
