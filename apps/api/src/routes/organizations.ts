import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SPORTS } from '@sportykids/shared';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireOrgAdmin } from '../middleware/require-org-admin';
import { prisma } from '../config/database';
import { generateUniqueCode, generateUniqueSlug } from '../services/invite-code';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../errors';
import { logger } from '../services/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  sport: z.enum(SPORTS as unknown as [string, ...string[]]),
  logoUrl: z.string().url().optional(),
  customColors: z
    .object({
      primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })
    .optional(),
  maxMembers: z.number().int().min(5).max(500).optional(),
});

const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  customColors: z
    .object({
      primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })
    .nullable()
    .optional(),
  maxMembers: z.number().int().min(5).max(500).optional(),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/organizations — Create organization
// ---------------------------------------------------------------------------

router.post('/', requireAuth, requireRole('parent'), async (req: Request, res: Response) => {
  const parsed = CreateOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid organization data', parsed.error.flatten());
  }

  const userId = req.auth!.userId;
  const { name, sport, logoUrl, customColors, maxMembers } = parsed.data;

  // Check if user already belongs to an org
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (existingUser?.organizationId) {
    throw new ConflictError('You already belong to an organization');
  }

  const [inviteCode, slug] = await Promise.all([
    generateUniqueCode(),
    generateUniqueSlug(name),
  ]);

  const [org] = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name,
        slug,
        sport,
        logoUrl: logoUrl ?? null,
        customColors: customColors ?? null,
        inviteCode,
        maxMembers: maxMembers ?? 100,
        createdBy: userId,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { organizationId: newOrg.id, organizationRole: 'admin' },
    });

    return [newOrg, updatedUser];
  });

  logger.info({ orgId: org.id, userId, slug }, 'Organization created');

  const memberCount = await prisma.user.count({ where: { organizationId: org.id } });

  res.status(201).json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    sport: org.sport,
    logoUrl: org.logoUrl,
    customColors: org.customColors,
    inviteCode: org.inviteCode,
    maxMembers: org.maxMembers,
    active: org.active,
    createdBy: org.createdBy,
    memberCount,
  });
});

// ---------------------------------------------------------------------------
// GET /api/organizations/:id — Get org details
// ---------------------------------------------------------------------------

router.get('/:id', requireAuth, requireOrgAdmin, async (req: Request, res: Response) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
  });

  if (!org) throw new NotFoundError('Organization not found');

  const memberCount = await prisma.user.count({ where: { organizationId: org.id } });

  res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    sport: org.sport,
    logoUrl: org.logoUrl,
    customColors: org.customColors,
    inviteCode: org.inviteCode,
    maxMembers: org.maxMembers,
    active: org.active,
    memberCount,
    createdAt: org.createdAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// PUT /api/organizations/:id — Update org settings
// ---------------------------------------------------------------------------

router.put('/:id', requireAuth, requireOrgAdmin, async (req: Request, res: Response) => {
  const parsed = UpdateOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid update data', parsed.error.flatten());
  }

  const currentOrg = await prisma.organization.findUnique({
    where: { id: req.params.id },
    select: { name: true },
  });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name;
    // Only regenerate slug if the name actually changed
    if (!currentOrg || parsed.data.name !== currentOrg.name) {
      data.slug = await generateUniqueSlug(parsed.data.name);
    }
  }
  if (parsed.data.logoUrl !== undefined) data.logoUrl = parsed.data.logoUrl;
  if (parsed.data.customColors !== undefined) data.customColors = parsed.data.customColors;
  if (parsed.data.maxMembers !== undefined) data.maxMembers = parsed.data.maxMembers;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;

  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data,
  });

  const memberCount = await prisma.user.count({ where: { organizationId: org.id } });

  res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    sport: org.sport,
    logoUrl: org.logoUrl,
    customColors: org.customColors,
    inviteCode: org.inviteCode,
    maxMembers: org.maxMembers,
    active: org.active,
    memberCount,
  });
});

// ---------------------------------------------------------------------------
// POST /api/organizations/:id/regenerate-code — Regenerate invite code
// ---------------------------------------------------------------------------

router.post('/:id/regenerate-code', requireAuth, requireOrgAdmin, async (req: Request, res: Response) => {
  const inviteCode = await generateUniqueCode();

  await prisma.organization.update({
    where: { id: req.params.id },
    data: { inviteCode },
  });

  logger.info({ orgId: req.params.id }, 'Invite code regenerated');

  res.json({ inviteCode });
});

// ---------------------------------------------------------------------------
// GET /api/organizations/:id/members — Paginated member list
// ---------------------------------------------------------------------------

router.get('/:id/members', requireAuth, requireOrgAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const sort = (req.query.sort as string) || 'name';
  const skip = (page - 1) * limit;

  type MemberOrderBy = { name?: 'asc' | 'desc'; lastActiveDate?: 'asc' | 'desc'; currentStreak?: 'asc' | 'desc' };
  let orderBy: MemberOrderBy = { name: 'asc' };
  if (sort === 'lastActive') orderBy = { lastActiveDate: 'desc' };
  if (sort === 'streak') orderBy = { currentStreak: 'desc' };

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: req.params.id },
      select: {
        id: true,
        name: true,
        age: true,
        totalPoints: true,
        currentStreak: true,
        lastActiveDate: true,
        createdAt: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.user.count({ where: { organizationId: req.params.id } }),
  ]);

  res.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      age: m.age,
      totalPoints: m.totalPoints,
      currentStreak: m.currentStreak,
      lastActiveDate: m.lastActiveDate?.toISOString() ?? null,
      joinedAt: m.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/organizations/:id/members/:userId — Remove member
