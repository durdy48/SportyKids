import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { FREE_TIER_LIMITS } from '@sportykids/shared';
import { resolveEffectiveTier, countTodayUsage } from '../services/subscription';
import { AuthorizationError } from '../errors';

type ContentFormat = 'news' | 'reels' | 'quiz';

const FORMAT_TO_ACTIVITY_TYPE: Record<ContentFormat, 'news_viewed' | 'reels_viewed' | 'quizzes_played'> = {
  news: 'news_viewed',
  reels: 'reels_viewed',
  quiz: 'quizzes_played',
};

const FORMAT_TO_LIMIT: Record<ContentFormat, number> = {
  news: FREE_TIER_LIMITS.newsPerDay,
  reels: FREE_TIER_LIMITS.reelsPerDay,
  quiz: FREE_TIER_LIMITS.quizPerDay,
};

/**
 * Middleware factory that enforces free tier subscription limits on content routes.
 *
 * - Checks daily usage count against free tier limits
 * - Restricts sport filter to first favoriteSport for free users
 * - Premium users pass through without checks
 * - Anonymous requests (no userId) pass through
 *
 * Middleware order: authMiddleware -> parentalGuard -> subscriptionGuard -> route handler
 */
export function subscriptionGuard(format: ContentFormat) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Prefer authenticated JWT userId over query/header to prevent IDOR
    const userId = req.auth?.userId
      || (req.query.userId as string)
      || (req.headers['x-user-id'] as string);
    if (!userId) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        subscriptionExpiry: true,
        parentUserId: true,
        favoriteSports: true,
        organizationId: true,
      },
    });

    if (!user) {
      next();
      return;
    }

    const tier = await resolveEffectiveTier(userId, {
      subscriptionTier: user.subscriptionTier as string,
      subscriptionExpiry: user.subscriptionExpiry as Date | null,
      parentUserId: user.parentUserId as string | null,
      organizationId: user.organizationId as string | null,
    });

    if (tier === 'premium') {
      next();
      return;
    }

    // Free tier checks: daily usage limit
    const activityType = FORMAT_TO_ACTIVITY_TYPE[format];
    const todayCount = await countTodayUsage(userId, activityType);
    const limit = FORMAT_TO_LIMIT[format];

    if (todayCount >= limit) {
      throw new AuthorizationError('Daily limit reached', {
        error: 'subscription_limit_reached',
        limitType: format,
        limit,
        used: todayCount,
        tier: 'free',
      });
    }

    // Cap query limit for free tier: remaining daily allowance
    const remaining = limit - todayCount;
    const requestedLimit = parseInt(req.query.limit as string, 10);
    if (requestedLimit && remaining < requestedLimit) {
      (req.query as Record<string, string>).limit = String(Math.max(remaining, 0));
    }

    // Sport restriction for free tier (news and reels only)
    if (format === 'news' || format === 'reels') {
      const sport = req.query.sport as string | undefined;
      const allowedSport = user.favoriteSports[0];
      if (sport && allowedSport && sport !== allowedSport) {
        throw new AuthorizationError('Sport not available on free plan', {
          error: 'subscription_sport_restricted',
          allowedSports: [allowedSport],
          tier: 'free',
        });
      }
    }

    next();
  };
}
