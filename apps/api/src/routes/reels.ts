import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';

const router = Router();

const filtersSchema = z.object({
  sport: z.string().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// GET /api/reels — Reels feed with filters
router.get('/', async (req: Request, res: Response) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { sport, age, page, limit } = parsed.data;
  const where: Record<string, unknown> = {};
  if (sport) where.sport = sport;
  if (age) {
    where.minAge = { lte: age };
    where.maxAge = { gte: age };
  }

  const [reels, total] = await Promise.all([
    prisma.reel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.reel.count({ where }),
  ]);

  res.json({ reels, total, page, totalPages: Math.ceil(total / limit) });
});

// GET /api/reels/:id — Reel detail
router.get('/:id', async (req: Request, res: Response) => {
  const reel = await prisma.reel.findUnique({ where: { id: req.params.id } });
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }
  res.json(reel);
});

export default router;
