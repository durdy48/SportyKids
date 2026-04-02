import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../../config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      count: vi.fn(),
    },
    parentalProfile: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../services/auth-service', () => ({
  verifyAccessToken: vi.fn(),
}));

const { prisma } = await import('../../config/database');

// We test the route handlers by importing subscription.ts and
// checking the service layer functions are called correctly.
// Full route integration tests would require express test utils.

describe('subscription routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/subscription/status/:userId', () => {
    it('status endpoint returns correct shape for free user', async () => {
      const { getSubscriptionStatus } = await import('../../services/subscription');

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionExpiry: null,
        favoriteSports: ['football'],
        parentUserId: null,
        role: 'child',
      } as never);
      vi.mocked(prisma.activityLog.count).mockResolvedValue(2);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const status = await getSubscriptionStatus('u1');

      expect(status).toMatchObject({
        tier: 'free',
        expiry: null,
        limits: {
          newsPerDay: 5,
          reelsPerDay: 5,
          quizPerDay: 3,
          sportsAllowed: ['football'],
        },
        canUpgrade: true,
      });
      expect(status.usage).toBeDefined();
      expect(typeof status.usage.newsToday).toBe('number');
    });

    it('status endpoint returns correct shape for premium user', async () => {
      const { getSubscriptionStatus } = await import('../../services/subscription');

      const expiryDate = new Date(Date.now() + 86400000 * 30);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'premium',
        subscriptionExpiry: expiryDate,
        favoriteSports: ['football', 'tennis'],
        parentUserId: null,
        role: 'parent',
      } as never);
      vi.mocked(prisma.activityLog.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const status = await getSubscriptionStatus('u1');

      expect(status).toMatchObject({
        tier: 'premium',
        limits: {
          newsPerDay: null,
          reelsPerDay: null,
          quizPerDay: null,
          sportsAllowed: null,
        },
        canUpgrade: false,
        familyPlan: true,
        childCount: 1,
      });
      expect(status.expiry).toBeTruthy();
    });
  });

  describe('POST /api/subscription/webhook', () => {
    it('webhook processes INITIAL_PURCHASE event', async () => {
      const { processWebhookEvent } = await import('../../services/subscription');

      vi.mocked(prisma.parentalProfile.findUnique).mockResolvedValue({
        userId: 'parent1',
      } as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'child1' },
      ] as never);
      vi.mocked(prisma.$transaction).mockResolvedValue([]);

      await processWebhookEvent({
        api_version: '1.0',
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: 'rc_1',
          product_id: 'sportykids_premium_monthly',
          expiration_at_ms: Date.now() + 86400000 * 30,
        },
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('webhook returns gracefully for unknown customer', async () => {
      const { processWebhookEvent } = await import('../../services/subscription');

      vi.mocked(prisma.parentalProfile.findUnique).mockResolvedValue(null);

      // Should not throw
      await processWebhookEvent({
        api_version: '1.0',
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: 'unknown',
        },
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
