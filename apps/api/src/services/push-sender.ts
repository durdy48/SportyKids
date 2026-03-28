import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../config/database';
import { logger } from './logger';

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
