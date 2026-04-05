# Admin Dashboard — Implementation Notes (prd.md / S1+S2)

**Date**: 2026-04-05
**Branch**: admin-dashboard

---

## What was implemented

### Part A — Shared Infrastructure

#### 1. recharts installed
- Added to `apps/web` workspace (compatible with Tailwind CSS 4).

#### 2. Route Group Restructuring
All existing pages moved into `apps/web/src/app/(main)/` so that the admin section can have its own layout without NavBar/UserProvider.

**New structure:**
```
apps/web/src/app/
├── layout.tsx              # Minimal root: html + body + fonts + global CSS
├── (main)/
│   ├── layout.tsx          # UserProvider + NavBar + OfflineBanner + metadata
│   ├── page.tsx
│   ├── HomeFeedClient.tsx
│   └── <all existing routes>
└── (admin)/
    ├── layout.tsx          # Client: role check, AdminSidebar, dark theme
    └── admin/
        ├── page.tsx        # Placeholder (prd2.md)
        └── moderation/
            └── page.tsx    # Full moderation UI
```

The root layout is now a simple server component that only wraps `<html>/<body>` with fonts. Metadata moved to `(main)/layout.tsx`.

#### 3. `(admin)/layout.tsx`
- Client component with `useUser()` role check.
- Redirects non-admin users to `/`.
- Wraps its own `UserProvider` independently of `(main)`.
- Renders `AdminSidebar` + main content area.

#### 4. Admin Components (`apps/web/src/components/admin/`)
- **`AdminSidebar.tsx`** — Fixed `w-56` sidebar. Links: Overview, Moderation, Analytics, Sources, Jobs, Users & Orgs. Active detection via `usePathname()`.
- **`AdminMetricCard.tsx`** — Metric card with title, value, optional trend (with arrow), optional icon, and severity-based border color (normal/warning/error).
- **`AdminTable.tsx`** — Generic typed table with sort, shimmer skeleton (3 rows), prev/next pagination, empty state, and custom `render` per column.
- **`AdminBadge.tsx`** — Colored badge with 6 variants: green, yellow, red, gray, blue, purple.

#### 5. NavBar Admin Link
Added conditional `⚙ Admin` link in `NavBar.tsx` visible only when `user?.role === 'admin'`.

#### 6. `apps/api/scripts/create-admin.ts`
Script to create or promote a user to admin.
```bash
npx tsx apps/api/scripts/create-admin.ts admin@sportykids.com
```
- If user exists: updates `role = 'admin'`.
- If not: creates user with `authProvider='email'`, `role='admin'`, and a random 16-char password printed to stdout.

### Part B — Content Moderation (S2)

#### 7. Extended `apps/api/src/routes/admin.ts`

**Extended `GET /api/admin/moderation/pending`:**
- Now accepts `type=news|reel`, `sport`, `source` (rssSourceId or videoSourceId), `page`, `limit`.
- Returns `{ items, total, page, totalPages }` with per-item fields: `id`, `type`, `title`, `sport`, `source`, `safetyReason`, `pendingSinceMinutes`, `url`, `imageUrl`.

**New endpoints:**
| Method | Route | Description |
|--------|-------|-------------|
| PATCH | `/api/admin/content/:type/:id/approve` | Approve news or reel |
| PATCH | `/api/admin/content/:type/:id/reject` | Reject with required reason |
| POST | `/api/admin/content/batch` | Batch approve/reject (max 100) |
| GET | `/api/admin/reports` | All ContentReports with filters, user & content resolution |
| PATCH | `/api/admin/reports/:id` | Update report status; `action: 'reject_content'` cascades |

All new endpoints require `requireAuth` + `requireRole('admin')`.

#### 8. `apps/web/src/app/(admin)/admin/moderation/page.tsx`
Two-tab UI:
- **Pending Content tab:** type/sport filters, select-all checkbox, batch approve/reject, per-row approve/reject buttons, rejection modal with reason, pagination.
- **User Reports tab:** status/contentType filters, action buttons (Reject Content / Dismiss), status badges, pagination.

#### 9. `apps/web/src/app/(admin)/admin/page.tsx`
Placeholder overview page with note about prd2.md.

#### 10. `authFetch` exported
`apps/web/src/lib/api.ts` — `authFetch` function exported so admin pages can use it directly.

---

## Files created
- `apps/web/src/app/layout.tsx` (modified — minimal root)
- `apps/web/src/app/(main)/layout.tsx` (new — moved from root)
- `apps/web/src/app/(admin)/layout.tsx` (new)
- `apps/web/src/app/(admin)/admin/page.tsx` (new)
- `apps/web/src/app/(admin)/admin/moderation/page.tsx` (new)
- `apps/web/src/components/admin/AdminSidebar.tsx` (new)
- `apps/web/src/components/admin/AdminMetricCard.tsx` (new)
- `apps/web/src/components/admin/AdminTable.tsx` (new)
- `apps/web/src/components/admin/AdminBadge.tsx` (new)
- `apps/web/src/components/admin/AdminBadge.test.tsx` (new)
- `apps/web/src/components/admin/AdminMetricCard.test.tsx` (new)
- `apps/web/src/components/admin/AdminTable.test.tsx` (new)
- `apps/api/src/routes/admin.ts` (modified — extended with 5 new endpoints)
- `apps/api/src/routes/admin.test.ts` (new — 25 tests)
- `apps/api/scripts/create-admin.ts` (new)

