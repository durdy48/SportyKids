import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SUPPORTED_LOCALES, SUPPORTED_COUNTRIES } from '@sportykids/shared';
import type { LiveScorePreferences } from '@sportykids/shared';
import { prisma } from '../config/database';
import { formatUser } from '../utils/format-user';
import { trackEvent } from '../services/monitoring';
import { verifyParentalSession } from '../services/parental-session';
import { requireAuth } from '../middleware/auth';
import { ValidationError, NotFoundError, AuthorizationError } from '../errors';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(1).max(50),
  age: z.number().int().min(4).max(18),
  favoriteSports: z.array(z.string()).min(1),
  favoriteTeam: z.string().optional(),
  selectedFeeds: z.array(z.string()).default([]),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  country: z.enum(SUPPORTED_COUNTRIES).optional(),
  ageGateCompleted: z.boolean().default(false),
  consentGiven: z.boolean().default(false),
});

const updateUserSchema = createUserSchema.partial().extend({
  consentBy: z.string().optional(),
  // Override: no default on update — absence means "don't change"
  selectedFeeds: z.array(z.string()).optional(),
});

// POST /api/users — Create user
router.post('/', async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const { favoriteSports, selectedFeeds, locale, country, ageGateCompleted, consentGiven, ...rest } = parsed.data;

  const user = await prisma.user.create({
    data: {
      ...rest,
      favoriteSports,
      selectedFeeds,
      ageGateCompleted,
      consentGiven,
      ...(consentGiven ? { consentDate: new Date() } : {}),
      ...(locale ? { locale } : {}),
      ...(country ? { country } : {}),
    },
  });

  trackEvent('onboarding_completed', {
    userId: user.id,
    sports: parsed.data.favoriteSports,
    ageRange: parsed.data.age?.toString(),
    country: parsed.data.country,
  });

  res.status(201).json(formatUser(user));
});

// GET /api/users/:id — Get user
router.get('/:id', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json(formatUser(user));
});

// PUT /api/users/:id — Update preferences
router.put('/:id', async (req: Request, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const exists = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, consentGiven: true },
  });
  if (!exists) {
    throw new NotFoundError('User not found');
  }

  const { favoriteSports, selectedFeeds, locale, country, ageGateCompleted, consentGiven, consentBy, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (favoriteSports) data.favoriteSports = favoriteSports;
  if (selectedFeeds !== undefined) data.selectedFeeds = selectedFeeds;
  if (locale !== undefined) data.locale = locale;
  if (country !== undefined) data.country = country;
  if (ageGateCompleted !== undefined) data.ageGateCompleted = ageGateCompleted;
  if (consentGiven !== undefined) {
    data.consentGiven = consentGiven;
    // Auto-set consentDate when transitioning to true
    if (consentGiven && !exists.consentGiven) {
      data.consentDate = new Date();
    }
  }
  if (consentBy !== undefined) data.consentBy = consentBy;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
  });

  res.json(formatUser(user));
});

