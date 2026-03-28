import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheArticleForOffline,
  getOfflineArticles,
  removeOfflineArticle,
  getOfflineArticleCount,
  isArticleCachedOffline,
  isOnline,
} from './offline-cache';
import type { NewsItem } from '@sportykids/shared';

function makeArticle(id: string): NewsItem {
  return {
    id,
    title: `Article ${id}`,
    summary: 'Summary',
    source: 'Test',
    sourceUrl: 'https://test.com',
    sport: 'football',
    imageUrl: '',
    minAge: 6,
    maxAge: 14,
    publishedAt: new Date('2026-03-20T12:00:00Z'),
    safetyStatus: 'approved',
  };
}

describe('offline-cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('caches an article and retrieves it', () => {
    cacheArticleForOffline(makeArticle('a1'));
    const articles = getOfflineArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0].id).toBe('a1');
  });

  it('does not duplicate existing articles', () => {
    cacheArticleForOffline(makeArticle('a1'));
    cacheArticleForOffline(makeArticle('a1'));
    expect(getOfflineArticleCount()).toBe(1);
  });

  it('limits cache to 20 articles', () => {
    for (let i = 0; i < 25; i++) {
      cacheArticleForOffline(makeArticle(`a${i}`));
    }
    expect(getOfflineArticleCount()).toBeLessThanOrEqual(20);
  });

  it('removes an article from cache', () => {
    cacheArticleForOffline(makeArticle('a1'));
    cacheArticleForOffline(makeArticle('a2'));
    removeOfflineArticle('a1');
    expect(isArticleCachedOffline('a1')).toBe(false);
    expect(isArticleCachedOffline('a2')).toBe(true);
  });

  it('isOnline returns true when navigator.onLine is true', () => {
    expect(isOnline()).toBe(true);
  });
});