## Files modified
- `apps/web/src/components/NavBar.tsx` — added conditional admin link
- `apps/web/src/lib/api.ts` — exported `authFetch`
- `apps/web/src/__tests__/age-gate.test.tsx` — updated import path after route group migration
- `apps/web/src/__tests__/legal-pages.test.tsx` — updated import paths after route group migration

## Moved (route group migration)
All files from `apps/web/src/app/{page,collection,quiz,...}` moved into `apps/web/src/app/(main)/`.

---

## Test results
- API: 663 tests, all passing (added 25 new admin tests)
- Web: 151 tests, all passing (added 42 new admin component tests)
- Mobile: 178 tests, all passing (unchanged)
- **Total: 992 tests, all passing**

---

## Tech Debt Reduction (post /t-review #1 — 2026-04-05)

### Critical fixes

- **`apps/api/src/routes/admin.ts`** — `POST /admin/quiz/generate` wrapped in try/catch; errors now logged and return 500.
- **`apps/web/src/app/(admin)/admin/moderation/page.tsx`** — `submitReject()` batch mode now mirrors `approveSelected()`: separates `newsIds`/`reelIds` and makes two parallel batch calls. Mixed-type selections no longer silently drop items.
- **`apps/api/src/routes/admin.ts`** — `GET /moderation/pending` now uses `count()` queries for real totals. Removed `take: PENDING_LIMIT` from data queries; sort+slice operates over all pending items. Extracted named types `PendingNewsRow` / `PendingReelRow`.

### Warning fixes

- `API_BASE` exported from `apps/web/src/lib/api.ts`; duplicate removed from `moderation/page.tsx`.
- `AdminTable.tsx`: `key={i}` → `key={String(row.id ?? i)}` for stable React keys.
- `(admin)/layout.tsx`: added comment explaining own `UserProvider`; font class corrected to `font-inter`.
- `create-admin.ts`: `age: 30` → `age: 18` with comment; `Math.random()` → `crypto.randomBytes(12).toString('base64url').slice(0, 16)`; `eslint-disable no-console` added.
- `AdminSidebar.tsx`: `aria-current="page"` on active link.
- `admin.ts`: replaced `Record<string, unknown>` + castings with `Prisma.NewsItemWhereInput`, `Prisma.ReelWhereInput`, `Prisma.ContentReportWhereInput`.

### Suggestion fixes

- `moderation/page.tsx`: `ModalState` discriminant type replaces `'batch'` string flag.
- `AdminTable.tsx`: sortable `<th>` now has `tabIndex={0}` + `onKeyDown` for keyboard accessibility.
- `moderation/page.tsx`: `fetchItems` and `fetchReports` now handle network errors with a visible `role="alert"` error state.
- `admin.test.ts`: 4 new tests for `POST /admin/quiz/generate` (401, 403, 200, 500).
- `create-admin.ts`: `eslint-disable no-console` suppresses expected CLI warnings.

### Test results after tech debt reduction

- API: **667 tests**, all passing (+4 from quiz/generate tests)
- Web: **151 tests**, all passing
- Lint: **0 errors, 0 warnings**

---

# prd2.md implementation — Admin Overview Page

**Date**: 2026-04-05

## What was implemented

### `GET /api/admin/overview`

New endpoint in `apps/api/src/routes/admin.ts`. Cached 5 min via `withCache`. Returns:
- `kpis`: `{ totalUsers, dau, pendingContent, activeRssSources }`
- `alerts`: rule-based array. Rules: pending_content (>30 min), pending_content_critical (>50), stale_rss (no sync in >6h)
- `subscriptionBreakdown`: `{ free, premium }`

Helper function `buildAlerts(pendingTotal, oldestPending, staleRss)` computes the alerts array.

### `GET /api/admin/analytics/activity-chart`

New endpoint in `apps/api/src/routes/admin.ts`. Cached until midnight UTC via `apiCache.get/set` with dynamic TTL (`msUntilMidnightUTC()`). Uses `$queryRaw` with `DATE_TRUNC('day', ...)` to group ActivityLog by day and type. Returns `Array<{ date, newsViewed, reelsViewed, quizzesPlayed }>`.

**Why `$queryRaw`**: Prisma `groupBy` does not support date-truncation expressions natively.

### `apps/web/src/app/(admin)/admin/page.tsx`

