import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so the mock object is available when vi.mock factory runs (hoisted to top)
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  sticker: { findMany: vi.fn() },
  userSticker: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  achievement: { findMany: vi.fn() },
  userAchievement: { findMany: vi.fn(), create: vi.fn() },
  activityLog: { groupBy: vi.fn() },
  dailyMission: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  parentalProfile: { findUnique: vi.fn() },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('./mission-generator', () => ({
  checkMissionProgress: vi.fn().mockResolvedValue({
    missionUpdated: false,
    completed: false,
    mission: null,
  }),
}));

// Import after mocking
import { checkAndUpdateStreak, awardSticker, evaluateAchievements } from './gamification';

describe('gamification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkAndUpdateStreak', () => {
    it('increments streak for consecutive days', async () => {
      const now = new Date('2026-03-25T10:00:00Z');
      vi.setSystemTime(now);

      // The function uses $transaction — we simulate the transaction callback
      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          user: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              currentStreak: 3,
              longestStreak: 5,
              lastActiveDate: new Date('2026-03-24T15:00:00Z'), // yesterday
              totalPoints: 100,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      // Mock awardSticker dependencies (called after transaction)
      mockPrisma.userSticker.findMany.mockResolvedValue([]);
      mockPrisma.sticker.findMany.mockResolvedValue([
        { id: 's1', name: 'Star', nameKey: 'sticker.star', imageUrl: '/star.png', sport: 'football', rarity: 'common' },
      ]);
      mockPrisma.userSticker.create.mockResolvedValue({});

      // Mock evaluateAchievements dependencies
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        totalPoints: 102,
        currentStreak: 4,
        longestStreak: 5,
        quizPerfectCount: 0,
        favoriteSports: '["football"]',
      });
      mockPrisma.activityLog.groupBy.mockResolvedValue([]);
      mockPrisma.userSticker.count.mockResolvedValue(1);
      mockPrisma.achievement.findMany.mockResolvedValue([]);
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);

      const result = await checkAndUpdateStreak('user-1');

      expect(result.currentStreak).toBe(4); // 3 + 1
      expect(result.streakBroken).toBe(false);
      expect(result.pointsAwarded).toBe(2); // daily login points
    });

    it('resets streak when gap is > 1 day', async () => {
      const now = new Date('2026-03-25T10:00:00Z');
      vi.setSystemTime(now);

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          user: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              currentStreak: 10,
              longestStreak: 15,
              lastActiveDate: new Date('2026-03-22T12:00:00Z'), // 3 days ago
              totalPoints: 200,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      mockPrisma.userSticker.findMany.mockResolvedValue([]);
      mockPrisma.sticker.findMany.mockResolvedValue([]);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        totalPoints: 202,
        currentStreak: 1,
        longestStreak: 15,
        quizPerfectCount: 0,
        favoriteSports: '[]',
      });
      mockPrisma.activityLog.groupBy.mockResolvedValue([]);
      mockPrisma.userSticker.count.mockResolvedValue(0);
      mockPrisma.achievement.findMany.mockResolvedValue([]);
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);

      const result = await checkAndUpdateStreak('user-1');

      expect(result.currentStreak).toBe(1); // reset
      expect(result.streakBroken).toBe(true);
    });

    it('returns no-op when already checked in today', async () => {
      const now = new Date('2026-03-25T10:00:00Z');
      vi.setSystemTime(now);

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          user: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              currentStreak: 5,
              longestStreak: 10,
              lastActiveDate: new Date('2026-03-25T08:00:00Z'), // same day
              totalPoints: 100,
            }),
            update: vi.fn(),
          },
        };
        return cb(tx);
      });

      const result = await checkAndUpdateStreak('user-1');

      expect(result.currentStreak).toBe(5);
      expect(result.pointsAwarded).toBe(0);
      expect(result.streakBroken).toBe(false);
      expect(result.dailyStickerAwarded).toBeNull();
    });
  });

  describe('awardSticker', () => {
    it('returns null when user has all stickers (none available)', async () => {
      mockPrisma.userSticker.findMany.mockResolvedValue([
        { stickerId: 's1' },
        { stickerId: 's2' },
      ]);
      mockPrisma.sticker.findMany.mockResolvedValue([]); // no available stickers

      const result = await awardSticker('user-1', 'daily_login', 'common');

      expect(result).toBeNull();
    });

    it('awards a random sticker when available', async () => {
      mockPrisma.userSticker.findMany.mockResolvedValue([]);
      mockPrisma.sticker.findMany.mockResolvedValue([
        { id: 's1', name: 'Golden Boot', nameKey: 'sticker.golden_boot', imageUrl: '/boot.png', sport: 'football', rarity: 'epic' },
      ]);
      mockPrisma.userSticker.create.mockResolvedValue({});

      const result = await awardSticker('user-1', 'daily_login', 'epic');

      expect(result).toEqual({
        id: 's1',
        name: 'Golden Boot',
        nameKey: 'sticker.golden_boot',
        imageUrl: '/boot.png',
        sport: 'football',
        rarity: 'epic',
      });
    });

    it('returns null on unique constraint violation', async () => {
      mockPrisma.userSticker.findMany.mockResolvedValue([]);
      mockPrisma.sticker.findMany.mockResolvedValue([
        { id: 's1', name: 'Star', nameKey: 'sticker.star', imageUrl: '/star.png', sport: 'football', rarity: 'common' },
      ]);
      mockPrisma.userSticker.create.mockRejectedValue(new Error('Unique constraint failed'));

      const result = await awardSticker('user-1', 'daily_login', 'common');

      expect(result).toBeNull();
    });
  });

  describe('achievement cache', () => {
    it('does not refetch achievements within 60s TTL', async () => {
      // Use a time far in the future to ensure any cache from prior tests has expired
      vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
      // Ensure the cache is stale by advancing well past any prior fetchedAt
      vi.advanceTimersByTime(120_000);

      // Reset call counts
      mockPrisma.achievement.findMany.mockClear();

      const achievements = [
        { id: 'a1', key: 'first_news', nameKey: 'achievement.first_news', icon: 'newspaper', type: 'news_read', threshold: 1, rewardStickerId: null },
      ];
      mockPrisma.achievement.findMany.mockResolvedValue(achievements);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        quizPerfectCount: 0,
        favoriteSports: '[]',
      });
      mockPrisma.activityLog.groupBy.mockResolvedValue([]);
      mockPrisma.userSticker.count.mockResolvedValue(0);
      mockPrisma.userAchievement.findMany.mockResolvedValue([{ achievementId: 'a1' }]);

      // First call — fetches from DB (cache is expired/empty)
      await evaluateAchievements('user-1');
      expect(mockPrisma.achievement.findMany).toHaveBeenCalledTimes(1);

      // Advance 30s (within 60s TTL)
      vi.advanceTimersByTime(30_000);

      // Second call — uses cache
      await evaluateAchievements('user-1');
      expect(mockPrisma.achievement.findMany).toHaveBeenCalledTimes(1); // still 1

      // Advance another 31s (total 61s, past TTL)
      vi.advanceTimersByTime(31_000);

      // Third call — refetches
      await evaluateAchievements('user-1');
      expect(mockPrisma.achievement.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
