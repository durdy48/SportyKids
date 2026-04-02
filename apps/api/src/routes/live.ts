import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { withCache } from '../services/cache';
import { NotFoundError, ValidationError } from '../errors';
import type { LiveMatchData } from '@sportykids/shared';

const router = Router();

// Cache TTL for live match: 60 seconds
const LIVE_MATCH_TTL = 60_000;

// GET /api/teams/:teamName/live — Get live match for a team
router.get(
  '/:teamName/live',
  withCache('team:live:', LIVE_MATCH_TTL),
  async (req: Request, res: Response) => {
    const teamName = decodeURIComponent(req.params.teamName as string);

    if (teamName.length < 3) {
      throw new ValidationError('Team name must be at least 3 characters');
    }

    if (teamName.length > 100) {
      throw new ValidationError('Team name must be 100 characters or less');
    }

    // Search for match where team is home or away, status is live or half_time
    const match = await prisma.liveMatch.findFirst({
      where: {
        OR: [
          { homeTeam: { contains: teamName, mode: 'insensitive' } },
          { awayTeam: { contains: teamName, mode: 'insensitive' } },
        ],
        status: { in: ['live', 'half_time', 'not_started'] },
      },
      orderBy: { matchDate: 'asc' },
    });

    if (!match) {
      // Also check for recently finished matches (within 2 hours)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const recentMatch = await prisma.liveMatch.findFirst({
        where: {
          OR: [
            { homeTeam: { contains: teamName, mode: 'insensitive' } },
            { awayTeam: { contains: teamName, mode: 'insensitive' } },
          ],
          status: 'finished',
          updatedAt: { gte: twoHoursAgo },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!recentMatch) {
        throw new NotFoundError('No live or recent match found for this team');
      }

      const data: LiveMatchData = {
        homeTeam: recentMatch.homeTeam,
        awayTeam: recentMatch.awayTeam,
        homeScore: recentMatch.homeScore,
        awayScore: recentMatch.awayScore,
        progress: recentMatch.progress,
        status: recentMatch.status as LiveMatchData['status'],
        league: recentMatch.league,
        sport: recentMatch.sport,
        matchDate: recentMatch.matchDate.toISOString(),
      };

      res.json(data);
      return;
    }

    const data: LiveMatchData = {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      progress: match.progress,
      status: match.status as LiveMatchData['status'],
      league: match.league,
      sport: match.sport,
      matchDate: match.matchDate.toISOString(),
    };

    res.json(data);
  },
);

export default router;
