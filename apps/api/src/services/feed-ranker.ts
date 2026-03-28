/**
 * Feed ranker — sorts news items by user preference relevance + behavioral signals.
 *
 * Base scoring:
 *   +5  favorite team match
 *   +3  favorite sport match
 *    0  unfollowed sport -> filtered out entirely
 *
 * Behavioral scoring (B-CP2):
 *   0-5  sport frequency boost (proportional to engagement share)
 *   0-2  source engagement boost
 *   0-3  recency decay (exponential, smooth curve)
 *   -8   already-read penalty (unweighted)
 *   +2   locale/language match boost (B-CP5)
 *
 * Weights are configurable via RANKING_WEIGHTS.
 * Diversity injection places a non-dominant sport item every DIVERSITY_INTERVAL positions.
 *
 * Within the same score tier, items are sorted by publishedAt DESC.
 */

interface RankableItem {
  id?: string;
  sport: string;
  team?: string | null;
  source?: string;
  publishedAt: Date | string;
  language?: string | null;
  country?: string | null;
  [key: string]: unknown;
}

interface UserPrefs {
  favoriteSports: string[];
  favoriteTeam?: string | null;
}

export interface BehavioralSignals {
  /** Map of sport -> engagement count in last 14 days */
  sportEngagement: Map<string, number>;
  /** Map of source -> engagement count in last 14 days */
  sourceEngagement: Map<string, number>;
  /** Set of already-read content IDs */
  readContentIds: Set<string>;
  /** User's locale for language boost */
  locale?: string;
  /** User's country for country boost */
  country?: string;
  /** Total interactions across all sports (precomputed for frequency calculation) */
  totalInteractions?: number;
}

// ---------------------------------------------------------------------------
// Configurable ranking weights (all default to 1.0 for backward compatibility)
// ---------------------------------------------------------------------------

export const RANKING_WEIGHTS = {
  TEAM: 1.0,
  SPORT: 1.0,
  SOURCE: 1.0,
  RECENCY: 1.0,
  LOCALE: 1.0,
  COUNTRY: 1.0,
} as const;

// ---------------------------------------------------------------------------
// Diversity injection constant
// ---------------------------------------------------------------------------

export const DIVERSITY_INTERVAL = 5;

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

/**
 * Frequency-weighted sport scoring (proportional instead of tier-based).
 * Returns a score from 0 to maxScore based on the sport's share of total engagement.
 */
export function sportFrequencyBoost(
  sportEngagement: Map<string, number>,
  sport: string,
  maxScore: number = 5,
  precomputedTotal?: number,
): number {
  const totalInteractions = precomputedTotal ?? Array.from(sportEngagement.values()).reduce((a, b) => a + b, 0);
  if (totalInteractions === 0) return 0;

  const sportCount = sportEngagement.get(sport.toLowerCase()) ?? 0;
  const frequency = sportCount / totalInteractions;
  return frequency * maxScore;
}

/**
 * Score a single item's source engagement boost (0-2).
 */
export function sourceBoost(sourceEngagement: Map<string, number>, source: string): number {
  const count = sourceEngagement.get(source.toLowerCase()) ?? 0;
  if (count >= 10) return 2;
  if (count >= 3) return 1;
  return 0;
}

/**
 * Exponential recency decay. Returns a smooth score from maxScore (brand new) to ~0 (very old).
 * Formula: maxScore * exp(-ageHours / halfLifeHours)
 * Note: halfLifeHours is a decay constant, not a true half-life. At t=halfLifeHours,
 * the value is ~0.368 * maxScore (not 0.5 * maxScore). Named for intuitive readability.
 */
export function recencyDecay(
  publishedAt: Date | string,
  maxScore: number = 3,
  halfLifeHours: number = 12,
): number {
  const ageMs = Date.now() - toTime(publishedAt);
  const ageHours = ageMs / (1000 * 60 * 60);
  return maxScore * Math.exp(-ageHours / halfLifeHours);
}

