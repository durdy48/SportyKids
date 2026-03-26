# Sprint 5 "Polish Premium" + Remaining P1/P2 Items - Product Requirements Document

## Overview

This PRD covers Sprint 5 ("Polish Premium") comprising 5 high-impact features that elevate SportyKids from MVP to a polished product, plus 11 remaining P1/P2 backlog items spanning parental controls, UX polish, infrastructure, and mobile-native capabilities. All items build on existing code paths and data models from Phases 0-4.

## Problem Statement

The current MVP has static feed ranking, hardcoded team stats, no offline support, no API-level caching, and no reading history. Parents lack schedule-based access controls. Mobile lacks native haptics and video playback. The infrastructure needs PostgreSQL migration, error monitoring, and CI/CD before beta testing with families.

## Goals

1. **Personalization**: Transform the "For You" feed from static weights to a behavioral algorithm that learns from usage patterns.
2. **Live data**: Replace static seed team stats with real data from a free sports API.
3. **Resilience**: Enable offline reading and add API-level caching to reduce latency and DB load.
4. **Engagement**: Surface reading history, content recommendations, and haptic feedback.
5. **Safety**: Add bedtime/schedule locks enforced server-side.
6. **Production readiness**: PostgreSQL migration, error monitoring, CI/CD pipeline.

## Target Users

- **Kids (6-14)**: Primary users consuming news, reels, quizzes.
- **Parents**: Configure schedule locks, review activity.
- **Developers**: Benefit from CI/CD, monitoring, PostgreSQL migration.

---

## Feature 1: B-CP2 — "For You" Algorithmic Feed

### Current State

`apps/api/src/services/feed-ranker.ts` uses static weights:
- `+5` for favorite team match
- `+3` for favorite sport match
- Filtered by `favoriteSports` only
- `RankableItem` interface is generic (accepts `[key: string]: unknown`)

### Proposed Scoring Formula

```
score(item) =
    teamBoost(item)           // +5 if matches favoriteTeam
  + sportBoost(item)          // +3 if matches favoriteSports
  + behavioralSportBoost(item) // +0 to +4 based on sport read frequency
  + sourceBoost(item)         // +0 to +2 based on source click frequency
  + recencyBoost(item)        // +0 to +3 based on time decay
  - alreadyReadPenalty(item)  // -8 if user already read this article
```

#### Behavioral Sport Boost (0-4 points)

Query `ActivityLog` for `type = 'news_viewed'` in the last 14 days, grouped by `sport`. Normalize to a 0-1 ratio per sport, then multiply by 4.

```typescript
// In feed-ranker.ts
interface BehavioralSignals {
  sportReadCounts: Record<string, number>;  // sport -> count in last 14 days
  sourceClickCounts: Record<string, number>; // source -> count in last 14 days
  readContentIds: Set<string>;               // contentIds from ActivityLog
}

async function getBehavioralSignals(userId: string): Promise<BehavioralSignals> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const logs = await prisma.activityLog.findMany({
    where: {
      userId,
      type: 'news_viewed',
      createdAt: { gte: since },
    },
    select: { sport: true, contentId: true },
  });

  const sportReadCounts: Record<string, number> = {};
  const sourceClickCounts: Record<string, number> = {};
  const readContentIds = new Set<string>();

  for (const log of logs) {
    if (log.sport) sportReadCounts[log.sport] = (sportReadCounts[log.sport] || 0) + 1;
    if (log.contentId) readContentIds.add(log.contentId);
  }

  // Source click counts require joining with NewsItem — separate query
  // ...

  return { sportReadCounts, sourceClickCounts, readContentIds };
}
```

#### Source Boost (0-2 points)

Same approach: count `news_viewed` logs, join `contentId` with `NewsItem.id` to resolve source name, normalize top sources to 0-2 range.

#### Recency Boost (0-3 points)

```typescript
function recencyBoost(publishedAt: Date): number {
  const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 2) return 3;
  if (hoursAgo < 6) return 2;
  if (hoursAgo < 24) return 1;
  return 0;
}
```

#### Already-Read Penalty (-8 points)

If `item.id` is in `readContentIds`, apply `-8` to push it below unread items but still keep it in the feed (not filtered out).

### Data Model Changes

No Prisma schema changes needed. All signals come from existing `ActivityLog` records (`type: 'news_viewed'`, `contentId`, `sport` fields already exist).

### API Changes

Update `GET /api/news` in `apps/api/src/routes/news.ts`:
- When `userId` is provided, call `getBehavioralSignals(userId)` and pass to `rankFeed()`.
- Cache behavioral signals per userId for 5 minutes (see Feature 4).

### Updated `rankFeed` Signature

```typescript
// apps/api/src/services/feed-ranker.ts
export function rankFeed<T extends RankableItem>(
  news: T[],
  userPrefs: UserPrefs,
  behavioral?: BehavioralSignals,  // NEW optional param — backward compatible
): T[]
```

### Edge Cases

- New users with no ActivityLog: falls back to current static weights (behavioral signals are all zero).
- Users who only read one sport: that sport gets max behavioral boost, others get 0 — this is intentional (reinforces preference).
- Very old articles (>7 days): recency boost is 0, effectively deprioritized.

### Acceptance Criteria

- [ ] `rankFeed()` accepts optional `BehavioralSignals` parameter
- [ ] `getBehavioralSignals()` queries ActivityLog for last 14 days
- [ ] Sport behavioral boost ranges 0-4 based on read frequency normalization
- [ ] Source boost ranges 0-2 based on click frequency normalization
- [ ] Recency boost: 3 (<2h), 2 (<6h), 1 (<24h), 0 (older)
- [ ] Already-read articles receive -8 penalty
- [ ] New users with no activity get identical results to current static ranking
- [ ] Behavioral signals cached per userId for 5 minutes
- [ ] Unit tests for scoring formula with mock signals

---

## Feature 2: B-CP3 — Live Team Stats

### Current State

`apps/api/src/services/team-stats.ts` reads from `TeamStats` table (static seed data with 15 teams). Fields: `teamName`, `sport`, `leaguePosition`, `recentResults` (JSON), `topScorer`, `nextMatch` (JSON).

### Recommended API: TheSportsDB

**Why TheSportsDB**: Free tier, no API key required, covers football/basketball/F1. Base URL: `https://www.thesportsdb.com/api/v1/json/3/`

#### Key Endpoints

| TheSportsDB Endpoint | Maps To |
|---|---|
| `lookupteam.php?id={id}` | Team metadata |
| `lookuptable.php?l={leagueId}&s={season}` | `leaguePosition` |
| `eventslast.php?id={teamId}` | `recentResults` (last 5) |
| `eventsnext.php?id={teamId}` | `nextMatch` |

