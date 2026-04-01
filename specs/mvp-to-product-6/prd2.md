# Phase 6, PRD 2: Real-Time Match Notifications

| Field | Value |
|-------|-------|
| **Phase** | 6.2 — Real-Time Match Notifications |
| **Priority** | P1 (high engagement, low effort) |
| **Target** | Month 1 post-launch (v1.2.0) |
| **Dependencies** | Phases 0-5 complete, push notifications working (Phase 4), TheSportsDB integration (team-stats-sync.ts) |
| **Estimated effort** | 5-7 days |

---

## 1. Overview / Problem Statement

SportyKids currently syncs team stats once daily (04:00 UTC via `sync-team-stats.ts`) using TheSportsDB free API. Users can see their favorite team's recent results and next match, but the data is always stale by hours.

The highest-engagement push notification for a sports app is a real-time score update: "Your team just scored!" These notifications drive immediate app opens and create a habit loop that no other content type matches.

This PRD defines a live score polling system that sends push notifications for key match events (goals, match start, match end, red cards) to users who have opted in. The system reuses the existing TheSportsDB integration and push notification infrastructure.

---

## 2. Goals and Non-Goals

### Goals

1. **Live score polling**: New cron job polls TheSportsDB livescore endpoint every 5 minutes during match windows.
2. **Event detection**: Detect goals, match starts, match ends, and red cards by diffing consecutive poll results.
3. **Targeted push notifications**: Send notifications only to users whose `favoriteTeam` is playing and who have opted in to `liveScores` push preference.
4. **Per-event-type opt-in**: Users can choose which event types they want notifications for (goals, match start, match end, red cards).
5. **Live match API endpoint**: `GET /api/teams/:teamName/live` returns current match status for display in the app.
6. **Kid-friendly notification copy**: All notification text uses age-appropriate language with i18n support (ES/EN).
7. **Rate limiting**: No more than 1 notification per event per user. No duplicate notifications across consecutive polls.
8. **Respect parental controls**: Notifications honor schedule lock (bedtime) — no push during restricted hours.

### Non-Goals

- WebSocket or SSE real-time streaming (polling is sufficient at 5-min intervals)
- Live match commentary or play-by-play
- In-app live score widget that auto-updates without refresh
- Notifications for teams other than the user's `favoriteTeam`
- Support for sports beyond football and basketball (TheSportsDB free tier limitation)
- Premium-gated live scores (this feature is available to all users)
- Historical live score data or match timeline storage beyond the current match

---

## 3. TheSportsDB API Analysis

### Available Endpoints (Free Tier, API key: `3`)

| Endpoint | URL | Notes |
|----------|-----|-------|
| Livescores (soccer) | `/api/v2/json/3/livescore.php?s=Soccer` | Returns all live soccer matches |
| Livescores (basketball) | `/api/v2/json/3/livescore.php?s=Basketball` | Returns all live basketball matches |
| Events by date | `/api/v1/json/3/eventsday.php?d=YYYY-MM-DD&s=Soccer` | All events on a given day |

### Livescore Response Shape

```typescript
interface TheSportsDbLivescore {
  idEvent: string;
  strEvent: string;           // "Arsenal vs Chelsea"
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strProgress: string;         // "45", "HT", "FT", "NS" (not started), "90+3"
  strStatus: string;           // "Match On", "Match Finished", "Not Started"
  idHomeTeam: string;
  idAwayTeam: string;
  strLeague: string;
  dateEvent: string;
  strTime: string;             // "20:00:00" (UTC)
  intRound?: string;
  strHomeGoalDetails?: string; // "22':Player A,45':Player B"
  strAwayGoalDetails?: string;
  strHomeRedCards?: string;    // "67':Player C"
  strAwayRedCards?: string;
}
```

### Rate Limits

- Free tier: ~1 request/second, no API key required for v1, key `3` for v2.
- The livescore endpoint returns all live matches for a sport in one call (no per-team queries needed).
- Two requests per poll cycle (one for Soccer, one for Basketball) = well within limits.

---

## 4. Data Model

### 4.1 New Model: `LiveMatch`

Stores the current state of a live match to enable event diffing between polls.

