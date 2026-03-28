# technical-debt-backlog PRD-1 Implementation Notes

# Implementation notes

## Requirements

List all 5 features from PRD-1 and their status (all implemented):
- Feature 1: Web & Mobile Testing Infrastructure — Implemented
- Feature 2: ESLint & Consistent Linting — Implemented
- Feature 3: Mobile Typecheck in CI — Implemented
- Feature 4: Structured Logging with Pino — Implemented
- Feature 5: Persistent Parental Session Tokens — Implemented

## Initial considerations

- Implementation order followed D10: Feature 4 → 2 → 5 → 1 → 3 (logging before linting to clear no-console, sessions before tests)
- Pre-existing flaky test (pin-lockout) fixed by adding fileParallelism: false to vitest config
- Pre-existing mobile type errors fixed as prerequisite for CI typecheck

## Design

- Pino structured logging with request-scoped child loggers via requestIdMiddleware
- ParentalSession model in Prisma replaces in-memory Map; lazy + periodic cleanup
- ESLint 9 flat config at root covering all 3 workspaces + Prettier
- Vitest for all 3 workspaces (same runner as API)

## Implementation details

List key files created/modified:
- apps/api/src/services/logger.ts — Pino logger with pino-pretty for dev
- apps/api/src/middleware/request-id.ts — X-Request-ID generation and req.log binding
- apps/api/src/services/parental-session.ts — DB-backed session CRUD
- apps/api/src/middleware/error-handler.ts — Enhanced with requestId, Sentry context
- apps/api/src/services/monitoring.ts — Added captureException context, addBreadcrumb
- apps/api/src/routes/parents.ts — Migrated from in-memory sessions to DB
- eslint.config.js — ESLint 9 flat config
- .prettierrc — Prettier config
- .github/workflows/ci.yml — Added test-web, test-mobile, Prisma cache, mobile typecheck
- 24 API files — console.* replaced with logger/req.log
- 6 PostHog trackEvent calls added across routes

## Tests

- API: 32 files, 301 tests (27 new job tests + existing 274)
- Web: 12 files, 57 tests (all new)
- Mobile: 10 files, 60 tests (all new)
- Total: 54 files, 418 tests

## Documentation updates

- CLAUDE.md updated with new stack, commands, models, architecture
- .github/workflows/ci.yml completely rewritten

## Performance

None — structured logging adds negligible overhead. Session DB query is indexed.

## Known issues

