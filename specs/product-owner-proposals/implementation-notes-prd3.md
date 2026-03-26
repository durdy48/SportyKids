# Product Owner Proposals — prd3.md Implementation Notes

## Requirements

Summary of all 16 items implemented:

| # | ID | Item | Status |
|---|------|------|--------|
| 1 | B-TF5 | API Caching Layer | Implemented — InMemoryCache class with TTL, max 10k entries, withCache() middleware |
| 2 | B-CP2 | "For You" Algorithmic Feed | Implemented — Behavioral scoring: sport 0-4, source 0-2, recency 0-3, read penalty -8 |
| 3 | B-CP5 | Content Filtering by Language | Implemented — +2 locale boost in feed-ranker |
| 4 | B-EN4 | Reading History | Implemented — GET /api/news/historial, "Recently Read" section on web home |
| 5 | B-CP4 | Content Recommendations | Implemented — GET /api/news/:id/relacionados |
| 6 | B-PT4 | Bedtime/Schedule Lock | Implemented — Prisma migration, parental-guard schedule check, ParentalPanel controls |
| 7 | B-CP3 | Live Team Stats | Implemented — TheSportsDB integration, team-ids.ts mapping, cron 04:00 UTC |
| 8 | B-UX7 | Kid-Friendly Error Messages | Implemented — ErrorState component (web+mobile), KID_FRIENDLY_ERRORS in shared constants |
| 9 | B-MP4 | Offline Reading Queue | Implemented — offline-cache.ts (web+mobile), OfflineBanner, 48h eviction |
| 10 | B-MP3 | Pull-to-Refresh | Implemented — BrandedRefreshControl with SportyKids colors |
| 11 | B-UX8 | Haptic Feedback | Implemented — haptics.ts with safe dynamic import |
| 12 | B-MP6 | Native Video Player | Implemented — expo-video (mobile), HTML5 video (web), YouTube embed fallback |
| 13 | B-PT6 | Parental Onboarding Tour | Implemented — 3-step tooltip flow, localStorage/AsyncStorage persistence |
| 14 | B-TF4 | PostgreSQL Migration Prep | Implemented — docker-compose.yml, migration script, SQLite remains default for dev |
| 15 | B-TF6 | Error Monitoring | Implemented — Sentry + PostHog integration, gated by env vars (no-op when unconfigured) |
| 16 | B-TF7 | CI/CD Pipeline | Implemented — .github/workflows/ci.yml, eas.json for Expo builds |

## Design Decisions

- **B-TF5**: InMemoryCache instead of Redis — sufficient for MVP scale (single process). Max 10k entries prevents memory bloat. TTL-based expiration with `withCache()` Express middleware for declarative route caching.
- **B-CP2**: Behavioral signals (sport reads, source clicks, read history) cached 5 min per userId to avoid repeated DB queries. Scoring formula: teamBoost +5, sportBoost +3, behavioralSport 0-4, source 0-2, recency 0-3, readPenalty -8.
- **B-CP5**: Language filtering implemented as a +2 locale boost in feed-ranker rather than hard filtering, so multilingual users still see content in other languages ranked lower.
- **B-CP3**: TheSportsDB free tier (no API key required). 1-second delay between requests to respect rate limits. Team name mapping via team-ids.ts. Cron at 04:00 UTC daily.
- **B-PT4**: Schedule lock enforced server-side in parental-guard middleware. Checks current time against `scheduleStart`/`scheduleEnd` fields on ParentalProfile. ParentalPanel UI exposes time pickers.
- **B-MP4**: Offline cache limited to 20 articles (~50KB) with 48h eviction. Uses localStorage (web) and AsyncStorage (mobile). OfflineBanner component shows connectivity status.
- **B-UX8**: Haptics use safe dynamic import (`expo-haptics`) to avoid crashes on web or simulator. No-op fallback when module unavailable.
- **B-TF4**: PostgreSQL migration as preparation only — docker-compose.yml and migration script provided, but SQLite remains the default for development. No schema changes required (Prisma handles the dialect switch).
- **B-TF6**: Sentry and PostHog gated by environment variables (`SENTRY_DSN`, `POSTHOG_API_KEY`). When not configured, all calls are no-ops with zero overhead.
- **B-TF7**: CI pipeline runs lint, typecheck, and tests on push/PR. EAS config for Expo OTA updates and builds.

## New files created

### B-TF5 (API Caching)
- `apps/api/src/services/cache.ts` — InMemoryCache class with TTL, max entries, withCache() middleware
- `apps/api/src/services/cache.test.ts` — Cache unit tests

### B-CP3 (Live Team Stats)
- `apps/api/src/services/team-ids.ts` — Team name to TheSportsDB ID mapping
- `apps/api/src/services/team-stats-sync.ts` — TheSportsDB API client for fetching live stats
- `apps/api/src/services/team-stats-sync.test.ts` — Sync service tests with mocked API
- `apps/api/src/jobs/sync-team-stats.ts` — Cron job at 04:00 UTC

### B-TF6 (Error Monitoring)
- `apps/api/src/services/monitoring.ts` — Sentry + PostHog initialization and helpers

### B-EN4 (Reading History)
- `apps/api/src/routes/news-history.test.ts` — History endpoint tests

### B-UX7 (Kid-Friendly Errors)
- `apps/web/src/components/ErrorState.tsx` — Kid-friendly error display (web)
- `apps/mobile/src/components/ErrorState.tsx` — Kid-friendly error display (mobile)
- `packages/shared/src/constants/errors.ts` — KID_FRIENDLY_ERRORS constant map

