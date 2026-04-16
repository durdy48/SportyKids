import cron from 'node-cron';
import { prisma } from '../config/database';
import { TEAM_IDS } from '../services/team-ids';
import {
  detectEvents,
  mapStatus,
  type MatchState,
} from '../services/live-scores';
import type { MatchEvent } from '@sportykids/shared';
import { sendLiveScoreToUsers } from '../services/push-sender';
import { logger } from '../services/logger';

// ---------------------------------------------------------------------------
// TheSportsDB livescore v2 API
// ---------------------------------------------------------------------------

const THESPORTSDB_V2 = 'https://www.thesportsdb.com/api/v2/json/3';

interface LivescoreEntry {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string;
  intAwayScore?: string;
  strStatus?: string;
  strProgress?: string;
  strLeague?: string;
  strSport?: string;
  dateEvent?: string;
  strTimestamp?: string;
  strHomeGoalDetails?: string;
  strAwayGoalDetails?: string;
  strHomeRedCards?: string;
  strAwayRedCards?: string;
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

async function fetchLivescores(sport: string): Promise<LivescoreEntry[]> {
  const res = await fetchWithTimeout(`${THESPORTSDB_V2}/livescore.php?s=${sport}`);
  if (!res || !res.ok) return [];
  try {
    const data = await res.json();
    return data.livescore ?? data.events ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Known team names (lowercase) for quick lookup
// ---------------------------------------------------------------------------

const TRACKED_TEAMS = new Set(
  Object.keys(TEAM_IDS).map((name) => name.toLowerCase()),
);

function isTrackedTeam(name: string): boolean {
  const lower = name.toLowerCase();
  for (const tracked of TRACKED_TEAMS) {
    if (lower.includes(tracked)) return true;
  }
  return false;
}

function findTrackedTeamName(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [teamName] of Object.entries(TEAM_IDS)) {
    if (lower.includes(teamName.toLowerCase())) {
      return teamName;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Process a single livescore entry
// ---------------------------------------------------------------------------

async function processLivescoreEntry(
  entry: LivescoreEntry & { _sport: string },
): Promise<{ processed: number; events: number; notified: number }> {
  const result = { processed: 0, events: 0, notified: 0 };
  const home = entry.strHomeTeam ?? '';
  const away = entry.strAwayTeam ?? '';

  if (!isTrackedTeam(home) && !isTrackedTeam(away)) return result;
  if (!entry.idEvent) return result;

  const status = mapStatus(entry.strStatus ?? '', entry.strProgress ?? '');
  const homeScore = parseInt(entry.intHomeScore ?? '0', 10) || 0;
  const awayScore = parseInt(entry.intAwayScore ?? '0', 10) || 0;

  const existing = await prisma.liveMatch.findUnique({
    where: { externalEventId: entry.idEvent },
  });

  const matchDate = entry.strTimestamp
    ? new Date(entry.strTimestamp)
    : entry.dateEvent
      ? new Date(entry.dateEvent)
      : new Date();

  const currentState: MatchState = {
    homeTeam: home,
    awayTeam: away,
    homeScore,
    awayScore,
    status,
    homeGoalDetails: entry.strHomeGoalDetails ?? '',
    awayGoalDetails: entry.strAwayGoalDetails ?? '',
    homeRedCards: entry.strHomeRedCards ?? '',
    awayRedCards: entry.strAwayRedCards ?? '',
  };

  if (existing) {
    const previousState: MatchState = {
      homeTeam: existing.homeTeam,
      awayTeam: existing.awayTeam,
      homeScore: existing.homeScore,
      awayScore: existing.awayScore,
      status: existing.status as MatchState['status'],
      homeGoalDetails: existing.homeGoalDetails,
      awayGoalDetails: existing.awayGoalDetails,
      homeRedCards: existing.homeRedCards,
      awayRedCards: existing.awayRedCards,
    };

    const matchEvents = detectEvents(previousState, currentState);
    const notifiedEvents = (existing.notifiedEvents as string[]) ?? [];

    for (const event of matchEvents) {
      const eventKey = `${event.type}:${event.homeScore}:${event.awayScore}:${event.team}`;
      if (notifiedEvents.includes(eventKey)) continue;

      const trackedHome = findTrackedTeamName(home);
      const trackedAway = findTrackedTeamName(away);

      for (const teamName of [trackedHome, trackedAway].filter(Boolean) as string[]) {
        const sent = await sendLiveScoreToUsers(teamName, event.type, event, home, away);
        result.notified += sent;
      }

      notifiedEvents.push(eventKey);
      result.events++;
    }

    await prisma.liveMatch.update({
      where: { externalEventId: entry.idEvent },
      data: {
        homeScore,
        awayScore,
        progress: entry.strProgress ?? '',
        status,
        homeGoalDetails: entry.strHomeGoalDetails ?? '',
        awayGoalDetails: entry.strAwayGoalDetails ?? '',
        homeRedCards: entry.strHomeRedCards ?? '',
        awayRedCards: entry.strAwayRedCards ?? '',
        lastPolledAt: new Date(),
        notifiedEvents,
      },
    });
  } else {
    await prisma.liveMatch.create({
      data: {
        externalEventId: entry.idEvent,
        homeTeam: home,
        awayTeam: away,
        homeScore,
        awayScore,
        progress: entry.strProgress ?? '',
        status,
        league: entry.strLeague ?? '',
        matchDate,
        sport: entry._sport,
        homeGoalDetails: entry.strHomeGoalDetails ?? '',
        awayGoalDetails: entry.strAwayGoalDetails ?? '',
        homeRedCards: entry.strHomeRedCards ?? '',
        awayRedCards: entry.strAwayRedCards ?? '',
        notifiedEvents: [],
      },
    });

    if (status === 'live') {
      const trackedHome = findTrackedTeamName(home);
      const trackedAway = findTrackedTeamName(away);
      for (const teamName of [trackedHome, trackedAway].filter(Boolean) as string[]) {
        const startEvent: MatchEvent = { type: 'match_start', team: '', homeScore, awayScore };
        const sent = await sendLiveScoreToUsers(teamName, 'match_start', startEvent, home, away);
        result.notified += sent;
      }
      result.events++;
    }
  }

  result.processed++;
  return result;
}

// ---------------------------------------------------------------------------
// In-memory cache for TeamStats.nextMatch dates (refreshed every hour)
// ---------------------------------------------------------------------------

interface MatchDateCache {
  dates: string[]; // ISO date strings of upcoming matches
  refreshedAt: number; // timestamp
}

let matchDateCache: MatchDateCache | null = null;
const MATCH_DATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getUpcomingMatchDates(): Promise<string[]> {
  const now = Date.now();
  if (matchDateCache && now - matchDateCache.refreshedAt < MATCH_DATE_CACHE_TTL_MS) {
    return matchDateCache.dates;
  }

  const teamStats = await prisma.teamStats.findMany({
    select: { nextMatch: true },
  });

  const dates = teamStats
    .map((ts) => (ts.nextMatch as { date?: string } | null)?.date)
    .filter((d): d is string => !!d);

  matchDateCache = { dates, refreshedAt: now };
  return dates;
}

// ---------------------------------------------------------------------------
// Poll & process
// ---------------------------------------------------------------------------

export async function pollLiveScores(): Promise<{ processed: number; events: number; notified: number }> {
  const result = { processed: 0, events: 0, notified: 0 };

  try {
    // Check if there are any active matches or upcoming matches today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeMatches = await prisma.liveMatch.count({
      where: { status: { in: ['live', 'half_time'] } },
    });

    // Use cached TeamStats.nextMatch dates to avoid repeated full-table reads
    const upcomingDates = await getUpcomingMatchDates();
    const hasMatchToday = upcomingDates.some((d) => {
      const matchDate = new Date(d);
      return matchDate >= today && matchDate < tomorrow;
    });

    if (activeMatches === 0 && !hasMatchToday) {
      logger.debug('No active or upcoming matches — skipping live score poll');
      return result;
    }

    // Fetch livescores for soccer and basketball
    const [soccerScores, basketballScores] = await Promise.all([
      fetchLivescores('Soccer'),
      fetchLivescores('Basketball'),
    ]);

    const allScores = [
      ...soccerScores.map((s) => ({ ...s, _sport: 'football' })),
      ...basketballScores.map((s) => ({ ...s, _sport: 'basketball' })),
    ];

    // Process entries in batches of 5 for parallelism while respecting API rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < allScores.length; i += BATCH_SIZE) {
      const batch = allScores.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(processLivescoreEntry));
      for (const entryResult of batchResults) {
        result.processed += entryResult.processed;
        result.events += entryResult.events;
        result.notified += entryResult.notified;
      }
    }

    // Clean up finished matches older than 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.liveMatch.deleteMany({
      where: {
        status: 'finished',
        updatedAt: { lt: dayAgo },
      },
    });

