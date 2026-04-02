import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

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
    organization: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import('../../config/database');
const { resolveEffectiveTier, countTodayUsage, getSubscriptionStatus, processWebhookEvent } = await import('../subscription');

describe('subscription service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // resolveEffectiveTier
  // ---------------------------------------------------------------------------

  describe('resolveEffectiveTier', () => {
    it('returns free for unknown user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const tier = await resolveEffectiveTier('unknown');
      expect(tier).toBe('free');
    });

    it('returns free for user with free tier', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionExpiry: null,
        parentUserId: null,
      } as never);
      const tier = await resolveEffectiveTier('u1');
      expect(tier).toBe('free');
    });

    it('returns premium for user with active premium', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'premium',
        subscriptionExpiry: new Date(Date.now() + 86400000), // tomorrow
        parentUserId: null,
      } as never);
      const tier = await resolveEffectiveTier('u1');
      expect(tier).toBe('premium');
    });

    it('returns premium for user with no expiry (premium)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'premium',
        subscriptionExpiry: null,
        parentUserId: null,
      } as never);
      const tier = await resolveEffectiveTier('u1');
      expect(tier).toBe('premium');
    });

    it('returns free for user with expired premium', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'premium',
        subscriptionExpiry: new Date(Date.now() - 86400000), // yesterday
        parentUserId: null,
      } as never);
      const tier = await resolveEffectiveTier('u1');
      expect(tier).toBe('free');
    });

    it('returns premium for child when parent is premium (family plan)', async () => {
      // First call: child
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({
          subscriptionTier: 'free',
          subscriptionExpiry: null,
          parentUserId: 'parent1',
        } as never)
        // Second call: parent
        .mockResolvedValueOnce({
          subscriptionTier: 'premium',
          subscriptionExpiry: new Date(Date.now() + 86400000),
        } as never);

      // First 3 children ordered by createdAt
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'child1' },
        { id: 'child2' },
      ] as never);

      const tier = await resolveEffectiveTier('child1');
      expect(tier).toBe('premium');
    });

    it('returns free for 4th child when parent is premium (family limit)', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({
          subscriptionTier: 'free',
          subscriptionExpiry: null,
          parentUserId: 'parent1',
        } as never)
        .mockResolvedValueOnce({
          subscriptionTier: 'premium',
          subscriptionExpiry: new Date(Date.now() + 86400000),
        } as never);

      // First 3 children (take: 3) — child4 is NOT among them
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'child1' },
        { id: 'child2' },
        { id: 'child3' },
      ] as never);

      const tier = await resolveEffectiveTier('child4');
      expect(tier).toBe('free');
    });

    it('returns premium for 3rd child but free for 4th child (first 3 get premium)', async () => {
      // Test that the first 3 children still get premium when there are 4+ children
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({
          subscriptionTier: 'free',
          subscriptionExpiry: null,
          parentUserId: 'parent1',
        } as never)
        .mockResolvedValueOnce({
          subscriptionTier: 'premium',
          subscriptionExpiry: new Date(Date.now() + 86400000),
        } as never);

      // First 3 children by createdAt — child3 IS among them
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'child1' },
        { id: 'child2' },
        { id: 'child3' },
      ] as never);

      const tier = await resolveEffectiveTier('child3');
      expect(tier).toBe('premium');
    });

    it('returns free for child when parent subscription is expired', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({
          subscriptionTier: 'free',
          subscriptionExpiry: null,
          parentUserId: 'parent1',
          organizationId: null,
        } as never)
        .mockResolvedValueOnce({
          subscriptionTier: 'premium',
          subscriptionExpiry: new Date(Date.now() - 86400000), // expired
        } as never);

      const tier = await resolveEffectiveTier('child1');
      expect(tier).toBe('free');
    });

    it('returns premium for user in an active organization', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionExpiry: null,
        parentUserId: null,
        organizationId: 'org1',
      } as never);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        active: true,
      } as never);

      const tier = await resolveEffectiveTier('u1');
      expect(tier).toBe('premium');
    });

    it('returns free for user in an inactive organization', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionExpiry: null,
        parentUserId: null,
        organizationId: 'org1',
      } as never);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        active: false,
      } as never);

      const tier = await resolveEffectiveTier('u1');
      expect(tier).toBe('free');
    });

    it('org membership takes priority over individual subscription check', async () => {
      // User is in active org AND has free individual tier — should get premium from org
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionExpiry: null,
        parentUserId: null,
        organizationId: 'org1',
      } as never);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        active: true,
      } as never);

      const tier = await resolveEffectiveTier('u1');
      expect(tier).toBe('premium');
      // Should not have checked parent — org check came first
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // countTodayUsage
  // ---------------------------------------------------------------------------

  describe('countTodayUsage', () => {
    it('returns count from activityLog for today', async () => {
      vi.mocked(prisma.activityLog.count).mockResolvedValue(3);
      const count = await countTodayUsage('u1', 'news_viewed');
      expect(count).toBe(3);
      expect(prisma.activityLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'u1',
            type: 'news_viewed',
          }),
        }),
      );
    });

    it('returns 0 when no activity', async () => {
      vi.mocked(prisma.activityLog.count).mockResolvedValue(0);
      const count = await countTodayUsage('u1', 'reels_viewed');
      expect(count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getSubscriptionStatus
  // ---------------------------------------------------------------------------

  describe('getSubscriptionStatus', () => {
    it('returns free status for unknown user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const status = await getSubscriptionStatus('unknown');
      expect(status.tier).toBe('free');
      expect(status.canUpgrade).toBe(true);
    });

    it('returns premium status with no limits', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'premium',
        subscriptionExpiry: new Date(Date.now() + 86400000),
        favoriteSports: ['football', 'tennis'],
        parentUserId: null,
        role: 'parent',
      } as never);
      vi.mocked(prisma.activityLog.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      const status = await getSubscriptionStatus('u1');
      expect(status.tier).toBe('premium');
      expect(status.limits.newsPerDay).toBeNull();
      expect(status.limits.sportsAllowed).toBeNull();
      expect(status.canUpgrade).toBe(false);
    });

    it('returns free status with correct limits and first sport', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionExpiry: null,
        favoriteSports: ['basketball', 'tennis'],
        parentUserId: null,
        role: 'child',
      } as never);
      vi.mocked(prisma.activityLog.count)
        .mockResolvedValueOnce(3) // news
        .mockResolvedValueOnce(1) // reels
        .mockResolvedValueOnce(0); // quiz
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const status = await getSubscriptionStatus('u1');
      expect(status.tier).toBe('free');
      expect(status.limits.newsPerDay).toBe(5);
      expect(status.limits.sportsAllowed).toEqual(['basketball']);
      expect(status.usage.newsToday).toBe(3);
      expect(status.usage.reelsToday).toBe(1);
      expect(status.canUpgrade).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // processWebhookEvent
  // ---------------------------------------------------------------------------

  describe('processWebhookEvent', () => {
    it('handles INITIAL_PURCHASE — sets parent + children to premium', async () => {
      vi.mocked(prisma.parentalProfile.findUnique).mockResolvedValue({
        userId: 'parent1',
      } as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'child1' },
        { id: 'child2' },
      ] as never);
      vi.mocked(prisma.$transaction).mockResolvedValue([]);

      await processWebhookEvent({
        api_version: '1.0',
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: 'rc_customer_1',
          expiration_at_ms: Date.now() + 86400000 * 30,
        },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('handles EXPIRATION — reverts to free', async () => {
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
          type: 'EXPIRATION',
          app_user_id: 'rc_customer_1',
        },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('handles CANCELLATION — keeps premium, updates expiry', async () => {
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
          type: 'CANCELLATION',
          app_user_id: 'rc_customer_1',
          expiration_at_ms: Date.now() + 86400000 * 15,
        },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('handles BILLING_ISSUE — no changes, just logs', async () => {
      vi.mocked(prisma.parentalProfile.findUnique).mockResolvedValue({
        userId: 'parent1',
      } as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      await processWebhookEvent({
        api_version: '1.0',
        event: {
          type: 'BILLING_ISSUE',
          app_user_id: 'rc_customer_1',
        },
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('handles unknown customer — logs warning and returns without error', async () => {
      vi.mocked(prisma.parentalProfile.findUnique).mockResolvedValue(null);

      await expect(
        processWebhookEvent({
          api_version: '1.0',
          event: {
            type: 'INITIAL_PURCHASE',
            app_user_id: 'unknown_customer',
          },
        }),
      ).resolves.not.toThrow();
    });

    it('handles RENEWAL — updates expiry', async () => {
      vi.mocked(prisma.parentalProfile.findUnique).mockResolvedValue({
        userId: 'parent1',
      } as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.$transaction).mockResolvedValue([]);

      await processWebhookEvent({
        api_version: '1.0',
        event: {
          type: 'RENEWAL',
          app_user_id: 'rc_customer_1',
          expiration_at_ms: Date.now() + 86400000 * 30,
        },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