#### Team ID Mapping

Create a mapping file at `apps/api/src/config/team-ids.ts`:

```typescript
// apps/api/src/config/team-ids.ts
export const THESPORTSDB_TEAM_IDS: Record<string, { id: string; leagueId: string; sport: string }> = {
  'Real Madrid':    { id: '133738', leagueId: '4335', sport: 'football' },
  'FC Barcelona':   { id: '133739', leagueId: '4335', sport: 'football' },
  'Atletico Madrid':{ id: '133703', leagueId: '4335', sport: 'football' },
  'Manchester City': { id: '133613', leagueId: '4328', sport: 'football' },
  'Liverpool':      { id: '133602', leagueId: '4328', sport: 'football' },
  'LA Lakers':      { id: '134867', leagueId: '4387', sport: 'basketball' },
  // ... map all 15+ seeded teams
};
```

#### Response Mapping

```typescript
// apps/api/src/services/team-stats-sync.ts
interface TheSportsDBEvent {
  strEvent: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string;
  strLeague: string;
}

function mapRecentResults(events: TheSportsDBEvent[], teamName: string): string {
  const results = events.slice(0, 5).map(e => {
    const isHome = e.strHomeTeam.includes(teamName);
    const homeScore = parseInt(e.intHomeScore || '0');
    const awayScore = parseInt(e.intAwayScore || '0');
    const teamScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;
    const opponent = isHome ? e.strAwayTeam : e.strHomeTeam;
    let result: 'W' | 'D' | 'L';
    if (teamScore > opponentScore) result = 'W';
    else if (teamScore === opponentScore) result = 'D';
    else result = 'L';
    return {
      opponent,
      score: `${teamScore}-${opponentScore}`,
      result,
      date: e.dateEvent,
    };
  });
  return JSON.stringify(results);
}
```

#### Cron Schedule

Add to `apps/api/src/jobs/sync-feeds.ts` (or create `apps/api/src/jobs/sync-team-stats.ts`):

```typescript
// apps/api/src/jobs/sync-team-stats.ts
import cron from 'node-cron';

// Run daily at 04:00 UTC (after most matches finish)
export function startTeamStatsSyncJob(): void {
  cron.schedule('0 4 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Syncing team stats from TheSportsDB...`);
    await syncAllTeamStats();
  });
  console.log('Team stats sync job scheduled: daily at 04:00 UTC.');
}
```

**Rate limiting**: TheSportsDB free tier allows ~100 requests/day. With 15 teams x 3 requests each = 45 requests per sync cycle. Add 1-second delay between requests.

### Edge Cases

- TheSportsDB is down: keep existing data, log error, retry next day.
- Team not found in API: skip update, keep seed data.
- Off-season (no recent matches): `recentResults` stays as last known, `nextMatch` becomes null.
- Non-football sports with limited TheSportsDB coverage: keep seed data, mark `updatedAt` to show staleness.

### Acceptance Criteria

- [ ] `apps/api/src/config/team-ids.ts` maps all 15 seeded teams to TheSportsDB IDs
- [ ] `apps/api/src/services/team-stats-sync.ts` fetches and maps data from TheSportsDB
- [ ] Cron job runs daily at 04:00 UTC
- [ ] 1-second delay between API requests to respect rate limits
- [ ] Graceful fallback: if API fails, existing data is preserved
- [ ] `recentResults` JSON matches existing format: `[{opponent, score, result, date}]`
- [ ] `nextMatch` JSON matches existing format: `{opponent, date, competition}`
- [ ] `leaguePosition` updated from league table endpoint
- [ ] Manual trigger endpoint: `POST /api/teams/sync` (admin only)
- [ ] Logs success/failure count per sync cycle

---

## Feature 3: B-MP4 — Offline Reading Queue

### Caching Strategy

Use `@react-native-async-storage/async-storage` (already installed, v2.2.0) on mobile and `localStorage` on web.

#### What to Cache

| Content | Storage Key | Max Items | Includes |
|---|---|---|---|
| News articles | `@sk_offline_news` | 20 | Full NewsItem + age-adapted summary if available |
| User preferences | `@sk_offline_user` | 1 | User object from context |
| Sticker collection | `@sk_offline_stickers` | all | UserSticker[] |

#### Storage Limits

- Max 20 news articles (~50KB estimated at ~2.5KB per article with summary).
- Images are NOT cached offline (too large). Show placeholder.
- Reels and quizzes are NOT cached (require network for video/scoring).

#### Sync Behavior

```typescript
// apps/mobile/src/lib/offline-cache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const OFFLINE_NEWS_KEY = '@sk_offline_news';
const MAX_OFFLINE_ARTICLES = 20;

interface OfflineNewsItem {
  article: NewsItem;
  summary?: string;
  cachedAt: number;
}

export async function cacheNewsForOffline(articles: NewsItem[]): Promise<void> {
  const existing = await getOfflineNews();
  const merged = [...articles.map(a => ({
    article: a,
    cachedAt: Date.now(),
  })), ...existing].slice(0, MAX_OFFLINE_ARTICLES);
  await AsyncStorage.setItem(OFFLINE_NEWS_KEY, JSON.stringify(merged));
}