### B-MP4 (Offline Reading Queue)
- `apps/web/src/lib/offline-cache.ts` — Web offline cache (localStorage, 20 articles, 48h TTL)
- `apps/web/src/components/OfflineBanner.tsx` — Connectivity status banner (web)
- `apps/mobile/src/lib/offline-cache.ts` — Mobile offline cache (AsyncStorage)
- `apps/mobile/src/components/OfflineBanner.tsx` — Connectivity status banner (mobile)

### B-MP3 (Pull-to-Refresh)
- `apps/mobile/src/components/BrandedRefreshControl.tsx` — Themed RefreshControl with SportyKids colors

### B-UX8 (Haptic Feedback)
- `apps/mobile/src/lib/haptics.ts` — Safe dynamic import wrapper for expo-haptics

### B-MP6 (Native Video Player)
- `apps/web/src/components/VideoPlayer.tsx` — HTML5 video with YouTube embed fallback
- `apps/mobile/src/components/VideoPlayer.tsx` — expo-video with YouTube embed fallback

### B-PT6 (Parental Onboarding Tour)
- `apps/web/src/components/ParentalTour.tsx` — 3-step tooltip tour (web)
- `apps/mobile/src/components/ParentalTour.tsx` — 3-step tooltip tour (mobile)

### B-TF4 (PostgreSQL Migration Prep)
- `apps/api/docker-compose.yml` — PostgreSQL 16 container for local development
- `apps/api/scripts/migrate-to-postgres.sh` — Migration script (SQLite to PostgreSQL)

### B-PT4 (Bedtime/Schedule Lock)
- `apps/api/prisma/migrations/20260326220000_add_schedule_lock_fields/` — Schedule lock Prisma migration

### B-TF6 + B-TF7 (Monitoring + CI/CD)
- `apps/web/src/lib/analytics.ts` — PostHog analytics client (web)
- `.github/workflows/ci.yml` — GitHub Actions CI pipeline
- `apps/mobile/eas.json` — Expo Application Services config

## Key files modified

- `apps/api/src/services/feed-ranker.ts` — Behavioral scoring (sport, source, recency, read penalty, locale boost)
- `apps/api/src/middleware/parental-guard.ts` — Schedule lock enforcement (time-of-day check)
- `apps/api/src/routes/news.ts` — Reading history, recommendations, caching, locale filtering
- `apps/api/src/routes/teams.ts` — Manual sync trigger + response caching
- `apps/api/src/routes/gamification.ts` — Stickers endpoint caching
- `apps/api/src/routes/parents.ts` — Schedule lock fields (scheduleStart, scheduleEnd)
- `apps/api/src/index.ts` — Team stats cron job registration + monitoring initialization
- `apps/api/prisma/schema.prisma` — Schedule lock fields on ParentalProfile
- `apps/web/src/app/HomeFeedClient.tsx` — "Recently Read" section
- `apps/web/src/components/LimitReached.tsx` — schedule_locked status handling
- `apps/web/src/components/ParentalPanel.tsx` — Schedule lock time picker controls
- `apps/web/src/lib/api.ts` — New API client functions (history, recommendations, offline)
- `apps/mobile/src/lib/api.ts` — New API client functions (history, recommendations, offline)
- `packages/shared/src/i18n/en.json` — 40+ new i18n keys (errors, offline, schedule, history, etc.)
- `packages/shared/src/i18n/es.json` — 40+ new i18n keys (errors, offline, schedule, history, etc.)

## Tests

- 14 test files, 136 tests total, all passing
- 45 new tests added (up from 91 tests across 11 files)
- New test files: cache.test.ts, team-stats-sync.test.ts, news-history.test.ts
- Existing test files expanded with additional coverage
- parents-preview.test.ts updated: all tests now use valid parental session tokens

## Database migrations

1. `20260326220000_add_schedule_lock_fields` — Adds `scheduleEnabled`, `scheduleStart`, `scheduleEnd` fields to ParentalProfile

## Review fixes (t-reduce-tech-debt round 3)

Security hardening across all API routes:

- **auth.ts**: `/upgrade` now requires `requireAuth`, enforces `req.auth!.userId === userId`
- **parents.ts**: 9 route handlers now verify `X-Parental-Session` header via `verifyParentalSession`
- **reports.ts**: `PUT /:reportId` now requires parental session; added `'actioned'` status to Zod enum
- **news.ts**: `POST /sincronizar` requires `requireAuth`; `DELETE /fuentes/custom/:id` requires `requireAuth` and prefers JWT userId
- **teams.ts**: `POST /sync` requires `requireAuth`
- **auth-service.ts**: JWT_SECRET throws in production instead of logging warning
- **digest-generator.ts**: HTML-escapes all interpolated values in email template
- **VideoPlayer.tsx**: iframe src restricted to known video platforms (YouTube, Vimeo, Dailymotion)
- **api.ts (web+mobile)**: Fixed `fetchSources` route from `/sources/list` to `/fuentes/listado`
- **api.ts (web)**: `fetchReports` returns typed array; `ParentalPanel` `digestPreview` properly typed

## Known issues

- TheSportsDB may be unreachable from sandbox environments — all code tested with mocks
- `expo-haptics` and `expo-video` require physical device testing (no-op in simulator/web)
- PostgreSQL migration script needs to be validated against an actual PostgreSQL instance
- Sentry and PostHog require real DSN/API keys for production use
- Suggestions deferred: timezone-aware time limit reset, monitoring.ts dynamic imports, API client deduplication, mobile typed navigation props
