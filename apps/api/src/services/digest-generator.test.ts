import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn(),
  },
  parentalProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  activityLog: {
    findMany: vi.fn(),
  },
  newsItem: {
    count: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

import { generateDigestData, renderDigestHtml } from './digest-generator';

describe('digest-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDigestData', () => {
    it('returns correct structure with all fields', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        name: 'Carlos',
        currentStreak: 5,
        longestStreak: 12,
      });

      mockPrisma.activityLog.findMany.mockResolvedValue([
        { type: 'news_viewed', durationSeconds: 120, sport: 'football', createdAt: new Date() },
        { type: 'news_viewed', durationSeconds: 60, sport: 'football', createdAt: new Date() },
        { type: 'reels_viewed', durationSeconds: 90, sport: 'basketball', createdAt: new Date() },
        { type: 'quizzes_played', durationSeconds: 300, sport: 'tennis', createdAt: new Date() },
      ]);

      mockPrisma.newsItem.count.mockResolvedValue(3);

      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 50,
        quizPerfectCount: 2,
      });

      const data = await generateDigestData('user-1');

      expect(data.userName).toBe('Carlos');
      expect(data.byType.news_viewed).toBe(2);
      expect(data.byType.reels_viewed).toBe(1);
      expect(data.byType.quizzes_played).toBe(1);
      expect(data.totalMinutes).toBe(10); // (120+60+90+300)/60 = 9.5 rounded to 10
      expect(data.dailyAverage).toBe(1); // 10/7 rounded
      expect(data.topSports).toHaveLength(3);
      expect(data.topSports[0].sport).toBe('football');
      expect(data.topSports[0].count).toBe(2);
      expect(data.moderationBlocked).toBe(3);
      expect(data.streak.current).toBe(5);
      expect(data.streak.longest).toBe(12);
      expect(data.quizPerformance.perfectCount).toBe(2);
      expect(data.period).toHaveProperty('from');
      expect(data.period).toHaveProperty('to');
    });

    it('handles user with no activity (zeros)', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-2',
        name: 'Lucia',
        currentStreak: 0,
        longestStreak: 0,
      });

      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.newsItem.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 0,
        quizPerfectCount: 0,
      });

      const data = await generateDigestData('user-2');

      expect(data.userName).toBe('Lucia');
      expect(data.totalMinutes).toBe(0);
      expect(data.dailyAverage).toBe(0);
      expect(data.byType.news_viewed).toBe(0);
      expect(data.byType.reels_viewed).toBe(0);
      expect(data.byType.quizzes_played).toBe(0);
      expect(data.topSports).toHaveLength(0);
      expect(data.moderationBlocked).toBe(0);
      expect(data.quizPerformance.total).toBe(0);
      expect(data.quizPerformance.correctPercent).toBe(0);
      expect(data.streak.current).toBe(0);
      expect(data.streak.longest).toBe(0);
    });
  });

  describe('renderDigestHtml', () => {
    const sampleData = {
      userName: 'Ana',
      period: { from: '2026-03-19T00:00:00.000Z', to: '2026-03-26T00:00:00.000Z' },
      totalMinutes: 45,
      dailyAverage: 6,
      byType: { news_viewed: 10, reels_viewed: 5, quizzes_played: 3 },
      topSports: [{ sport: 'football', count: 8 }, { sport: 'tennis', count: 4 }],
      quizPerformance: { total: 3, correctPercent: 80, perfectCount: 1 },
      moderationBlocked: 2,
      streak: { current: 7, longest: 14 },
    };

    it('produces valid HTML string', () => {
      const html = renderDigestHtml(sampleData, 'es');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('SportyKids');
      expect(html).toContain('Ana');
      expect(html).toContain('45 min');
      expect(html).toContain('football');
      expect(html).toContain('80%');
    });

    it('uses correct locale for text', () => {
      const htmlEs = renderDigestHtml(sampleData, 'es');
      const htmlEn = renderDigestHtml(sampleData, 'en');

      expect(htmlEs).toContain('Resumen Semanal');
      expect(htmlEs).toContain('lang="es"');

      expect(htmlEn).toContain('Weekly Digest');
      expect(htmlEn).toContain('lang="en"');
    });
  });

  describe('digest endpoints (integration-like)', () => {
    it('generateDigestData throws for non-existent user', async () => {
      mockPrisma.user.findUniqueOrThrow.mockRejectedValue(
        new Error('No User found'),
      );

      await expect(generateDigestData('nonexistent')).rejects.toThrow('No User found');
    });

    it('generateDigestData includes quiz performance from user record', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-3',
        name: 'Pablo',
        currentStreak: 3,
        longestStreak: 3,
      });
      mockPrisma.activityLog.findMany.mockResolvedValue([
        { type: 'quizzes_played', durationSeconds: 60, sport: null, createdAt: new Date() },
        { type: 'quizzes_played', durationSeconds: 60, sport: null, createdAt: new Date() },
      ]);
      mockPrisma.newsItem.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 20,
        quizPerfectCount: 1,
      });

      const data = await generateDigestData('user-3');

      expect(data.quizPerformance.total).toBe(2);
      expect(data.quizPerformance.perfectCount).toBe(1);
      expect(data.quizPerformance.correctPercent).toBe(100); // 20/(2*10)*100 = 100
    });
  });
});