export async function getOfflineNews(): Promise<OfflineNewsItem[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_NEWS_KEY);
  if (!raw) return [];
  const items: OfflineNewsItem[] = JSON.parse(raw);
  // Evict items older than 48 hours
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  return items.filter(i => i.cachedAt > cutoff);
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);
  return isOnline;
}
```

#### Offline Banner

When offline, show a banner at the top of the feed:

```
+------------------------------------------+
| [wifi-off icon]  You're offline           |
| Showing saved articles                    |
+------------------------------------------+
```

#### Web Implementation

On web (`apps/web/`), use `navigator.onLine` + `window.addEventListener('online'/'offline')` and `localStorage` with same key structure. Cap at 20 articles.

### New Dependencies

- Mobile: `@react-native-community/netinfo` (compatible with Expo SDK 54)
- Web: No new dependencies (native browser APIs)

### Files to Modify

- `apps/mobile/src/lib/offline-cache.ts` (NEW)
- `apps/mobile/src/screens/HomeFeed.tsx` — check network, serve cached if offline
- `apps/mobile/src/components/OfflineBanner.tsx` (NEW)
- `apps/web/src/lib/offline-cache.ts` (NEW)
- `apps/web/src/app/page.tsx` — same offline logic for web
- `apps/web/src/components/OfflineBanner.tsx` (NEW)
- `packages/shared/src/i18n/es.json` — add `offline.*` keys
- `packages/shared/src/i18n/en.json` — add `offline.*` keys

### i18n Keys

```json
{
  "offline": {
    "banner_title": "You're offline",
    "banner_message": "Showing saved articles",
    "no_cached": "No saved articles available",
    "cached_count": "{{count}} articles saved for offline"
  }
}
```

### Acceptance Criteria

- [ ] News feed automatically caches latest 20 articles after each successful fetch
- [ ] Cached articles include summary if previously fetched
- [ ] Offline detection works on mobile (NetInfo) and web (navigator.onLine)
- [ ] Offline banner appears when connection is lost
- [ ] Cached articles older than 48h are evicted
- [ ] When reconnecting, feed refreshes from API and updates cache
- [ ] Image placeholders shown when offline (no broken images)
- [ ] Reels and quiz tabs show "requires internet" message when offline
- [ ] Storage does not exceed ~1MB total
- [ ] i18n keys added for es and en

---

## Feature 4: B-TF5 — API Caching Layer

### Cache Architecture

In-memory cache using `Map` with TTL. Redis-ready interface for future migration.

#### Cache Middleware Pattern

```typescript
// apps/api/src/middleware/cache.ts

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry>();
  private maxEntries = 10_000;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Simple eviction: if at max, clear expired entries
    if (this.store.size >= this.maxEntries) {
      this.evictExpired();
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) this.store.delete(key);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

export const apiCache = new InMemoryCache();
```

#### Express Middleware

```typescript
// apps/api/src/middleware/cache.ts (continued)

import { Request, Response, NextFunction } from 'express';

interface CacheOptions {
  ttlMs: number;
  keyPrefix: string;
  keyFn?: (req: Request) => string;
}

export function withCache(options: CacheOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyFn
      ? `${options.keyPrefix}:${options.keyFn(req)}`
      : `${options.keyPrefix}:${req.originalUrl}`;

    const cached = apiCache.get(key);
    if (cached) {
      res.json(cached);
      return;
    }

    // Override res.json to intercept the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        apiCache.set(key, body, options.ttlMs);
      }
      return originalJson(body);
    };

    next();
  };
}
```

#### TTL Configuration

| Endpoint | Cache Key Prefix | TTL | Invalidation Trigger |
|---|---|---|---|
| `GET /api/news` | `news:feed` | 5 min | `POST /api/news/sincronizar` |
| `GET /api/news/:id` | `news:detail` | 10 min | None (immutable) |
| `GET /api/news/:id/resumen` | `news:summary` | 24 h | None (immutable once generated) |
| `GET /api/teams/:teamName/stats` | `team:stats` | 1 h | Team stats cron sync |
| `GET /api/gamification/stickers` | `stickers:catalog` | 24 h | None (static catalog) |
| `GET /api/gamification/stickers/:userId` | `stickers:user` | 5 min | `POST /api/gamification/check-in` |
| `GET /api/quiz/questions` | `quiz:questions` | until `expiresAt` | `POST /api/quiz/generate` |
| `GET /api/reels` | `reels:feed` | 10 min | None |

#### Usage in Routes

```typescript
// apps/api/src/routes/news.ts
import { withCache, apiCache } from '../middleware/cache';

// GET /api/news — cached 5 min, keyed by full query string
router.get('/', parentalGuard, withCache({
  ttlMs: 5 * 60 * 1000,
  keyPrefix: 'news:feed',
}), async (req, res) => { /* existing handler */ });

