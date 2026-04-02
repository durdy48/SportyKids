import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { z } from 'zod';
import { prisma } from '../config/database';
import {
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  hashPassword,
  verifyPassword,
  findOrCreateSocialUser,
  type JwtPayload,
} from '../services/auth-service';
import passport from '../services/passport';
import { requireAuth } from '../middleware/auth';
import { formatUser } from '../utils/format-user';
import { ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError } from '../errors';
import { apiCache } from '../services/cache';

const router = Router();

// ---------------------------------------------------------------------------
// Apple JWKS client — cached for 24 hours to avoid repeated fetches
// ---------------------------------------------------------------------------

const appleJwks = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  rateLimit: true,
});

interface AppleTokenPayload {
  sub: string;
  email?: string;
  nonce?: string;
  iss: string;
  aud: string;
}

/**
 * Verify an Apple identity token using Apple's JWKS public keys.
 * Checks signature, issuer, and audience claims.
 */
async function verifyAppleToken(idToken: string): Promise<AppleTokenPayload> {
  // Decode header to get the key ID (kid)
  const header = JSON.parse(Buffer.from(idToken.split('.')[0], 'base64').toString()) as { kid: string };

  const signingKey = await appleJwks.getSigningKey(header.kid);
  const publicKey = signingKey.getPublicKey();

  const decoded = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: process.env.APPLE_CLIENT_ID,
  }) as AppleTokenPayload;

  return decoded;
}

// ---------------------------------------------------------------------------
// OAuth state cache helpers — store state params with 5 min TTL
// ---------------------------------------------------------------------------

const OAUTH_STATE_TTL = 5 * 60 * 1000; // 5 minutes
const OAUTH_STATE_PREFIX = 'oauth:state:';

function storeOAuthState(state: string, data: Record<string, string> = {}): void {
  apiCache.set(`${OAUTH_STATE_PREFIX}${state}`, { valid: true, ...data }, OAUTH_STATE_TTL);
}

async function validateOAuthState(state: string | undefined): Promise<Record<string, string> | null> {
  if (!state) return null;
  const key = `${OAUTH_STATE_PREFIX}${state}`;
  const stored = await Promise.resolve(apiCache.get<Record<string, string>>(key));
  if (!stored) return null;
  // Invalidate after use (single-use token)
  await Promise.resolve(apiCache.invalidate(key));
  return stored;
}

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
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const { email, password, name, age, role } = parsed.data;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Email already registered');
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
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AuthenticationError('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Invalid email or password');
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
    throw new ValidationError('Refresh token required');
  }

  const result = await refreshAccessToken(refreshToken);
  if (!result) {
    throw new AuthenticationError('Invalid or expired refresh token');
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
    throw new NotFoundError('User not found');
  }
  res.json(formatUser(user));
});

// ---------------------------------------------------------------------------
// POST /api/auth/upgrade — Convert anonymous user to email account
// ---------------------------------------------------------------------------

router.post('/upgrade', requireAuth, async (req: Request, res: Response) => {
  const parsed = upgradeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const { userId, email, password } = parsed.data;

  // IDOR protection: caller can only upgrade their own account
  if (req.auth!.userId !== userId) {
    throw new AuthorizationError('Cannot upgrade another user\'s account');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.authProvider !== 'anonymous') {
    throw new ConflictError('User already has an account');
  }

  // Check if email is taken
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    throw new ConflictError('Email already registered');
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
    throw new AuthorizationError('Only parents can link children');
  }

  const parsed = linkChildSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const child = await prisma.user.findUnique({ where: { id: parsed.data.childUserId } });
  if (!child) {
    throw new NotFoundError('Child user not found');
  }

  if (child.parentUserId) {
    throw new ConflictError('Child already linked to a parent');
  }

  const updated = await prisma.user.update({
    where: { id: child.id },
    data: { parentUserId: req.auth!.userId },
  });

  res.json(formatUser(updated));
});

// ---------------------------------------------------------------------------
// GET /api/auth/providers — Which OAuth providers are available
// ---------------------------------------------------------------------------

router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    apple: !!process.env.APPLE_CLIENT_ID,
  });
});

// ---------------------------------------------------------------------------
// Google OAuth 2.0
// ---------------------------------------------------------------------------

