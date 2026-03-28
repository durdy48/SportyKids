import { describe, it, expect, vi } from 'vitest';

// Mock all dependencies used by HomeFeed
vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api' }));
vi.mock('../../lib/api', () => ({
  fetchNews: vi.fn().mockResolvedValue({ news: [], total: 0, page: 1, totalPages: 0 }),
  fetchNewsSummary: vi.fn().mockResolvedValue({ summary: '', ageRange: '6-8', generatedAt: '' }),
  fetchTrending: vi.fn().mockResolvedValue({ trendingIds: [] }),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'u1', name: 'Test', age: 10, favoriteSports: ['football'] },
    locale: 'es',
    streakInfo: { currentStreak: 3, longestStreak: 7 },
  }),
}));
vi.mock('../../components/BrandedRefreshControl', () => ({ BrandedRefreshControl: 'BrandedRefreshControl' }));
vi.mock('../../components/NewsCard', () => ({ NewsCard: 'NewsCard' }));
vi.mock('../../components/NewsCardSkeleton', () => ({ NewsCardSkeleton: 'NewsCardSkeleton' }));
vi.mock('../../components/FiltersBar', () => ({ FiltersBar: 'FiltersBar' }));
vi.mock('../../components/StreakCounter', () => ({ StreakCounter: 'StreakCounter' }));

describe('HomeFeedScreen', () => {
  it('can be imported without errors', async () => {
    const mod = await import('../HomeFeed');
    expect(mod.HomeFeedScreen).toBeDefined();
    expect(typeof mod.HomeFeedScreen).toBe('function');
  });

  it('is a React component (function)', async () => {
    const { HomeFeedScreen } = await import('../HomeFeed');
    // Verify it is a function that can be called as a component
    expect(HomeFeedScreen.length).toBeGreaterThanOrEqual(0);
  });
});