// ---------------------------------------------------------------------------

router.delete('/:id/members/:userId', requireAuth, requireOrgAdmin, async (req: Request, res: Response) => {
  const targetUserId = req.params.userId;
  const orgId = req.params.id;

  // Cannot remove self (admin)
  if (targetUserId === req.auth!.userId) {
    throw new AuthorizationError('Cannot remove yourself from the organization');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { organizationId: true },
  });

  if (!targetUser || targetUser.organizationId !== orgId) {
    throw new NotFoundError('Member not found in this organization');
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { organizationId: null, organizationRole: null },
  });

  logger.info({ orgId, targetUserId }, 'Member removed from organization');

  res.json({ message: 'Member removed' });
});

// ---------------------------------------------------------------------------
// POST /api/organizations/:id/leave — Leave organization
// ---------------------------------------------------------------------------

router.post('/:id/leave', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const orgId = req.params.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, organizationRole: true },
  });

  if (!user || user.organizationId !== orgId) {
    throw new NotFoundError('You are not a member of this organization');
  }

  if (user.organizationRole === 'admin') {
    throw new AuthorizationError('Admins cannot leave their organization. Transfer admin role first.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: null, organizationRole: null },
  });

  logger.info({ orgId, userId }, 'Member left organization');

  res.json({ message: 'Left organization' });
});

// ---------------------------------------------------------------------------
// GET /api/organizations/:id/activity — Aggregate activity
// ---------------------------------------------------------------------------

router.get('/:id/activity', requireAuth, requireOrgAdmin, async (req: Request, res: Response) => {
  const orgId = req.params.id;
  const period = (req.query.period as string) || '7d';

  let daysBack = 7;
  if (period === '30d') daysBack = 30;
  if (period === 'all') daysBack = 365;

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // Get member IDs
  const members = await prisma.user.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      totalPoints: true,
      currentStreak: true,
      lastActiveDate: true,
    },
  });

  const memberIds = members.map((m) => m.id);
  const totalMembers = members.length;

  if (totalMembers === 0) {
    res.json({
      period,
      summary: {
        totalMembers: 0,
        activeMembers: 0,
        totalNewsRead: 0,
        totalReelsWatched: 0,
        totalQuizAnswered: 0,
        averageStreak: 0,
        averagePoints: 0,
      },
      daily: [],
      topMembers: [],
    });
    return;
  }

  // Aggregate activity counts by type using Prisma groupBy (avoids loading all rows)
  const typeCounts = await prisma.activityLog.groupBy({
    by: ['type'],
    where: {
      userId: { in: memberIds },
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });

  let totalNewsRead = 0;
  let totalReelsWatched = 0;
  let totalQuizAnswered = 0;
  for (const tc of typeCounts) {
    if (tc.type === 'news_viewed') totalNewsRead = tc._count._all;
    if (tc.type === 'reels_viewed') totalReelsWatched = tc._count._all;
    if (tc.type === 'quizzes_played') totalQuizAnswered = tc._count._all;
  }

  // Count distinct active members using groupBy on userId
  const activeUserGroups = await prisma.activityLog.groupBy({
    by: ['userId'],
    where: {
      userId: { in: memberIds },
      createdAt: { gte: since },
    },
  });
  const activeMemberCount = activeUserGroups.length;

  const averageStreak =
    members.reduce((sum, m) => sum + m.currentStreak, 0) / totalMembers;
  const averagePoints =
    members.reduce((sum, m) => sum + m.totalPoints, 0) / totalMembers;

  // Daily breakdown using a limited findMany with select (need date + type + userId for daily grouping)
  // Prisma groupBy does not support grouping by a date expression, so we use a bounded findMany
  const activityLogs = await prisma.activityLog.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: since },
    },
    select: {
      userId: true,
      type: true,
      createdAt: true,
    },
    take: 10000,
  });

  const dailyMap = new Map<string, { activeMembers: Set<string>; newsRead: number; reelsWatched: number; quizAnswered: number }>();

  for (const log of activityLogs) {
    const dateKey = log.createdAt.toISOString().slice(0, 10);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { activeMembers: new Set(), newsRead: 0, reelsWatched: 0, quizAnswered: 0 });
    }
    const day = dailyMap.get(dateKey)!;
    day.activeMembers.add(log.userId);
    if (log.type === 'news_viewed') day.newsRead++;
    if (log.type === 'reels_viewed') day.reelsWatched++;
    if (log.type === 'quizzes_played') day.quizAnswered++;
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      activeMembers: d.activeMembers.size,
      newsRead: d.newsRead,
      reelsWatched: d.reelsWatched,
      quizAnswered: d.quizAnswered,
    }));

  // Top 5 members by points
  const topMembers = [...members]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 5)
    .map((m) => ({
      name: m.name,
      points: m.totalPoints,
      streak: m.currentStreak,
    }));

  res.json({
    period,
    summary: {
      totalMembers,
      activeMembers: activeMemberCount,
      totalNewsRead,
      totalReelsWatched,
      totalQuizAnswered,
      averageStreak: Math.round(averageStreak * 10) / 10,
      averagePoints: Math.round(averagePoints),
    },
    daily,
    topMembers,
  });
});

export default router;