- ESLint warning about module type in eslint.config.js (Node prints a warning about adding "type": "module" to package.json). Harmless.
- Mobile screen tests are smoke tests only (can't fully render RN components in vitest/node)

---

# prd2.md implementation

# Implementation notes

## Requirements

All 3 features from PRD-2 implemented:
- Feature 6: Complete PostgreSQL Migration — Implemented
- Feature 8: Robust Error Handler — Implemented
- Feature 9: Deprecated Code Cleanup & Version Alignment — Implemented

## Initial considerations

- PostgreSQL migration had to be done first since it changes the database provider and schema types, affecting all routes and services
- Error handler migration was done second since it modifies all route files
- Code cleanup was last since it's independent changes
- Docker/Colima needed to be started for PostgreSQL container
- Used `docker-compose` (v1 syntax) since Colima doesn't include `docker compose` v2 plugin

## Design

### Feature 6: PostgreSQL Migration
- Changed Prisma provider from `sqlite` to `postgresql`
- Converted 9 fields from JSON-string to native PostgreSQL types (String[], Json)
- Replaced in-memory trending aggregation with Prisma `groupBy` + `having`
- Added 3 composite indexes for common query patterns
- Removed all old SQLite migrations, created fresh PostgreSQL baseline

### Feature 8: Error Handler
- Abstract `AppError` base class with `statusCode`, `code`, `details`
- 6 concrete error classes: ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, RateLimitError
- Centralized handler maps AppError/Prisma P2002/P2025/P2003/ZodError to correct HTTP codes
- Sentry only receives 5xx errors
- ERROR_CODES constant in shared package for frontend consumption
- KID_FRIENDLY_ERRORS extended with auth_required, too_fast, forbidden

### Feature 9: Code Cleanup
- Deleted deprecated sportBoost/recencyBoost functions
- Aligned React to ^19.2.4 across web and mobile
- Removed skipLibCheck from web tsconfig
- Fixed hardcoded 'es' locale in 3 push notification jobs with per-locale grouping
- Restructured CI to single setup job with cache

## Implementation details

### Feature 6 files:
- `apps/api/prisma/schema.prisma` — Provider change, native types, indexes
- `apps/api/prisma/seed.ts` — Removed JSON.stringify wrapping for array fields
- `apps/api/src/routes/news.ts` — Trending endpoint uses Prisma groupBy, case-insensitive search
- `apps/api/src/routes/users.ts` — Removed JSON.parse/stringify for user fields
- `apps/api/src/routes/parents.ts` — Removed JSON.parse/stringify for parental fields
- `apps/api/src/routes/quiz.ts` — Removed JSON.parse/stringify for quiz options
- `apps/api/src/services/team-stats.ts` — Native Json type for recentResults/nextMatch
- `apps/api/src/services/team-stats-sync.ts` — Same
- `apps/api/src/services/push-sender.ts` — Native Json for pushPreferences
- `apps/api/src/services/gamification.ts` — Native arrays
- `apps/api/src/services/mission-generator.ts` — Native arrays
- `apps/api/src/middleware/parental-guard.ts` — Native arrays
- `apps/api/src/jobs/generate-daily-quiz.ts` — Native arrays
- `apps/api/src/utils/format-user.ts` — Removed JSON.parse for user fields

### Feature 8 files:
- `apps/api/src/errors/index.ts` — Error class definitions (new)
- `apps/api/src/middleware/error-handler.ts` — Complete rewrite
- `packages/shared/src/constants/errors.ts` — ERROR_CODES, extended KID_FRIENDLY_ERRORS
- `packages/shared/src/constants/index.ts` — New exports
- `packages/shared/src/i18n/es.json` — Kid-friendly error i18n keys
- `packages/shared/src/i18n/en.json` — Kid-friendly error i18n keys
- All 8 route files migrated to throw error classes
- `apps/api/src/middleware/auth.ts` — Throws AuthenticationError/AuthorizationError
- `apps/api/src/middleware/parental-guard.ts` — Throws appropriate errors

### Feature 9 files:
- `apps/api/src/services/feed-ranker.ts` — Deleted sportBoost, recencyBoost
- `apps/api/src/services/feed-ranker.test.ts` — Deleted deprecated test blocks
- `apps/mobile/package.json` — React ^19.2.4
- `apps/web/tsconfig.json` — Removed skipLibCheck
- `apps/web/vitest.setup.ts` — Removed triple-slash reference for jest-dom
- `apps/api/src/jobs/generate-daily-missions.ts` — user.locale support
- `apps/api/src/jobs/sync-feeds.ts` — Per-locale push grouping
- `apps/api/src/jobs/generate-daily-quiz.ts` — Per-locale push grouping
- `.github/workflows/ci.yml` — Setup job with cache/save + cache/restore

## Tests

- API: 379 tests (35 files) — net +69 from PRD-1 baseline (new error handler tests +60, locale tests +7, removed deprecated -9, adjusted existing)
- Web: 57 tests (12 files) — unchanged
- Mobile: 60 tests (10 files) — unchanged
- Total: 496 tests (56 files)

New test files:
- `apps/api/src/errors/errors.test.ts` — 48 tests for all error classes
- `apps/api/src/middleware/error-handler.test.ts` — 12 tests for handler mapping

Updated test files for PostgreSQL native types (mock data changed from JSON strings to arrays):
- pin-lockout, push-sender, parents-preview, parental-guard, gamification, mission-generator, users-locale tests

Updated test files for structured error responses:
- Routes and middleware tests updated from `res.body.error` (string) to `res.body.error.code` (structured object)

Locale-aware push notification tests added to:
- generate-daily-missions.test.ts (+3 tests)
- sync-feeds.test.ts (+2 tests)
- generate-daily-quiz.test.ts (+2 tests)

## Documentation updates

- `CLAUDE.md` — Updated tech debt section (6 new resolved items), database references (PostgreSQL default), architecture tree (errors/ directory), models section (native types), env vars (DATABASE_URL), infrastructure notes
- `docs/es/02-modelo-de-datos.md` — Updated SQLite notes to PostgreSQL
- `docs/en/02-data-model.md` — Updated SQLite notes to PostgreSQL
- `docs/es/06-service-overview.md` — Updated service descriptions
- `docs/en/06-service-overview.md` — Updated service descriptions

## Performance

- Trending endpoint: eliminated O(n) in-memory aggregation, replaced with PostgreSQL GROUP BY (constant memory)
- Added composite indexes on NewsItem, Reel, ActivityLog for common query patterns
- Native PostgreSQL arrays eliminate JSON.parse overhead on every request
- CI pipeline: eliminated 3 redundant `npm ci` + `prisma generate` runs via shared setup job with cache

## Review fixes (/t-reduce-tech-debt #2)

### Critical fixes:
- `apps/api/src/middleware/error-handler.ts` — Non-5xx errors now always include `details` (schedule lock info, validation errors). Only 5xx strip details in production.
- `apps/web/src/lib/api.ts` — Added `parseParentalBlockError()` helper reading from `body.error.details`. Replaced 3 duplicate 403 parsing blocks.
- `apps/mobile/src/components/VideoPlayer.tsx` — Moved `require('expo-video')` to module scope with try/catch. Hook always called unconditionally.

### Warning fixes:
- `apps/api/src/routes/gamification.ts` — Migrated 5 inline error responses to typed errors (NotFoundError, ValidationError)
- `apps/api/src/routes/teams.ts` — Migrated to NotFoundError, removed redundant try/catch
- `apps/api/src/routes/news.ts` — 503 response uses standard error format
- `apps/mobile/src/screens/ParentalControl.tsx` — Removed unused `_changingPin` state
- `apps/api/src/routes/parents.ts` — `formatProfile` uses `ParentalProfile` type from Prisma

### Additional fix during validation:
- `apps/mobile/src/rn-flatlist-fix.d.ts` — Type augmentation for FlatList/SectionList props missing from RN 0.81 + React 19.2.x types

## Known issues

- ESLint warning about module type in eslint.config.js (Node prints a warning about adding "type": "module" to package.json). Harmless.
- Mobile screen tests are smoke tests only (can't fully render RN components in vitest/node)
- API typecheck shows vitest-related type errors from `vite/module-runner` declaration (pre-existing, vitest's declarations require `bundler` moduleResolution but API uses `node`). Does not affect runtime or tests.
- OAuth routes (501 stubs) were not migrated to throw error classes since they carry domain-specific fields and are placeholder implementations.
- Docker requires Colima on this machine. `docker-compose` (v1) works but `docker compose` (v2 plugin) is not available.
- Suggestions from review.md (monitoring.ts PII scrubbing comment, error-handler isProduction testability, feed-ranker import order, parents.ts setInterval cleanup, error codes DRY) left as-is — low priority, no user impact.

---

# prd3.md implementation

# Implementation notes

## Requirements

All 3 features from PRD-3 implemented:
- Feature 10: Parental Trust Completion (B-PT1 Digest UI, B-PT2 Preview Mode, B-PT3 Granular Time Limits) — Implemented
- Feature 11: Daily Missions Completion (B-EN1 real-time refresh, expired state, confetti, mobile MissionCard, push notifications) — Implemented
- Feature 12: Dark Mode — Web & Mobile (B-UX4 audit, NavBar icon, mobile theme system, screen migration) — Implemented

## Initial considerations

- Feature 10 was mostly frontend work since backend digest/preview/time-limits endpoints already existed
- Feature 11 required one new cron job (mission-reminder) and modifications to the missions route for expired state
- Feature 12 web was mostly CSS dark: variant additions; mobile required a new theme system from scratch
- No new npm dependencies added — mobile sliders use custom PanResponder-based implementation
- Implementation order: Feature 10 (backend first → web → mobile), Feature 11 (backend → web → mobile), Feature 12 (web → mobile)

## Design

### Feature 10: Parental Trust
- Mobile digest tab mirrors web ParentalPanel digest tab (toggle, email, day picker, preview, download)
- Test email endpoint reuses existing `generateDigestData()` + `renderDigestHtml()` + nodemailer
- Test email rate limited per-user (1 per 5 min) stored in-memory Map
- Save confirmation uses a brief auto-hiding toast pattern
- FeedPreviewModal (web) shows restrictions banner parsing ParentalProfile fields
- Mobile FeedPreviewModal uses React Native `Modal` component (full-screen)
- Per-type time limit sliders on mobile use custom `View` + `PanResponder` (no external dependency)
- LimitReached enhanced with 3 new content-type-specific variants

### Feature 11: Daily Missions
- Real-time refresh via `CustomEvent('sportykids:activity-logged')` dispatched in web api.ts `recordActivity()`
- MissionCard listens via `addEventListener` and re-fetches mission on activity
- Expired mission state: GET /api/missions/today/:userId returns `{ mission: null, expired: true }` when yesterday's mission exists
- `celebrateMissionComplete()` in celebrations.ts — gold/blue confetti via canvas-confetti
- Mobile MissionCard: 3 visual states (uncompleted/completed-unclaimed/claimed) + expired
- Mission reminder cron at 18:00 UTC sends push to users with >50% progress

### Feature 12: Dark Mode
- Web: CSS custom properties already handle most dark mode; only hardcoded Tailwind classes needed `dark:` variants
- Mobile: New `theme.ts` with lightColors/darkColors/resolveColors, exposed via UserContext
- All 20 mobile files migrated from `COLORS.darkText`/`COLORS.lightBackground` to `colors.text`/`colors.background`
- Theme toggle: 3-state cycle (system → dark → light) matching web pattern
- StatusBar adapts to resolved theme

## Implementation details

### Feature 10 files:
- `apps/api/src/routes/parents.ts` — Added POST /api/parents/digest/:userId/test endpoint
- `apps/api/src/routes/digest-test-email.test.ts` — Tests for test email endpoint (NEW)
- `apps/web/src/components/ParentalPanel.tsx` — Send test email button, save toast, dark: variants
- `apps/web/src/components/FeedPreviewModal.tsx` — Active restrictions banner, dark: variants
- `apps/web/src/components/LimitReached.tsx` — 3 new per-type limit variants
- `apps/web/src/components/LimitReached.test.tsx` — Tests for new variants (NEW)
- `apps/web/src/lib/api.ts` — sendTestDigestEmail() function
- `apps/mobile/src/screens/ParentalControl.tsx` — Digest tab, feed preview button, per-type sliders, theme toggle
- `apps/mobile/src/components/LimitReached.tsx` — Mobile LimitReached component (NEW)
- `apps/mobile/src/lib/api.ts` — getDigestPreferences(), updateDigestPreferences(), fetchFeedPreview()

### Feature 11 files:
- `apps/api/src/routes/missions.ts` — Expired mission response, envelope wrapping
- `apps/api/src/routes/missions.test.ts` — Tests for expired mission endpoint (NEW)
- `apps/api/src/jobs/mission-reminder.ts` — New cron job at 18:00 UTC (NEW)
- `apps/api/src/jobs/mission-reminder.test.ts` — Tests for mission reminder (NEW)
- `apps/api/src/index.ts` — Registered mission-reminder cron
- `apps/web/src/components/MissionCard.tsx` — Real-time refresh, expired state, confetti, dark: variants
- `apps/web/src/components/MissionCard.test.tsx` — Tests for new states (NEW)
- `apps/web/src/lib/api.ts` — sportykids:activity-logged event dispatch
- `apps/web/src/lib/celebrations.ts` — celebrateMissionComplete() function
- `apps/mobile/src/components/MissionCard.tsx` — Mobile MissionCard (NEW)
- `apps/mobile/src/screens/HomeFeed.tsx` — MissionCard as FlatList header

### Feature 12 files:
- `apps/web/src/components/NavBar.tsx` — Theme icon (sun/moon/auto)
- `apps/web/src/components/QuizGame.tsx` — dark: variants
- `apps/web/src/components/OnboardingWizard.tsx` — dark: variants
- `apps/web/src/components/ContentReportList.tsx` — dark: variants
- `apps/web/src/app/HomeFeedClient.tsx` — dark: variants
- `apps/mobile/src/lib/theme.ts` — Theme system (NEW)
- `apps/mobile/src/lib/__tests__/theme.test.ts` — Theme resolution tests (NEW)
- `apps/mobile/src/lib/user-context.tsx` — Added theme/setTheme/colors/resolvedTheme
- `apps/mobile/src/App.tsx` — StatusBar adapts to theme
- `apps/mobile/src/navigation/index.tsx` — Tab bar and header colors from theme
- All 10 mobile screens — Migrated to colors from UserContext
- All 6 mobile components — Migrated to colors from UserContext

### i18n:
- `packages/shared/src/i18n/en.json` — 15 new keys
- `packages/shared/src/i18n/es.json` — 15 new keys

## Tests

- API: 393 tests (38 files) — +14 tests, +3 new test files
  - `apps/api/src/routes/digest-test-email.test.ts` — Test email endpoint tests (incl. rate limiting)
  - `apps/api/src/routes/missions.test.ts` — Expired mission endpoint tests (incl. claim, expired flag)
  - `apps/api/src/jobs/mission-reminder.test.ts` — Mission reminder cron tests
- Web: 69 tests (14 files) — +12 tests, +2 new test files
  - `apps/web/src/components/MissionCard.test.tsx` — Mission states, refresh, confetti
  - `apps/web/src/components/LimitReached.test.tsx` — Per-type limit variants
- Mobile: 69 tests (11 files) — +9 tests, +1 new test file
  - `apps/mobile/src/lib/__tests__/theme.test.ts` — resolveColors, resolveTheme tests
- Total: 531 tests (63 files) — +35 from PRD-2 baseline of 496

## Documentation updates

- `CLAUDE.md` — Updated to reflect new endpoints (POST digest test, mission-reminder cron), new mobile components (MissionCard, LimitReached, FeedPreviewModal, theme.ts), dark mode support, test counts
- `docs/es/` and `docs/en/` — Updated service overview with new cron jobs and features

## Performance

- Mission real-time refresh uses DOM events (zero-cost) instead of polling
- Dark mode on web leverages existing CSS custom properties — minimal additional CSS
- Mobile theme via React Context avoids unnecessary re-renders (colors object is stable per theme)

## Review fixes (/t-reduce-tech-debt #3)

### Critical fixes:
- `apps/mobile/src/screens/ParentalControl.tsx` — Added per-type time limit sliders (step-selector grids for news/reels/quiz, 0-120 min) in restrictions tab

### Warning fixes:
- `apps/api/src/routes/parents.ts` — Test email cooldown migrated from in-memory Map to CacheProvider (`apiCache.set/get`)
- `apps/api/src/routes/missions.ts` — Added `expired: true/false` field to missions today endpoint (checks yesterday's mission)
- `apps/mobile/src` (8 files) — Replaced ~50 hardcoded hex colors with theme-aware `colors.*` properties
- `apps/web/src/components/OnboardingWizard.tsx` — Added 10+ `dark:` Tailwind variants
- `apps/mobile/src/navigation/index.tsx` — Reels header uses `colors.background` instead of `#000`
- `apps/mobile/src/components/MissionCard.tsx` — Claim button text color uses constant
- `apps/api/src/routes/parents.ts` — Test email error handler uses `throw` instead of raw `res.status(500)`

### Suggestion fixes:
- Mobile MissionCard: Added `__DEV__` console.warn for catch blocks, removed unsafe double cast, typed API response
- `apps/api/src/jobs/mission-reminder.ts` — Converted dynamic imports to static
- `apps/mobile/src/screens/ParentalControl.tsx` — Replaced 5 dynamic imports with static
- `apps/web/src/components/ParentalPanel.tsx` — Added `testEmailSuccess` boolean state replacing string matching
- `apps/mobile/src/screens/ParentalControl.tsx` — Preview ActivityIndicator uses `colors.surface`
- `apps/api/src/routes/digest-test-email.test.ts` — Added rate-limiting test case (429)
- `apps/api/src/routes/missions.test.ts` — Added 4 tests: claim validation, expired flag variants

## Known issues

- Mobile FeedPreviewModal shows reels as thumbnails only (no full player in preview)
- Per-timezone push scheduling not implemented — missions notification sent at 05:00 UTC, reminder at 18:00 UTC
- Some semantic accent colors (success green, warning yellow) remain as hardcoded hex with alpha opacity for tinted backgrounds — acceptable since these are intentional design choices, not theme colors

---

# prd4.md implementation

# Implementation notes

## Requirements

All features from PRD-4 implemented:
- Feature 7: OAuth Social Login (Google + Apple via Passport.js) — Implemented
- Feature 13.1: B-UX7 Kid-Friendly Error Messages — Implemented
- Feature 13.2: B-UX8 Haptic Feedback on Mobile — Implemented
- Feature 13.3: B-MP3 Pull-to-Refresh with BrandedRefreshControl — Implemented
- Feature 13.4: B-PT4 Schedule Lock UI (Bedtime Hours) — Implemented
- Feature 13.5: B-PT6 Parental Onboarding Tour — Verified (already working on web, fixed mobile)
- Feature 13.6: B-CP4 Related Article Recommendations — Implemented
- Feature 13.7: B-EN4 Reading History — Implemented
- Feature 13.8: B-CP5 Content Filtering by User Language — Verified and fixed (locale param added to frontends)
- Feature 13.9: B-MP6 Native Reel Player Audit — Documented

## Initial considerations

- OAuth implementation uses Passport.js for Google web redirect flow but direct token verification for mobile flows (expo-auth-session returns ID tokens client-side)
- Apple Sign In uses manual JWT decoding rather than full JWKS verification — production should add proper verification via Apple's public keys
- Social login buttons are conditionally rendered based on `/api/auth/providers` endpoint, so missing env vars = hidden buttons (no crashes)
- Haptic feedback uses the existing `haptics.ts` utility — no new dependencies
- BrandedRefreshControl was already built, just needed integration in screens
- Schedule lock backend was already complete, only needed frontend UI

## Design

### Feature 7: OAuth Social Login
- Passport.js Google strategy for web redirect flow
- `findOrCreateSocialUser` handles 3 flows: find by socialId, link by email, create new
- Mobile uses POST endpoints (`/google/token`, `/apple/token`) with server-side token verification
- `GET /api/auth/providers` returns which providers are configured
- Web callback page (`/auth/callback`) reads tokens from URL, stores in localStorage
- `socialId` field on User model with composite index `(authProvider, socialId)`

### Feature 13.1: Kid-Friendly Errors
- 4 new error types in KID_FRIENDLY_ERRORS: rate_limited, format_blocked, limit_reached, unauthorized
- `getErrorType()` extended to map HTTP 401 → unauthorized, 429 → rate_limited
- String-based detection for schedule_locked, format_blocked, limit_reached

### Feature 13.2-13.9: UX Polish
- Haptics integrated at 6+ interaction points following iOS HIG intensity mapping
- BrandedRefreshControl uses i18n for title text (fixed from hardcoded)
- Schedule Lock UI mirrors web design with hour pickers and timezone dropdown
- Related articles fetched from existing endpoint, displayed below expanded article
- Reading history shown as horizontal scroll section on home feed
- Locale param added to both web and mobile API calls for content filtering

## Implementation details

### Feature 7 files:
- `apps/api/prisma/schema.prisma` — Added socialId, composite index
- `apps/api/src/services/auth-service.ts` — findOrCreateSocialUser function
- `apps/api/src/services/passport.ts` — Passport.js Google strategy (NEW)
- `apps/api/src/routes/auth.ts` — 7 new/replaced routes (providers, google, google/callback, google/token, apple, apple/callback, apple/token)
- `apps/api/src/utils/format-user.ts` — Strips socialId from responses
- `packages/shared/src/types/index.ts` — SocialAuthRequest interface, socialId on User
- `apps/web/src/app/auth/callback/page.tsx` — OAuth callback page (NEW)
- `apps/web/src/lib/api.ts` — fetchAuthProviders function
- `apps/web/src/lib/auth.ts` — getGoogleLoginUrl, getAppleLoginUrl
- `apps/web/src/components/OnboardingWizard.tsx` — Social login buttons on step 1
- `apps/mobile/src/lib/auth.ts` — fetchAuthProviders, loginWithSocialToken
- `apps/mobile/src/screens/Login.tsx` — Social login buttons
- `apps/mobile/src/screens/Register.tsx` — Social login buttons

### Feature 13.1 files:
- `packages/shared/src/constants/errors.ts` — 4 new error types + getErrorType mappings
- `packages/shared/src/i18n/es.json` — Kid error i18n keys
- `packages/shared/src/i18n/en.json` — Kid error i18n keys

### Feature 13.2 files:
- `apps/mobile/src/screens/Quiz.tsx` — haptic success/error
- `apps/mobile/src/screens/Collection.tsx` — haptic light on sticker tap
- `apps/mobile/src/screens/Reels.tsx` — haptic light on like
- `apps/mobile/src/navigation/index.tsx` — haptic selection on tab switch
- `apps/mobile/src/components/MissionCard.tsx` — haptic success on claim
- `apps/mobile/src/lib/user-context.tsx` — haptic success on check-in

### Feature 13.3 files:
- `apps/mobile/src/components/BrandedRefreshControl.tsx` — i18n title
- `apps/mobile/src/screens/HomeFeed.tsx` — Pull-to-refresh
- `apps/mobile/src/screens/Reels.tsx` — Pull-to-refresh
- `apps/mobile/src/screens/Collection.tsx` — Pull-to-refresh
- `apps/mobile/src/screens/Quiz.tsx` — Pull-to-refresh

### Feature 13.4 files:
- `apps/web/src/components/ParentalPanel.tsx` — Schedule lock UI
- `apps/mobile/src/screens/ParentalControl.tsx` — Schedule lock UI
- `packages/shared/src/i18n/es.json` — schedule.enable, schedule.description
- `packages/shared/src/i18n/en.json` — schedule.enable, schedule.description

### Feature 13.5 files:
- `apps/mobile/src/screens/ParentalControl.tsx` — Added ParentalTour import/render (was missing)

### Feature 13.6 files:
- `apps/web/src/components/NewsCard.tsx` — Related articles section
- `apps/mobile/src/components/NewsCard.tsx` — Related articles section

### Feature 13.7 files:
- `apps/mobile/src/screens/HomeFeed.tsx` — Reading history horizontal section

### Feature 13.8 files:
- `apps/web/src/lib/api.ts` — locale in fetchNews
- `apps/mobile/src/lib/api.ts` — locale in fetchNews
- `apps/web/src/app/HomeFeedClient.tsx` — Passes locale
- `apps/mobile/src/screens/HomeFeed.tsx` — Passes locale

### Feature 13.9 files:
- `docs/en/06-service-overview.md` — Video Player Strategy section
- `docs/es/06-service-overview.md` — Video Player Strategy section

## Tests

- API: 423 tests (39 files) — +30 from PRD-3 baseline (393)
  - `apps/api/src/__tests__/auth-social.test.ts` — 26 tests for OAuth flows (NEW)
  - `apps/api/src/__tests__/routes/auth-oauth.test.ts` — Rewritten from 501 stub tests to real OAuth route tests (10 tests)
- Web: 69 tests (14 files) — unchanged
- Mobile: 69 tests (11 files) — unchanged
- Total: 561 tests (64 files)

## Documentation updates

- `CLAUDE.md` — OAuth stack, routes, env vars, socialId field, resolved tech debt (8 items), test counts
- `docs/en/02-data-model.md` — socialId field, auth fields section
- `docs/es/02-modelo-de-datos.md` — Same in Spanish
- `docs/en/06-service-overview.md` — OAuth section, Video Player Strategy
- `docs/es/06-service-overview.md` — Same in Spanish

## Performance

- OAuth web flow uses server-side redirect (no extra API call)
- Mobile token flow is single POST (verify + create/find user + issue JWT)
- Haptics are fire-and-forget (no await)
- Pull-to-refresh reuses existing fetch functions
- Related articles lazy-loaded on article expansion only

## Review fixes (/t-reduce-tech-debt #4)

### Critical fixes:
- `apps/api/src/routes/auth.ts` — Google OAuth state validation: state stored in apiCache, validated as single-use token on callback
- `apps/api/src/routes/auth.ts` — Apple JWKS verification: `verifyAppleToken()` helper uses `jwks-rsa` + `jsonwebtoken.verify` with cached JWKS keys (24h)
- `apps/api/src/routes/auth.ts` — Apple nonce: hashed with SHA-256, stored in cache, verified on callback return
- `apps/web/src/app/auth/callback/page.tsx` — URL cleanup with `window.history.replaceState` after reading tokens

### Warning fixes:
- Removed unused `passport-apple` and `@types/passport-apple` dependencies
- `apps/mobile/src/screens/Quiz.tsx` — console.error guarded with `__DEV__`
- `apps/mobile/src/screens/Login.tsx` + `Register.tsx` — Social buttons show Alert explaining OAuth needs setup; hardcoded colors replaced with theme `colors.*`
- `apps/api/src/routes/auth.ts` — `express.urlencoded` scoped to Apple callback only
- `apps/web/src/app/auth/callback/page.tsx` — Added `res.ok` check before JSON parse
- `apps/api/src/services/auth-service.ts` — `findOrCreateSocialUser` returns Prisma `User` type
- `apps/api/src/routes/auth.ts` — Added comment documenting Apple scope prerequisite

### Suggestion fixes:
- Extracted `handleGoogleCallback` async function for readability
- Deduplicated `createFakeAppleToken` test helper
- Added dev-only debug logs for silent catches (OnboardingWizard, HomeFeed)
- Simplified `languageBoost` signature to accept `string` only
- Fixed `getErrorType` false positive risk with specific status code matching
- Added `Suspense` boundary to OAuth callback page for Next.js compatibility

## Known issues

- Google OAuth requires real Google Cloud Console credentials to test end-to-end
- Mobile social login buttons show informational alert (expo-auth-session not installed yet — needs deep linking setup for production)
- Full reading history page ("See all") not implemented — currently just logs navigation intent
- Schedule lock uses hour-level precision only (no minutes)
