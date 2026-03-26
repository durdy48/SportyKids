/**
 * Offline reading queue for web (B-MP4).
 *
 * Caches up to 20 articles in localStorage for offline reading.
 * Articles are evicted after 48 hours.
 */

import type { NewsItem } from '@sportykids/shared';

const STORAGE_KEY = 'sportykids_offline_articles';
const MAX_ARTICLES = 20;
const EVICTION_MS = 48 * 60 * 60 * 1000; // 48 hours

interface CachedArticle {
  article: NewsItem;
  cachedAt: number;
}

function getCache(): CachedArticle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: CachedArticle[] = JSON.parse(raw);
    // Evict expired articles
    const now = Date.now();
    return items.filter((item) => now - item.cachedAt < EVICTION_MS);
  } catch {
    return [];
  }
}

function saveCache(items: CachedArticle[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ARTICLES)));
  } catch {
    // localStorage full or unavailable
  }
}

export function cacheArticleForOffline(article: NewsItem): void {
  const cache = getCache();
  // Don't duplicate
  const existing = cache.findIndex((c) => c.article.id === article.id);
  if (existing !== -1) {
    cache[existing].cachedAt = Date.now(); // Refresh expiry
  } else {
    cache.unshift({ article, cachedAt: Date.now() });
  }
  saveCache(cache);
}

export function removeOfflineArticle(articleId: string): void {
  const cache = getCache();
  saveCache(cache.filter((c) => c.article.id !== articleId));
}

export function getOfflineArticles(): NewsItem[] {
  return getCache().map((c) => c.article);
}

export function getOfflineArticleCount(): number {
  return getCache().length;
}

export function isArticleCachedOffline(articleId: string): boolean {
  return getCache().some((c) => c.article.id === articleId);
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