```prisma
model LiveMatch {
  id              String    @id @default(cuid())
  externalEventId String    @unique   // TheSportsDB idEvent
  homeTeam        String
  awayTeam        String
  homeScore       Int       @default(0)
  awayScore       Int       @default(0)
  progress        String    @default("NS")  // "NS", "1", "45", "HT", "46", "90", "FT", etc.
  status          String    @default("not_started") // not_started, live, half_time, finished
  league          String    @default("")
  matchDate       DateTime
  sport           String
  homeGoalDetails String    @default("")  // Raw goal details from API
  awayGoalDetails String    @default("")
  homeRedCards    String    @default("")
  awayRedCards    String    @default("")
  lastPolledAt    DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Tracking which events we already notified for
  notifiedEvents  Json      @default("[]") // Array of event keys like "goal:home:2", "red:away:1"

  @@index([status])
  @@index([homeTeam])
  @@index([awayTeam])
}
```

### 4.2 Extend `PushPreferences` Type

Current shape in `packages/shared/src/types/index.ts`:

```typescript
export interface PushPreferences {
  sports: boolean;
  dailyQuiz: boolean;
  teamUpdates: boolean;
}
```

Extended shape:

```typescript
export interface LiveScorePreferences {
  enabled: boolean;
  goals: boolean;
  matchStart: boolean;
  matchEnd: boolean;
  redCards: boolean;
}

export interface PushPreferences {
  sports: boolean;
  dailyQuiz: boolean;
  teamUpdates: boolean;
  liveScores?: LiveScorePreferences;
}
```

Default for new users and existing users without the field:

```typescript
const DEFAULT_LIVE_SCORE_PREFS: LiveScorePreferences = {
  enabled: true,
  goals: true,
  matchStart: true,
  matchEnd: true,
  redCards: true,
};
```

Since `pushPreferences` is a `Json?` column in Prisma, no migration is needed for the schema — the new fields are simply added to the JSON object. The `push-sender.ts` preference check logic must be updated to handle the new `liveScores` key.

---

## 5. Event Detection Algorithm

### 5.1 Match Lifecycle

```
Not Started (NS) → Live (kickoff) → Half Time (HT) → Live (2nd half) → Finished (FT)
```

### 5.2 Detectable Events

| Event Type | Detection Logic | Notification Key |
|------------|----------------|------------------|
| **Match Start** | `status` changes from `not_started` to `live` | `start:{eventId}` |
| **Goal (home)** | `homeScore` increases between polls | `goal:home:{newScore}` |
| **Goal (away)** | `awayScore` increases between polls | `goal:away:{newScore}` |
| **Red Card (home)** | `homeRedCards` has new entries vs. previous poll | `red:home:{count}` |
| **Red Card (away)** | `awayRedCards` has new entries vs. previous poll | `red:away:{count}` |
| **Half Time** | `status` changes to `half_time` | `ht:{eventId}` |
| **Match End** | `status` changes to `finished` | `end:{eventId}` |

### 5.3 Deduplication

Each detected event generates a unique key (shown in the table above). The key is appended to `LiveMatch.notifiedEvents` (a JSON array). Before sending a notification, the system checks whether the key already exists. This ensures:

- If a poll returns the same score twice, no duplicate notification is sent.
- If the job restarts mid-match, previously notified events are not re-sent.

### 5.4 Diff Function

```typescript
interface MatchEvent {
  type: 'match_start' | 'goal' | 'red_card' | 'half_time' | 'match_end';
  team: 'home' | 'away' | null; // null for match_start, half_time, match_end
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  progress: string;
  league: string;
  sport: string;
  eventKey: string;
}

function detectEvents(
  previous: LiveMatch | null,
  current: TheSportsDbLivescore,
): MatchEvent[];
```

---

## 6. Cron Job: `live-scores.ts`

### 6.1 Schedule

```
*/5 * * * *    (every 5 minutes)
```

The job runs every 5 minutes unconditionally. The first step inside the job checks whether any matches are likely happening. If no matches are expected, the job exits immediately with minimal overhead.

### 6.2 Match Window Check

To avoid unnecessary API calls outside match hours, the job consults the `TeamStats.nextMatch` dates for all tracked teams. If no tracked team has a match within the current day (UTC), the job skips the poll.

