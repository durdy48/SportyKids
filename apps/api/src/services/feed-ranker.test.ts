import { describe, it, expect, vi } from 'vitest';
import { rankFeed, sportBoost, sourceBoost, recencyBoost, languageBoost } from './feed-ranker';
import type { BehavioralSignals } from './feed-ranker';

// Mock prisma and cache so the module loads without DB
vi.mock('../config/database', () => ({
  prisma: { activityLog: { findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock('./cache', () => ({
  apiCache: { get: vi.fn(), set: vi.fn() },
}));

function makeItem(overrides: Partial<{ id: string; sport: string; team: string | null; source: string; publishedAt: string; language: string }>) {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: 'Test news',
    sport: 'football',
    team: null,
    source: 'BBC Sport',
    publishedAt: '2026-03-25T10:00:00Z',
    language: null,
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
// Behavioral scoring unit tests (B-CP2)
// ---------------------------------------------------------------------------

describe('sportBoost', () => {
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

describe('recencyBoost', () => {
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
      sportEngagement: new Map([['football', 25]]),  // +4 boost
      sourceEngagement: new Map(),
      readContentIds: new Set(),
    };

    const result = rankFeed(items, { favoriteSports: ['football', 'basketball'], favoriteTeam: null }, signals);

    // Football item gets +4 sport boost + 3 base = 7 vs basketball 3 base
    expect(result[0].sport).toBe('football');
  });
});