// POST /api/news/sincronizar — invalidate news cache after sync
router.post('/sincronizar', async (_req, res) => {
  const result = await runManualSync();
  apiCache.invalidate('news:');  // Invalidate all news caches
  res.json({ /* ... */ });
});
```

#### Behavioral Signals Cache

The `getBehavioralSignals()` from Feature 1 should also be cached:

```typescript
// Key: `behavioral:{userId}`, TTL: 5 min
```

### Edge Cases

- Cache stampede: acceptable for MVP with in-memory cache (single process). For Redis, add mutex/singleflight.
- Memory pressure: `maxEntries = 10_000` with eviction of expired entries.
- Personalized endpoints (with `userId`): cache key includes userId to avoid leaking personalized feeds.

### Acceptance Criteria

- [ ] `InMemoryCache` class created at `apps/api/src/middleware/cache.ts`
- [ ] `withCache()` middleware intercepts `res.json()` to cache successful responses
- [ ] News feed cached for 5 min with full URL as key (includes query params + userId)
- [ ] Team stats cached for 1 hour
- [ ] Sticker catalog cached for 24 hours
- [ ] Quiz questions cached until `expiresAt`
- [ ] `apiCache.invalidate(prefix)` clears matching keys
- [ ] Sync endpoint invalidates news cache
- [ ] Check-in endpoint invalidates user sticker cache
- [ ] Cache is per-user for personalized endpoints (userId in key)
- [ ] Max 10,000 entries with expired-entry eviction

---

## Feature 5: B-EN4 — Reading History

### Current State

`ActivityLog` already records `type: 'news_viewed'` with `contentId` (the NewsItem ID) and `sport`. This data exists but is not surfaced to the user.

### API Changes

Add to `apps/api/src/routes/news.ts`:

```typescript
// GET /api/news/historial?userId=&page=1&limit=10
router.get('/historial', async (req: Request, res: Response) => {
  const schema = z.object({
    userId: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { userId, page, limit } = parsed.data;

  const logs = await prisma.activityLog.findMany({
    where: { userId, type: 'news_viewed', contentId: { not: null } },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    select: { contentId: true, createdAt: true, sport: true },
  });

  const contentIds = logs.map(l => l.contentId).filter(Boolean) as string[];

  const newsItems = await prisma.newsItem.findMany({
    where: { id: { in: contentIds }, safetyStatus: 'approved' },
  });

  const newsMap = new Map(newsItems.map(n => [n.id, n]));
  const history = logs
    .filter(l => l.contentId && newsMap.has(l.contentId))
    .map(l => ({
      viewedAt: l.createdAt,
      news: newsMap.get(l.contentId!),
    }));

  const total = await prisma.activityLog.count({
    where: { userId, type: 'news_viewed', contentId: { not: null } },
  });

  res.json({ history, total, page, totalPages: Math.ceil(total / limit) });
});
```

**Note**: Route path is `/historial` (Spanish, consistent with existing news routes per project convention).

### UI — Web

Add "Recently read" section to the home page (`apps/web/src/app/page.tsx`), shown only when user is logged in and has history.

```
+------------------------------------------+
|  Recently Read                    See all >|
+------------------------------------------+
| [img] Title of article 1     2 hours ago  |
| [img] Title of article 2     Yesterday    |
| [img] Title of article 3     2 days ago   |
+------------------------------------------+
```

### UI — Mobile

Add horizontal scrollable row in `apps/mobile/src/screens/HomeFeed.tsx`:

```
+------------------------------------------+
| Recently Read                             |
| +--------+ +--------+ +--------+         |
| |  img   | |  img   | |  img   |  -->    |
| | Title  | | Title  | | Title  |         |
| | 2h ago | | Yester | | 2d ago |         |
| +--------+ +--------+ +--------+         |
+------------------------------------------+
```

### i18n Keys

```json
{
  "history": {
    "title": "Recently Read",
    "see_all": "See all",
    "empty": "No articles read yet",
    "time_ago": "{{time}} ago"
  }
}
```

### Acceptance Criteria

- [ ] `GET /api/news/historial?userId=&page=&limit=` returns paginated reading history
- [ ] Response includes full NewsItem objects with `viewedAt` timestamps
- [ ] Only `approved` news items are returned (deleted/rejected items filtered out)
- [ ] Web: "Recently Read" horizontal section on home page (max 5 items)
- [ ] Mobile: horizontal scrollable row on HomeFeed (max 5 items)
- [ ] "See all" link navigates to full history page/screen
- [ ] Empty state shows "No articles read yet" message
- [ ] i18n keys for es and en
- [ ] Reading history respects parental guard (uses existing middleware)

---

## Feature 6: B-PT4 — Bedtime / Schedule Lock

### Prisma Schema Change

```prisma
// apps/api/prisma/schema.prisma — add to ParentalProfile
model ParentalProfile {
  id                  String  @id @default(cuid())
  userId              String  @unique
  user                User    @relation(fields: [userId], references: [id])
  pin                 String
  allowedSports       String  @default("[]")
  allowedFeeds        String  @default("[]")
  allowedFormats      String  @default("[\"news\",\"reels\",\"quiz\"]")
  maxDailyTimeMinutes Int     @default(60)
  allowedHoursStart   Int     @default(7)   // NEW: 0-23, default 7am
  allowedHoursEnd     Int     @default(21)  // NEW: 0-23, default 9pm
  timezone            String  @default("Europe/Madrid") // NEW: IANA timezone
}
```

**Migration**: `npx prisma migrate dev --name add-schedule-lock`

### Middleware Update

Add schedule check to `apps/api/src/middleware/parental-guard.ts`, after the existing format/sport/time checks:

```typescript
// In parentalGuard(), after daily time limit check (line ~103):

// 7. Check schedule lock (bedtime)
if (profile.allowedHoursStart !== undefined && profile.allowedHoursEnd !== undefined) {
  // Get current hour in user's timezone
  const tz = profile.timezone || 'Europe/Madrid';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz,
  });
  const currentHour = parseInt(formatter.format(now));

  const start = profile.allowedHoursStart;
  const end = profile.allowedHoursEnd;

  let isAllowed: boolean;
  if (start <= end) {
    // Normal range: e.g., 7-21
    isAllowed = currentHour >= start && currentHour < end;
  } else {
    // Overnight range: e.g., 22-6 (allowed from 22 to 06)
    isAllowed = currentHour >= start || currentHour < end;
  }

  if (!isAllowed) {
    res.status(403).json({
      error: 'schedule_locked',
      message: 'Content is not available at this time',
      allowedHoursStart: start,
      allowedHoursEnd: end,
    });
    return;
  }
}
```

Update `CachedProfile` interface to include new fields:

```typescript
interface CachedProfile {
  allowedFormats: string;
  allowedSports: string;
  maxDailyTimeMinutes: number | null;
  allowedHoursStart: number;    // NEW
  allowedHoursEnd: number;      // NEW
  timezone: string;             // NEW
}
```

### Lock Screen UI

Update `apps/web/src/components/LimitReached.tsx` to handle `schedule_locked` type:

```
+------------------------------------------+
|                                          |
|              (moon + stars)              |
|                 🌙 ⭐                    |
|                                          |
|        Time to rest, champion!           |
|                                          |
|    SportyKids is sleeping too.           |
|    Come back tomorrow at 7:00 AM!        |
|                                          |
|          [ Go to Home ]                  |
|                                          |
+------------------------------------------+
```

Add `schedule_locked` to `LimitType`:

```typescript
// apps/web/src/components/LimitReached.tsx
type LimitType = 'limit_reached' | 'format_blocked' | 'sport_blocked' | 'schedule_locked';

// Add to EMOJIS and MESSAGE_KEYS maps
```

### Parental Panel Update

Add schedule controls to the Restrictions tab in `apps/web/src/components/ParentalPanel.tsx` (or wherever restrictions are managed):

```
+------------------------------------------+
| Schedule                                  |
| Start time:  [ 07:00  v ]               |
| End time:    [ 21:00  v ]               |
| Timezone:    [ Europe/Madrid  v ]        |
+------------------------------------------+
```

### i18n Keys

```json
{
  "limit": {
    "schedule_locked_title": "Time to rest, champion!",
    "schedule_locked_message": "SportyKids is sleeping too. Come back at {{time}}!",
  },
  "parental": {
    "schedule": "Schedule",
    "allowed_hours_start": "Start time",
    "allowed_hours_end": "End time",
    "timezone": "Timezone"
  }
}
```

### Acceptance Criteria

- [ ] Prisma migration adds `allowedHoursStart` (default 7), `allowedHoursEnd` (default 21), `timezone` (default "Europe/Madrid") to ParentalProfile
- [ ] `parental-guard.ts` checks current hour in user's timezone against allowed range
- [ ] Overnight ranges work correctly (e.g., 22-6 for night owls)
- [ ] `schedule_locked` error response includes `allowedHoursStart` and `allowedHoursEnd`
- [ ] `LimitReached` component renders sleep-themed screen for `schedule_locked`
- [ ] Parental panel allows setting start/end hours and timezone
- [ ] `PUT /api/parents/perfil/:userId` accepts and persists the new fields
- [ ] Cache in parental-guard.ts includes new fields
- [ ] i18n keys for es and en

---

## Feature 7: B-MP3 — Pull-to-Refresh with Branding

### Mobile Implementation

In `apps/mobile/src/screens/HomeFeed.tsx`, replace default `RefreshControl` with branded version:

```
+------------------------------------------+
|         (pulling down)                    |
|                                          |
|         [SportyKids logo/mascot]         |
|         "Loading fresh news..."          |
|         [spinning animation]             |
|                                          |
+------------------------------------------+
```

```typescript
// apps/mobile/src/components/BrandedRefresh.tsx
import { RefreshControl } from 'react-native';
import { COLORS } from '@sportykids/shared';

