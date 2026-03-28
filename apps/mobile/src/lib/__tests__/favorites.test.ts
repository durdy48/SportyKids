import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'sportykids_favorites';

describe('favorites', () => {
  // We need to re-import the module for each test to reset the in-memory cache.
  // The module has a `cachedFavorites` variable that persists across calls.

  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.setItem).mockReset();
    vi.resetModules();
  });

  async function loadModule() {
    return import('../favorites');
  }

  // -------------------------------------------------------------------------
  // getFavorites
  // -------------------------------------------------------------------------

  describe('getFavorites', () => {
    it('returns empty array when nothing stored', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
      const { getFavorites } = await loadModule();

      const favs = await getFavorites();
      expect(favs).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(FAVORITES_KEY);
    });

    it('parses stored JSON favorites', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(['a', 'b']));
      const { getFavorites } = await loadModule();

      const favs = await getFavorites();
      expect(favs).toEqual(['a', 'b']);
    });

    it('uses in-memory cache on second call', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(['x']));
      const { getFavorites } = await loadModule();

      await getFavorites();
      await getFavorites();
      // AsyncStorage.getItem should only be called once due to caching
      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // toggleFavorite
  // -------------------------------------------------------------------------

  describe('toggleFavorite', () => {
    it('adds a new favorite and returns true', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify([]));
      const { toggleFavorite } = await loadModule();

      const added = await toggleFavorite('news-1');
      expect(added).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        FAVORITES_KEY,
        expect.stringContaining('news-1'),
      );
    });

    it('removes an existing favorite and returns false', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(['news-1', 'news-2']));
      const { toggleFavorite } = await loadModule();

      const result = await toggleFavorite('news-1');
      expect(result).toBe(false);
    });

    it('enforces max 100 favorites', async () => {
      const hundredIds = Array.from({ length: 100 }, (_, i) => `id-${i}`);
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(hundredIds));
      const { toggleFavorite } = await loadModule();

      await toggleFavorite('new-id');

      // The stored value should have the new id at front and 100 total (oldest evicted)
      const storedCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const stored = JSON.parse(storedCall[1]);
      expect(stored[0]).toBe('new-id');
      expect(stored.length).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // isFavorite
  // -------------------------------------------------------------------------

  describe('isFavorite', () => {
    it('returns true for favorited item', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(['abc']));
      const { isFavorite } = await loadModule();

      expect(await isFavorite('abc')).toBe(true);
    });

    it('returns false for non-favorited item', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(['abc']));
      const { isFavorite } = await loadModule();

      expect(await isFavorite('xyz')).toBe(false);
    });
  });
});
