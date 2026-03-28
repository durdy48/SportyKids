import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) },
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock aggregator
const mockSyncAllSources = vi.fn();
vi.mock('../services/aggregator', () => ({
  syncAllSources: (...args: unknown[]) => mockSyncAllSources(...args),
}));

// Mock daily quiz job
vi.mock('./generate-daily-quiz', () => ({
  startDailyQuizJob: vi.fn(),
}));

// Mock push-sender
const mockSendPushToUsers = vi.fn();
vi.mock('../services/push-sender', () => ({
  sendPushToUsers: (...args: unknown[]) => mockSendPushToUsers(...args),
}));

// Mock prisma
const mockFindManyNews = vi.fn();
const mockFindManyUser = vi.fn();
vi.mock('../config/database', () => ({
  prisma: {
    newsItem: { findMany: (...args: unknown[]) => mockFindManyNews(...args) },
    user: { findMany: (...args: unknown[]) => mockFindManyUser(...args) },
  },
}));

// Mock @sportykids/shared
const mockT = vi.fn((key: string, locale: string) => `${key}[${locale}]`);
vi.mock('@sportykids/shared', () => ({
  t: (...args: unknown[]) => mockT(...(args as [string, string])),
}));

import { runManualSync, startSyncJob, notifyTeamNews } from './sync-feeds';

describe('sync-feeds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runManualSync', () => {
    it('should call syncAllSources and return result', async () => {
      const result = {
        totalProcessed: 10,
        totalCreated: 3,
        totalApproved: 2,
        totalRejected: 1,
        totalErrors: 0,
      };
      mockSyncAllSources.mockResolvedValue(result);

      const actual = await runManualSync();
      expect(actual).toEqual(result);
      expect(mockSyncAllSources).toHaveBeenCalledOnce();
    });

    it('should propagate errors from syncAllSources', async () => {
      mockSyncAllSources.mockRejectedValue(new Error('RSS fetch failed'));

      await expect(runManualSync()).rejects.toThrow('RSS fetch failed');
    });
  });

  describe('startSyncJob', () => {
    it('should schedule cron and start daily quiz job', async () => {
      const cron = await import('node-cron');
      const { startDailyQuizJob } = await import('./generate-daily-quiz');

      // Reset module state by re-importing (activeJob starts null)
      startSyncJob();

      expect(cron.default.schedule).toHaveBeenCalledWith(
        '*/30 * * * *',
        expect.any(Function),
      );
      expect(startDailyQuizJob).toHaveBeenCalled();
    });

  });

  describe('notifyTeamNews', () => {
    it('should send locale-aware push notifications for team news', async () => {
      // Setup: new approved team article
      mockFindManyNews.mockResolvedValue([
        { id: 'n1', title: 'Madrid wins', team: 'Real Madrid' },
      ]);
      // Users with different locales
      mockFindManyUser.mockResolvedValue([
        { id: 'u1', locale: 'es' },
        { id: 'u2', locale: 'en' },
        { id: 'u3', locale: null },
      ]);
      mockSendPushToUsers.mockResolvedValue(undefined);

      await notifyTeamNews(new Date());

      // Should send separate batches per locale
      // 'es' locale: u1 and u3 (null defaults to es)
      expect(mockSendPushToUsers).toHaveBeenCalledWith(
        ['u1', 'u3'],
        expect.objectContaining({
          title: expect.stringContaining('[es]'),
        }),
        'teamUpdates',
      );
      // 'en' locale: u2
      expect(mockSendPushToUsers).toHaveBeenCalledWith(
        ['u2'],
        expect.objectContaining({
          title: expect.stringContaining('[en]'),
        }),
        'teamUpdates',
      );
    });

    it('should default to es locale when user has no locale', async () => {
      mockFindManyNews.mockResolvedValue([
        { id: 'n1', title: 'Goal scored', team: 'Barcelona' },
      ]);
      mockFindManyUser.mockResolvedValue([
        { id: 'u1', locale: null },
      ]);
      mockSendPushToUsers.mockResolvedValue(undefined);

      await notifyTeamNews(new Date());

      expect(mockT).toHaveBeenCalledWith('push.team_news_title', 'es');
    });
  });
});
