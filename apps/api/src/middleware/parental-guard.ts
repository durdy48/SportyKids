import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

// In-memory cache with 60s TTL — only store needed fields, never the PIN hash
interface CachedProfile {
  allowedFormats: string;
  allowedSports: string;
  maxDailyTimeMinutes: number | null;
}
const profileCache = new Map<string, { profile: CachedProfile; fetchedAt: number }>();
const CACHE_TTL = 60_000;

export function invalidateProfileCache(userId: string) {
  profileCache.delete(userId);
}

export async function parentalGuard(req: Request, res: Response, next: NextFunction) {
  // 1. Extract userId from query param or header
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  if (!userId) return next();

  // 2. Fetch profile (cached)
  let cached = profileCache.get(userId);
  if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL) {
    const fullProfile = await prisma.parentalProfile.findUnique({ where: { userId } });
    if (!fullProfile) return next();
    cached = {
      profile: {
        allowedFormats: fullProfile.allowedFormats,
        allowedSports: fullProfile.allowedSports,
        maxDailyTimeMinutes: fullProfile.maxDailyTimeMinutes,
      },
      fetchedAt: Date.now(),
    };
    profileCache.set(userId, cached);
  }
  const profile = cached.profile;

  // 3. Determine format from route path
  const path = req.baseUrl; // /api/news, /api/reels, /api/quiz
  let format = '';
  if (path.includes('/news')) format = 'news';
  else if (path.includes('/reels')) format = 'reels';
  else if (path.includes('/quiz')) format = 'quiz';

  // 4. Check format restriction
  if (format) {
    let allowed: string[] = [];
    try {
      allowed = JSON.parse(profile.allowedFormats || '[]');
    } catch {
      // Invalid JSON — default to no restrictions
    }
    if (allowed.length > 0 && !allowed.includes(format)) {
      res.status(403).json({
        error: 'format_blocked',
        message: `Format "${format}" is not allowed`,
      });
      return;
    }
  }

  // 5. Check sport restriction
  const sport = req.query.sport as string;
  if (sport) {
    let allowedSports: string[] = [];
    try {
      allowedSports = JSON.parse(profile.allowedSports || '[]');
    } catch {
      // Invalid JSON — default to no restrictions
    }
    if (allowedSports.length > 0 && !allowedSports.includes(sport)) {
      res.status(403).json({
        error: 'sport_blocked',
        message: `Sport "${sport}" is not allowed`,
      });
      return;
    }
  }

  // 6. Check daily time limit
  if (profile.maxDailyTimeMinutes && profile.maxDailyTimeMinutes > 0) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const aggregation = await prisma.activityLog.aggregate({
      _sum: { durationSeconds: true },
      where: { userId, createdAt: { gte: todayStart } },
    });

    const totalSeconds = aggregation._sum.durationSeconds ?? 0;
    const limitSeconds = profile.maxDailyTimeMinutes * 60;

    if (totalSeconds >= limitSeconds) {
      res.status(403).json({
        error: 'limit_reached',
        message: 'Daily time limit reached',
        limit: profile.maxDailyTimeMinutes,
        used: Math.round(totalSeconds / 60),
      });
      return;
    }
  }

  next();
}
