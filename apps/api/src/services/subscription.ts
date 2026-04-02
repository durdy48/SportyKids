import { prisma } from '../config/database';
import { FREE_TIER_LIMITS, FAMILY_PLAN_MAX_CHILDREN } from '@sportykids/shared';
import type { SubscriptionTier, SubscriptionStatus } from '@sportykids/shared';
import { logger } from './logger';

/** User data needed for tier resolution (avoids redundant DB queries). */
export interface TierUserData {
  subscriptionTier: string;
  subscriptionExpiry: Date | null;
  parentUserId: string | null;
  organizationId?: string | null;
}

/**
 * Resolve the effective subscription tier for a user.
 * If the user is a child linked to a parent, the parent's tier is checked (family plan).
 * Expired subscriptions are treated as free.
 *
 * If `userData` is provided, it is used directly instead of querying the DB.
 */
export async function resolveEffectiveTier(
  userId: string,
  userData?: TierUserData | null,
): Promise<SubscriptionTier> {
  const user = userData ?? await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionExpiry: true,
      parentUserId: true,
      organizationId: true,
    },
  });

  if (!user) return 'free';

  // Check organization membership first — active org grants premium
  if (user.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { active: true },
    });
    if (org?.active) return 'premium';
  }

  // Check if user is directly premium and not expired
  if (
    user.subscriptionTier === 'premium' &&
    (!user.subscriptionExpiry || user.subscriptionExpiry > new Date())
  ) {
    return 'premium';
  }

  // If user is a child with a parent, check parent's tier (family plan)
  if (user.parentUserId) {
    const parent = await prisma.user.findUnique({
      where: { id: user.parentUserId },
      select: { subscriptionTier: true, subscriptionExpiry: true },
    });

    if (
      parent?.subscriptionTier === 'premium' &&
      (!parent.subscriptionExpiry || parent.subscriptionExpiry > new Date())
    ) {
      // Check family plan limit: only the first N children (by creation date) get premium
      const firstChildren = await prisma.user.findMany({
        where: { parentUserId: user.parentUserId },
        orderBy: { createdAt: 'asc' },
        take: FAMILY_PLAN_MAX_CHILDREN,
        select: { id: true },
      });

      if (firstChildren.some((c) => c.id === userId)) {
        return 'premium';
      }
    }
  }

  return 'free';
}

/**
 * Count today's activity log entries for a user by type.
 * Uses UTC day boundaries.
 */
export async function countTodayUsage(
  userId: string,
  type: 'news_viewed' | 'reels_viewed' | 'quizzes_played',
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const count = await prisma.activityLog.count({
    where: {
      userId,
      type,
      createdAt: { gte: todayStart },
    },
  });

  return count;
}

/**
 * Get full subscription status for a user, including limits and today's usage.
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionExpiry: true,
      favoriteSports: true,
      parentUserId: true,
      organizationId: true,
      role: true,
    },
  });

  if (!user) {
    return {
      tier: 'free',
      expiry: null,
      limits: {
        newsPerDay: FREE_TIER_LIMITS.newsPerDay,
        reelsPerDay: FREE_TIER_LIMITS.reelsPerDay,
        quizPerDay: FREE_TIER_LIMITS.quizPerDay,
        sportsAllowed: [],
      },
      usage: { newsToday: 0, reelsToday: 0, quizToday: 0 },
      canUpgrade: true,
      familyPlan: false,
      childCount: 0,
    };
  }

  const tier = await resolveEffectiveTier(userId, {
    subscriptionTier: user.subscriptionTier as string,
    subscriptionExpiry: user.subscriptionExpiry as Date | null,
    parentUserId: user.parentUserId as string | null,
    organizationId: user.organizationId as string | null,
  });

  const [newsToday, reelsToday, quizToday] = await Promise.all([
    countTodayUsage(userId, 'news_viewed'),
    countTodayUsage(userId, 'reels_viewed'),
    countTodayUsage(userId, 'quizzes_played'),
  ]);

  // Count children for family plan info
  let childCount = 0;
  let familyPlan = false;
  if (user.role === 'parent' || !user.parentUserId) {
    childCount = await prisma.user.count({ where: { parentUserId: userId } });
    familyPlan = childCount > 0;
  } else if (user.parentUserId) {
    // Child: check parent's child count
    childCount = await prisma.user.count({ where: { parentUserId: user.parentUserId } });
    familyPlan = true;
  }

  if (tier === 'premium') {
    return {
      tier: 'premium',
      expiry: user.subscriptionExpiry?.toISOString() ?? null,
      limits: {
        newsPerDay: null,
        reelsPerDay: null,
        quizPerDay: null,
        sportsAllowed: null,
      },
      usage: { newsToday, reelsToday, quizToday },
      canUpgrade: false,
      familyPlan,
      childCount,
    };
  }

  // Free tier
  const sportsAllowed =
    user.favoriteSports.length > 0 ? [user.favoriteSports[0]] : null;

  return {
    tier: 'free',
    expiry: null,
    limits: {
      newsPerDay: FREE_TIER_LIMITS.newsPerDay,
      reelsPerDay: FREE_TIER_LIMITS.reelsPerDay,
      quizPerDay: FREE_TIER_LIMITS.quizPerDay,
      sportsAllowed,
    },
    usage: { newsToday, reelsToday, quizToday },
    canUpgrade: true,
    familyPlan,
    childCount,
  };
}

/**
 * RevenueCat webhook event type.
 */
export interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    type: string;
    app_user_id: string;
    product_id?: string;
    expiration_at_ms?: number;
    environment?: string;
  };
}

/**
 * Process a RevenueCat webhook event.
 * Updates subscription tier for the parent and all linked children.
 */
export async function processWebhookEvent(payload: RevenueCatWebhookEvent): Promise<void> {
  const { type, app_user_id, expiration_at_ms } = payload.event;

  logger.info({ type, app_user_id }, 'Processing RevenueCat webhook event');

  // Find the parental profile by RevenueCat customer ID
  const profile = await prisma.parentalProfile.findUnique({
    where: { revenuecatCustomerId: app_user_id },
    select: { userId: true },
  });

  if (!profile) {
    logger.warn({ app_user_id }, 'RevenueCat webhook: no parental profile found for customer ID');
    return; // Return 200 to prevent retry — unknown customer
  }

  const parentId = profile.userId;

  // Find all children linked to this parent
  const children = await prisma.user.findMany({
    where: { parentUserId: parentId },
    select: { id: true },
  });

  const allUserIds = [parentId, ...children.map((c) => c.id)];
  const expiry = expiration_at_ms ? new Date(expiration_at_ms) : null;

  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE': {
      await prisma.$transaction(
        allUserIds.map((id) =>
          prisma.user.update({
            where: { id },
            data: {
              subscriptionTier: 'premium',
              subscriptionExpiry: expiry,
            },
          }),
        ),
      );
      logger.info({ parentId, childCount: children.length, type }, 'Subscription activated/renewed');
      break;
    }

    case 'CANCELLATION': {
      // Keep premium until expiry — do not revoke immediately
      // Just update the expiry date if provided
      if (expiry) {
        await prisma.$transaction(
          allUserIds.map((id) =>
            prisma.user.update({
              where: { id },
              data: { subscriptionExpiry: expiry },
            }),
          ),
        );
      }
      logger.info({ parentId, type }, 'Subscription cancelled — premium until expiry');
      break;
    }

    case 'EXPIRATION': {
      await prisma.$transaction(
        allUserIds.map((id) =>
          prisma.user.update({
            where: { id },
            data: {
              subscriptionTier: 'free',
              subscriptionExpiry: null,
            },
          }),
        ),
      );
      logger.info({ parentId, childCount: children.length, type }, 'Subscription expired — reverted to free');
      break;
    }

    case 'BILLING_ISSUE': {
      // Keep premium — RevenueCat retries billing automatically
      logger.warn({ parentId, type }, 'Billing issue — keeping premium, RevenueCat will retry');
      break;
    }

    default: {
      logger.warn({ type, app_user_id }, 'Unhandled RevenueCat webhook event type');
    }
  }
}
