import { prisma } from '../config/database';

/**
 * Retrieves team statistics from the database.
 * Returns null if the team is not found.
 *
 * Note: recentResults and nextMatch are native PostgreSQL Json fields,
 * no JSON parsing needed.
 */
export async function getTeamStats(teamName: string) {
  const stats = await prisma.teamStats.findUnique({
    where: { teamName },
  });

  if (!stats) return null;

  return stats;
}
