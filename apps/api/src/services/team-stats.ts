import { prisma } from '../config/database';

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
  let recentResults = [];
  try {
    recentResults = JSON.parse(stats.recentResults);
  } catch {
    // Invalid JSON — default to empty array
  }

  let nextMatch = null;
  if (stats.nextMatch) {
    try {
      nextMatch = JSON.parse(stats.nextMatch);
    } catch {
      // Invalid JSON — default to null
    }
  }

  return {
    ...stats,
    recentResults,
    nextMatch,
  };
}
