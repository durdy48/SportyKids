import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { safeJsonParse } from '../utils/safe-json-parse';

// In-memory cache with 60s TTL — only store needed fields, never the PIN hash
interface CachedProfile {
  allowedFormats: string;
  allowedSports: string;
  maxDailyTimeMinutes: number | null;
  maxNewsMinutes: number | null;
  maxReelsMinutes: number | null;
  maxQuizMinutes: number | null;
  allowedHoursStart: number;
  allowedHoursEnd: number;
  timezone: string;
}

// Map route-derived format to per-type limit field and activity log type
const FORMAT_TO_LIMIT_KEY: Record<string, keyof Pick<CachedProfile, 'maxNewsMinutes' | 'maxReelsMinutes' | 'maxQuizMinutes'>> = {
  news: 'maxNewsMinutes',
  reels: 'maxReelsMinutes',
  quiz: 'maxQuizMinutes',
};

const FORMAT_TO_ACTIVITY_TYPE: Record<string, string> = {
  news: 'news_viewed',
  reels: 'reels_viewed',
  quiz: 'quizzes_played',
};
const profileCache = new Map<string, { profile: CachedProfile; fetchedAt: number }>();
const CACHE_TTL = 60_000;

export function invalidateProfileCache(userId: string) {
  profileCache.delete(userId);
}

/**
 * Get the current hour (0-23) in a given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
export function getCurrentHourInTimezone(timezone: string, now?: Date): number {
  const date = now ?? new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Check if the current time falls within the allowed schedule window.
 * Handles ranges that cross midnight (e.g., start=22, end=6).
 */
export function isWithinSchedule(currentHour: number, start: number, end: number): boolean {
  if (start <= end) {
    // Normal range: e.g., 7-21
    return currentHour >= start && currentHour < end;
  } else {
    // Crosses midnight: e.g., 22-6 means allowed from 22:00 to 05:59
    return currentHour >= start || currentHour < end;
  }
}

export async function parentalGuard(req: Request, res: Response, next: NextFunction) {
  // 1. Extract userId from query param or header
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  if (!userId) return next();

  // 2. Fetch profile (cached)
  let cached = profileCache.get(userId);
  if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL) {
    const fullProfile = await prisma.parentalProfile.findUnique({
      where: { userId },
      select: {
        userId: true,
        allowedFormats: true,
        allowedSports: true,
        maxDailyTimeMinutes: true,
        maxNewsMinutes: true,
        maxReelsMinutes: true,
        maxQuizMinutes: true,
        allowedHoursStart: true,
        allowedHoursEnd: true,
        timezone: true,
      },
    });
    if (!fullProfile) return next();
    cached = {
      profile: {
        allowedFormats: fullProfile.allowedFormats,
        allowedSports: fullProfile.allowedSports,
        maxDailyTimeMinutes: fullProfile.maxDailyTimeMinutes,
        maxNewsMinutes: fullProfile.maxNewsMinutes,
        maxReelsMinutes: fullProfile.maxReelsMinutes,
        maxQuizMinutes: fullProfile.maxQuizMinutes,
        allowedHoursStart: fullProfile.allowedHoursStart,
        allowedHoursEnd: fullProfile.allowedHoursEnd,
        timezone: fullProfile.timezone,
      },
      fetchedAt: Date.now(),
    };
    profileCache.set(userId, cached);
  }
  const profile = cached.profile;

  // 3. Check schedule lock (B-PT4)
  const currentHour = getCurrentHourInTimezone(profile.timezone);
  if (!isWithinSchedule(currentHour, profile.allowedHoursStart, profile.allowedHoursEnd)) {
    res.status(403).json({
      error: 'schedule_locked',
      message: 'Outside allowed hours',
      allowedHoursStart: profile.allowedHoursStart,
      allowedHoursEnd: profile.allowedHoursEnd,
      timezone: profile.timezone,
    });
    return;
  }

  // 4. Determine format from route path
  const path = req.baseUrl; // /api/news, /api/reels, /api/quiz
  let format = '';
  if (path.includes('/news')) format = 'news';
  else if (path.includes('/reels')) format = 'reels';
  else if (path.includes('/quiz')) format = 'quiz';

  // 5. Check format restriction
  if (format) {
    const allowed: string[] = safeJsonParse(profile.allowedFormats, []);
    if (allowed.length > 0 && !allowed.includes(format)) {
      res.status(403).json({
        error: 'format_blocked',
        message: `Format "${format}" is not allowed`,
      });
      return;
    }
  }

  // 6. Check sport restriction
  const sport = req.query.sport as string;
  if (sport) {
    const allowedSports: string[] = safeJsonParse(profile.allowedSports, []);
    if (allowedSports.length > 0 && !allowedSports.includes(sport)) {
      res.status(403).json({
        error: 'sport_blocked',
        message: `Sport "${sport}" is not allowed`,
      });
      return;
    }
  }

  // 7. Check daily time limit (per-type limit takes precedence over global)
  const perTypeLimitKey = format ? FORMAT_TO_LIMIT_KEY[format] : undefined;
  const perTypeLimit = perTypeLimitKey ? profile[perTypeLimitKey] : null;
  const effectiveLimit = perTypeLimit ?? profile.maxDailyTimeMinutes;

  if (effectiveLimit && effectiveLimit > 0) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // When using a per-type limit, filter by specific activity type;
    // when using global limit, aggregate all activity types
    const whereClause: Record<string, unknown> = {
      userId,
      createdAt: { gte: todayStart },
    };
    if (perTypeLimit != null && format) {
      whereClause.type = FORMAT_TO_ACTIVITY_TYPE[format];
    }

    const aggregation = await prisma.activityLog.aggregate({
      _sum: { durationSeconds: true },
      where: whereClause,
    });

    const totalSeconds = aggregation._sum.durationSeconds ?? 0;
    const limitSeconds = effectiveLimit * 60;

    if (totalSeconds >= limitSeconds) {
      res.status(403).json({
        error: 'limit_reached',
        message: perTypeLimit != null ? `Daily ${format} time limit reached` : 'Daily time limit reached',
        format: format || undefined,
        limit: effectiveLimit,
        used: Math.round(totalSeconds / 60),
      });
      return;
    }
  }

  next();
}