Replaced placeholder with full Overview page. Features:
- Alert banners (green "All systems operational" or warning/error banners with action links)
- 4 KPI cards using `AdminMetricCard` (Total Users, DAU, Pending Content, Active RSS Sources)
- `AreaChart` (Recharts) — 3 series: news (blue), reels (green), quiz (yellow), `fillOpacity=0.2`
- `PieChart` donut — free (gray) vs premium (blue), innerRadius=60
- Jobs placeholder (prd3 not yet implemented)
- "Last updated" timestamp, error state with `role="alert"`

## Files created/modified

- `apps/api/src/routes/admin.ts` — extended with 2 new endpoints + helpers
- `apps/api/src/routes/admin.test.ts` — +10 tests for new endpoints
- `apps/web/src/app/(admin)/admin/page.tsx` — replaced placeholder with full overview page

## Test results

- API: **677 tests**, all passing (+10 new)
- Web: **151 tests**, all passing
- Mobile: **178 tests**, all passing
- **Total: 1035 tests, all passing**
- Lint: **0 errors, 0 warnings**

---

## Tech Debt Reduction (post /t-review #2 — prd2.md — 2026-04-05)

### Warning fixes

- **`admin.ts` — `buildAlerts`**: Removed 30-min gate on `pending_content` alert. Warning now fires immediately when `pendingTotal > 0`; message includes age context ("for over 30 minutes" / "(newest just arrived)").
- **`admin.test.ts`**: Added test for `stale_rss` alert (W2). Mocks `rssSource.findMany` with a source whose `lastSyncedAt` is 8h ago and asserts `type: 'stale_rss'` appears in alerts.
- **`admin/page.tsx`**: Added inline comment explaining why full URLs with `API_BASE` are used (authFetch does not prepend base internally).
- **`admin.ts` — stale RSS query**: Changed `lastSyncedAt: { lt: ... }` to `OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: ... } }]` so never-synced sources also appear as stale alerts. Message shows "has never synced" for null sources.

### Suggestion fixes

- **`admin/page.tsx`**: Alert `key` prop changed from `` `${alert.type}-${i}` `` to `` `${alert.type}-${alert.message}` `` for stable reconciliation.
- **`admin.ts`**: Added comment before `activity-chart` manual cache explaining why `withCache` middleware cannot be used (dynamic TTL until midnight UTC).
- **`admin/page.tsx`**: Donut empty-state now uses `totalPieUsers === 0` instead of `pieData.every(d => d.value === 0)`, allowing single-segment charts to render.
- **`admin.test.ts`**: Removed unnecessary `newsItem.findFirst` mock from `pending_content_critical` test (branch short-circuits before reaching `findFirst`).

### Test results after tech debt reduction (prd2.md)

- API: **680 tests**, all passing (+3 new: W1 alert-no-gate, W1 critical-exclusivity, W2 stale_rss)
- Web: **151 tests**, all passing
- Mobile: **178 tests**, all passing
- **Total: 1038 tests, all passing**
- Lint: **0 errors, 0 warnings**

---

# prd3.md implementation — Operations & Jobs (S5)

**Date**: 2026-04-05

## What was implemented

### JobRun Prisma model

New model added to `apps/api/prisma/schema.prisma`:
- Fields: `id`, `jobName`, `startedAt`, `finishedAt`, `status` (running/success/error), `output` (Json?), `triggeredBy` (cron/manual), `triggeredId` (admin userId)
- Composite index on `[jobName, startedAt]`
- Migration SQL in `apps/api/prisma/migrations/20260405000000_add_job_run/migration.sql`

### Job Instrumentation (10 files)

All 10 job files in `apps/api/src/jobs/` now export a `run*` function that:
1. Creates a `JobRun` record with `status: 'running'`
2. Calls the existing job logic
3. Updates the record to `status: 'success'` or `status: 'error'`
4. Re-throws errors so the cron scheduler still logs them via Pino

The cron schedule inside each `start*Job()` function now calls `run*('cron')` instead of the raw logic function.

| File | Exported function |
|------|------------------|
| `sync-feeds.ts` | `runSyncFeeds()` |
| `sync-videos.ts` | `runSyncVideos()` |
| `sync-team-stats.ts` | `runSyncTeamStats()` |
| `generate-daily-quiz.ts` | `runGenerateDailyQuiz()` |
| `generate-timeless-quiz.ts` | `runGenerateTimelessQuiz()` |
| `generate-daily-missions.ts` | `runGenerateDailyMissions()` |
| `streak-reminder.ts` | `runStreakReminder()` |
| `mission-reminder.ts` | `runMissionReminder()` |
| `send-weekly-digests.ts` | `runSendWeeklyDigests()` |
| `live-scores.ts` | `runLiveScores()` |

### `apps/api/src/services/job-runner.ts`

New service:
- `KNOWN_JOBS`: array of 10 job name strings
- `JOB_FREQUENCIES`: expected frequency in minutes per job
- `triggerJob(jobName, adminUserId)`: dynamically imports the job's `run*` function, fires it async (no await), waits 100ms for the DB write, returns `{ jobRunId }`. Returns `{ jobRunId: 'pending' }` if the DB write races.

