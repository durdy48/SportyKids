import { Router, Request, Response } from 'express';
import { getTeamStats } from '../services/team-stats';

const router = Router();

// GET /api/teams/:teamName/stats — Get team statistics
router.get('/:teamName/stats', async (req: Request, res: Response) => {
  const teamName = req.params.teamName as string;

  const stats = await getTeamStats(decodeURIComponent(teamName));

  if (!stats) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  res.json(stats);
});

export default router;
