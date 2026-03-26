import jwt from 'jsonwebtoken';
import { compare, hash } from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/database';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('[AUTH] FATAL: JWT_SECRET is not set. This is required in production.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JwtPayload {
  userId: string;
  role: 'child' | 'parent';
  parentUserId?: string;
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export async function generateRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });

  return { token, expiresAt };
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    // Clean up expired token
    if (stored) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
    }
    return null;
  }

  // Rotate: delete old, create new
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const payload: JwtPayload = {
    userId: stored.userId,
    role: (stored.user.role as 'child' | 'parent') || 'child',
    parentUserId: stored.user.parentUserId || undefined,
  };

  const accessToken = generateAccessToken(payload);
  const newRefresh = await generateRefreshToken(stored.userId);

  return { accessToken, refreshToken: newRefresh.token };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}
