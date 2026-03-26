/**
 * Offline reading queue for mobile (B-MP4).
 *
 * Caches up to 20 articles in AsyncStorage for offline reading.
 * Articles are evicted after 48 hours.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsItem } from '@sportykids/shared';

const STORAGE_KEY = 'sportykids_offline_articles';
const MAX_ARTICLES = 20;
const EVICTION_MS = 48 * 60 * 60 * 1000; // 48 hours

interface CachedArticle {
  article: NewsItem;
  cachedAt: number;
}

async function getCache(): Promise<CachedArticle[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: CachedArticle[] = JSON.parse(raw);
    const now = Date.now();
    return items.filter((item) => now - item.cachedAt < EVICTION_MS);
  } catch {
    return [];
  }
}

async function saveCache(items: CachedArticle[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ARTICLES)));
  } catch {
    // AsyncStorage full or unavailable
  }
}

export async function cacheArticleForOffline(article: NewsItem): Promise<void> {
  const cache = await getCache();
  const existing = cache.findIndex((c) => c.article.id === article.id);
  if (existing !== -1) {
    cache[existing].cachedAt = Date.now();
  } else {
    cache.unshift({ article, cachedAt: Date.now() });
  }
  await saveCache(cache);
}

export async function removeOfflineArticle(articleId: string): Promise<void> {
  const cache = await getCache();
  await saveCache(cache.filter((c) => c.article.id !== articleId));
}

export async function getOfflineArticles(): Promise<NewsItem[]> {
  const cache = await getCache();
  return cache.map((c) => c.article);
}

export async function getOfflineArticleCount(): Promise<number> {
  const cache = await getCache();
  return cache.length;
}

export async function isArticleCachedOffline(articleId: string): Promise<boolean> {
  const cache = await getCache();
  return cache.some((c) => c.article.id === articleId);
}
