import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../config/database';
import { logger } from './logger';
import { isWithinAllowedHours } from './schedule-check';
import { EVENT_TO_PREFERENCE, buildNotificationPayload } from './live-scores';
import type { MatchEventType, MatchEvent, LiveScorePreferences } from '@sportykids/shared';

const expo = new Expo();

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  badge?: number;
}

type PushPreference = 'dailyQuiz' | 'teamUpdates' | null;

/**
 * Send push notification to a single user.
 * Checks pushEnabled and preference before sending.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  preference: PushPreference = null,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushEnabled: true, pushPreferences: true },
    });

    if (!user?.pushEnabled) return;

    if (preference && user.pushPreferences) {
      const prefs = user.pushPreferences as Record<string, unknown>;
      if (preference === 'dailyQuiz' && !prefs.dailyQuiz) return;
      if (preference === 'teamUpdates' && !prefs.teamUpdates) return;
    }

    const tokens = await prisma.pushToken.findMany({
      where: { userId, active: true },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    await sendToTokens(
      tokens.map((t) => t.token),
      payload,
    );
  } catch (error) {
    logger.error({ err: error, userId }, 'Error sending push to user');
  }
}

/**
 * Send push notification to multiple users.
 * Filters by pushEnabled and preference.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  preference: PushPreference = null,
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, pushEnabled: true },
      select: { id: true, pushPreferences: true },
    });

    const eligibleUserIds = users
      .filter((user) => {
        if (!preference) return true;
        if (!user.pushPreferences) return true;
        const prefs = user.pushPreferences as Record<string, unknown>;
        if (preference === 'dailyQuiz' && !prefs.dailyQuiz) return false;
        if (preference === 'teamUpdates' && !prefs.teamUpdates) return false;
        return true;
      })
      .map((u) => u.id);

    if (eligibleUserIds.length === 0) return;

    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: eligibleUserIds }, active: true },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    await sendToTokens(
      tokens.map((t) => t.token),
      payload,
    );
  } catch (error) {
    logger.error({ err: error }, 'Error sending push to users');
  }
}

/**
 * Send live score push notifications to users whose favoriteTeam matches.
 * Filters by liveScores preference, specific event type, and parental schedule lock.
 * Builds notification payloads per user locale for proper i18n.
 * Returns count of users notified.
 */
export async function sendLiveScoreToUsers(
  teamName: string,
  eventType: MatchEventType,
  eventOrPayload: MatchEvent | PushPayload,
  homeTeam?: string,
  awayTeam?: string,
): Promise<number> {
  try {
    // Find users with matching team, push enabled
    const users = await prisma.user.findMany({
      where: {
        favoriteTeam: { equals: teamName, mode: 'insensitive' },
        pushEnabled: true,
      },
      select: { id: true, pushPreferences: true, locale: true },
    });

    if (users.length === 0) return 0;

    const preferenceKey = EVENT_TO_PREFERENCE[eventType];

    // Pre-filter by liveScores preferences
    const prefFiltered = users.filter((user) => {
      const prefs = user.pushPreferences as Record<string, unknown> | null;
      if (!prefs?.liveScores) return false;
      const livePrefs = prefs.liveScores as LiveScorePreferences;
      if (!livePrefs.enabled) return false;
      if (!livePrefs[preferenceKey as keyof LiveScorePreferences]) return false;
      return true;
    });

    if (prefFiltered.length === 0) return 0;

    // Batch-fetch all parental profiles to avoid N+1 queries
    const profiles = await prisma.parentalProfile.findMany({
      where: { userId: { in: prefFiltered.map((u) => u.id) } },
      select: { userId: true, allowedHoursStart: true, allowedHoursEnd: true, timezone: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    // Filter by parental schedule lock
    const eligible: string[] = [];
    for (const user of prefFiltered) {
      const profile = profileMap.get(user.id);
      if (profile) {
        const allowed = isWithinAllowedHours(
          profile.allowedHoursStart,
          profile.allowedHoursEnd,
          profile.timezone,
        );
        if (!allowed) continue;
      }

      eligible.push(user.id);
    }

    if (eligible.length === 0) return 0;

    // Determine if caller passed event data (for per-locale payloads) or a pre-built payload
    const isEventData = homeTeam !== undefined && awayTeam !== undefined && 'type' in eventOrPayload;

    // Extract team names after type narrowing for safe usage below
    const resolvedHomeTeam = homeTeam as string;
    const resolvedAwayTeam = awayTeam as string;

    // Build locale→userIds map from eligible users
    const eligibleSet = new Set(eligible);
    const localeGroups = new Map<string, string[]>();
    for (const user of prefFiltered) {
      if (!eligibleSet.has(user.id)) continue;
      const loc = user.locale || 'es';
      const group = localeGroups.get(loc);
      if (group) {
        group.push(user.id);
      } else {
        localeGroups.set(loc, [user.id]);
      }
    }

    let totalNotified = 0;

    for (const [locale, userIds] of localeGroups) {
      const tokens = await prisma.pushToken.findMany({
        where: { userId: { in: userIds }, active: true },
        select: { token: true },
      });

      if (tokens.length === 0) continue;

      const payload = isEventData
        ? buildNotificationPayload(eventOrPayload as MatchEvent, resolvedHomeTeam, resolvedAwayTeam, locale)
        : eventOrPayload as PushPayload;

      await sendToTokens(
        tokens.map((t) => t.token),
        payload,
      );

      totalNotified += userIds.length;
    }

    logger.info(
      { teamName, eventType, usersNotified: totalNotified, locales: [...localeGroups.keys()] },
      'Live score notifications sent',
    );

    return totalNotified;
  } catch (error) {
    logger.error({ err: error, teamName, eventType }, 'Error sending live score notifications');
    return 0;
  }
}

/**
 * Internal: send push to raw Expo push tokens, handling batching and receipts.
 */
async function sendToTokens(pushTokens: string[], payload: PushPayload): Promise<void> {
  const messages: ExpoPushMessage[] = [];

  for (const token of pushTokens) {
    if (!Expo.isExpoPushToken(token)) {
      logger.warn({ token }, 'Invalid Expo push token');
      continue;
    }

    messages.push({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: payload.sound ?? 'default',
      badge: payload.badge,
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

      // Handle errors: deactivate invalid tokens
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'error') {
          const details = 'details' in ticket ? (ticket as { details?: { error?: string } }).details : undefined;
          if (details?.error === 'DeviceNotRegistered') {
            const msg = chunk[i] as ExpoPushMessage;
            const targetToken = (typeof msg.to === 'string' ? msg.to : msg.to[0]) as string;
            await prisma.pushToken.updateMany({
              where: { token: targetToken },
              data: { active: false },
            });
            logger.info({ token: targetToken }, 'Deactivated push token');
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error sending push notification chunk');
    }
  }
}
