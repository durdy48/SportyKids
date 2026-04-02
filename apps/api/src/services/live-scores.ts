/**
 * Live scores service — detects match events and builds notification payloads.
 *
 * Uses TheSportsDB livescore API v2 for real-time match data.
 */

import { t, SUPPORTED_LOCALES } from '@sportykids/shared';
import type { MatchEvent, LiveMatchStatus, MatchEventType, SupportedLocale } from '@sportykids/shared';
import type { PushPayload } from './push-sender';

// ---------------------------------------------------------------------------
// Match state used for event detection
// ---------------------------------------------------------------------------

export interface MatchState {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: LiveMatchStatus;
  homeGoalDetails: string;
  awayGoalDetails: string;
  homeRedCards: string;
  awayRedCards: string;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Count semicolon-separated items from TheSportsDB detail string format: "10':Player;25':Player;"
 */
export function parseDetailCount(details: string): number {
  if (!details || !details.trim()) return 0;
  return details.split(';').filter((s) => s.trim().length > 0).length;
}

/** Alias for clarity: count goals from goal detail string */
export const parseGoalCount = parseDetailCount;

/** Alias for clarity: count red cards from red card detail string */
export const parseRedCardCount = parseDetailCount;

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/**
 * Map TheSportsDB status strings to our LiveMatchStatus enum.
 */
export function mapStatus(strStatus: string, strProgress: string): LiveMatchStatus {
  const status = strStatus.toLowerCase();
  const progress = strProgress.toLowerCase();

  if (
    status.includes('finished') ||
    status.includes('after') ||
    status === 'ft' ||
    status === 'aet' ||
    status === 'pen'
  ) {
    return 'finished';
  }

  if (
    status.includes('halftime') ||
    status.includes('half time') ||
    progress === 'ht'
  ) {
    return 'half_time';
  }

  if (
    status.includes('progress') ||
    status.includes('1st half') ||
    status.includes('2nd half') ||
    status.includes('extra') ||
    /^\d+$/.test(progress)
  ) {
    // Progress is a minute number like "65" — match is live
    if (/^\d+$/.test(progress) && parseInt(progress, 10) > 0) {
      return 'live';
    }
    if (status.includes('progress') || status.includes('half')) {
      return 'live';
    }
  }

  return 'not_started';
}

// ---------------------------------------------------------------------------
// Event detection
// ---------------------------------------------------------------------------

/**
 * Detect events by diffing two match states.
 */
export function detectEvents(previous: MatchState, current: MatchState): MatchEvent[] {
  const events: MatchEvent[] = [];

  // Match start: was not_started, now live
  if (previous.status === 'not_started' && current.status === 'live') {
    events.push({
      type: 'match_start',
      team: '',
      homeScore: current.homeScore,
      awayScore: current.awayScore,
    });
  }

  // Half time
  if (previous.status !== 'half_time' && current.status === 'half_time') {
    events.push({
      type: 'half_time',
      team: '',
      homeScore: current.homeScore,
      awayScore: current.awayScore,
    });
  }

  // Match end
  if (previous.status !== 'finished' && current.status === 'finished') {
    events.push({
      type: 'match_end',
      team: '',
      homeScore: current.homeScore,
      awayScore: current.awayScore,
    });
  }

  // Home goal
  if (current.homeScore > previous.homeScore) {
    events.push({
      type: 'goal',
      team: current.homeTeam,
      homeScore: current.homeScore,
      awayScore: current.awayScore,
    });
  }

  // Away goal
  if (current.awayScore > previous.awayScore) {
    events.push({
      type: 'goal',
      team: current.awayTeam,
      homeScore: current.homeScore,
      awayScore: current.awayScore,
    });
  }

  // Home red card
  const prevHomeReds = parseRedCardCount(previous.homeRedCards);
  const currHomeReds = parseRedCardCount(current.homeRedCards);
  if (currHomeReds > prevHomeReds) {
    events.push({
      type: 'red_card',
      team: current.homeTeam,
      homeScore: current.homeScore,
      awayScore: current.awayScore,
    });
  }

  // Away red card
  const prevAwayReds = parseRedCardCount(previous.awayRedCards);
  const currAwayReds = parseRedCardCount(current.awayRedCards);
  if (currAwayReds > prevAwayReds) {
    events.push({
      type: 'red_card',
      team: current.awayTeam,
      homeScore: current.homeScore,
      awayScore: current.awayScore,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Notification payload builder
// ---------------------------------------------------------------------------

/** Map event type to push i18n key prefix */
const EVENT_KEY_MAP: Record<MatchEventType, string> = {
  goal: 'live_goal',
  match_start: 'live_match_start',
  match_end: 'live_match_end',
  red_card: 'live_red_card',
  half_time: 'live_half_time',
};

/**
 * Build a push notification payload for a match event.
 */
export function buildNotificationPayload(
  event: MatchEvent,
  homeTeam: string,
  awayTeam: string,
  locale: string,
): PushPayload {
  const l: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as SupportedLocale)
    : 'es';
  const prefix = EVENT_KEY_MAP[event.type];

  let title = t(`push.${prefix}_title`, l);
  let body = t(`push.${prefix}_body`, l);

  // Replace placeholders
  const replacements: Record<string, string> = {
    '{team}': event.team || homeTeam,
    '{home}': homeTeam,
    '{away}': awayTeam,
    '{homeScore}': String(event.homeScore),
    '{awayScore}': String(event.awayScore),
  };

  for (const [key, value] of Object.entries(replacements)) {
    title = title.replaceAll(key, value);
    body = body.replaceAll(key, value);
  }

  return {
    title,
    body,
    data: { screen: 'FavoriteTeam', type: 'live_score' },
    sound: 'default',
  };
}

/** Map event type to the preference key in LiveScorePreferences */
export const EVENT_TO_PREFERENCE: Record<MatchEventType, string> = {
  goal: 'goals',
  match_start: 'matchStart',
  match_end: 'matchEnd',
  red_card: 'redCards',
  half_time: 'halfTime',
};