router.get('/google', (req: Request, res: Response, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new NotFoundError('Google OAuth not configured');
  }

  // C1: Generate state and store it in cache for validation on callback
  const state = crypto.randomBytes(16).toString('hex');
  storeOAuthState(state);

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

/** Handle the Google OAuth callback — extracted for readability. */
async function handleGoogleCallback(
  err: Error | null,
  user: Record<string, unknown> | false,
  res: Response,
): Promise<void> {
  const redirectUrl = process.env.GOOGLE_SUCCESS_REDIRECT_URL || 'http://localhost:3000';

  if (err || !user) {
    res.redirect(`${redirectUrl}/login?error=google_auth_failed`);
    return;
  }

  const payload: JwtPayload = {
    userId: user.id as string,
    role: (user.role as 'child' | 'parent') || 'parent',
    parentUserId: (user.parentUserId as string) || undefined,
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id as string);

  res.redirect(
    `${redirectUrl}/auth/callback?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken.token)}`,
  );
}

router.get('/google/callback', async (req: Request, res: Response, next) => {
  const redirectUrl = process.env.GOOGLE_SUCCESS_REDIRECT_URL || 'http://localhost:3000';

  // C1: Validate the state parameter to prevent CSRF
  const stateValid = await validateOAuthState(req.query.state as string | undefined);
  if (!stateValid) {
    res.redirect(`${redirectUrl}/login?error=invalid_state`);
    return;
  }

  passport.authenticate('google', { session: false }, (err: Error | null, user: Record<string, unknown> | false) => {
    handleGoogleCallback(err, user, res);
  })(req, res, next);
});

// POST /api/auth/google/token — Mobile flow: verify Google ID token
router.post('/google/token', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken || typeof idToken !== 'string') {
    throw new ValidationError('ID token required');
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new NotFoundError('Google OAuth not configured');
  }

  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new AuthenticationError('Invalid Google ID token');
  }

  const googlePayload = ticket.getPayload();
  if (!googlePayload || !googlePayload.sub) {
    throw new AuthenticationError('Invalid Google ID token payload');
  }

  const { user } = await findOrCreateSocialUser(
    'google',
    googlePayload.sub,
    googlePayload.email || null,
    googlePayload.name || 'User',
  );

  const jwtPayload: JwtPayload = {
    userId: user.id,
    role: (user.role as 'child' | 'parent') || 'parent',
    parentUserId: user.parentUserId || undefined,
  };
  const accessToken = generateAccessToken(jwtPayload);
  const refreshToken = await generateRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken: refreshToken.token,
    user: formatUser(user),
  });
});

// ---------------------------------------------------------------------------
// Apple Sign In
// ---------------------------------------------------------------------------

router.get('/apple', (_req: Request, res: Response) => {
  if (!process.env.APPLE_CLIENT_ID) {
    throw new NotFoundError('Apple Sign In not configured');
  }

  // C1 + C3: Generate state and nonce, store nonce hash keyed by state for callback verification.
  // NOTE (W8): The scope 'name email' requires a configured Apple Services ID
  // in the Apple Developer Console with the "Sign In with Apple" capability enabled.
  // Without this configuration, Apple will not return name or email data.
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');

  // Store both state validity and nonce hash for verification on callback
  storeOAuthState(state, { nonceHash });

  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: process.env.APPLE_CALLBACK_URL || 'http://localhost:3001/api/auth/apple/callback',
    response_type: 'code id_token',
    scope: 'name email',
    response_mode: 'form_post',
    state,
    // Apple expects the SHA-256 hash of the nonce in the authorize request
    nonce: nonceHash,
  });

  res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});

// W4: URL-encoded body parsing scoped to Apple's form POST callback only
const appleUrlEncoded = express.urlencoded({ extended: true });