export function BrandedRefreshControl({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={COLORS.blue}
      colors={[COLORS.blue, COLORS.green, COLORS.yellow]}
      title="Loading fresh news..."
      titleColor={COLORS.text}
      progressBackgroundColor={COLORS.background}
    />
  );
}
```

### Screens to Update

- `apps/mobile/src/screens/HomeFeed.tsx`
- `apps/mobile/src/screens/Reels.tsx`
- `apps/mobile/src/screens/FavoriteTeam.tsx`

### Acceptance Criteria

- [ ] `BrandedRefreshControl` component created with SportyKids colors
- [ ] HomeFeed, Reels, and FavoriteTeam screens use branded refresh
- [ ] Pull-to-refresh triggers API refetch
- [ ] Loading text uses i18n keys
- [ ] Colors match design tokens (Blue #2563EB primary tint)

---

## Feature 8: B-UX7 — Kid-Friendly Error Messages

### Error State Component

Create `apps/web/src/components/ErrorState.tsx` and `apps/mobile/src/components/ErrorState.tsx`:

```
+------------------------------------------+
|                                          |
|           (bouncing ball icon)           |
|               ⚽💨                        |
|                                          |
|   Oops! The ball went out of bounds!     |
|                                          |
|   We couldn't load this page.            |
|   Let's try again!                       |
|                                          |
|          [ Try Again ]                   |
|                                          |
+------------------------------------------+
```

### Error Mapping

```typescript
// packages/shared/src/constants/errors.ts (NEW)
export const KID_FRIENDLY_ERRORS: Record<string, { titleKey: string; messageKey: string; emoji: string }> = {
  network_error:    { titleKey: 'error.ball_out', messageKey: 'error.network_message', emoji: 'football-away' },
  not_found:        { titleKey: 'error.hide_seek', messageKey: 'error.not_found_message', emoji: 'magnifier' },
  server_error:     { titleKey: 'error.timeout', messageKey: 'error.server_message', emoji: 'whistle' },
  empty_state:      { titleKey: 'error.empty', messageKey: 'error.empty_message', emoji: 'empty-net' },
  default:          { titleKey: 'error.generic', messageKey: 'error.generic_message', emoji: 'shrug' },
};
```

### i18n Keys

```json
{
  "error": {
    "ball_out": "Oops! The ball went out of bounds!",
    "network_message": "We couldn't connect. Check your internet and try again!",
    "hide_seek": "Playing hide and seek!",
    "not_found_message": "We couldn't find what you're looking for.",
    "timeout": "The referee blew the whistle!",
    "server_message": "Something went wrong on our side. Try again in a moment!",
    "empty": "Empty net!",
    "empty_message": "There's nothing here yet. Check back later!",
    "generic": "Oops!",
    "generic_message": "Something unexpected happened. Let's try again!",
    "retry": "Try Again"
  }
}
```

### Files to Modify

- `apps/web/src/components/ErrorState.tsx` (NEW)
- `apps/mobile/src/components/ErrorState.tsx` (NEW)
- `packages/shared/src/constants/errors.ts` (NEW)
- `packages/shared/src/i18n/es.json` — add `error.*` keys
- `packages/shared/src/i18n/en.json` — add `error.*` keys
- Replace all raw error text in screens with `<ErrorState>` component

### Acceptance Criteria

- [ ] `ErrorState` component accepts `type` (network, not_found, server, empty, default) and `onRetry` callback
- [ ] Each error type has a unique sports-themed message and emoji
- [ ] Retry button calls `onRetry` when provided
- [ ] All screens use `ErrorState` instead of raw error text
- [ ] i18n keys for es (Spanish sports metaphors) and en
- [ ] Component works on both web (Next.js) and mobile (React Native)

---

## Feature 9: B-UX8 — Haptic Feedback on Mobile

### Expo Haptics Integration

Install: `npx expo install expo-haptics` (compatible with SDK 54).

#### Haptic Map

| Interaction | Method | Intensity |
|---|---|---|
| Quiz correct answer | `Haptics.notificationAsync(NotificationFeedbackType.Success)` | Medium |
| Quiz wrong answer | `Haptics.notificationAsync(NotificationFeedbackType.Error)` | Medium |
| Sticker obtained | `Haptics.notificationAsync(NotificationFeedbackType.Success)` | Medium |
| Achievement unlocked | `Haptics.notificationAsync(NotificationFeedbackType.Success)` | Medium |
| Daily check-in | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` | Medium |
| Like/share on Reel | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` | Light |
| Pull-to-refresh trigger | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` | Light |
| Tab navigation | `Haptics.selectionAsync()` | Light |
| Button press (primary actions) | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` | Light |

#### Utility Wrapper

```typescript
// apps/mobile/src/lib/haptics.ts
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const haptic = {
  success: () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  error: () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
  impact: (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  },
  selection: () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  },
};
```

### Files to Modify

- `apps/mobile/src/lib/haptics.ts` (NEW)
- `apps/mobile/src/screens/Quiz.tsx` — haptic on answer
- `apps/mobile/src/screens/Reels.tsx` — haptic on like/share
- `apps/mobile/src/screens/HomeFeed.tsx` — haptic on pull-to-refresh
- `apps/mobile/src/screens/Collection.tsx` (if exists) — haptic on sticker view
- `apps/mobile/src/navigation/` — haptic on tab press

### Acceptance Criteria

- [ ] `expo-haptics` installed and compatible with SDK 54
- [ ] `haptics.ts` utility wraps all haptic calls with Platform.OS guard
- [ ] Quiz: success haptic on correct, error haptic on wrong
- [ ] Sticker/achievement: success haptic on unlock
- [ ] Reels: light impact on like/share
- [ ] Pull-to-refresh: light impact on trigger
- [ ] Tab navigation: selection haptic
- [ ] No haptics on web (Platform guard)

---

## Feature 10: B-CP4 — Content Recommendations

### Behavior

After reading an article, show 2-3 related articles at the bottom of the detail view. Matching criteria (in priority order):
1. Same `team` (if article has a team)
2. Same `sport`
3. Exclude the current article
4. Only `safetyStatus: 'approved'`
5. Order by `publishedAt` DESC

### API

```typescript
// Add to apps/api/src/routes/news.ts

