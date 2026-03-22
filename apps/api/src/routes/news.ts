import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { runManualSync } from '../jobs/sync-feeds';

const router = Router();

const filtersSchema = z.object({
  sport: z.string().optional(),
  team: z.string().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  source: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/news — List with filters and pagination
router.get('/', async (req: Request, res: Response) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { sport, team, age, source, page, limit } = parsed.data;

  const where: Record<string, unknown> = {};
  if (sport) where.sport = sport;
  if (team) where.team = { contains: team };
  if (source) where.source = { contains: source };
  if (age) {
    where.minAge = { lte: age };
    where.maxAge = { gte: age };
  }

  const [news, total] = await Promise.all([
    prisma.newsItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.newsItem.count({ where }),
  ]);

  res.json({
    news,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/news/:id — News item detail
router.get('/:id', async (req: Request, res: Response) => {
  const newsItem = await prisma.newsItem.findUnique({
    where: { id: req.params.id },
  });

  if (!newsItem) {
    res.status(404).json({ error: 'News item not found' });
    return;
  }

  res.json(newsItem);
});

// GET /api/news/fuentes/listado — List active RSS sources
router.get('/fuentes/listado', async (_req: Request, res: Response) => {
  const sources = await prisma.rssSource.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  res.json(sources);
});

// POST /api/news/sincronizar — Manual synchronization
router.post('/sincronizar', async (_req: Request, res: Response) => {
  const total = await runManualSync();
  res.json({ message: 'Synchronization complete', newsAdded: total });
});

export default router;
