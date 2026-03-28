import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SUPPORTED_LOCALES, SUPPORTED_COUNTRIES } from '@sportykids/shared';
import { prisma } from '../config/database';
import { formatUser } from '../utils/format-user';
import { trackEvent } from '../services/monitoring';
import { ValidationError, NotFoundError } from '../errors';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(1).max(50),
  age: z.number().int().min(4).max(18),
  favoriteSports: z.array(z.string()).min(1),
  favoriteTeam: z.string().optional(),
  selectedFeeds: z.array(z.string()).default([]),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  country: z.enum(SUPPORTED_COUNTRIES).optional(),
});

const updateUserSchema = createUserSchema.partial();

// POST /api/users — Create user
router.post('/', async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const { favoriteSports, selectedFeeds, locale, country, ...rest } = parsed.data;

  const user = await prisma.user.create({
    data: {
      ...rest,
      favoriteSports,
      selectedFeeds,
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

  const exists = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    throw new NotFoundError('User not found');
  }

  const { favoriteSports, selectedFeeds, locale, country, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (favoriteSports) data.favoriteSports = favoriteSports;
  if (selectedFeeds) data.selectedFeeds = selectedFeeds;
  if (locale !== undefined) data.locale = locale;
  if (country !== undefined) data.country = country;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
  });

  res.json(formatUser(user));
});

// POST /api/users/:id/notifications/subscribe — Update push notification preferences
const notificationSubscribeSchema = z.object({
  enabled: z.boolean(),
  preferences: z.object({
    sports: z.boolean().default(true),
    dailyQuiz: z.boolean().default(true),
    teamUpdates: z.boolean().default(true),
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