// GET /api/news/:id/relacionados?limit=3
router.get('/:id/relacionados', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 3, 5);
  const article = await prisma.newsItem.findUnique({ where: { id: req.params.id } });
  if (!article || article.safetyStatus !== 'approved') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const related = await prisma.newsItem.findMany({
    where: {
      id: { not: article.id },
      safetyStatus: 'approved',
      OR: [
        ...(article.team ? [{ team: article.team }] : []),
        { sport: article.sport },
      ],
    },
    orderBy: [
      // Team matches first, then by date
      { publishedAt: 'desc' },
    ],
    take: limit,
  });

  res.json({ related });
});
```

### UI

```
+------------------------------------------+
| [Article content above...]               |
+------------------------------------------+
| Related Articles                          |
| +--------------------------------------+ |
| | [img] Related article 1        2h ago| |
| +--------------------------------------+ |
| | [img] Related article 2    Yesterday | |
| +--------------------------------------+ |
| | [img] Related article 3      3d ago  | |
| +--------------------------------------+ |
+------------------------------------------+
```

### Acceptance Criteria

- [ ] `GET /api/news/:id/relacionados?limit=3` returns related articles
- [ ] Prioritizes same team, then same sport
- [ ] Excludes the current article
- [ ] Only returns approved articles
- [ ] Web: shown below article detail
- [ ] Mobile: shown below article detail
- [ ] i18n keys for section title

---

## Feature 11: B-CP5 — Content Filtering by Language

### Behavior

When a user's locale is set, prioritize `RssSource` records whose `language` field matches. Do NOT filter out other languages entirely — just boost matching language sources in the feed.

### Implementation

Update `apps/api/src/services/feed-ranker.ts`:

```typescript
interface UserPrefs {
  favoriteSports: string[];
  favoriteTeam?: string | null;
  locale?: string; // NEW
}

// In scoring: +2 if article source language matches user locale
```

Update `GET /api/news` in `apps/api/src/routes/news.ts` to pass `locale` from query or user context into `rankFeed()`.

Alternatively, add a `locale` query param to the news endpoint and use it to join `NewsItem.source` with `RssSource.name` to resolve language, then boost in ranking.

### Acceptance Criteria

- [ ] Feed ranker adds +2 boost for articles from sources matching user locale
- [ ] Non-matching language articles still appear (not filtered out)
- [ ] `locale` parameter accepted on `GET /api/news`
- [ ] Works with existing RssSource.language field (no schema changes)

---

## Feature 12: B-MP6 — Native Video Player

### Current State

Reels use YouTube iframe embeds via `videoUrl`. The `Reel` model has `videoType` (nullable) and `videoUrl`.

### Implementation

Install: `npx expo install expo-video` (preferred over expo-av for SDK 54+).

```typescript
// apps/mobile/src/components/NativeReelPlayer.tsx
import { VideoView, useVideoPlayer } from 'expo-video';

interface NativeReelPlayerProps {
  videoUrl: string;
  videoType?: string; // 'mp4' | 'youtube' | null
  aspectRatio?: string;
}