// Apple always POSTs the callback
router.post('/apple/callback', appleUrlEncoded, async (req: Request, res: Response) => {
  const { id_token, state, user: appleUserJson } = req.body;
  const redirectUrl = process.env.APPLE_SUCCESS_REDIRECT_URL || process.env.GOOGLE_SUCCESS_REDIRECT_URL || 'http://localhost:3000';

  if (!id_token) {
    return res.redirect(`${redirectUrl}/login?error=apple_auth_failed`);
  }

  try {
    // C1: Validate the state parameter to prevent CSRF
    const stateData = await validateOAuthState(state);
    if (!stateData) {
      return res.redirect(`${redirectUrl}/login?error=invalid_state`);
    }

    // C2: Verify the identity token using Apple's JWKS public keys
    const decoded = await verifyAppleToken(id_token);

    // C3: Verify the nonce claim matches what we stored
    if (stateData.nonceHash && decoded.nonce !== stateData.nonceHash) {
      return res.redirect(`${redirectUrl}/login?error=invalid_nonce`);
    }

    // Apple sends name only on first auth, as JSON string in `user` field
    let name = 'User';
    if (appleUserJson) {
      try {
        const appleUser = typeof appleUserJson === 'string' ? JSON.parse(appleUserJson) : appleUserJson;
        if (appleUser.name) {
          name = [appleUser.name.firstName, appleUser.name.lastName].filter(Boolean).join(' ') || 'User';
        }
      } catch {
        // Apple user JSON parsing failed, use default name
      }
    }

    const { user } = await findOrCreateSocialUser('apple', decoded.sub, decoded.email || null, name);

    const payload: JwtPayload = {
      userId: user.id,
      role: (user.role as 'child' | 'parent') || 'parent',
      parentUserId: user.parentUserId || undefined,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(user.id);

    res.redirect(
      `${redirectUrl}/auth/callback?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken.token)}`,
    );
  } catch {
    res.redirect(`${redirectUrl}/login?error=apple_auth_failed`);
  }
});

// POST /api/auth/apple/token — Mobile flow: verify Apple identity token
router.post('/apple/token', async (req: Request, res: Response) => {
  const { idToken, name, nonce } = req.body;
  if (!idToken || typeof idToken !== 'string') {
    throw new ValidationError('ID token required');
  }

  if (!process.env.APPLE_CLIENT_ID) {
    throw new NotFoundError('Apple Sign In not configured');
  }

  // C2: Verify the identity token using Apple's JWKS public keys
  let decoded: AppleTokenPayload;
  try {
    decoded = await verifyAppleToken(idToken);
  } catch {
    throw new AuthenticationError('Invalid Apple identity token');
  }

  if (!decoded.sub) {
    throw new AuthenticationError('Invalid Apple identity token: missing sub');
  }

  // C3: Verify nonce if provided by mobile client
  if (nonce) {
    const expectedNonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
    if (decoded.nonce !== expectedNonceHash) {
      throw new AuthenticationError('Invalid Apple identity token: nonce mismatch');
    }
  }

  const { user } = await findOrCreateSocialUser(
    'apple',
    decoded.sub,
    decoded.email || null,
    name || 'User',
  );

  const jwtPayload: JwtPayload = {
    userId: user.id,
    role: (user.role as 'child' | 'parent') || 'parent',
    parentUserId: user.parentUserId || undefined,
  };
  const accessToken = generateAccessToken(jwtPayload);
  const refreshToken = await generateRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken: refreshToken.token,
    user: formatUser(user),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/join-organization — Join organization with invite code
// ---------------------------------------------------------------------------

const JoinOrganizationSchema = z.object({
  inviteCode: z
    .string()
    .length(6)
    .regex(/^[A-Z0-9]{6}$/),
});

router.post('/join-organization', requireAuth, async (req: Request, res: Response) => {
  const parsed = JoinOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid invite code format', parsed.error.flatten());
  }

  const userId = req.auth!.userId;
  const { inviteCode } = parsed.data;

  // Check if user already belongs to an org
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, favoriteSports: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.organizationId) {
    throw new ConflictError('You already belong to an organization');
  }

  // Find org by invite code
  const org = await prisma.organization.findUnique({
    where: { inviteCode },
  });

  if (!org) {
    throw new NotFoundError('No organization found with this invite code');
  }

  if (!org.active) {
    throw new AuthorizationError('This organization is no longer active');
  }

  // Atomic capacity check + join inside transaction
  await prisma.$transaction(async (tx) => {
    // Re-check capacity inside transaction
    const memberCount = await tx.user.count({ where: { organizationId: org.id } });
    if (memberCount >= org.maxMembers) {
      throw new ConflictError('Organization is at capacity');
    }

    // Check user still has no org
    const freshUser = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (freshUser.organizationId) {
      throw new ConflictError('Already belongs to an organization');
    }

    const updateData: Record<string, unknown> = {
      organizationId: org.id,
      organizationRole: 'member',
    };

    // Auto-set favorite sport from org if user has no favorites
    if (!user.favoriteSports || user.favoriteSports.length === 0) {
      updateData.favoriteSports = [org.sport];
    }

    await tx.user.update({
      where: { id: userId },
      data: updateData,
    });
  });

  res.json({
    organizationId: org.id,
    organizationName: org.name,
    sport: org.sport,
    message: 'Successfully joined the organization',
  });
});

export default router;