/**
 * Language match boost (B-CP5). +2 if item language matches user locale.
 * Callers should normalize null/undefined to '' before invoking.
 */
export function languageBoost(itemLanguage: string, userLocale: string): number {
  if (!itemLanguage || !userLocale) return 0;
  return itemLanguage.toLowerCase().startsWith(userLocale.toLowerCase()) ? 2 : 0;
}

/**
 * Country match boost. +1 if item country matches user country (case-insensitive).
 */
export function countryBoost(itemCountry: string | null | undefined, userCountry: string | undefined): number {
  if (!itemCountry || !userCountry) return 0;
  return itemCountry.toUpperCase() === userCountry.toUpperCase() ? 1 : 0;
}

export function rankFeed<T extends RankableItem>(
  news: T[],
  userPrefs: UserPrefs,
  behavioral?: BehavioralSignals,
): T[] {
  const { favoriteSports, favoriteTeam } = userPrefs;

  // If user has no sport preferences, return all sorted by date
  if (!favoriteSports || favoriteSports.length === 0) {
    return sortByDate(news);
  }

  const sportSet = new Set(favoriteSports.map((s) => s.toLowerCase()));
  const teamLower = favoriteTeam?.toLowerCase() ?? null;

  // Filter out sports the user does not follow
  const filtered = news.filter((item) => sportSet.has(item.sport.toLowerCase()));

  // Score each item
  const scored = filtered.map((item) => {
    let score = 0;

    // Favorite team match
    const teamScore =
      teamLower &&
      item.team &&
      item.team.toLowerCase().includes(teamLower)
        ? 5
        : 0;
    score += teamScore * RANKING_WEIGHTS.TEAM;

    // Favorite sport (always true after filtering, but explicit for clarity)
    if (sportSet.has(item.sport.toLowerCase())) {
      score += 3; // Base sport match (not weighted — it's a filter gate)
    }

    // Behavioral scoring when signals are available
    if (behavioral) {
      score += sportFrequencyBoost(behavioral.sportEngagement, item.sport, 5, behavioral.totalInteractions) * RANKING_WEIGHTS.SPORT;
      if (item.source) {
        score += sourceBoost(behavioral.sourceEngagement, item.source) * RANKING_WEIGHTS.SOURCE;
      }
      score += recencyDecay(item.publishedAt) * RANKING_WEIGHTS.RECENCY;

      // Already-read penalty (unweighted)
      if (item.id && behavioral.readContentIds.has(item.id)) {
        score -= 8;
      }

      // Language match boost (B-CP5)
      if (behavioral.locale && item.language) {
        score += languageBoost(item.language || '', behavioral.locale || '') * RANKING_WEIGHTS.LOCALE;
      }

      // Country match boost
      if (behavioral.country && item.country) {
        score += countryBoost(item.country, behavioral.country) * RANKING_WEIGHTS.COUNTRY;
      }
    }

    return { item, score };
  });

  // Sort: highest score first, then by publishedAt DESC within same score
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return toTime(b.item.publishedAt) - toTime(a.item.publishedAt);
  });

  const result = scored.map((s) => s.item);

  // Diversity injection: every DIVERSITY_INTERVAL-th position gets a non-dominant sport item
  if (behavioral && behavioral.sportEngagement.size > 0) {
    applyDiversityInjection(result, behavioral.sportEngagement);
  }

  return result;
}

/**
 * Post-sort diversity injection. Swaps dominant-sport items at every DIVERSITY_INTERVAL-th
 * position with the next non-dominant sport item in the list.
 */