export function NativeReelPlayer({ videoUrl, videoType, aspectRatio }: NativeReelPlayerProps) {
  // If YouTube URL, fall back to WebView embed
  if (!videoType || videoType === 'youtube') {
    return <YouTubeEmbed url={videoUrl} />;
  }

  const player = useVideoPlayer(videoUrl, p => {
    p.loop = true;
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', aspectRatio: aspectRatio === '9:16' ? 9/16 : 16/9 }}
      allowsFullscreen
      nativeControls
    />
  );
}
```

### Web

On web (`apps/web/`), use HTML5 `<video>` tag for MP4 URLs, keep iframe for YouTube:

```typescript
// apps/web/src/components/ReelPlayer.tsx — update existing component
{reel.videoType === 'mp4' ? (
  <video src={reel.videoUrl} controls loop playsInline className="w-full rounded-xl" />
) : (
  <iframe src={reel.videoUrl} /* existing YouTube embed */ />
)}
```

### Acceptance Criteria

- [ ] `expo-video` installed and compatible with SDK 54
- [ ] MP4 videos play natively on mobile with loop and controls
- [ ] YouTube URLs fall back to WebView/iframe embed
- [ ] Web uses HTML5 `<video>` for MP4, iframe for YouTube
- [ ] Aspect ratio respected from `Reel.aspectRatio` field
- [ ] Player pauses when scrolling away (intersection observer on web, viewability on mobile)

---

## Feature 13: B-PT6 — Parental Onboarding Tour

### Behavior

After PIN creation during onboarding (step 5 in `apps/web/src/app/onboarding/page.tsx`), show 3 tooltip screens explaining parental controls.

### Tooltip Flow

```
Screen 1/3:
+------------------------------------------+
|  [1/3]                                   |
|  +------------------------------------+  |
|  |  (pointing to Restrictions tab)    |  |
|  |  Set allowed sports, formats, and  |  |
|  |  daily time limits here.           |  |
|  +------------------------------------+  |
|                              [ Next > ]  |
+------------------------------------------+

Screen 2/3:
+------------------------------------------+
|  [2/3]                                   |
|  +------------------------------------+  |
|  |  (pointing to Activity tab)        |  |
|  |  Track what your child reads and   |  |
|  |  how much time they spend.         |  |
|  +------------------------------------+  |
|                              [ Next > ]  |
+------------------------------------------+

Screen 3/3:
+------------------------------------------+
|  [3/3]                                   |
|  +------------------------------------+  |
|  |  (pointing to Schedule section)    |  |
|  |  Set bedtime hours to control      |  |
|  |  when the app is accessible.       |  |
|  +------------------------------------+  |
|                            [ Got it! ]   |
+------------------------------------------+
```

### Implementation

- Create `apps/web/src/components/ParentalTour.tsx`
- Store `hasSeenTour` in localStorage (`@sk_parental_tour_seen`)
- Show only once after initial PIN creation
- Mobile: same flow in `apps/mobile/src/screens/ParentalControl.tsx`

### Acceptance Criteria

- [ ] 3-step tooltip tour shown after PIN creation
- [ ] Each step highlights a specific parental control feature
- [ ] Tour can be dismissed at any point
- [ ] Tour only shows once (persisted in localStorage/AsyncStorage)
- [ ] i18n keys for tour content in es and en
- [ ] Works on both web and mobile

---

## Feature 14: B-TF4 — PostgreSQL Migration

### JSON Fields to Migrate to Native Arrays

| Model | Field | Current (SQLite) | Target (PostgreSQL) |
|---|---|---|---|
| `User` | `favoriteSports` | `String @default("[]")` | `String[]` |
| `User` | `selectedFeeds` | `String @default("[]")` | `String[]` |
| `User` | `pushPreferences` | `String?` (JSON) | `Json?` |
| `ParentalProfile` | `allowedSports` | `String @default("[]")` | `String[]` |
| `ParentalProfile` | `allowedFeeds` | `String @default("[]")` | `String[]` |
| `ParentalProfile` | `allowedFormats` | `String @default(...)` | `String[]` |
| `QuizQuestion` | `options` | `String` (JSON) | `Json` |
| `TeamStats` | `recentResults` | `String` (JSON) | `Json` |
| `TeamStats` | `nextMatch` | `String?` (JSON) | `Json?` |

### Migration Steps

1. **Update datasource in schema.prisma**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. **Update field types**:
```prisma
model User {
  // ...
  favoriteSports  String[]  @default([])
  selectedFeeds   String[]  @default([])
  pushPreferences Json?
  // ...
}

model ParentalProfile {
  // ...
  allowedSports   String[]  @default([])
  allowedFeeds    String[]  @default([])
  allowedFormats  String[]  @default(["news", "reels", "quiz"])
  // ...
}

model QuizQuestion {
  // ...
  options         Json
  // ...
}

model TeamStats {
  // ...
  recentResults   Json
  nextMatch       Json?
  // ...
}
```

3. **Data migration script** (`apps/api/prisma/migrate-to-pg.ts`):
```typescript
// For each model with JSON string fields:
// 1. Read all rows
// 2. Parse JSON strings
// 3. Write back as native arrays/JSON
// Run AFTER schema migration but BEFORE application code changes
```

4. **Remove all `JSON.parse()` / `JSON.stringify()` calls** in:
   - `apps/api/src/routes/news.ts` (lines 58, 88 — `selectedFeeds`, `favoriteSports`)
   - `apps/api/src/routes/users.ts` (user creation/update)
   - `apps/api/src/middleware/parental-guard.ts` (lines 50, 67 — `allowedFormats`, `allowedSports`)
   - `apps/api/src/services/team-stats.ts` (lines 16, 23 — `recentResults`, `nextMatch`)
   - `apps/api/src/services/feed-ranker.ts` (if any)
   - `apps/api/src/services/gamification.ts` (if parsing user fields)
   - `apps/api/prisma/seed.ts` (stringify calls in seed data)

5. **Update `.env`**:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/sportykids?schema=public"
```

6. **Run migration**:
```bash
npx prisma migrate dev --name migrate-to-postgresql
npx tsx prisma/migrate-to-pg.ts  # data migration
npx prisma generate
```

### Acceptance Criteria

- [ ] `schema.prisma` datasource changed to `postgresql`
- [ ] All 9 JSON string fields converted to native types (`String[]` or `Json`)
- [ ] Data migration script transforms existing JSON strings to native arrays
- [ ] All `JSON.parse()` / `JSON.stringify()` calls removed from application code
- [ ] Seed script updated to use native arrays (no `JSON.stringify()`)
- [ ] All API endpoints work with native PostgreSQL arrays
- [ ] `packages/shared/src/types/` updated if any type definitions change
- [ ] Docker Compose or similar for local PostgreSQL development
- [ ] README updated with PostgreSQL setup instructions

---

## Feature 15: B-TF6 — Error Monitoring + Analytics

### Sentry Integration

Install: `@sentry/nextjs` (web), `@sentry/react-native` (mobile), `@sentry/node` (API).

#### API Integration Points

```typescript
// apps/api/src/index.ts (entry point)
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2, // 20% of transactions
});
```

Update `apps/api/src/middleware/error-handler.ts`:

```typescript
import * as Sentry from '@sentry/node';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  Sentry.captureException(err, {
    extra: {
      url: req.originalUrl,
      method: req.method,
      userId: req.query.userId || req.headers['x-user-id'],
    },
  });
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', code: 500 });
}
```

#### Key Events to Track

| Event | Where | Sentry Method |
|---|---|---|
| Unhandled API errors | `error-handler.ts` | `captureException` |
| RSS feed sync failures | `aggregator.ts` | `captureMessage` (warning) |
| AI moderation failures | `content-moderator.ts` | `captureMessage` (warning) |
| AI summary generation failures | `summarizer.ts` | `captureMessage` (warning) |
| Quiz generation failures | `generate-daily-quiz.ts` | `captureMessage` (error) |
| TheSportsDB API failures | `team-stats-sync.ts` | `captureMessage` (warning) |
| Invalid PIN attempts (>3 in 5 min) | `parents.ts` | `captureMessage` (warning) |

#### Web Integration

```typescript
// apps/web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
});
```

### Analytics: PostHog (Self-Hostable)

PostHog is GDPR-friendly and can be self-hosted. For a kids' app, minimal tracking is essential.

**Events to track** (anonymized, no PII):
- `feed_viewed` (sport filter, feed mode)
- `article_read` (sport, source — no title)
- `reel_watched` (sport, duration)
- `quiz_completed` (score, sport)
- `onboarding_step` (step number)
- `parental_pin_created`

**No tracking of**: names, ages, exact content, location.

### Acceptance Criteria

- [ ] Sentry initialized in API, web, and mobile
- [ ] `error-handler.ts` reports all unhandled exceptions to Sentry
- [ ] RSS sync failures logged as Sentry warnings
- [ ] AI service failures logged as Sentry warnings/errors
- [ ] PostHog (or Plausible) initialized with minimal, anonymized events
- [ ] No PII (names, ages, exact ages) sent to analytics
- [ ] Environment variables: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `POSTHOG_KEY`
- [ ] Source maps uploaded to Sentry for meaningful stack traces

---

## Feature 16: B-TF7 — CI/CD Pipeline

### GitHub Actions Structure

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, 'phase-*']
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate --schema=apps/api/prisma/schema.prisma
      - run: npm run build:shared        # Build shared package first
      - run: npx tsc --noEmit -p apps/api/tsconfig.json
      - run: npx tsc --noEmit -p apps/web/tsconfig.json
      # Lint (add eslint config if not present)
      # - run: npx eslint apps/ packages/ --ext .ts,.tsx

  test:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    env:
      DATABASE_URL: "file:./test.db"
      AI_PROVIDER: "none"   # Skip AI calls in tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate --schema=apps/api/prisma/schema.prisma
      - run: npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
      - run: npm test           # Vitest or Jest (to be configured)

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate --schema=apps/api/prisma/schema.prisma
      - run: npm run build:api
      - run: npm run build:web

  mobile-build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: cd apps/mobile && eas build --platform all --profile preview --non-interactive
