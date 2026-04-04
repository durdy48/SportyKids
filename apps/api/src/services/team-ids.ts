/**
 * Mapping of SportyKids team names to TheSportsDB team IDs.
 * API: https://www.thesportsdb.com/api/v1/json/3/
 *
 * This mapping enables live stats syncing (B-CP3).
 */

export const TEAM_IDS: Record<string, { sportsDbId: string; sport: string }> = {
  // Football (Soccer)
  'Real Madrid': { sportsDbId: '133738', sport: 'football' },
  'Barcelona': { sportsDbId: '133739', sport: 'football' },
  'Atletico Madrid': { sportsDbId: '133743', sport: 'football' },
  'Manchester City': { sportsDbId: '133613', sport: 'football' },
  'Manchester United': { sportsDbId: '133612', sport: 'football' },
  'Liverpool': { sportsDbId: '133602', sport: 'football' },
  'Arsenal': { sportsDbId: '133604', sport: 'football' },
  'Chelsea': { sportsDbId: '133610', sport: 'football' },
  'Bayern Munich': { sportsDbId: '134777', sport: 'football' },
  'PSG': { sportsDbId: '133714', sport: 'football' },
  'Juventus': { sportsDbId: '134218', sport: 'football' },
  'Inter Milan': { sportsDbId: '134198', sport: 'football' },
  'AC Milan': { sportsDbId: '134197', sport: 'football' },
  'Sevilla FC': { sportsDbId: '133709', sport: 'football' },

  // Basketball
  'Los Angeles Lakers': { sportsDbId: '134867', sport: 'basketball' },
  'Golden State Warriors': { sportsDbId: '134860', sport: 'basketball' },
};

/**
 * Get the TheSportsDB team ID for a given team name.
 * Uses case-insensitive partial matching.
 */
export function getSportsDbTeamId(teamName: string): { sportsDbId: string; sport: string } | null {
  const lower = teamName.toLowerCase();
  for (const [name, info] of Object.entries(TEAM_IDS)) {
    if (name.toLowerCase() === lower || lower.includes(name.toLowerCase())) {
      return info;
    }
  }
  return null;
}

// Build reverse lookup map: sportsDbId -> teamName
const REVERSE_MAP: Record<string, string> = {};
for (const [name, info] of Object.entries(TEAM_IDS)) {
  REVERSE_MAP[info.sportsDbId] = name;
}

/**
 * Get the SportyKids team name for a given TheSportsDB team ID.
 */
export function getTeamNameBySportsDbId(id: string): string | null {
  return REVERSE_MAP[id] ?? null;
}
