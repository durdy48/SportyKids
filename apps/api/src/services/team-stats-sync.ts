/**
 * Team stats sync service — fetches live data from TheSportsDB (B-CP3).
 *
 * API: https://www.thesportsdb.com/api/v1/json/3/
 * Free tier, no key needed. 1-second delay between requests.
 */

import { prisma } from '../config/database';
import { TEAM_IDS } from './team-ids';
import { apiCache } from './cache';
import { logger } from './logger';

const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const REQUEST_DELAY_MS = 1000;

interface SportsDbEvent {
  strEvent?: string;
  intHomeScore?: string;
  intAwayScore?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  dateEvent?: string;
  strLeague?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

/**
 * Fetch last 5 events for a team from TheSportsDB.
 */
async function fetchLastEvents(teamId: string): Promise<SportsDbEvent[]> {
  const res = await fetchWithTimeout(`${THESPORTSDB_BASE}/eventslast.php?id=${teamId}`);
  if (!res || !res.ok) return [];
  try {
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch next 5 events for a team from TheSportsDB.
 */
async function fetchNextEvents(teamId: string): Promise<SportsDbEvent[]> {
  const res = await fetchWithTimeout(`${THESPORTSDB_BASE}/eventsnext.php?id=${teamId}`);
  if (!res || !res.ok) return [];
  try {
    const data = await res.json();
    return data.events ?? [];
  } catch {
    return [];
  }
}

/**
 * Sync stats for a single team. Returns true if the team was updated.
 */
export async function syncTeamStats(teamName: string, sportsDbId: string, sport: string): Promise<boolean> {
  try {
    const [lastEvents, nextEvents] = await Promise.all([
      fetchLastEvents(sportsDbId),
      fetchNextEvents(sportsDbId),
    ]);

    // Validate that events actually belong to the requested team — TheSportsDB can return
    // wrong team data when rate-limited or when IDs resolve to different entities.
    const teamNameLower = teamName.toLowerCase();
    const teamMatchesEvent = (event: SportsDbEvent) => {
      const home = event.strHomeTeam?.toLowerCase() ?? '';
      const away = event.strAwayTeam?.toLowerCase() ?? '';
      return home.includes(teamNameLower) || away.includes(teamNameLower);
    };

    const validLastEvents = lastEvents.filter(teamMatchesEvent);
    const validNextEvents = nextEvents.filter(teamMatchesEvent);

    if (lastEvents.length > 0 && validLastEvents.length === 0) {
      logger.warn({ teamName, sampleTeam: lastEvents[0]?.strHomeTeam }, 'TheSportsDB returned events for wrong team — skipping upsert');
      return false;
    }

    // Parse recent results
    const recentResults = validLastEvents.slice(0, 5).map((event) => {
      const isHome = event.strHomeTeam?.toLowerCase().includes(teamNameLower);
      const homeScore = parseInt(event.intHomeScore ?? '0', 10);
      const awayScore = parseInt(event.intAwayScore ?? '0', 10);
      const myScore = isHome ? homeScore : awayScore;
      const oppScore = isHome ? awayScore : homeScore;
      const opponent = isHome ? event.strAwayTeam : event.strHomeTeam;

      let result: 'W' | 'D' | 'L' = 'D';
      if (myScore > oppScore) result = 'W';
      else if (myScore < oppScore) result = 'L';

      return {
        opponent: opponent ?? 'Unknown',
        score: `${homeScore}-${awayScore}`,
        result,
        date: event.dateEvent ?? '',
      };
    });

    // Parse next match
    const next = validNextEvents[0];
    const nextMatch = next ? {
      opponent: next.strHomeTeam?.toLowerCase().includes(teamNameLower)
        ? next.strAwayTeam ?? 'TBD'
        : next.strHomeTeam ?? 'TBD',
      date: next.dateEvent ?? '',
      competition: next.strLeague ?? '',
    } : null;

    // Upsert team stats
    await prisma.teamStats.upsert({
      where: { teamName },
      update: {
        sport,
        recentResults,
        nextMatch: nextMatch ?? undefined,
      },
      create: {
        teamName,
        sport,
        recentResults,
        nextMatch: nextMatch ?? undefined,
      },
    });

    // Invalidate cache for this team
    apiCache.invalidate(`team:stats:${teamName}`);

    return true;
  } catch (err) {
    logger.error({ err, teamName }, 'Error syncing team stats');
    return false;
  }
}

/**
 * Sync all teams in the mapping. 1-second delay between teams.
 */
export async function syncAllTeamStats(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  const entries = Object.entries(TEAM_IDS);
  for (let i = 0; i < entries.length; i++) {
    const [teamName, { sportsDbId, sport }] = entries[i];
    const success = await syncTeamStats(teamName, sportsDbId, sport);
    if (success) synced++;
    else failed++;

    // Rate-limit: 1-second delay between requests (except after the last one)
    if (i < entries.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { synced, failed };
}
