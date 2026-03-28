import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsItem } from '@sportykids/shared';

const STORAGE_KEY = 'sportykids_offline_articles';

// Helper to create a minimal NewsItem stub
function makeArticle(id: string): NewsItem {
  return { id, title: `Article ${id}`, sport: 'football' } as unknown as NewsItem;
}

describe('offline-cache', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.setItem).mockReset();
    vi.resetModules();
  });

  async function loadModule() {
    return import('../offline-cache');
  }

  // -------------------------------------------------------------------------
  // cacheArticleForOffline
  // -------------------------------------------------------------------------

  describe('cacheArticleForOffline', () => {
    it('stores an article in AsyncStorage', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      const { cacheArticleForOffline } = await loadModule();

      await cacheArticleForOffline(makeArticle('a1'));

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"a1"'),
      );
    });

    it('updates cachedAt when article already exists', async () => {
      const existing = [{ article: makeArticle('a1'), cachedAt: 1000 }];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(existing));
      const { cacheArticleForOffline } = await loadModule();

      await cacheArticleForOffline(makeArticle('a1'));

      const storedCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const stored = JSON.parse(storedCall[1]);
      expect(stored.length).toBe(1);
      expect(stored[0].cachedAt).toBeGreaterThan(1000);
    });
  });

  // -------------------------------------------------------------------------
  // getOfflineArticles
  // -------------------------------------------------------------------------

  describe('getOfflineArticles', () => {
    it('returns empty array when nothing cached', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      const { getOfflineArticles } = await loadModule();

      const articles = await getOfflineArticles();
      expect(articles).toEqual([]);
    });

    it('returns cached articles (not expired)', async () => {
      const cached = [
        { article: makeArticle('a1'), cachedAt: Date.now() },
        { article: makeArticle('a2'), cachedAt: Date.now() },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(cached));
      const { getOfflineArticles } = await loadModule();

      const articles = await getOfflineArticles();
      expect(articles).toHaveLength(2);
      expect(articles[0].id).toBe('a1');
    });

    it('evicts articles older than 48 hours', async () => {
      const TWO_DAYS_AGO = Date.now() - 49 * 60 * 60 * 1000;
      const cached = [
        { article: makeArticle('old'), cachedAt: TWO_DAYS_AGO },
        { article: makeArticle('fresh'), cachedAt: Date.now() },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(cached));
      const { getOfflineArticles } = await loadModule();

      const articles = await getOfflineArticles();
      expect(articles).toHaveLength(1);
      expect(articles[0].id).toBe('fresh');
    });
  });

  // -------------------------------------------------------------------------
  // removeOfflineArticle
  // -------------------------------------------------------------------------

  describe('removeOfflineArticle', () => {
    it('removes a specific article from cache', async () => {
      const cached = [
        { article: makeArticle('a1'), cachedAt: Date.now() },
        { article: makeArticle('a2'), cachedAt: Date.now() },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(cached));
      const { removeOfflineArticle } = await loadModule();

      await removeOfflineArticle('a1');

      const storedCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const stored = JSON.parse(storedCall[1]);
      expect(stored.length).toBe(1);
      expect(stored[0].article.id).toBe('a2');
    });
  });

  // -------------------------------------------------------------------------
  // isArticleCachedOffline
  // -------------------------------------------------------------------------

  describe('isArticleCachedOffline', () => {
    it('returns true for cached article', async () => {
      const cached = [{ article: makeArticle('a1'), cachedAt: Date.now() }];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(cached));
      const { isArticleCachedOffline } = await loadModule();

      expect(await isArticleCachedOffline('a1')).toBe(true);
    });

    it('returns false for non-cached article', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([]));
      const { isArticleCachedOffline } = await loadModule();

      expect(await isArticleCachedOffline('missing')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getOfflineArticleCount
  // -------------------------------------------------------------------------

  describe('getOfflineArticleCount', () => {
    it('returns count of non-expired articles', async () => {
      const cached = [
        { article: makeArticle('a1'), cachedAt: Date.now() },
        { article: makeArticle('a2'), cachedAt: Date.now() },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(cached));
      const { getOfflineArticleCount } = await loadModule();

      expect(await getOfflineArticleCount()).toBe(2);
    });
  });
});
