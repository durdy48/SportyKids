import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted Prisma mock
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  activityLog: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  parentalProfile: {
    count: vi.fn(),
  },
  dailyMission: {
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@sportykids/shared', () => ({
  SPORTS: ['football', 'basketball', 'tennis', 'swimming', 'athletics', 'cycling', 'formula1', 'padel'],
}));

import {
  computeDau,
  computeMau,
  computeSportActivity,
  computeRetentionD1,
  computeRetentionD7,
  computeSubscriptionBreakdown,
  computeParentalActivationRate,
  computeConsentRate,
  computeQuizEngagement,
  computeMissionsCompleted,
  computeMissionsClaimed,
} from './admin-stats.js';

const TODAY = new Date('2026-04-05T00:00:00.000Z');

describe('admin-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // computeRetentionD1
  // -------------------------------------------------------------------------
  describe('computeRetentionD1', () => {
    it('returns { rate: 0, cohortSize: 0 } when no users registered yesterday', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await computeRetentionD1(TODAY);

      expect(result).toEqual({ rate: 0, cohortSize: 0 });
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns correct rate when 2 of 4 cohort users are retained', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1' },
        { id: 'u2' },
        { id: 'u3' },
        { id: 'u4' },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(2) }]);

      const result = await computeRetentionD1(TODAY);

      expect(result).toEqual({ rate: 0.5, cohortSize: 4 });
    });

    it('returns rate: 1 when all cohort users are retained', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(2) }]);

      const result = await computeRetentionD1(TODAY);

      expect(result).toEqual({ rate: 1, cohortSize: 2 });
    });
  });

  // -------------------------------------------------------------------------
  // computeRetentionD7
  // -------------------------------------------------------------------------
  describe('computeRetentionD7', () => {
    it('returns { rate: 0, cohortSize: 0 } when no users registered 7 days ago', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await computeRetentionD7(TODAY);

      expect(result).toEqual({ rate: 0, cohortSize: 0 });
    });

    it('returns correct rate for D7 cohort', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(1) }]);

      const result = await computeRetentionD7(TODAY);

      expect(result.cohortSize).toBe(3);
      expect(result.rate).toBeCloseTo(0.33, 2);
    });
  });

  // -------------------------------------------------------------------------
  // computeDau
  // -------------------------------------------------------------------------
  describe('computeDau', () => {
    it('counts distinct active users for the given date', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(3) }]);

      const result = await computeDau(TODAY);

      expect(result).toEqual({ count: 3 });
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('returns 0 when no activity', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);

      const result = await computeDau(TODAY);

      expect(result).toEqual({ count: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // computeMau
  // -------------------------------------------------------------------------
  describe('computeMau', () => {
    it('counts distinct active users in last 30 days', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(2) }]);

      const result = await computeMau(TODAY);

      expect(result).toEqual({ count: 2 });
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('returns 0 when no activity', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);

      const result = await computeMau(TODAY);

      expect(result).toEqual({ count: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // computeSportActivity
  // -------------------------------------------------------------------------
  describe('computeSportActivity', () => {
    it('returns 0 for sports with no activity', async () => {
      mockPrisma.activityLog.groupBy.mockResolvedValue([]);

      const result = await computeSportActivity(TODAY);

      expect(result.football).toBe(0);
      expect(result.basketball).toBe(0);
      expect(result.tennis).toBe(0);
      expect(result.swimming).toBe(0);
      expect(result.athletics).toBe(0);
      expect(result.cycling).toBe(0);
      expect(result.formula1).toBe(0);
      expect(result.padel).toBe(0);
    });

    it('correctly counts activity per sport', async () => {
      mockPrisma.activityLog.groupBy.mockResolvedValue([
        { sport: 'football', _count: { sport: 2 } },
        { sport: 'tennis', _count: { sport: 1 } },
        { sport: 'basketball', _count: { sport: 1 } },
      ]);

      const result = await computeSportActivity(TODAY);

      expect(result.football).toBe(2);
      expect(result.tennis).toBe(1);
      expect(result.basketball).toBe(1);
      expect(result.swimming).toBe(0);
    });

    it('ignores unknown sports', async () => {
      mockPrisma.activityLog.groupBy.mockResolvedValue([
        { sport: 'hockey', _count: { sport: 3 } },
        { sport: 'football', _count: { sport: 1 } },
      ]);

      const result = await computeSportActivity(TODAY);

      expect(result.football).toBe(1);
      expect(Object.keys(result)).not.toContain('hockey');
    });
  });

  // -------------------------------------------------------------------------
  // computeSubscriptionBreakdown
  // -------------------------------------------------------------------------
  describe('computeSubscriptionBreakdown', () => {
    it('returns free and premium counts', async () => {
      mockPrisma.user.groupBy.mockResolvedValue([
        { subscriptionTier: 'free', _count: { _all: 120 } },
        { subscriptionTier: 'premium', _count: { _all: 30 } },
      ]);

      const result = await computeSubscriptionBreakdown();

      expect(result).toEqual({ free: 120, premium: 30 });
    });

    it('returns zeros when no users', async () => {
      mockPrisma.user.groupBy.mockResolvedValue([]);

      const result = await computeSubscriptionBreakdown();

      expect(result).toEqual({ free: 0, premium: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // computeParentalActivationRate
  // -------------------------------------------------------------------------
  describe('computeParentalActivationRate', () => {
    it('returns correct rate when parents have profiles', async () => {
      mockPrisma.user.count.mockResolvedValue(10); // totalParents
      mockPrisma.parentalProfile.count.mockResolvedValue(7); // withParental

      const result = await computeParentalActivationRate();

      expect(result.totalParents).toBe(10);
      expect(result.withParental).toBe(7);
      expect(result.rate).toBe(0.7);
    });

    it('returns rate: 0 when no parents exist', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.parentalProfile.count.mockResolvedValue(0);

      const result = await computeParentalActivationRate();

      expect(result.rate).toBe(0);
      expect(result.totalParents).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // computeConsentRate
  // -------------------------------------------------------------------------
  describe('computeConsentRate', () => {
    it('returns 0 when no users', async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await computeConsentRate();

      expect(result).toEqual({ rate: 0, consented: 0, total: 0 });
    });

    it('returns correct rate when some users have consented', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60); // consented

      const result = await computeConsentRate();

      expect(result.total).toBe(100);
      expect(result.consented).toBe(60);
      expect(result.rate).toBe(0.6);
    });
  });

  // -------------------------------------------------------------------------
  // computeQuizEngagement
  // -------------------------------------------------------------------------
  describe('computeQuizEngagement', () => {
    it('returns 0 rate when DAU is 0', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
      mockPrisma.activityLog.count.mockResolvedValue(5);

      const result = await computeQuizEngagement(TODAY);

      expect(result.rate).toBe(0);
      expect(result.dau).toBe(0);
    });

    it('returns correct quiz engagement rate', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(10) }]);
      mockPrisma.activityLog.count.mockResolvedValue(5);

      const result = await computeQuizEngagement(TODAY);

      expect(result.dau).toBe(10);
      expect(result.quizAnswered).toBe(5);
      expect(result.rate).toBe(0.5);
    });
  });

  // -------------------------------------------------------------------------
  // computeMissionsCompleted
  // -------------------------------------------------------------------------
  describe('computeMissionsCompleted', () => {
    it('counts missions completed on target date', async () => {
      mockPrisma.dailyMission.count.mockResolvedValue(42);

      const result = await computeMissionsCompleted(TODAY);

      expect(result).toEqual({ count: 42 });
      const call = mockPrisma.dailyMission.count.mock.calls[0]![0] as { where: { completed: boolean; date: { startsWith: string } } };
      expect(call.where.completed).toBe(true);
      expect(call.where.date.startsWith).toBe('2026-04-05');
    });

    it('returns 0 when no missions completed', async () => {
      mockPrisma.dailyMission.count.mockResolvedValue(0);

      const result = await computeMissionsCompleted(TODAY);

      expect(result).toEqual({ count: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // computeMissionsClaimed
  // -------------------------------------------------------------------------
  describe('computeMissionsClaimed', () => {
    it('counts missions claimed on target date', async () => {
      mockPrisma.dailyMission.count.mockResolvedValue(15);

      const result = await computeMissionsClaimed(TODAY);

      expect(result).toEqual({ count: 15 });
      const call = mockPrisma.dailyMission.count.mock.calls[0]![0] as { where: { claimed: boolean; date: { startsWith: string } } };
      expect(call.where.claimed).toBe(true);
    });
  });
});
