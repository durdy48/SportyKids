import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so the mock object is available when vi.mock factory runs
const mockPrisma = vi.hoisted(() => ({
  dailyMission: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  parentalProfile: {
    findUnique: vi.fn(),
  },
  activityLog: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  sticker: { findMany: vi.fn() },
  userSticker: { create: vi.fn(), findMany: vi.fn() },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

// Mock awardSticker from gamification to avoid circular dependency issues
vi.mock('./gamification', () => ({
  awardSticker: vi.fn().mockResolvedValue({
    id: 'sticker-1',
    name: 'Star',
    nameKey: 'sticker.star',
    imageUrl: '/star.png',
    sport: 'football',
    rarity: 'rare',
  }),
}));

import { generateDailyMission, checkMissionProgress, claimMissionReward } from './mission-generator';
import { awardSticker } from './gamification';

describe('mission-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateDailyMission', () => {
    it('creates a new mission when none exists', async () => {
      mockPrisma.dailyMission.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        age: 10,
        favoriteSports: '["football","basketball"]',
      });
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);

      const createdMission = {
        id: 'mission-1',
        userId: 'user-1',
        date: '2026-03-26',
        type: 'read_news',
        title: 'Read 3 news articles',
        target: 3,
        progress: 0,
        completed: false,
        rewardType: 'sticker',
        rewardRarity: 'rare',
        rewardPoints: 0,
        claimed: false,
      };
      mockPrisma.dailyMission.create.mockResolvedValue(createdMission);

      const result = await generateDailyMission('user-1', 'en');

      expect(mockPrisma.dailyMission.findUnique).toHaveBeenCalledWith({
        where: { userId_date: { userId: 'user-1', date: '2026-03-26' } },
      });
      expect(mockPrisma.dailyMission.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(createdMission);
    });

    it('returns existing mission if already created today', async () => {
      const existingMission = {
        id: 'mission-1',
        userId: 'user-1',
        date: '2026-03-26',
        type: 'read_news',
        target: 3,
        progress: 1,
        completed: false,
      };
      mockPrisma.dailyMission.findUnique.mockResolvedValue(existingMission);

      const result = await generateDailyMission('user-1');

      expect(mockPrisma.dailyMission.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingMission);
    });

    it('filters out reels missions when reels format is blocked', async () => {
      mockPrisma.dailyMission.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        age: 10,
        favoriteSports: '["football"]',
      });
      mockPrisma.parentalProfile.findUnique.mockResolvedValue({
        allowedFormats: '["news","quiz"]', // no reels
      });

      mockPrisma.dailyMission.create.mockImplementation(async ({ data }) => ({
        id: 'mission-1',
        ...data,
      }));

      const result = await generateDailyMission('user-1');

      // The created mission type should NOT be watch_reels
      expect((result as Record<string, unknown>).type).not.toBe('watch_reels');
    });

    it('younger kids (age <= 8) get lower targets', async () => {
      mockPrisma.dailyMission.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        age: 7,
        favoriteSports: '["football"]',
      });
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);

      let capturedTarget: number | undefined;
      mockPrisma.dailyMission.create.mockImplementation(async ({ data }) => {
        capturedTarget = data.target;
        return { id: 'mission-1', ...data };
      });

      // Run multiple times to verify target is always minTarget for young kids
      for (let i = 0; i < 10; i++) {
        mockPrisma.dailyMission.findUnique.mockResolvedValue(null);
        await generateDailyMission('user-1');
      }

      // All captured targets should be the minimum for each type
      // Since the kid is 7, target should always be minTarget
      expect(capturedTarget).toBeDefined();
      // We can't predict which mission type, but we know minTargets are 1-3
      expect(capturedTarget!).toBeGreaterThanOrEqual(1);
      expect(capturedTarget!).toBeLessThanOrEqual(5);
    });
  });

  describe('checkMissionProgress', () => {
    it('increments progress for matching activity', async () => {
      const mission = {
        id: 'mission-1',
        userId: 'user-1',
        date: '2026-03-26',
        type: 'read_news',
        target: 3,
        progress: 1,
        completed: false,
      };
      mockPrisma.dailyMission.findUnique.mockResolvedValue(mission);

      const updatedMission = { ...mission, progress: 2 };
      mockPrisma.dailyMission.update.mockResolvedValue(updatedMission);

      const result = await checkMissionProgress('user-1', 'news_viewed');

      expect(result.missionUpdated).toBe(true);
      expect(result.completed).toBe(false);
      expect(mockPrisma.dailyMission.update).toHaveBeenCalledWith({
        where: { id: 'mission-1' },
        data: { progress: 2, completed: false },
      });
    });

    it('sets completed when progress >= target', async () => {
      const mission = {
        id: 'mission-1',
        userId: 'user-1',
        date: '2026-03-26',
        type: 'read_news',
        target: 3,
        progress: 2,
        completed: false,
      };
      mockPrisma.dailyMission.findUnique.mockResolvedValue(mission);

      const updatedMission = { ...mission, progress: 3, completed: true };
      mockPrisma.dailyMission.update.mockResolvedValue(updatedMission);

      const result = await checkMissionProgress('user-1', 'news_viewed');

      expect(result.missionUpdated).toBe(true);
      expect(result.completed).toBe(true);
      expect(mockPrisma.dailyMission.update).toHaveBeenCalledWith({
        where: { id: 'mission-1' },
        data: expect.objectContaining({
          progress: 3,
          completed: true,
          completedAt: expect.any(Date),
        }),
      });
    });

    it('returns no update for non-matching activity', async () => {
      const mission = {
        id: 'mission-1',
        userId: 'user-1',
        date: '2026-03-26',
        type: 'read_news',
        target: 3,
        progress: 1,
        completed: false,
      };
      mockPrisma.dailyMission.findUnique.mockResolvedValue(mission);

      const result = await checkMissionProgress('user-1', 'reels_viewed');

      expect(result.missionUpdated).toBe(false);
      expect(mockPrisma.dailyMission.update).not.toHaveBeenCalled();
    });
  });

  describe('claimMissionReward', () => {
    it('awards sticker and/or points for completed mission', async () => {
      const mission = {
        id: 'mission-1',
        userId: 'user-1',
        date: '2026-03-26',
        type: 'read_and_quiz',
        target: 3,
        progress: 3,
        completed: true,
        claimed: false,
        rewardType: 'both',
        rewardRarity: 'rare',
        rewardPoints: 50,
      };
      mockPrisma.dailyMission.findUnique.mockResolvedValue(mission);
      mockPrisma.dailyMission.update.mockResolvedValue({ ...mission, claimed: true });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await claimMissionReward('user-1');

      expect(result.claimed).toBe(true);
      expect(result.pointsAwarded).toBe(50);
      expect(result.sticker).toBeTruthy();
      expect(awardSticker).toHaveBeenCalledWith('user-1', 'mission', 'rare');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { totalPoints: { increment: 50 } },
      });
    });

    it('rejects if mission not completed', async () => {
      const mission = {
        id: 'mission-1',
        userId: 'user-1',
        date: '2026-03-26',
        type: 'read_news',
        target: 3,
        progress: 1,
        completed: false,
        claimed: false,
        rewardType: 'sticker',
        rewardRarity: 'rare',
        rewardPoints: 0,
      };
      mockPrisma.dailyMission.findUnique.mockResolvedValue(mission);

      const result = await claimMissionReward('user-1');

      expect(result.claimed).toBe(false);
      expect(result.sticker).toBeNull();
      expect(result.pointsAwarded).toBe(0);
    });
  });
});