// DELETE /api/users/:id/data — Delete user and all related data (GDPR/COPPA)
// Authorization: valid JWT (self or parent) OR valid parental session for the user.
// Anonymous users without JWT can delete via parental session (PIN-verified).
router.delete('/:id/data', async (req: Request, res: Response) => {
  const userId = req.params.id;

  // Find the target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { parentalProfile: true },
  });

  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  // Check authorization: JWT auth OR parental session
  const authUser = req.auth; // may be null for anonymous users
  const sessionToken = req.headers['x-parental-session'] as string | undefined;
  const sessionUserId = await verifyParentalSession(sessionToken);

  const hasJwtAuth = authUser && (authUser.userId === userId || authUser.userId === targetUser.parentUserId);
  const hasParentalSession = sessionUserId === userId;

  if (!hasJwtAuth && !hasParentalSession) {
    throw new AuthorizationError('Not authorized to delete this user. Provide a valid JWT or parental session.');
  }

  // Child accounts with parental profile always require a valid parental session
  if (targetUser.parentalProfile && !hasParentalSession) {
    throw new AuthorizationError('Valid parental session required to delete child account');
  }

  // Delete all related records in a transaction
  await prisma.$transaction([
    prisma.pushToken.deleteMany({ where: { userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.parentalSession.deleteMany({ where: { userId } }),
    prisma.activityLog.deleteMany({ where: { userId } }),
    prisma.contentReport.deleteMany({ where: { userId } }),
    prisma.userSticker.deleteMany({ where: { userId } }),
    prisma.userAchievement.deleteMany({ where: { userId } }),
    prisma.dailyMission.deleteMany({ where: { userId } }),
    prisma.parentalProfile.deleteMany({ where: { userId } }),
    // Unlink children before deleting parent (FK constraint)
    prisma.user.updateMany({ where: { parentUserId: userId }, data: { parentUserId: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  trackEvent('user_data_deleted', { userId });

  res.json({ deleted: true, userId, deletedAt: new Date().toISOString() });
});

// POST /api/users/:id/notifications/subscribe — Update push notification preferences
const notificationSubscribeSchema = z.object({
  enabled: z.boolean(),
  preferences: z.object({
    sports: z.boolean().default(true),
    dailyQuiz: z.boolean().default(true),
    teamUpdates: z.boolean().default(true),
    liveScores: z.object({
      enabled: z.boolean(),
      goals: z.boolean(),
      matchStart: z.boolean(),
      matchEnd: z.boolean(),
      halfTime: z.boolean(),
      redCards: z.boolean(),
    }).optional(),
  }).optional(),
  pushToken: z.string().optional(),
  platform: z.enum(['expo', 'web']).optional(),
});

router.post('/:id/notifications/subscribe', async (req: Request, res: Response) => {
  const parsed = notificationSubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const { enabled, preferences, pushToken, platform } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      pushEnabled: enabled,
      pushPreferences: preferences ?? user.pushPreferences,
    },
  });

  // Upsert push token if provided
  if (pushToken && platform) {
    await prisma.pushToken.upsert({
      where: { token: pushToken },
      create: { userId: req.params.id, token: pushToken, platform, active: enabled },
      update: { active: enabled, userId: req.params.id },
    });
  }

  // If disabling, deactivate all push tokens for this user
  if (!enabled) {
    await prisma.pushToken.updateMany({
      where: { userId: req.params.id },
      data: { active: false },
    });
  }

  res.json({
    pushEnabled: updated.pushEnabled,
    pushPreferences: updated.pushPreferences ?? null,
  });
});

// PUT /api/users/:id/notifications/live-scores — Update live score preferences
const liveScorePreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  goals: z.boolean().optional(),
  matchStart: z.boolean().optional(),
  matchEnd: z.boolean().optional(),
  halfTime: z.boolean().optional(),
  redCards: z.boolean().optional(),
}).strict();

router.put('/:id/notifications/live-scores', requireAuth, async (req: Request, res: Response) => {
  const userId = req.params.id;

  if (req.auth?.userId !== userId) {
    throw new ValidationError('Cannot update preferences for another user');
  }

  const parsed = liveScorePreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid live score preferences', parsed.error.flatten());
  }

  const prefs = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushPreferences: true },
  });

  if (!user) throw new NotFoundError('User not found');

  const currentPrefs = (user.pushPreferences ?? {}) as Record<string, unknown>;
  const currentLiveScores = (currentPrefs.liveScores ?? {
    enabled: false,
    goals: true,
    matchStart: true,
    matchEnd: true,
    halfTime: true,
    redCards: true,
  }) as LiveScorePreferences;

  const updatedLiveScores: LiveScorePreferences = {
    ...currentLiveScores,
    ...prefs,
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      pushPreferences: {
        ...currentPrefs,
        liveScores: updatedLiveScores,
      },
    },
  });

  res.json({ liveScores: updatedLiveScores });
});

// GET /api/users/:id/notifications — Get push notification settings
router.get('/:id/notifications', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    pushEnabled: user.pushEnabled,
    pushPreferences: user.pushPreferences ?? null,
  });
});


export default router;