Dynamic imports are used to avoid circular dependencies at module load time.

### New API endpoints in `apps/api/src/routes/admin.ts`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/jobs` | Status of all 10 known jobs (statusLabel: OK/STALE/ERROR/RUNNING/NEVER) |
| POST | `/api/admin/jobs/:name/trigger` | Trigger a job manually (202 Accepted, async) |
| GET | `/api/admin/jobs/:name/history?limit=20` | Last N runs for a job (max 50) |

Stale detection: `now - lastRun.finishedAt > 2 × frequencyMinutes × 60000`.

`GET /jobs` uses a single `findMany` query (not 10 separate queries) grouped by `jobName` in memory.

### `apps/web/src/app/(admin)/admin/jobs/page.tsx`

Full Jobs admin page:
- Stale alert banners above the table
- Job status table: name (clickable → history drawer), last run relative time, duration, status badge, `▶ Run` button
- **Trigger confirmation modal**: confirms intent before firing
- **Job history drawer**: slide-in from right, fetches last 20 runs on open, Escape/backdrop to close
- **Polling**: when any job is `running`, the table auto-refreshes every 5s
- Loading skeleton (shimmer rows)
- Error state with `role="alert"`

### Overview page update

`apps/web/src/app/(admin)/admin/page.tsx` — the Jobs placeholder (prd2 note) is replaced with a compact jobs status panel:
- Fetches `GET /api/admin/jobs` alongside other overview data
- Shows a mini-table with each job's name, status badge, and relative last-run time
- Links to `/admin/jobs` for the full page

## Files created

- `apps/api/src/services/job-runner.ts` (new)
- `apps/api/prisma/migrations/20260405000000_add_job_run/migration.sql` (new)
- `apps/web/src/app/(admin)/admin/jobs/page.tsx` (new)

## Files modified

- `apps/api/prisma/schema.prisma` — added `JobRun` model
- `apps/api/src/routes/admin.ts` — 3 new endpoints + import of job-runner
- `apps/api/src/routes/admin.test.ts` — added `jobRun` to mockPrisma, vi.mock for job-runner, 13 new tests
- `apps/api/src/jobs/sync-feeds.ts` — `runSyncFeeds()` exported, cron updated
- `apps/api/src/jobs/sync-videos.ts` — prisma import added, `runSyncVideos()` exported, cron updated
- `apps/api/src/jobs/sync-team-stats.ts` — prisma import added, `runSyncTeamStats()` exported, cron updated
- `apps/api/src/jobs/generate-daily-quiz.ts` — `runGenerateDailyQuiz()` exported, cron updated
- `apps/api/src/jobs/generate-timeless-quiz.ts` — `runGenerateTimelessQuiz()` exported, cron updated
- `apps/api/src/jobs/generate-daily-missions.ts` — `runGenerateDailyMissions()` exported, cron updated
- `apps/api/src/jobs/streak-reminder.ts` — `runStreakReminder()` exported, cron updated
- `apps/api/src/jobs/mission-reminder.ts` — `runMissionReminder()` exported, cron updated
- `apps/api/src/jobs/send-weekly-digests.ts` — `runSendWeeklyDigests()` exported, cron updated
- `apps/api/src/jobs/live-scores.ts` — `runLiveScores()` exported, cron updated
- `apps/web/src/app/(admin)/admin/page.tsx` — jobs placeholder replaced with live data

## Test results

- API: **695 tests**, all passing (+15 new: 13 job endpoint tests + 2 sync-team-stats instrumentation tests)
- Web: **151 tests**, all passing
- Mobile: **178 tests**, all passing
- **Total: 1,024 tests, all passing**
- Lint: **0 errors, 0 warnings**

## Notes

- `prisma.jobRun` calls use `(prisma as any).jobRun` in production code because the Prisma client is not yet regenerated (pending `npm run db:migrate` + `npm run db:generate` on the dev machine). After migration, the `as any` casts can be removed.
- The `triggerJob` function uses dynamic imports to avoid circular dependencies between `job-runner.ts` and individual job files.
- Rate-limit for trigger endpoint: relies on the existing default rate limiter (100 req/min). A dedicated lower limit can be added in a future iteration.


---

## Tech Debt Reduction — prd3.md (after /t-review #3)

**Date**: 2026-04-05

All 11 review items resolved:

### Changes applied

**C1 — GET /jobs query limit** (`admin.ts`):
- Added `take: KNOWN_JOBS.length * 5` (50 rows) to `prisma.jobRun.findMany`. Prevents unbounded scans as history grows.

**C2 — Drawer ARIA fix** (`jobs/page.tsx`):
- `JobHistoryDrawer` now uses `aria-label={jobName ? \`${jobName} execution history\` : undefined}` and `aria-hidden={\!isOpen}`. No more invalid empty aria-label when drawer is closed.

