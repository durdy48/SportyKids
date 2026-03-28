import { Router, Request, Response } from 'express';
import { getTeamStats } from '../services/team-stats';
import { syncAllTeamStats } from '../services/team-stats-sync';
import { withCache, CACHE_TTL } from '../services/cache';
import { requireAuth } from '../middleware/auth';
import { NotFoundError } from '../errors';

const router = Router();

// GET /api/teams/:teamName/stats — Get team statistics
router.get('/:teamName/stats', withCache('team:stats:', CACHE_TTL.TEAM_STATS), async (req: Request, res: Response) => {
  const teamName = req.params.teamName as string;

  const stats = await getTeamStats(decodeURIComponent(teamName));

  if (!stats) throw new NotFoundError('Team not found');

  res.json(stats);
});

// POST /api/teams/sync — Manual sync of team stats from TheSportsDB (B-CP3)
router.post('/sync', requireAuth, async (_req: Request, res: Response) => {
  const result = await syncAllTeamStats();
  res.json({
    message: 'Team stats sync complete',
    ...result,
  });
});

export default router;
