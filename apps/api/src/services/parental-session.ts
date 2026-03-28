import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from './logger';

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function createParentalSession(
  userId: string,
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.parentalSession.create({
    data: { userId, token: sessionToken, expiresAt },
  });

  logger.info({ userId }, 'Parental session created');
  return { sessionToken, expiresAt };
}

export async function verifyParentalSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  const session = await prisma.parentalSession.findUnique({ where: { token } });
  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    // Lazy cleanup of this expired session
    await prisma.parentalSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.userId;
}

export async function revokeParentalSessions(userId: string): Promise<void> {
  await prisma.parentalSession.deleteMany({ where: { userId } });
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.parentalSession.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  if (result.count > 0) {
    logger.info({ cleaned: result.count }, 'Expired parental sessions cleaned');
  }
  return result.count;
}