function applyDiversityInjection<T extends RankableItem>(
  items: T[],
  sportEngagement: Map<string, number>,
): void {
  let totalInteractions = 0;
  for (const count of sportEngagement.values()) {
    totalInteractions += count;
  }
  if (totalInteractions === 0) return;

  // Identify dominant sports (>40% of engagement)
  const dominantSports = new Set<string>();
  for (const [sport, count] of sportEngagement.entries()) {
    if (count / totalInteractions > 0.4) {
      dominantSports.add(sport.toLowerCase());
    }
  }
  if (dominantSports.size === 0) return;

  // Scan every DIVERSITY_INTERVAL-th position (0-indexed: 4, 9, 14, ...)
  for (let i = DIVERSITY_INTERVAL - 1; i < items.length; i += DIVERSITY_INTERVAL) {
    const currentSport = items[i].sport.toLowerCase();
    if (!dominantSports.has(currentSport)) continue;

    // Find next non-dominant sport item after this position
    let swapIdx = -1;
    for (let j = i + 1; j < items.length; j++) {
      if (!dominantSports.has(items[j].sport.toLowerCase())) {
        swapIdx = j;
        break;
      }
    }

    if (swapIdx !== -1) {
      const temp = items[i];
      items[i] = items[swapIdx];
      items[swapIdx] = temp;
    }
  }
}

function toTime(date: Date | string): number {
  return date instanceof Date ? date.getTime() : new Date(date).getTime();
}

function sortByDate<T extends RankableItem>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => toTime(b.publishedAt) - toTime(a.publishedAt),
  );
}

// ---------------------------------------------------------------------------
// Behavioral signals fetcher (queries ActivityLog, cached 5 min)
// ---------------------------------------------------------------------------

import { prisma } from '../config/database';
import { apiCache } from './cache';

const BEHAVIORAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidate the behavioral signals cache for a specific user.
 * Call this when a new activity is logged so that the next feed request
 * uses fresh signals instead of waiting for the 5-minute TTL to expire.
 */
export function invalidateBehavioralCache(userId: string): void {
  apiCache.invalidate(`behavioral:${userId}`);
}

export async function getBehavioralSignals(userId: string, locale?: string, country?: string): Promise<BehavioralSignals> {
  const cacheKey = `behavioral:${userId}`;
  const cached = apiCache.get<BehavioralSignals>(cacheKey);
  if (cached) return { ...cached, locale, country };

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const logs = await prisma.activityLog.findMany({
    where: {
      userId,
      createdAt: { gte: fourteenDaysAgo },
    },
    select: { type: true, sport: true, contentId: true },
  });

  const sportEngagement = new Map<string, number>();
  const sourceEngagement = new Map<string, number>();
  const readContentIds = new Set<string>();

  for (const log of logs) {
    // Sport engagement
    if (log.sport) {
      const key = log.sport.toLowerCase();
      sportEngagement.set(key, (sportEngagement.get(key) ?? 0) + 1);
    }

    // Track read content
    if (log.contentId && log.type === 'news_viewed') {
      readContentIds.add(log.contentId);
    }
  }

  // Source affinity: join ActivityLog content IDs with NewsItem to get source names
  const viewedContentIds = [...new Set(
    logs.filter(l => l.type === 'news_viewed' && l.contentId).map(l => l.contentId!)
  )];

  if (viewedContentIds.length > 0) {
    const viewedItems = await prisma.newsItem.findMany({
      where: { id: { in: viewedContentIds } },
      select: { id: true, source: true },
    });

    const sourceById = new Map(viewedItems.map(n => [n.id, n.source]));

    for (const contentId of viewedContentIds) {
      const source = sourceById.get(contentId);
      if (source) {
        const key = source.toLowerCase();
        sourceEngagement.set(key, (sourceEngagement.get(key) ?? 0) + 1);
      }
    }
  }

  // Precompute total interactions
  let totalInteractions = 0;
  for (const count of sportEngagement.values()) {
    totalInteractions += count;
  }

  const signals: BehavioralSignals = {
    sportEngagement,
    sourceEngagement,
    readContentIds,
    totalInteractions,
    locale,
    country,
  };

  apiCache.set(cacheKey, signals, BEHAVIORAL_CACHE_TTL);

  return signals;
}
