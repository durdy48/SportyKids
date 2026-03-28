import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { generateDailyMission, claimMissionReward } from '../services/mission-generator';
import { trackEvent } from '../services/monitoring';
import { ValidationError } from '../errors';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/missions/today/:userId — Get or generate today's mission
// ---------------------------------------------------------------------------

router.get('/today/:userId', async (req: Request, res: Response) => {
  const locale = (req.query.locale as string) === 'en' ? 'en' : 'es';
  const userId = req.params.userId;

  try {
    const mission = await generateDailyMission(userId, locale);
    res.json({ mission, expired: false });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      // User not found -- check if a mission existed yesterday to distinguish
      // "expired mission" from "brand new user with no missions"
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yesterdayMission = await prisma.dailyMission.findUnique({
        where: { userId_date: { userId, date: yesterdayStr } },
      });
      if (yesterdayMission) {
        res.json({ mission: null, expired: true });
        return;
      }
      res.json({ mission: null, expired: false });
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
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const result = await claimMissionReward(parsed.data.userId);

  if (!result.claimed) {
    throw new ValidationError('No completed unclaimed mission for today');
  }

  // Fetch mission details for analytics tracking
  const today = new Date().toISOString().split('T')[0];
  const mission = await prisma.dailyMission.findUnique({
    where: { userId_date: { userId: parsed.data.userId, date: today } },
    select: { type: true, rewardType: true },
  });

  if (mission) {
    trackEvent('daily_mission_claimed', {
      userId: parsed.data.userId,
      missionType: mission.type,
      rewardType: mission.rewardType,
    });
  }

  res.json(result);
});

export default router;
