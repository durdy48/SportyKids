import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import {
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  hashPassword,
  verifyPassword,
  type JwtPayload,
} from '../services/auth-service';
import { requireAuth } from '../middleware/auth';
import { formatUser } from '../utils/format-user';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(50),
  age: z.number().int().min(4).max(18).default(10),
  role: z.enum(['child', 'parent']).default('parent'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const upgradeSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
});

const linkChildSchema = z.object({
  childUserId: z.string(),
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const { email, password, name, age, role } = parsed.data;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      age,
      email,
      passwordHash: passwordHashed,
      authProvider: 'email',
      role,
      lastLoginAt: new Date(),
    },
  });

  const payload: JwtPayload = { userId: user.id, role: role as 'child' | 'parent' };
  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id);

  res.status(201).json({
    accessToken,
    refreshToken: refreshToken.token,
    user: formatUser(user),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: JwtPayload = {
    userId: user.id,
    role: (user.role as 'child' | 'parent') || 'child',
    parentUserId: user.parentUserId || undefined,
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken: refreshToken.token,
    user: formatUser(user),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  const result = await refreshAccessToken(refreshToken);
  if (!result) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  res.json(result);
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === 'string') {
    await revokeRefreshToken(refreshToken);
  }
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(formatUser(user));
});

// ---------------------------------------------------------------------------
// POST /api/auth/upgrade — Convert anonymous user to email account
// ---------------------------------------------------------------------------

router.post('/upgrade', requireAuth, async (req: Request, res: Response) => {
  const parsed = upgradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const { userId, email, password } = parsed.data;

  // IDOR protection: caller can only upgrade their own account
  if (req.auth!.userId !== userId) {
    res.status(403).json({ error: 'Cannot upgrade another user\'s account' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.authProvider !== 'anonymous') {
    res.status(409).json({ error: 'User already has an account' });
    return;
  }

  // Check if email is taken
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHashed = await hashPassword(password);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      passwordHash: passwordHashed,
      authProvider: 'email',
      lastLoginAt: new Date(),
    },
  });

  const payload: JwtPayload = {
    userId: updated.id,
    role: (updated.role as 'child' | 'parent') || 'child',
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(updated.id);

  res.json({
    accessToken,
    refreshToken: refreshToken.token,
    user: formatUser(updated),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/link-child — Parent links an anonymous child profile
// ---------------------------------------------------------------------------

router.post('/link-child', requireAuth, async (req: Request, res: Response) => {
  if (req.auth!.role !== 'parent') {
    res.status(403).json({ error: 'Only parents can link children' });
    return;
  }

  const parsed = linkChildSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const child = await prisma.user.findUnique({ where: { id: parsed.data.childUserId } });
  if (!child) {
    res.status(404).json({ error: 'Child user not found' });
    return;
  }

  if (child.parentUserId) {
    res.status(409).json({ error: 'Child already linked to a parent' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: child.id },
    data: { parentUserId: req.auth!.userId },
  });

  res.json(formatUser(updated));
});

// ---------------------------------------------------------------------------
// OAuth placeholder routes (planned)
// ---------------------------------------------------------------------------
// Implementation plan:
// 1. Google OAuth 2.0:
//    - GET /api/auth/google → redirect to Google consent screen
//    - GET /api/auth/google/callback → exchange code for tokens, upsert user
//    - Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
//    - Library: googleapis or passport-google-oauth20
//
// 2. Apple Sign In:
//    - GET /api/auth/apple → redirect to Apple authorization
//    - GET /api/auth/apple/callback → verify identity token, upsert user
//    - Requires: APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
//    - Library: apple-signin-auth
//
// 3. Common flow for both:
//    - On first login: create User with authProvider = 'google' | 'apple'
//    - On subsequent logins: update lastLoginAt
//    - Link to existing email account if same email found
//    - Issue JWT access + refresh tokens (same as email auth)
// ---------------------------------------------------------------------------

router.get('/google', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Google OAuth not yet implemented',
    provider: 'google',
    status: 'planned',
  });
});

router.get('/google/callback', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Google OAuth callback not yet implemented',
    provider: 'google',
    status: 'planned',
  });
});

router.get('/apple', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Apple Sign In not yet implemented',
    provider: 'apple',
    status: 'planned',
  });
});

router.get('/apple/callback', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Apple Sign In callback not yet implemented',
    provider: 'apple',
    status: 'planned',
  });
});

export default router;