    logger.info(result, 'Live scores poll complete');
  } catch (error) {
    logger.error({ err: error }, 'Error polling live scores');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cron job: every 5 minutes
// ---------------------------------------------------------------------------

export async function runLiveScores(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  // For manual triggers always log; for cron only log when there is actual work
  // to avoid ~288 JobRun rows/day when no matches are scheduled.
  let run: { id: string } | null = existingRunId ? { id: existingRunId } : null;

  const ensureRun = async () => {
    if (!run) {
      run = await prisma.jobRun.create({
        data: { jobName: 'live-scores', status: 'running', triggeredBy, triggeredId },
      });
    }
    return run;
  };

  try {
    const result = await pollLiveScores();

    // Only persist a JobRun record when there was something to process or
    // this was triggered manually (admins expect a history entry).
    if (triggeredBy === 'manual' || result.processed > 0 || result.events > 0) {
      const r = await ensureRun();
      await prisma.jobRun.update({
        where: { id: r.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          output: { processed: result.processed, events: result.events, notified: result.notified },
        },
      });
    }
  } catch (e) {
    const r = await ensureRun();
    await prisma.jobRun.update({
      where: { id: r.id },
      data: { status: 'error', finishedAt: new Date(), output: { error: String(e) } },
    });
    throw e;
  }
}

let activeJob: ReturnType<typeof cron.schedule> | null = null;

export function startLiveScoresJob(): void {
  if (activeJob) {
    logger.info('Live scores job is already active.');
    return;
  }

  activeJob = cron.schedule('*/5 * * * *', async () => {
    logger.info('Polling live scores...');
    await runLiveScores('cron');
  });

  logger.info('Live scores job scheduled: every 5 minutes.');
}