```

### EAS Build Configuration

```json
// apps/mobile/eas.json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": true },
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

### Required Secrets

| Secret | Purpose |
|---|---|
| `EXPO_TOKEN` | EAS Build authentication |
| `SENTRY_AUTH_TOKEN` | Source map uploads |
| `SENTRY_DSN` | Error reporting in build |

### Acceptance Criteria

- [ ] `.github/workflows/ci.yml` runs on push to main and PRs
- [ ] TypeScript type-check passes for API and web
- [ ] Prisma client generated in CI (required for type-check)
- [ ] Test job runs after lint (when tests exist)
- [ ] Build job compiles API and web successfully
- [ ] Mobile build triggers on main branch only (via EAS)
- [ ] `eas.json` configured with preview and production profiles
- [ ] Build caches npm dependencies for speed
- [ ] CI completes in under 10 minutes for lint+typecheck+build

---

## Technical Requirements

### Dependencies to Add

| Package | Workspace | Purpose |
|---|---|---|
| `@react-native-community/netinfo` | `apps/mobile` | Offline detection |
| `expo-haptics` | `apps/mobile` | Haptic feedback |
| `expo-video` | `apps/mobile` | Native video player |
| `@sentry/node` | `apps/api` | Error monitoring (API) |
| `@sentry/nextjs` | `apps/web` | Error monitoring (web) |
| `@sentry/react-native` | `apps/mobile` | Error monitoring (mobile) |
| `posthog-js` | `apps/web` | Analytics (web) |
| `posthog-react-native` | `apps/mobile` | Analytics (mobile) |

### Environment Variables to Add

```
# .env additions
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
POSTHOG_KEY=
POSTHOG_HOST=
DATABASE_URL=postgresql://...  # (after PostgreSQL migration)
```

### New Files Summary

| File | Feature |
|---|---|
| `apps/api/src/config/team-ids.ts` | B-CP3 |
| `apps/api/src/services/team-stats-sync.ts` | B-CP3 |
| `apps/api/src/jobs/sync-team-stats.ts` | B-CP3 |
| `apps/api/src/middleware/cache.ts` | B-TF5 |
| `apps/mobile/src/lib/offline-cache.ts` | B-MP4 |
| `apps/mobile/src/lib/haptics.ts` | B-UX8 |
| `apps/mobile/src/components/OfflineBanner.tsx` | B-MP4 |
| `apps/mobile/src/components/BrandedRefresh.tsx` | B-MP3 |
| `apps/mobile/src/components/ErrorState.tsx` | B-UX7 |
| `apps/mobile/src/components/NativeReelPlayer.tsx` | B-MP6 |
| `apps/web/src/lib/offline-cache.ts` | B-MP4 |
| `apps/web/src/components/OfflineBanner.tsx` | B-MP4 |
| `apps/web/src/components/ErrorState.tsx` | B-UX7 |
| `apps/web/src/components/ParentalTour.tsx` | B-PT6 |
| `packages/shared/src/constants/errors.ts` | B-UX7 |
| `apps/api/prisma/migrate-to-pg.ts` | B-TF4 |
| `.github/workflows/ci.yml` | B-TF7 |
| `apps/mobile/eas.json` | B-TF7 |

## Out of Scope

- Push notifications (real FCM/APNs integration) — placeholder only
- Real authentication (JWT/sessions) — still using userId param
- Multi-language UI beyond es/en
- Admin dashboard
- Content creation tools
- Social features (comments, friends)
- Real-time live scores (WebSocket)
- App Store / Play Store submission

## Documentation Update

After implementing this PRD, review and update **all** documents in `docs/es/` and `docs/en/` to reflect the changes. Specifically:

| Document | Expected updates |
|----------|-----------------|
| `01-arquitectura.md` / `01-architecture.md` | PostgreSQL migration, caching layer, CI/CD pipeline, error monitoring (Sentry), analytics (PostHog), offline architecture |
| `02-modelo-de-datos.md` / `02-data-model.md` | All JSON string fields migrated to native arrays (PostgreSQL), new fields: `ParentalProfile.allowedHoursStart/End/timezone` |
| `03-api-reference.md` / `03-api-reference.md` | New endpoints: reading history (`/api/news/historial`), content recommendations. Updated: feed ranking algorithm, bedtime enforcement responses |
| `04-guia-desarrollo.md` / `04-development-guide.md` | PostgreSQL setup instructions, Redis/cache config, Sentry DSN setup, GitHub Actions CI/CD, Expo EAS Build, haptic feedback dev notes |
| `05-flujos-de-usuario.md` / `05-user-flows.md` | Offline reading flow, bedtime lock experience, error recovery flows, content recommendations flow |
| `06-service-overview.md` / `06-service-overview.md` | Updated: `feed-ranker.ts` (behavioral scoring), `team-stats.ts` (live API). New: cache middleware, error monitoring integration |
| `07-guia-de-despliegue.md` / `07-deployment-guide.md` | PostgreSQL deployment, Redis deployment, Sentry/PostHog setup, GitHub Actions secrets, EAS Build profiles |
| `08-diseno-y-ux.md` / `08-design-and-ux.md` | Kid-friendly error states, haptic feedback patterns, bedtime lock screen, offline banner, branded pull-to-refresh, reading history UI, recommendations UI |
| `09-seguridad-y-privacidad.md` / `09-security-and-privacy.md` | Bedtime enforcement, content language filtering, error monitoring data policy |
| `10-roadmap-y-decisiones.md` / `10-roadmap-and-decisions.md` | Mark Sprint 5 + remaining items as completed, document PostgreSQL decision, TheSportsDB API choice, caching strategy |

**Process**: Read each document, identify sections affected by the changes, and update them. Add new sections if a feature introduces concepts not previously documented. Keep both languages (ES/EN) in sync.

## Future Considerations

- **Redis migration**: Replace `InMemoryCache` with Redis when deploying multiple API instances.
- **CDN for images**: Cache news images on a CDN to support offline image viewing.
- **ML-based recommendations**: Replace rule-based content recommendations with collaborative filtering.
- **A/B testing**: Use PostHog feature flags to test feed ranking variations.
- **Rate limiting**: Add express-rate-limit before public beta.
- **Database read replicas**: For scaling read-heavy feed queries.
- **Background sync on mobile**: Use Expo Background Fetch for periodic offline cache updates.
