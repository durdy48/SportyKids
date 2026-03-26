import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock prisma with vi.hoisted so it's available in the vi.mock factory
const mockPrisma = vi.hoisted(() => ({
  parentalProfile: { findUnique: vi.fn() },
  activityLog: { aggregate: vi.fn() },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('../utils/safe-json-parse', () => ({
  safeJsonParse: (val: string, fallback: unknown) => {
    try { return JSON.parse(val); } catch { return fallback; }
  },
}));

import { parentalGuard, invalidateProfileCache, getCurrentHourInTimezone, isWithinSchedule } from './parental-guard';

// Helper to create mock Express objects
function createMocks(overrides: {
  baseUrl?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const req = {
    baseUrl: overrides.baseUrl ?? '/api/news',
    query: overrides.query ?? { userId: 'user-1' },
    headers: overrides.headers ?? {},
  } as unknown as Request;

  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next, status, json };
}

describe('parentalGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the in-memory profile cache between tests
    invalidateProfileCache('user-1');
  });

  it('calls next() when no userId is provided', async () => {
    const { req, res, next } = createMocks({ query: {} });
    await parentalGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when no parental profile exists', async () => {
    mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);
    const { req, res, next } = createMocks();
    await parentalGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  describe('per-type time limits', () => {
    const baseProfile = {
      userId: 'user-1',
      allowedFormats: JSON.stringify(['news', 'reels', 'quiz']),
      allowedSports: JSON.stringify([]),
      maxDailyTimeMinutes: 120,
      maxNewsMinutes: 30,
      maxReelsMinutes: null,
      maxQuizMinutes: 15,
      allowedHoursStart: 0,
      allowedHoursEnd: 24,
      timezone: 'UTC',
    };

    it('returns 403 with format when per-type news limit is exceeded', async () => {
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(baseProfile);
      // 30 minutes = 1800 seconds of news_viewed
      mockPrisma.activityLog.aggregate.mockResolvedValue({
        _sum: { durationSeconds: 1800 },
      });

      const { req, res, next, status, json } = createMocks({ baseUrl: '/api/news' });
      await parentalGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'limit_reached',
          format: 'news',
          limit: 30,
          used: 30,
        }),
      );

      // Verify the aggregate was called with type filter for per-type limit
      expect(mockPrisma.activityLog.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'news_viewed',
          }),
        }),
      );
    });

    it('falls back to global maxDailyTimeMinutes when per-type limit is null (reels)', async () => {
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(baseProfile);
      // 120 minutes = 7200 seconds (global limit)
      mockPrisma.activityLog.aggregate.mockResolvedValue({
        _sum: { durationSeconds: 7200 },
      });

      const { req, res, next, status, json } = createMocks({ baseUrl: '/api/reels' });
      await parentalGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'limit_reached',
          format: 'reels',
          limit: 120,
        }),
      );

      // When falling back to global, should NOT filter by type
      expect(mockPrisma.activityLog.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            type: expect.anything(),
          }),
        }),
      );
    });

    it('passes through when user is under the per-type limit', async () => {
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(baseProfile);
      // Only 10 minutes used (under 30 min news limit)
      mockPrisma.activityLog.aggregate.mockResolvedValue({
        _sum: { durationSeconds: 600 },
      });

      const { req, res, next } = createMocks({ baseUrl: '/api/news' });
      await parentalGuard(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('returns 403 with format for quiz per-type limit', async () => {
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(baseProfile);
      // 15 minutes = 900 seconds of quizzes_played
      mockPrisma.activityLog.aggregate.mockResolvedValue({
        _sum: { durationSeconds: 900 },
      });

      const { req, res, next, status, json } = createMocks({ baseUrl: '/api/quiz' });
      await parentalGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'limit_reached',
          format: 'quiz',
          limit: 15,
        }),
      );

      // Should filter by quizzes_played
      expect(mockPrisma.activityLog.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'quizzes_played',
          }),
        }),
      );
    });

    it('passes through when all limits are null/zero and global is also null', async () => {
      mockPrisma.parentalProfile.findUnique.mockResolvedValue({
        ...baseProfile,
        maxDailyTimeMinutes: null,
        maxNewsMinutes: null,
        maxReelsMinutes: null,
        maxQuizMinutes: null,
      });

      const { req, res, next } = createMocks({ baseUrl: '/api/news' });
      await parentalGuard(req, res, next);

      expect(next).toHaveBeenCalled();
      // Should not even query activity logs
      expect(mockPrisma.activityLog.aggregate).not.toHaveBeenCalled();
    });

    it('message indicates per-type limit when per-type is set', async () => {
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.activityLog.aggregate.mockResolvedValue({
        _sum: { durationSeconds: 1800 },
      });

      const { req, res, next, json } = createMocks({ baseUrl: '/api/news' });
      await parentalGuard(req, res, next);

      const response = json.mock.calls[0][0];
      expect(response.message).toContain('news');
      expect(response.message).toContain('time limit reached');
    });

    it('message indicates global limit when falling back', async () => {
      mockPrisma.parentalProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.activityLog.aggregate.mockResolvedValue({
        _sum: { durationSeconds: 7200 },
      });

      const { req, res, next, json } = createMocks({ baseUrl: '/api/reels' });
      await parentalGuard(req, res, next);

      const response = json.mock.calls[0][0];
      expect(response.message).toBe('Daily time limit reached');
    });
  });

  describe('schedule lock (B-PT4)', () => {
    const scheduleProfile = {
      userId: 'user-1',
      allowedFormats: JSON.stringify(['news', 'reels', 'quiz']),
      allowedSports: JSON.stringify([]),
      maxDailyTimeMinutes: null,
      maxNewsMinutes: null,
      maxReelsMinutes: null,
      maxQuizMinutes: null,
      allowedHoursStart: 8,
      allowedHoursEnd: 20,
      timezone: 'UTC',
    };

    it('blocks access outside allowed hours', async () => {
      // Mock getCurrentHourInTimezone indirectly by using a profile with UTC
      // and mocking Date to a time outside the window
      const outsideHour = new Date('2026-03-26T22:00:00Z'); // 22:00 UTC, outside 8-20
      vi.setSystemTime(outsideHour);

      mockPrisma.parentalProfile.findUnique.mockResolvedValue(scheduleProfile);
      const { req, res, next, status, json } = createMocks({ baseUrl: '/api/news' });
      await parentalGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'schedule_locked',
          allowedHoursStart: 8,
          allowedHoursEnd: 20,
        }),
      );

      vi.useRealTimers();
    });

    it('allows access within allowed hours', async () => {
      const insideHour = new Date('2026-03-26T12:00:00Z'); // 12:00 UTC, within 8-20
      vi.setSystemTime(insideHour);

      mockPrisma.parentalProfile.findUnique.mockResolvedValue(scheduleProfile);
      const { req, res, next } = createMocks({ baseUrl: '/api/news' });
      await parentalGuard(req, res, next);

      expect(next).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests for schedule helper functions
// ---------------------------------------------------------------------------

describe('isWithinSchedule', () => {
  it('normal range: 7-21, hour 10 -> true', () => {
    expect(isWithinSchedule(10, 7, 21)).toBe(true);
  });
  it('normal range: 7-21, hour 6 -> false', () => {
    expect(isWithinSchedule(6, 7, 21)).toBe(false);
  });
  it('normal range: 7-21, hour 21 -> false (exclusive end)', () => {
    expect(isWithinSchedule(21, 7, 21)).toBe(false);
  });
  it('midnight crossing: 22-6, hour 23 -> true', () => {
    expect(isWithinSchedule(23, 22, 6)).toBe(true);
  });
  it('midnight crossing: 22-6, hour 3 -> true', () => {
    expect(isWithinSchedule(3, 22, 6)).toBe(true);
  });
  it('midnight crossing: 22-6, hour 10 -> false', () => {
    expect(isWithinSchedule(10, 22, 6)).toBe(false);
  });
  it('all day: 0-24, hour 15 -> true', () => {
    expect(isWithinSchedule(15, 0, 24)).toBe(true);
  });
});

describe('getCurrentHourInTimezone', () => {
  it('returns the correct hour for UTC', () => {
    const date = new Date('2026-03-26T14:30:00Z');
    expect(getCurrentHourInTimezone('UTC', date)).toBe(14);
  });
  it('falls back to UTC hour for invalid timezone', () => {
    const date = new Date('2026-03-26T14:30:00Z');
    const hour = getCurrentHourInTimezone('Invalid/Timezone', date);
    // Should not crash, returns a number
    expect(typeof hour).toBe('number');
  });
});