Additionally, the job always polls if there are any `LiveMatch` records with `status = 'live'` or `status = 'half_time'` (to catch match endings).

### 6.3 Job Flow

```
1. Check if any LiveMatch records have status 'live' or 'half_time'
   → If yes, proceed to step 3

2. Check TeamStats.nextMatch for all tracked teams
   → If no team has a match today, exit early

3. Fetch livescore API for Soccer
4. Fetch livescore API for Basketball (1-second delay between requests)

5. For each live match in the response:
   a. Check if homeTeam or awayTeam matches any team in TEAM_IDS
   b. If not tracked, skip
   c. Upsert LiveMatch record by externalEventId
   d. Detect events by diffing previous LiveMatch state with new data
   e. For each detected event:
      - Generate event key
      - Check if key exists in notifiedEvents → skip if duplicate
      - Find users with favoriteTeam matching the relevant team
      - Filter by liveScores push preference and event type opt-in
      - Filter by schedule lock (parental bedtime hours)
      - Send push notification via push-sender.ts
      - Append event key to notifiedEvents

6. Clean up: delete LiveMatch records with status 'finished' that are older than 24 hours

7. Log summary: { matchesPolled, eventsDetected, notificationsSent }
```

### 6.4 Error Handling

- If TheSportsDB API is unreachable, log a warning and retry on the next 5-minute cycle. No crash.
- If push sending fails for individual users, log the error and continue with the remaining users.
- The job uses the existing `fetchWithTimeout` utility from `team-stats-sync.ts` (10-second timeout).

### 6.5 Performance Considerations

- The livescore endpoint returns all live matches for a sport in one request. At most 2 API calls per cycle.
- User lookup for `favoriteTeam` matching uses an indexed query.
- Push notifications are batched via Expo's chunk API (existing infrastructure in `push-sender.ts`).
- LiveMatch table will have at most ~20-30 rows at any time (only active matches for tracked teams).

---

## 7. API Endpoints

### 7.1 `GET /api/teams/:teamName/live`

Returns the current live match for a team, if any.

**Auth**: None required (public endpoint, cached 1 minute).

**Response (match in progress)**:

```json
{
  "live": true,
  "match": {
    "homeTeam": "Real Madrid",
    "awayTeam": "Barcelona",
    "homeScore": 2,
    "awayScore": 1,
    "progress": "67",
    "status": "live",
    "league": "Spanish La Liga",
    "sport": "football",
    "matchDate": "2026-04-01T20:00:00.000Z"
  }
}
```

**Response (no live match)**:

```json
{
  "live": false,
  "match": null
}
```

**Implementation**: Query `LiveMatch` table for records where `homeTeam` or `awayTeam` matches the param and `status` is `live` or `half_time`. Cache response for 60 seconds.

### 7.2 `PUT /api/users/:id/notifications/live-scores`

Updates the live score notification preferences for a user.

**Auth**: `requireAuth`

**Request body**:

```json
{
  "enabled": true,
  "goals": true,
  "matchStart": true,
  "matchEnd": false,
  "redCards": true
}
```

**Response**: `200 OK` with the updated preferences.

**Implementation**: Merges the `liveScores` key into the existing `pushPreferences` JSON field on the User model. No schema migration needed.

---

## 8. Push Notification Format

### 8.1 Notification Templates (i18n)

All templates support interpolation parameters: `{homeTeam}`, `{awayTeam}`, `{homeScore}`, `{awayScore}`, `{minute}`, `{league}`.

