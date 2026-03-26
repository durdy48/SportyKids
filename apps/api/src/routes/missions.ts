import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateDailyMission, claimMissionReward } from '../services/mission-generator';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/missions/today/:userId — Get or generate today's mission
// ---------------------------------------------------------------------------

router.get('/today/:userId', async (req: Request, res: Response) => {
  const locale = (req.query.locale as string) === 'en' ? 'en' : 'es';

  try {
    const mission = await generateDailyMission(req.params.userId, locale);
    res.json(mission);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// POST /api/missions/claim — Claim completed mission reward
// ---------------------------------------------------------------------------

const claimSchema = z.object({
  userId: z.string().min(1),
});

router.post('/claim', async (req: Request, res: Response) => {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const result = await claimMissionReward(parsed.data.userId);

  if (!result.claimed) {
    res.status(400).json({ error: 'No completed unclaimed mission for today' });
    return;
  }

  res.json(result);
});

export default router;
