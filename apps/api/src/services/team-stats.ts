import { prisma } from '../config/database';
import { safeJsonParse } from '../utils/safe-json-parse';

/**
 * Retrieves team statistics from the database.
 * Returns null if the team is not found.
 */
export async function getTeamStats(teamName: string) {
  const stats = await prisma.teamStats.findUnique({
    where: { teamName },
  });

  if (!stats) return null;

  // Parse JSON fields for the response
  const recentResults = safeJsonParse(stats.recentResults, []);
  const nextMatch = safeJsonParse(stats.nextMatch, null);

  return {
    ...stats,
    recentResults,
    nextMatch,
  };
}