| Event | ES | EN |
|-------|----|----|
| Match Start | `{homeTeam} vs {awayTeam} acaba de empezar` | `{homeTeam} vs {awayTeam} just kicked off` |
| Goal (user's team) | `{homeTeam} {homeScore}–{awayScore} {awayTeam} (min. {minute})` | `{homeTeam} {homeScore}–{awayScore} {awayTeam} (min. {minute})` |
| Goal (opponent) | `{homeTeam} {homeScore}–{awayScore} {awayTeam} (min. {minute})` | `{homeTeam} {homeScore}–{awayScore} {awayTeam} (min. {minute})` |
| Red Card | `Tarjeta roja en {homeTeam} vs {awayTeam} (min. {minute})` | `Red card in {homeTeam} vs {awayTeam} (min. {minute})` |
| Half Time | `Descanso: {homeTeam} {homeScore}–{awayScore} {awayTeam}` | `Half time: {homeTeam} {homeScore}–{awayScore} {awayTeam}` |
| Match End | `Final: {homeTeam} {homeScore}–{awayScore} {awayTeam}` | `Full time: {homeTeam} {homeScore}–{awayScore} {awayTeam}` |

### 8.2 Notification Titles

| Event | ES | EN |
|-------|----|----|
| Match Start | `Empieza el partido` | `Match started` |
| Goal (user's team scores) | `Gol de tu equipo!` | `Your team scored!` |
| Goal (opponent scores) | `Gol en contra` | `Opponent scored` |
| Red Card | `Tarjeta roja!` | `Red card!` |
| Half Time | `Descanso` | `Half time` |
| Match End (user's team won) | `Tu equipo ha ganado!` | `Your team won!` |
| Match End (user's team lost) | `Fin del partido` | `Match ended` |
| Match End (draw) | `Empate` | `Draw` |

### 8.3 Sport-Specific Emoji Prefix

| Sport | Emoji |
|-------|-------|
| Football | `\u26BD` |
| Basketball | `\u{1F3C0}` |

The emoji is prepended to the notification title for visual distinction.

### 8.4 Push Data Payload

```typescript
{
  screen: 'FavoriteTeam',  // Navigate to team screen on tap
  teamName: 'Real Madrid',
  eventType: 'goal',
}
```

### 8.5 Parental Schedule Lock Check

Before sending a live score notification, the system must check whether the target user has a `ParentalProfile` with schedule lock configured. If the current time in the user's timezone falls outside `allowedHoursStart`–`allowedHoursEnd`, the notification is silently dropped.

Implementation: reuse the schedule check logic from `parental-guard.ts` middleware, extracted into a shared utility.

---

## 9. i18n Keys

New keys to add to `packages/shared/src/i18n/es.json` and `en.json`:

```json
{
  "live_scores": {
    "title": "Live scores / Resultados en vivo",
    "enabled": "Live match notifications / Notificaciones de partidos en vivo",
    "goals": "Goals / Goles",
    "match_start": "Match start / Inicio de partido",
    "match_end": "Match end / Final de partido",
    "red_cards": "Red cards / Tarjetas rojas",
    "description": "Get notified when your favorite team plays / Recibe alertas cuando juega tu equipo",
    "no_live_match": "No live match right now / No hay partido en vivo ahora",
    "live_now": "Live now / En vivo ahora",
    "minute": "min.",
    "half_time": "HT / Descanso",
    "full_time": "FT / Final",
    "not_started": "Not started / No iniciado"
  },
  "live_notifications": {
    "match_start_title": "Match started / Empieza el partido",
    "goal_for_title": "Your team scored! / Gol de tu equipo!",
    "goal_against_title": "Opponent scored / Gol en contra",
    "red_card_title": "Red card! / Tarjeta roja!",
    "half_time_title": "Half time / Descanso",
    "match_end_win_title": "Your team won! / Tu equipo ha ganado!",
    "match_end_loss_title": "Match ended / Fin del partido",
    "match_end_draw_title": "Draw / Empate",
    "match_start_body": "{homeTeam} vs {awayTeam} just kicked off / acaba de empezar",
    "goal_body": "{homeTeam} {homeScore}–{awayScore} {awayTeam} (min. {minute})",
    "red_card_body": "Red card in {homeTeam} vs {awayTeam} (min. {minute}) / Tarjeta roja en ...",
    "half_time_body": "Half time: {homeTeam} {homeScore}–{awayScore} {awayTeam}",
    "match_end_body": "Full time: {homeTeam} {homeScore}–{awayScore} {awayTeam}"
  }
}
```

(Above shows conceptual key-value pairs. Actual ES and EN files will have their respective language values.)

---

## 10. Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/services/live-scores.ts` | Core service: fetch livescores, diff events, send notifications |
| `apps/api/src/jobs/live-scores.ts` | Cron job wrapper (every 5 min) |
| `apps/api/src/routes/live.ts` | `GET /api/teams/:teamName/live` endpoint |
| `apps/api/prisma/migrations/XXXXXX_add_live_match/` | Migration for `LiveMatch` model |

## 11. Files to Modify

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add `LiveMatch` model |
| `apps/api/src/index.ts` | Import and start live-scores cron job, mount live route |
| `packages/shared/src/types/index.ts` | Add `LiveScorePreferences` interface, extend `PushPreferences` |
| `packages/shared/src/i18n/es.json` | Add `live_scores.*` and `live_notifications.*` keys |
| `packages/shared/src/i18n/en.json` | Add `live_scores.*` and `live_notifications.*` keys |
| `apps/api/src/services/push-sender.ts` | Add `liveScores` preference check, add `sendLiveScoreNotification` function |
| `apps/api/src/services/team-ids.ts` | Export `getTeamNameBySportsDbId()` reverse-lookup utility |
| `apps/web/src/components/NotificationSettings.tsx` | Add live score preferences section with per-event toggles |
| `apps/web/src/lib/api.ts` | Add `updateLiveScorePreferences()` and `getLiveMatch()` API functions |
| `apps/mobile/src/lib/api.ts` | Add `updateLiveScorePreferences()` and `getLiveMatch()` API functions |
| `apps/mobile/src/screens/ParentalControl.tsx` | (No change needed — parental schedule lock already controls notification timing) |
| `apps/mobile/src/navigation/index.tsx` | Wire notification tap handler for `FavoriteTeam` screen with live score data |

---

## 12. Mobile UI Changes

### 12.1 Notification Preferences (within existing ParentalControl or Settings)

Add a new section below the existing notification toggles:

```
Live Match Notifications
├── [toggle] Goals
├── [toggle] Match start
├── [toggle] Match end
└── [toggle] Red cards
```

Each toggle maps to a field in `PushPreferences.liveScores`. The section is only visible when `pushEnabled` is true and `favoriteTeam` is set.

### 12.2 FavoriteTeam Screen — Live Match Banner

When `GET /api/teams/:teamName/live` returns `live: true`, show a banner at the top of the FavoriteTeam screen:

```
┌─────────────────────────────────┐
│  LIVE  Real Madrid 2–1 Chelsea  │
│         67' - La Liga           │
└─────────────────────────────────┘
```

- Pulsing red dot + "LIVE" badge
- Auto-refreshes every 60 seconds via `setInterval` + `refetch`
- Tapping the banner does nothing (informational only)

### 12.3 Android Notification Channel

Add a dedicated notification channel for live scores on Android:

```typescript
await Notifications.setNotificationChannelAsync('live-scores', {
  name: 'Live Match Scores',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 200, 100, 200],
  lightColor: '#22C55E',
});
```

This allows users to manage live score notification volume and behavior at the OS level, independent of other notification types.

---

## 13. Web UI Changes

### 13.1 NotificationSettings Component

Extend the existing `NotificationSettings.tsx` component with a new section:

```
Live Match Notifications
  [checkbox] Goals
  [checkbox] Match start
  [checkbox] Match end
  [checkbox] Red cards
```

The section appears below the existing `teamUpdates` toggle. Disabled (grayed out) when notifications are globally disabled or when the user has no `favoriteTeam`.

### 13.2 Team Stats Page — Live Match Indicator

On the `/team` page, when a live match is detected, replace the "Next match" section with the live score display. Same visual treatment as mobile (pulsing dot, score, minute).

---

## 14. `push-sender.ts` Extensions

### 14.1 New Preference Type

Add `'liveScores'` to the `PushPreference` union:

```typescript
type PushPreference = 'dailyQuiz' | 'teamUpdates' | 'liveScores' | null;
```

### 14.2 New Function: `sendLiveScoreToUsers`

```typescript
export async function sendLiveScoreToUsers(
  teamName: string,
  eventType: 'goals' | 'matchStart' | 'matchEnd' | 'redCards',
  payload: PushPayload,
): Promise<number>;
```

This function:

1. Finds all users where `favoriteTeam` matches `teamName` (case-insensitive).
2. Filters by `pushEnabled = true`.
3. Filters by `pushPreferences.liveScores.enabled = true`.
4. Filters by `pushPreferences.liveScores[eventType] = true`.
5. For each eligible user, checks parental schedule lock (if `ParentalProfile` exists).
6. Sends push to remaining users via existing `sendToTokens`.
7. Returns the count of notifications sent (for logging).

### 14.3 Schedule Lock Utility

Extract the schedule check from `parental-guard.ts` into a reusable function:

```typescript
// apps/api/src/services/schedule-check.ts
export function isWithinAllowedHours(
  allowedStart: number,
  allowedEnd: number,
  timezone: string,
): boolean;
```

Used by both the middleware and the live score notification sender.

---

## 15. Testing Strategy

### 15.1 Unit Tests

| Test File | Coverage |
|-----------|----------|
| `apps/api/src/services/__tests__/live-scores.test.ts` | Event detection logic: diff function, deduplication, all event types |
| `apps/api/src/services/__tests__/schedule-check.test.ts` | Schedule lock utility across timezones and edge cases |
| `apps/api/src/routes/__tests__/live.test.ts` | GET endpoint: live match found, no live match, caching |

### 15.2 Event Detection Tests

```
describe('detectEvents')
  it('detects match start when status changes from not_started to live')
  it('detects home goal when homeScore increases')
  it('detects away goal when awayScore increases')
  it('detects multiple goals when score jumps by 2+')
  it('detects red card when redCards string has new entries')
  it('detects half time when progress changes to HT')
  it('detects match end when status changes to finished')
  it('returns empty array when no changes between polls')
  it('does not duplicate events already in notifiedEvents')
  it('handles null previous state as first-time detection')

describe('sendLiveScoreToUsers')
  it('sends to users with matching favoriteTeam and liveScores enabled')
  it('skips users with liveScores disabled')
  it('skips users with specific event type disabled')
  it('skips users outside allowed schedule hours')
  it('skips users without favoriteTeam')
  it('handles users with no pushPreferences (uses defaults)')

describe('isWithinAllowedHours')
  it('returns true when current time is within range')
  it('returns false when current time is outside range')
  it('handles overnight ranges (e.g., 22-8)')
  it('returns true for default 0-24 (no restriction)')
  it('converts timezone correctly')
```

### 15.3 Integration Tests

| Test | What It Validates |
|------|------------------|
| Cron job dry run | Job starts, checks match window, exits early when no matches today |
| Full poll cycle (mocked API) | Fetches livescores, upserts LiveMatch, detects events, sends push |
| Cleanup | Finished matches older than 24h are deleted from LiveMatch table |

### 15.4 E2E Tests (Playwright)

| Flow | Steps |
|------|-------|
| Live score preferences | Navigate to settings, toggle live score notifications, verify saved |
| Live match banner | (Requires API mock) Seed a LiveMatch, navigate to team page, verify banner shows |

---

## 16. Acceptance Criteria

### Must Have (P0)

- [ ] `LiveMatch` model exists in Prisma schema with migration applied
- [ ] `live-scores.ts` cron job runs every 5 minutes
- [ ] Job correctly skips when no matches are happening (early exit)
- [ ] Job fetches TheSportsDB livescore endpoint for Soccer and Basketball
- [ ] Events are detected: goals, match start, match end
- [ ] Notifications are sent only to users with matching `favoriteTeam`
- [ ] Notifications respect `liveScores` push preference
- [ ] Notifications are not duplicated across consecutive polls
- [ ] `GET /api/teams/:teamName/live` returns current match state
- [ ] i18n keys added for ES and EN
- [ ] Notification copy is kid-friendly (no betting references, no violent language)
- [ ] Unit tests cover event detection logic with >90% branch coverage
- [ ] All existing tests continue to pass

### Should Have (P1)

- [ ] Red card event detection and notification
- [ ] Half time notification
- [ ] Per-event-type opt-in toggles in mobile and web UI
- [ ] Android notification channel `live-scores`
- [ ] Live match banner on FavoriteTeam screen (mobile) and team page (web)
- [ ] Parental schedule lock respected for notifications
- [ ] LiveMatch cleanup (24h after finished)

### Nice to Have (P2)

- [ ] Match end title varies based on result (win/loss/draw)
- [ ] Sport-specific emoji in notification title
- [ ] E2E test for live match banner
- [ ] Metrics logging (matches polled, events detected, notifications sent per cycle)

---

## 17. Rollout Plan

### Phase A: Backend (Days 1-3)

1. Add `LiveMatch` model to schema, run migration
2. Implement `live-scores.ts` service (fetch, diff, detect events)
3. Implement `schedule-check.ts` utility (extracted from parental-guard)
4. Extend `push-sender.ts` with `sendLiveScoreToUsers`
5. Implement cron job wrapper
6. Implement `GET /api/teams/:teamName/live` route
7. Write unit and integration tests

### Phase B: Frontend (Days 4-5)

1. Add `LiveScorePreferences` to shared types
2. Add i18n keys for both locales
3. Extend `NotificationSettings.tsx` (web) with live score toggles
4. Extend notification preferences in mobile
5. Add live match banner to FavoriteTeam screen (mobile) and team page (web)
6. Wire notification tap handler to navigate to team screen
7. Add Android notification channel

### Phase C: QA and Deploy (Days 6-7)

1. Test with mocked livescore data (TheSportsDB does not provide a staging API)
2. Deploy to Fly.io production
3. Monitor first live match cycle via logs
4. Verify notifications arrive on physical devices

---

## 18. Monitoring and Observability

### Log Events

| Event | Level | Data |
|-------|-------|------|
| `live-scores:poll:start` | info | `{ matchesLive, trackedTeamsWithMatchToday }` |
| `live-scores:poll:skip` | debug | `{ reason: 'no_matches_today' }` |
| `live-scores:event:detected` | info | `{ eventType, homeTeam, awayTeam, score, eventKey }` |
| `live-scores:notification:sent` | info | `{ eventType, teamName, userCount }` |
| `live-scores:notification:skipped` | debug | `{ reason, userId }` |
| `live-scores:poll:complete` | info | `{ matchesPolled, eventsDetected, notificationsSent, durationMs }` |
| `live-scores:cleanup` | info | `{ deletedCount }` |
| `live-scores:api:error` | warn | `{ endpoint, statusCode }` |

### Sentry

- Errors in the cron job are caught and logged but not thrown (job should never crash).
- API timeout errors are logged as warnings, not Sentry errors (expected behavior).
- Push send failures for individual users are logged but do not halt the batch.

---

## 19. Security Considerations

- **No PII in notifications**: Push payloads contain only team names and scores, never user data.
- **Rate limiting**: The `/api/teams/:teamName/live` endpoint uses the existing `content` rate limiter tier (60 req/min).
- **Parental controls respected**: Schedule lock prevents notifications during bedtime.
- **Content safety**: Notification text is templated (not user-generated), so no moderation needed.
- **TheSportsDB API key**: The free tier key (`3`) is public and documented by TheSportsDB. No secret to protect.
- **No child interaction**: Live scores are informational push notifications. No chat, comments, or social features.

---

## 20. Cost Analysis

| Resource | Cost | Notes |
|----------|------|-------|
| TheSportsDB free tier | $0 | v2 livescore API is free. Premium ($20/mo) gives faster updates but not required. |
| Expo push notifications | $0 | Free tier covers up to 10,000 notifications/month |
| LiveMatch DB storage | Negligible | ~30 rows max, cleaned up daily |
| Cron CPU | Negligible | 2 HTTP requests every 5 minutes, lightweight diffing |

Total incremental cost: **$0** on the free tier. If the user base grows beyond 10,000 active users during match hours, Expo's paid push tier ($99/mo) may be needed.

---

## 21. Future Considerations

These are explicitly out of scope for this PRD but worth noting for future iterations:

- **Multi-team support**: Allow users to follow multiple teams (requires schema change to `favoriteTeams: String[]`).
- **WebSocket live updates**: Replace polling with a WebSocket connection for sub-minute latency.
- **Match timeline in-app**: Show a play-by-play timeline within the FavoriteTeam screen.
- **Pre-match reminders**: "Your team plays in 1 hour" notification (separate event type).
- **TheSportsDB premium upgrade**: $20/mo for faster livescore updates and more sports coverage.
- **Web push notifications**: Use the Web Push API for browser-based live score alerts.
