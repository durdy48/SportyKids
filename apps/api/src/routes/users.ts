import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(1).max(50),
  age: z.number().int().min(4).max(18),
  favoriteSports: z.array(z.string()).min(1),
  favoriteTeam: z.string().optional(),
  selectedFeeds: z.array(z.string()).default([]),
});

const updateUserSchema = createUserSchema.partial();

// POST /api/users — Create user
router.post('/', async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const { favoriteSports, selectedFeeds, ...rest } = parsed.data;

  const user = await prisma.user.create({
    data: {
      ...rest,
      favoriteSports: JSON.stringify(favoriteSports),
      selectedFeeds: JSON.stringify(selectedFeeds),
    },
  });

  res.status(201).json(formatUser(user));
});

// GET /api/users/:id — Get user
router.get('/:id', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(formatUser(user));
});

// PUT /api/users/:id — Update preferences
router.put('/:id', async (req: Request, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { favoriteSports, selectedFeeds, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (favoriteSports) data.favoriteSports = JSON.stringify(favoriteSports);
  if (selectedFeeds) data.selectedFeeds = JSON.stringify(selectedFeeds);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
  });

  res.json(formatUser(user));
});

// Converts JSON string fields to arrays for the response
function formatUser(user: Record<string, unknown>) {
  return {
    ...user,
    favoriteSports: JSON.parse(user.favoriteSports as string),
    selectedFeeds: JSON.parse(user.selectedFeeds as string),
  };
}

export default router;
