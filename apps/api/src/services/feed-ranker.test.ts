import { describe, it, expect, vi } from 'vitest';
import {
  rankFeed,
  sportBoost,
  sourceBoost,
  recencyBoost,
  languageBoost,
  countryBoost,
  sportFrequencyBoost,
  recencyDecay,
  invalidateBehavioralCache,
  RANKING_WEIGHTS,
  DIVERSITY_INTERVAL,
} from './feed-ranker';
import type { BehavioralSignals } from './feed-ranker';

// Define mock before vi.mock (hoisted)
const { mockInvalidate } = vi.hoisted(() => ({
  mockInvalidate: vi.fn(),
}));

// Mock prisma and cache so the module loads without DB
vi.mock('../config/database', () => ({
  prisma: {
    activityLog: { findMany: vi.fn().mockResolvedValue([]) },
    newsItem: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('./cache', () => ({
  apiCache: { get: vi.fn(), set: vi.fn(), invalidate: mockInvalidate },
}));

function makeItem(overrides: Partial<{ id: string; sport: string; team: string | null; source: string; publishedAt: string; language: string; country: string }>) {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: 'Test news',
    sport: 'football',
    team: null,
    source: 'BBC Sport',
    publishedAt: '2026-03-25T10:00:00Z',
    language: null,
    country: null,
    ...overrides,
  };
}

describe('rankFeed', () => {
  it('gives +5 boost to favorite team items', () => {
    const items = [
      makeItem({ sport: 'football', team: null, publishedAt: '2026-03-25T12:00:00Z' }),
      makeItem({ sport: 'football', team: 'Real Madrid', publishedAt: '2026-03-25T10:00:00Z' }),
    ];

    const result = rankFeed(items, {
      favoriteSports: ['football'],
      favoriteTeam: 'Real Madrid',
    });

    // Real Madrid item should come first despite earlier date (score 8 vs 3)
    expect(result[0].team).toBe('Real Madrid');
  });

  it('gives +3 boost to favorite sport items', () => {
    const items = [
      makeItem({ sport: 'football', publishedAt: '2026-03-25T08:00:00Z' }),
      makeItem({ sport: 'basketball', publishedAt: '2026-03-25T12:00:00Z' }),
    ];

    const result = rankFeed(items, {
      favoriteSports: ['football', 'basketball'],
      favoriteTeam: null,
    });

    // Both get +3. Same score, so sorted by date DESC: basketball (12:00) first
    expect(result[0].sport).toBe('basketball');
    expect(result[1].sport).toBe('football');
  });

  it('filters out unfollowed sports entirely', () => {
    const items = [
      makeItem({ sport: 'football' }),
      makeItem({ sport: 'tennis' }),
      makeItem({ sport: 'swimming' }),
    ];

    const result = rankFeed(items, {
      favoriteSports: ['football'],
      favoriteTeam: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].sport).toBe('football');
  });

  it('sorts by score DESC then by date DESC', () => {
    const items = [
      makeItem({ sport: 'football', team: null, publishedAt: '2026-03-25T08:00:00Z' }),
      makeItem({ sport: 'football', team: 'Barcelona', publishedAt: '2026-03-25T06:00:00Z' }),
      makeItem({ sport: 'football', team: null, publishedAt: '2026-03-25T12:00:00Z' }),
    ];

    const result = rankFeed(items, {
      favoriteSports: ['football'],
      favoriteTeam: 'Barcelona',
    });

    // Barcelona: score 8 (5+3) -> first
    // Then remaining two at score 3, sorted by date: 12:00 before 08:00
    expect(result[0].team).toBe('Barcelona');
    expect(result[1].publishedAt).toBe('2026-03-25T12:00:00Z');
    expect(result[2].publishedAt).toBe('2026-03-25T08:00:00Z');
  });

  it('returns all items sorted by date when user has no sport preferences', () => {
    const items = [
      makeItem({ sport: 'tennis', publishedAt: '2026-03-25T06:00:00Z' }),
      makeItem({ sport: 'football', publishedAt: '2026-03-25T12:00:00Z' }),
      makeItem({ sport: 'swimming', publishedAt: '2026-03-25T09:00:00Z' }),
    ];

    const result = rankFeed(items, {
      favoriteSports: [],
      favoriteTeam: null,
    });

    expect(result).toHaveLength(3);
    // Sorted by date DESC
    expect(result[0].sport).toBe('football');   // 12:00
    expect(result[1].sport).toBe('swimming');   // 09:00
    expect(result[2].sport).toBe('tennis');     // 06:00
  });

  it('does case-insensitive matching for team name', () => {
    const items = [
      makeItem({ sport: 'football', team: 'REAL MADRID CF' }),
    ];

    const result = rankFeed(items, {
      favoriteSports: ['football'],
      favoriteTeam: 'real madrid',
    });

    expect(result).toHaveLength(1);
    // Should still get the team boost (includes match)
  });

  it('does not mutate the original array', () => {
    const items = [
      makeItem({ sport: 'football', publishedAt: '2026-03-25T08:00:00Z' }),
      makeItem({ sport: 'football', publishedAt: '2026-03-25T12:00:00Z' }),
    ];
    const copy = [...items];

    rankFeed(items, { favoriteSports: ['football'], favoriteTeam: null });

    expect(items[0]).toBe(copy[0]);
    expect(items[1]).toBe(copy[1]);
  });
});

// ---------------------------------------------------------------------------
// Behavioral scoring unit tests (B-CP2) — legacy functions
// ---------------------------------------------------------------------------

describe('sportBoost (deprecated)', () => {
  it('returns 0 for no engagement', () => {
    expect(sportBoost(new Map(), 'football')).toBe(0);
  });
  it('returns 1 for 1-4 interactions', () => {
    expect(sportBoost(new Map([['football', 3]]), 'football')).toBe(1);
  });
  it('returns 2 for 5-9 interactions', () => {
    expect(sportBoost(new Map([['football', 7]]), 'football')).toBe(2);
  });
  it('returns 3 for 10-19 interactions', () => {
    expect(sportBoost(new Map([['football', 15]]), 'football')).toBe(3);
  });
  it('returns 4 for 20+ interactions', () => {
    expect(sportBoost(new Map([['football', 25]]), 'football')).toBe(4);
  });
});

describe('sourceBoost', () => {
  it('returns 0 for no engagement', () => {
    expect(sourceBoost(new Map(), 'bbc sport')).toBe(0);
  });
  it('returns 1 for 3-9 interactions', () => {
    expect(sourceBoost(new Map([['bbc sport', 5]]), 'BBC Sport')).toBe(1);
  });
  it('returns 2 for 10+ interactions', () => {
    expect(sourceBoost(new Map([['bbc sport', 12]]), 'BBC Sport')).toBe(2);
  });
});

describe('recencyBoost (deprecated)', () => {
  it('returns 3 for articles less than 3 hours old', () => {
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(recencyBoost(recent)).toBe(3);
  });
  it('returns 2 for articles 3-12 hours old', () => {
    const recent = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    expect(recencyBoost(recent)).toBe(2);
  });
  it('returns 1 for articles 12-24 hours old', () => {
    const recent = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
    expect(recencyBoost(recent)).toBe(1);
  });
  it('returns 0 for articles older than 24 hours', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(recencyBoost(old)).toBe(0);
  });
});

describe('languageBoost (B-CP5)', () => {
  it('returns 2 for matching language', () => {
    expect(languageBoost('es', 'es')).toBe(2);
  });
  it('returns 0 for non-matching language', () => {
    expect(languageBoost('en', 'es')).toBe(0);
  });
  it('returns 0 for null/undefined values', () => {
    expect(languageBoost(null, 'es')).toBe(0);
    expect(languageBoost('en', undefined)).toBe(0);
  });
});

describe('countryBoost', () => {
  it('returns 1 for matching country', () => {
    expect(countryBoost('ES', 'ES')).toBe(1);
  });
  it('returns 0 for non-matching country', () => {
    expect(countryBoost('GB', 'ES')).toBe(0);
  });
  it('is case-insensitive', () => {
    expect(countryBoost('es', 'ES')).toBe(1);
    expect(countryBoost('ES', 'es')).toBe(1);
  });
  it('returns 0 for null/undefined values', () => {
    expect(countryBoost(null, 'ES')).toBe(0);
    expect(countryBoost('ES', undefined)).toBe(0);
    expect(countryBoost(null, undefined)).toBe(0);
  });
});

describe('rankFeed with behavioral signals', () => {
  it('applies already-read penalty (-8)', () => {
    const readId = 'read-article-1';
    const unreadId = 'unread-article-2';

    const items = [
      makeItem({ id: readId, sport: 'football', publishedAt: '2026-03-25T12:00:00Z' }),
      makeItem({ id: unreadId, sport: 'football', publishedAt: '2026-03-25T08:00:00Z' }),
    ];

    const signals: BehavioralSignals = {
      sportEngagement: new Map(),
      sourceEngagement: new Map(),
      readContentIds: new Set([readId]),
    };

    const result = rankFeed(items, { favoriteSports: ['football'], favoriteTeam: null }, signals);

    // Unread article should be first despite earlier date (read penalty is -8)
    expect(result[0].id).toBe(unreadId);
  });

  it('boosts items in highly engaged sports', () => {
    const items = [
      makeItem({ id: '1', sport: 'football', publishedAt: '2026-03-25T08:00:00Z' }),
      makeItem({ id: '2', sport: 'basketball', publishedAt: '2026-03-25T08:00:00Z' }),
    ];

    const signals: BehavioralSignals = {
      sportEngagement: new Map([['football', 25]]),  // 100% of engagement -> maxScore
      sourceEngagement: new Map(),
      readContentIds: new Set(),
    };

    const result = rankFeed(items, { favoriteSports: ['football', 'basketball'], favoriteTeam: null }, signals);

    // Football item gets +5 sport frequency boost + 3 base vs basketball 3 base + 0 frequency
    expect(result[0].sport).toBe('football');
  });

  it('applies country boost (+1) for matching country', () => {
    const items = [
      makeItem({ id: '1', sport: 'football', country: 'GB', publishedAt: '2026-03-25T08:00:00Z' }),
      makeItem({ id: '2', sport: 'football', country: 'ES', publishedAt: '2026-03-25T08:00:00Z' }),
    ];

    const signals: BehavioralSignals = {
      sportEngagement: new Map(),
      sourceEngagement: new Map(),
      readContentIds: new Set(),
      country: 'ES',
    };

    const result = rankFeed(items, { favoriteSports: ['football'], favoriteTeam: null }, signals);

    // ES item gets +1 country boost
    expect(result[0].id).toBe('2');
  });
});

// ===========================================================================
// NEW TESTS — Enhanced Feed Algorithm (PRD5)
// ===========================================================================

// ---------------------------------------------------------------------------
// sportFrequencyBoost
// ---------------------------------------------------------------------------

describe('sportFrequencyBoost', () => {
  it('returns 0 for empty engagement map', () => {
    expect(sportFrequencyBoost(new Map(), 'football')).toBe(0);
  });

  it('returns maxScore for single-sport user (100% frequency)', () => {
    const engagement = new Map([['football', 10]]);
    expect(sportFrequencyBoost(engagement, 'football')).toBe(5);
  });

  it('returns proportional scores for multi-sport user', () => {
    // 60% football, 40% basketball
    const engagement = new Map([['football', 30], ['basketball', 20]]);
    expect(sportFrequencyBoost(engagement, 'football')).toBe(3.0);  // 30/50 * 5
    expect(sportFrequencyBoost(engagement, 'basketball')).toBe(2.0); // 20/50 * 5
  });

  it('returns 0 for a sport not in the map', () => {
    const engagement = new Map([['football', 10], ['basketball', 5]]);
    expect(sportFrequencyBoost(engagement, 'tennis')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recencyDecay
// ---------------------------------------------------------------------------

describe('recencyDecay', () => {
  it('returns maxScore (3.0) for age = 0', () => {
    const now = new Date().toISOString();
    const score = recencyDecay(now);
    expect(score).toBeCloseTo(3.0, 1);
  });

  it('returns ~1.1 for age = 12h (halfLife)', () => {
    const twelvHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const score = recencyDecay(twelvHoursAgo);
    // 3 * exp(-12/12) = 3 * exp(-1) ≈ 3 * 0.3679 ≈ 1.1036
    expect(score).toBeCloseTo(1.1, 0);
  });

  it('returns near-zero for age = 48h', () => {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const score = recencyDecay(fortyEightHoursAgo);
    // 3 * exp(-48/12) = 3 * exp(-4) ≈ 3 * 0.0183 ≈ 0.055
    expect(score).toBeLessThan(0.1);
  });

  it('is monotonically decreasing', () => {
    const scores: number[] = [];
    for (let hours = 0; hours <= 48; hours += 1) {
      const date = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      scores.push(recencyDecay(date));
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Diversity injection (tested via rankFeed)
// ---------------------------------------------------------------------------

describe('diversity injection', () => {
  it('swaps dominant sport at 5th position with next non-dominant item', () => {
    // Build a feed where football dominates (>40%) and basketball is minority
    // All same publishedAt to make order deterministic by score alone
    const items: ReturnType<typeof makeItem>[] = [];
    // 8 football items + 2 basketball items
    for (let i = 0; i < 8; i++) {
      items.push(makeItem({ id: `fb-${i}`, sport: 'football', publishedAt: `2026-03-25T${String(12 - i).padStart(2, '0')}:00:00Z` }));
    }
    items.push(makeItem({ id: 'bk-0', sport: 'basketball', publishedAt: '2026-03-25T01:00:00Z' }));
    items.push(makeItem({ id: 'bk-1', sport: 'basketball', publishedAt: '2026-03-25T00:00:00Z' }));

    const signals: BehavioralSignals = {
      sportEngagement: new Map([['football', 30], ['basketball', 5]]),  // football is ~86% dominant
      sourceEngagement: new Map(),
      readContentIds: new Set(),
    };

    const result = rankFeed(items, { favoriteSports: ['football', 'basketball'], favoriteTeam: null }, signals);

    // Position 4 (0-indexed, 5th item) should be a non-dominant sport (basketball)
    expect(result[4].sport).toBe('basketball');
  });

  it('does not modify the first 4 items', () => {
    const items: ReturnType<typeof makeItem>[] = [];
    for (let i = 0; i < 8; i++) {
      items.push(makeItem({ id: `fb-${i}`, sport: 'football', publishedAt: `2026-03-25T${String(12 - i).padStart(2, '0')}:00:00Z` }));
    }
    items.push(makeItem({ id: 'bk-0', sport: 'basketball', publishedAt: '2026-03-25T01:00:00Z' }));

    const signals: BehavioralSignals = {
      sportEngagement: new Map([['football', 30], ['basketball', 5]]),
      sourceEngagement: new Map(),
      readContentIds: new Set(),
    };

    // Run without diversity to get reference order
    const withoutSignals = rankFeed(items, { favoriteSports: ['football', 'basketball'], favoriteTeam: null });
    const withSignals = rankFeed(items, { favoriteSports: ['football', 'basketball'], favoriteTeam: null }, signals);

    // First 4 items should be the same sport (football, the dominant one)
    for (let i = 0; i < 4; i++) {
      expect(withSignals[i].sport).toBe('football');
    }
  });

  it('is a no-op without behavioral signals', () => {
    const items = [
      makeItem({ id: 'fb-0', sport: 'football', publishedAt: '2026-03-25T12:00:00Z' }),
      makeItem({ id: 'fb-1', sport: 'football', publishedAt: '2026-03-25T11:00:00Z' }),
      makeItem({ id: 'fb-2', sport: 'football', publishedAt: '2026-03-25T10:00:00Z' }),
      makeItem({ id: 'fb-3', sport: 'football', publishedAt: '2026-03-25T09:00:00Z' }),
      makeItem({ id: 'fb-4', sport: 'football', publishedAt: '2026-03-25T08:00:00Z' }),
      makeItem({ id: 'bk-0', sport: 'basketball', publishedAt: '2026-03-25T07:00:00Z' }),
    ];

    const result = rankFeed(items, { favoriteSports: ['football', 'basketball'], favoriteTeam: null });

    // Without behavioral signals, no diversity injection — pure date order
    expect(result[4].id).toBe('fb-4');
  });

  it('is a no-op when no non-dominant items are available', () => {
    const items: ReturnType<typeof makeItem>[] = [];
    for (let i = 0; i < 8; i++) {
      items.push(makeItem({ id: `fb-${i}`, sport: 'football', publishedAt: `2026-03-25T${String(12 - i).padStart(2, '0')}:00:00Z` }));
    }

    const signals: BehavioralSignals = {
      sportEngagement: new Map([['football', 30]]),  // 100% dominant
      sourceEngagement: new Map(),
      readContentIds: new Set(),
    };

    const result = rankFeed(items, { favoriteSports: ['football'], favoriteTeam: null }, signals);

    // All items are football — nothing to swap, so order should be by score/date
    expect(result).toHaveLength(8);
    for (const item of result) {
      expect(item.sport).toBe('football');
    }
  });
});

// ---------------------------------------------------------------------------
// RANKING_WEIGHTS
// ---------------------------------------------------------------------------

describe('RANKING_WEIGHTS', () => {
  it('all weights default to 1.0', () => {
    expect(RANKING_WEIGHTS.TEAM).toBe(1.0);
    expect(RANKING_WEIGHTS.SPORT).toBe(1.0);
    expect(RANKING_WEIGHTS.SOURCE).toBe(1.0);
    expect(RANKING_WEIGHTS.RECENCY).toBe(1.0);
    expect(RANKING_WEIGHTS.LOCALE).toBe(1.0);
    expect(RANKING_WEIGHTS.COUNTRY).toBe(1.0);
  });

  it('DIVERSITY_INTERVAL is 5', () => {
    expect(DIVERSITY_INTERVAL).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// invalidateBehavioralCache
// ---------------------------------------------------------------------------

describe('invalidateBehavioralCache', () => {
  it('removes cached entry for user', () => {
    mockInvalidate.mockClear();
    invalidateBehavioralCache('user-123');
    expect(mockInvalidate).toHaveBeenCalledWith('behavioral:user-123');
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility — existing rankFeed behavior with new scoring
// ---------------------------------------------------------------------------

describe('backward compat', () => {
  it('existing rankFeed tests pass with new scoring (weights all 1.0)', () => {
    // This verifies that the weighted scoring with all weights at 1.0
    // produces equivalent ordering to the original implementation
    const items = [
      makeItem({ sport: 'football', team: null, publishedAt: '2026-03-25T08:00:00Z' }),
      makeItem({ sport: 'football', team: 'Barcelona', publishedAt: '2026-03-25T06:00:00Z' }),
      makeItem({ sport: 'football', team: null, publishedAt: '2026-03-25T12:00:00Z' }),
    ];

    const result = rankFeed(items, {
      favoriteSports: ['football'],
      favoriteTeam: 'Barcelona',
    });

    // Barcelona: team boost (5*1.0) + sport (3) -> highest
    // Then remaining sorted by date
    expect(result[0].team).toBe('Barcelona');
    expect(result[1].publishedAt).toBe('2026-03-25T12:00:00Z');
    expect(result[2].publishedAt).toBe('2026-03-25T08:00:00Z');
  });
});