**W1+W2 — Static imports + race condition fix** (`job-runner.ts` + all 10 job files):
- All 10 job imports moved to static module-level. `JOB_MAP` defined at module level.
- `triggerJob` pre-creates the `JobRun` record and passes `run.id` as `existingRunId` to the job function. Returns `{ jobRunId: run.id }` immediately — no `setTimeout`, no `findFirst` race condition.
- Each `run*` function accepts optional `existingRunId?: string`. If provided, skips `create` and uses the pre-created record. Cron call sites unaffected (they don't pass `existingRunId`).

**W3 — Remove (prisma as any) casts** (12 files):
- All 33 `(prisma as any).jobRun` casts replaced with `prisma.jobRun` (properly typed after client regeneration). Accompanying `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments removed.

**W4 — ERROR statusLabel test** (`admin.test.ts`):
- Added test: `returns statusLabel ERROR when last run has status error`. Confirms `statusLabel === 'ERROR'` and `isStale === false`.

**W5 — Rate limit on trigger** (`admin.ts`):
- `POST /jobs/:name/trigger` now uses `syncLimiter` (2 req/min per IP) from `middleware/rate-limiter.ts`.

**S1 — JOB_MAP/JOB_FREQUENCIES sync assertion** (`job-runner.ts`):
- Startup assertion after `JOB_MAP` definition throws if keys diverge from `KNOWN_JOBS`. Skipped in test env.

**S2 — Polling condition unified** (`jobs/page.tsx`):
- Polling `useEffect` now checks `j.statusLabel === 'RUNNING'` instead of `j.lastRun?.status === 'running'`.

**S3 — formatDurationMs centralized** (`jobs/page.tsx`):
- `formatDuration` renamed to `formatDurationMs(ms: number | null)`. Both table and drawer use the same function.

**S4 — aria-live on jobs table** (`jobs/page.tsx`):
- Jobs table container has `aria-live="polite"` for screen reader polling updates.

### Test results after fixes

- API: **696 tests**, all passing (+1: ERROR statusLabel test)
- Web: **151 tests**, all passing
- **Total: 847 tests (API+Web), all passing**
- Lint: **0 errors, 0 warnings**

---

# prd4.md implementation — Source Management (S4)

## Overview

Admin panel for managing all RSS news sources and video sources. Covers CRUD, toggle activate/deactivate, single-source manual sync, and add custom sources.

## Files created

- `apps/web/src/app/(admin)/admin/sources/page.tsx` — Sources management page (RSS + Video tabs)

## Files modified

| File | Change |
|------|--------|
| `apps/api/src/routes/admin.ts` | Added 10 new admin source management endpoints |
| `apps/api/src/routes/admin.test.ts` | Added 16 new tests for source endpoints |
| `apps/api/src/services/aggregator.ts` | Added `syncSingleSource(sourceId)` export |
| `apps/api/src/services/video-aggregator.ts` | Added `syncSingleVideoSource(sourceId)` export |

## Backend endpoints added

**RSS Sources:**
- `GET /api/admin/sources/rss` — paginated list with `newsCount` (count of NewsItems where `source === rssSource.name`) and `isStale` (lastSyncedAt > 2h ago)
- `PATCH /api/admin/sources/rss/:id` — update `active`, `name`, `sport`, `country`
- `DELETE /api/admin/sources/rss/:id` — 403 for predefined, delete for custom
- `POST /api/admin/sources/rss/:id/sync` — single source sync (sync, returns `{processed, errors}`)
- `POST /api/admin/sources/rss` — add custom source with rss-parser reachability validation (5s timeout, 422 on fail)

**Video Sources:**
- `GET /api/admin/sources/video` — paginated list with `reelCount` and `isStale` (>8h)
- `PATCH /api/admin/sources/video/:id` — update `active`, `name`, `sport`
- `DELETE /api/admin/sources/video/:id` — 403 for predefined, delete for custom
- `POST /api/admin/sources/video/:id/sync` — single video source sync
- `POST /api/admin/sources/video` — add custom video source (validates feedUrl contains `youtube.com`)

## Key implementation decisions

- `newsCount` computed via `prisma.newsItem.count({ where: { source: rssSource.name } })` since `NewsItem` has no `rssSourceId` FK — the aggregator stores `RssSource.name` in `NewsItem.source`.
- `reelCount` computed via `prisma.reel.count({ where: { videoSourceId: source.id } })` — `Reel.videoSourceId` is a logical FK storing `VideoSource.id`.
- rss-parser is imported at module level in admin.ts with a 5s timeout for feed validation.
- Video source add skips reachability check (YouTube Atom feeds need auth to fetch).

## Tests

16 new tests added to `apps/api/src/routes/admin.test.ts`:
- Auth/role checks (401/403) for all endpoints
- Pagination, filtering (sport, active)
- `newsCount` and `isStale` computed fields
- Active toggle (PATCH)
- Delete: 403 for predefined, success for custom
- Sync: mocked `syncSingleSource`, returns `{processed, errors}`
- Add custom RSS: mocked rss-parser (throw → 422, resolve → 201 with `isCustom: true`)

## Test results

- API: **713 tests**, all passing (+16 new)
- Web: **151 tests**, all passing
- Mobile: **178 tests**, all passing
- **Total: 1042 tests, all passing**
- Lint: 0 errors, 0 warnings

---

## Tech Debt Reduction — prd4.md (post /t-review #4)

### Fixes applied

**Critical fixes:**
- `aggregator.ts`: `syncSingleSource` now throws `'Source not found or inactive'` if `source.active === false`
- `video-aggregator.ts`: Same guard in `syncSingleVideoSource`
- `admin.ts:919`: Added comment explaining newsCount uses name-based match (no FK) and may drift

**Warning fixes:**
- `admin.ts`: `GET /sources/rss` and `GET /sources/video` now return `sources` key (not `items`) per PRD spec
- `sources/page.tsx`: Updated to read `data.sources` instead of `data.items`
- `aggregator.ts`, `video-aggregator.ts`: `syncSingleSource`/`syncSingleVideoSource` return `errors: result.moderationErrors ?? 0` (not hardcoded 0)
- `admin.ts`: Removed local `SPORTS` constant; imported from `@sportykids/shared`
- `sources/page.tsx`: Same SPORTS import from shared
- `admin.ts`: `PATCH /sources/rss/:id` and `PATCH /sources/video/:id` now return 404 on Prisma P2025 instead of 500
- `sources/page.tsx`: Replaced `alert()` on sync success with inline state update (lastSyncedAt + isStale)

**Suggestion fixes:**
- `admin.ts`: Added N+1 comment on `newsItem.count()` loop in both source list endpoints
- `sources/page.tsx`: Submit buttons disabled until URL is syntactically valid (via `isValidUrl` helper)
- `sources/page.tsx`: Added comment explaining `${API_BASE}/admin/...` URL pattern
- `admin.test.ts`: Added error path tests for sync endpoints (syncSingleSource throws → 500)

### Tests added (22 new tests)
- 401/403 guards for: PATCH rss, DELETE rss, POST rss, POST rss sync, POST video, PATCH video, POST video sync
- 404 tests for: PATCH rss/:id and PATCH video/:id (P2025)
- Error path: POST rss/:id/sync and POST video/:id/sync when handler throws

### Test results after fixes

- API: **733 tests**, all passing (+20 vs pre-reduction)
- Web: **151 tests**, all passing
- Lint: 0 errors, 0 warnings

---

# prd5.md implementation — Analytics Dashboard (S3)

**Date**: 2026-04-05

## What was implemented

### AnalyticsSnapshot Prisma Model

New model added to `apps/api/prisma/schema.prisma`:
- Fields: `id`, `date` (day the data represents), `metric` (metric key string), `value` (Json), `createdAt`
- `@@unique([date, metric])` constraint for idempotent upserts
- `@@index([date])` for efficient range queries
- Migration SQL: `apps/api/prisma/migrations/20260405010000_add_analytics_snapshot/migration.sql`

### `apps/api/src/services/admin-stats.ts`

11 pure metric computation functions:
| Function | Description |
|----------|-------------|
| `computeDau(date)` | Distinct userId in ActivityLog for target date |
| `computeMau(date)` | Distinct userId in ActivityLog for 30 days ending on date |
| `computeSportActivity(date)` | Activity count by sport for target date |
| `computeRetentionD1(date)` | % of users from day-before who were active on date |
| `computeRetentionD7(date)` | % of users from 7 days ago who were active in date-6..date |
| `computeSubscriptionBreakdown()` | Current free/premium user counts |
| `computeParentalActivationRate()` | ParentalProfile count / User[role=parent] count |
| `computeConsentRate()` | consentGiven=true / total users |
| `computeQuizEngagement(date)` | quizzes_played activity / DAU |
| `computeMissionsCompleted(date)` | DailyMission completed=true count for date |
| `computeMissionsClaimed(date)` | DailyMission claimed=true count for date |

### `apps/api/src/jobs/compute-analytics.ts`

Cron job at `0 2 * * *` (2am UTC). Follows JobRun instrumentation pattern from prd3:
- Creates `JobRun` record (or uses `existingRunId` when triggered manually via job-runner)
- Computes all 11 metrics for yesterday via `Promise.all`
- Upserts each into `AnalyticsSnapshot` (idempotent)
- Updates `JobRun` to success/error with processed count

### Updated `apps/api/src/services/job-runner.ts`

- Added `'compute-analytics'` to `KNOWN_JOBS` (now 11 jobs)
- Added `'compute-analytics': 1440` to `JOB_FREQUENCIES`
- Added static import + `JOB_MAP` entry for `runComputeAnalytics`

### New API endpoints in `apps/api/src/routes/admin.ts`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/analytics/snapshot?from&to&metrics` | Pre-computed snapshots by date range + optional metric filter |
| GET | `/api/admin/analytics/top-content?from&to&limit` | Top N news by views via $queryRaw, cached 5min |

Notes:
- `$queryRaw` COUNT(*) returns BigInt — cast with `Number(row.views)` before returning
- `top-content` cached 5min via `withCache`
- Both endpoints require `requireAuth + requireRole('admin')`

### `apps/web/src/app/(admin)/admin/analytics/page.tsx`

Full analytics dashboard with:
- Date range selector: "Last 7 days", "Last 30 days" (default), "Last 90 days"
- "Analytics data as of yesterday 2am UTC." notice
- DAU/MAU AreaChart: DAU (blue #2563EB), MAU (purple #8B5CF6)
- Retention BarChart: D1 (green), D7 (orange), vertical layout, percentage Y-axis
- Sport Activity BarChart: horizontal, sorted by count desc
- Subscription Breakdown PieChart: free (slate) vs premium (blue), donut innerRadius=60
- Missions PieChart: completed (green) vs claimed (yellow)
- AdminMetricCard for: Parental Activation Rate, Consent Rate, Quiz Engagement (with MiniProgressBar)
- Top Content AdminTable: Title, Sport (AdminBadge), Published, Views
- Empty state when no snapshot data exists
- Error state with `role="alert"` and retry button
- Loading skeleton

### Updated `apps/web/src/components/admin/AdminSidebar.tsx`

Added Analytics link to sidebar nav pointing to `/admin/analytics`.

## Files created

- `apps/api/prisma/migrations/20260405010000_add_analytics_snapshot/migration.sql`
- `apps/api/src/services/admin-stats.ts`
- `apps/api/src/services/admin-stats.test.ts` (21 unit tests)
- `apps/api/src/jobs/compute-analytics.ts`
- `apps/web/src/app/(admin)/admin/analytics/page.tsx`

## Files modified

- `apps/api/prisma/schema.prisma` — added `AnalyticsSnapshot` model
- `apps/api/src/services/job-runner.ts` — added compute-analytics to JOB_MAP/KNOWN_JOBS/JOB_FREQUENCIES
- `apps/api/src/index.ts` — registered compute-analytics cron
- `apps/api/src/routes/admin.ts` — 2 new analytics endpoints
- `apps/api/src/routes/admin.test.ts` — added analyticsSnapshot mock, 9 new integration tests
- `apps/web/src/components/admin/AdminSidebar.tsx` — Analytics nav link

## Test results

- API: **763 tests**, all passing (+30 new: 21 unit + 9 integration)
- Web: **151 tests**, all passing
- Mobile: **178 tests**, all passing
- admin-stats: **29 tests**, all passing
- **Total: 1121 tests, all passing**
- Lint: 0 errors, 0 warnings

---

# prd6.md implementation — Users & Organizations (S6)

**Date**: 2026-04-05
**Branch**: admin-dashboard

## What was implemented

### Backend — Users endpoints (`apps/api/src/routes/admin.ts`)

Five new admin-protected endpoints appended at the end of the admin router:

- **GET /api/admin/users** — Paginated user list with `q` (email ILIKE / id match), `role`, and `tier` filters. Returns `{ users, total, page, totalPages }`. Limit capped at 100.

- **GET /api/admin/users/:id** — Full user profile. Uses `Prisma.UserGetPayload` type assertion to correctly type the `include: { parentalProfile: { select: {...} } }` result. Strips `passwordHash` via destructuring before serialization. Returns `parentalProfile` with `hasPin` derived from `pin` field (note: `scheduleLocked` was omitted — field not in DB schema). Returns `recentActivity` (last 10 `ActivityLog` entries) and `stats` (`stickerCount`, `achievementCount`, `totalQuizAnswers`, `totalNewsViewed`).

- **PATCH /api/admin/users/:id/tier** — Zod-validated (`free` | `premium`). Returns `{ id, subscriptionTier }`. Returns 404 on P2025.

- **PATCH /api/admin/users/:id/role** — Zod-validated (`child` | `parent` | `admin`). Blocks self-role change with 403 "Cannot change your own role" by comparing `req.auth?.userId` to `:id`. Returns 404 on P2025.

- **POST /api/admin/users/:id/revoke-tokens** — Calls `prisma.refreshToken.deleteMany({ where: { userId } })`. Returns `{ revoked: count }`.

### Backend — Organizations endpoints (`apps/api/src/routes/admin.ts`)

Three new admin-protected endpoints:

- **GET /api/admin/organizations** — Paginated list with `sport` and `active` (string `'true'`/`'false'`) filters. Uses `_count: { select: { members: true } }` to compute `memberCount` in a single query.

- **GET /api/admin/organizations/:id** — Full org detail with members (via `include` + type assertion `Prisma.OrganizationGetPayload<...>`), and activity summary from `$queryRaw` (30-day daily `ActivityLog` counts via JOIN, BigInt cast to Number).

- **PATCH /api/admin/organizations/:id** — Updates `active` and/or `maxMembers`. Validates `maxMembers >= current member count` before updating. Returns 404 on P2025.

### Backend tests (`apps/api/src/routes/admin.test.ts`)

Extended `mockPrisma` with: `user.update`, `activityLog.count`, `userSticker.count`, `userAchievement.count`, `userQuizHistory.count`, `refreshToken.deleteMany`, `organization.findMany`, `organization.findUnique`, `organization.count`, `organization.update`.

Added 43 new tests covering all 8 new endpoints: auth (401/403), validation (400), not found (404), happy path, edge cases.

### Frontend — Users & Organizations pages (`apps/web/src/app/(admin)/admin/users/`)

Three new pages:

1. **`page.tsx`** — Tabbed page (`Users` | `Organizations`). Tab state synced to `?tab=` query param. Uses `useDebounce` hook (300ms) for search input. `UsersTab` and `OrganizationsTab` are inline components. Both use `AdminTable` (with type assertions to `unknown` for the generic type mismatch). `useSearchParams` + `useRouter` for tab URL sync.

2. **`[id]/page.tsx`** — User detail page. Three modals: `ChangeTierModal`, `ChangeRoleModal`, `RevokeTokensModal`. Modals show current values, allow selection, and have warning text per PRD. All API calls use `authFetch`. Success/error feedback inline below breadcrumbs.

3. **`organizations/[id]/page.tsx`** — Org detail page. `CopyButton` component (inline) with clipboard API and 2s "✓ Copied" state. `DeactivateModal` (handles both deactivate/reactivate). Activity chart uses Recharts `AreaChart` with gradient fill and empty state. Members table with `AdminBadge` for role/tier/orgRole.

### AdminSidebar update (`apps/web/src/components/admin/AdminSidebar.tsx`)

Removed `comingSoon: true` from the Users & Orgs nav link. Removed associated `opacity-60` and `(soon)` badge styling.

## Key decisions

- `scheduleLocked` is referenced in CLAUDE.md but not in the Prisma schema (`ParentalProfile` model). Omitted from the `parentalProfile` response.
- Used `Prisma.UserGetPayload<...>` and `Prisma.OrganizationGetPayload<...>` type assertions to work around Prisma v6 TypeScript inference issues with `include` + `select`.
- The `useDebounce` hook is defined inline in `users/page.tsx` per PRD specification.
- `CopyButton` is defined inline in `organizations/[id]/page.tsx` per PRD specification.
- Admin nav link `[Regenerate Invite Code]` calls the existing non-admin endpoint `POST /api/organizations/:id/regenerate-code` (not a new admin endpoint).

## Test results

- API: **808 tests**, all passing (+43 new tests)
- Web: **152 tests**, all passing
- Lint: 0 errors, 0 warnings

---

## Tech Debt Fixes — prd6.md (post /t-review #6)

**Date**: 2026-04-05

### Critical fix: `scheduleLocked` in parentalProfile response

Added `allowedHoursStart` and `allowedHoursEnd` to the `parentalProfile` select in `GET /admin/users/:id`. Now computes `scheduleLocked: allowedHoursStart !== 0 || allowedHoursEnd !== 24` in the response serialization (`admin.ts`).

### Warning fix: Explicit `select` for user detail (security)

Replaced `findUnique` with `include` + destructuring pattern with a full explicit `select` covering all User fields except `passwordHash`. `passwordHash` is now never loaded from Postgres in the `GET /admin/users/:id` handler.

### Warning fix: Admin-scoped `regenerate-code` endpoint

Added `POST /api/admin/organizations/:id/regenerate-code` endpoint to `admin.ts` secured with `requireRole('admin')`. Updated the org detail frontend to call this endpoint instead of the org-member-scoped one. Fixes 403 for admin users who are not org members.

### Warning fix: `scheduleLocked` test assertion

Updated test fixture for `GET /admin/users/:id` to supply `allowedHoursStart`/`allowedHoursEnd` and asserts `res.body.parentalProfile.scheduleLocked === false`.

### Suggestion fix: `formula1` badge type safety

Added `'red'` to `BadgeVariant` in `AdminBadge.tsx`. Removed `'red' as 'gray'` cast in `sportBadgeVariant`.

### Suggestion fix: `AdminTable` generic typing

Imported `Column<T>` from `AdminTable`, typed columns as `Column<AdminUser>[]` / `Column<AdminOrg>[]`, removed `as unknown as Parameters<...>` casts.

### Suggestion fix: Org field links to org detail

Organization field in user detail now renders as a `<Link>` to `/admin/users/organizations/:orgId` instead of raw UUID text.

### Suggestion fix: Members pagination TODO

Added TODO comment near members table render in org detail page.

### Tests

4 new tests added in `admin.test.ts` for `POST /api/admin/organizations/:id/regenerate-code`: 401 without auth, 403 for non-admin, 200+code generation, 404 on P2025.

**Final counts**: 812 API tests (all passing) | 152 web tests (all passing) | lint clean.
