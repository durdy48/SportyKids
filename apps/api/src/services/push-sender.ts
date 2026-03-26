import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../config/database';

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
      try {
        const prefs = JSON.parse(user.pushPreferences);
        if (preference === 'dailyQuiz' && !prefs.dailyQuiz) return;
        if (preference === 'teamUpdates' && !prefs.teamUpdates) return;
      } catch {
        // Invalid preferences JSON — send anyway
      }
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
    console.error(`[push-sender] Error sending to user ${userId}:`, error);
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
        try {
          const prefs = JSON.parse(user.pushPreferences);
          if (preference === 'dailyQuiz' && !prefs.dailyQuiz) return false;
          if (preference === 'teamUpdates' && !prefs.teamUpdates) return false;
        } catch {
          // Invalid preferences — include user
        }
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
    console.error('[push-sender] Error sending to users:', error);
  }
}

/**
 * Internal: send push to raw Expo push tokens, handling batching and receipts.
 */
async function sendToTokens(pushTokens: string[], payload: PushPayload): Promise<void> {
  const messages: ExpoPushMessage[] = [];

  for (const token of pushTokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`[push-sender] Invalid Expo push token: ${token}`);
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
            console.log(`[push-sender] Deactivated token: ${targetToken}`);
          }
        }
      }
    } catch (error) {
      console.error('[push-sender] Error sending chunk:', error);
    }
  }
}
