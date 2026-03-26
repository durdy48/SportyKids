# Code Review: Product Owner Proposals (Full Feature)

## Summary

The implementation delivers a comprehensive set of features (auth, push, gamification, caching, offline, schedule lock, etc.) with good architectural structure and i18n support. However, there are **6 critical security issues** around unauthenticated admin/parental endpoints and a partial IDOR fix, **2 bugs** in API client route paths, and several warnings around type safety and missing status values. The authorization model is inconsistent — some routes use JWT, some use parental sessions, many use nothing — leaving sensitive endpoints effectively unprotected.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| JWT auth (register/login/refresh/logout) | prd2 B-TF3 | OK | Implemented with bcrypt, refresh token rotation |
| Parental PIN with bcrypt | prd B-TF2 | OK | Transparent SHA-256 migration |
| Schedule lock (bedtime) | prd3 B-PT4 | OK | Timezone-aware, server-side enforcement |
| Content moderation (AI) | prd B-TF2 | OK | Only approved content served |
| Daily quiz generation | prd B-TF2 | OK | Cron 06:00 UTC, age-range-specific |
| Daily missions | prd2 B-EN1 | OK | Weighted random, format restrictions respected |
| Gamification (streaks, stickers, achievements) | prd | OK | 20 achievement types, milestone rewards |
| RSS catalog + custom sources | prd | OK | SSRF protection, validation |
| Content reporting | prd2 B-PT5 | OK | Rate-limited, deduplicated |
| Weekly digest (email + PDF) | prd2 B-PT1 | OK | jsPDF, nodemailer |
| Push notifications | prd2 B-MP5 | OK | Expo push SDK, preference-based filtering |
| Team stats (TheSportsDB) | prd3 B-CP3 | OK | Live sync with rate limiting |
| Behavioral feed ranking | prd3 B-CP2 | OK | Sport/source/recency/read penalty scoring |
| Offline reading | prd3 B-MP4 | OK | localStorage/AsyncStorage, 20 articles |
| Dark mode | prd2 B-UX4 | OK | System/light/dark with flash prevention |
| i18n (ES/EN) | all | OK | Shared translation system |
| Reading history | prd3 B-EN4 | OK | Activity log based, deduplicated |
| Related articles | prd3 B-CP4 | OK | Team-first, sport-fallback |
| Error monitoring (Sentry) | prd3 B-TF6 | OK | Opt-in, no PII |
| Analytics (PostHog) | prd3 B-TF6 | OK | Opt-in, autocapture disabled |
| Report status "actioned" | CLAUDE.md | Issue | Update route only accepts "reviewed"/"dismissed" |
| Rate limiting on auth endpoints | security | Missing | No brute-force protection on login/register |

## TODO: Critical Issues (must fix)

- [x] **apps/api/src/routes/auth.ts:184** — `/api/auth/upgrade` IDOR protection is incomplete. The check `if (req.auth && req.auth.userId !== userId)` only applies when the caller has a JWT. An unauthenticated request can upgrade ANY anonymous user by supplying their userId. Fix: add `requireAuth` middleware to this route, then always enforce `req.auth!.userId === userId`.

- [x] **apps/api/src/routes/parents.ts:189,217,250,293,436,486,511,532,546** — All parental profile/activity/digest/preview routes lack authentication or session verification. Any caller who knows a userId can read child activity data, modify parental restrictions, configure digest settings, and preview the child's feed. Fix: add `verifyParentalSession` check (via `X-Parental-Session` header) or `requireAuth` with `requireRole('parent')` middleware to all these routes.

- [x] **apps/api/src/routes/reports.ts:136** — `PUT /api/reports/:reportId` is unauthenticated. Anyone can change the status of any content report. Fix: add parental session verification or `requireAuth` middleware.

- [x] **apps/api/src/routes/news.ts:352** — `POST /api/news/sincronizar` (manual RSS sync) is unauthenticated. Anyone can trigger a full RSS sync and cache invalidation. Fix: add `requireAuth` middleware (ideally restrict to parent/admin role).

- [x] **apps/api/src/routes/teams.ts:23** — `POST /api/teams/sync` is unauthenticated. Anyone can trigger external API calls to TheSportsDB and DB writes. Fix: add `requireAuth` middleware.

- [x] **apps/web/src/lib/api.ts:90** — `fetchSources()` calls `/api/news/sources/list` but the backend route is `/api/news/fuentes/listado`. This always returns 404. Fix: change URL to `${API_BASE}/news/fuentes/listado`.

- [x] **apps/mobile/src/lib/api.ts:97** — Same broken route as web. `fetchSources()` calls `/api/news/sources/list` instead of `/api/news/fuentes/listado`. Fix: change URL to `${API_BASE}/news/fuentes/listado`.

## TODO: Warnings (should fix)

- [x] **apps/api/src/services/auth-service.ts:10** — Hardcoded fallback JWT secret `'dev-secret-change-in-production'`. While a console warning exists, this should fail-closed in production. Fix: throw an error if `NODE_ENV === 'production' && !process.env.JWT_SECRET` instead of logging a warning.

- [x] **apps/api/src/routes/reports.ts:134** — Missing "actioned" status. CLAUDE.md documents ContentReport status can be "actioned" but the Zod schema only allows `['reviewed', 'dismissed']`. Fix: add `'actioned'` to the enum.

- [x] **apps/web/src/components/VideoPlayer.tsx:80-89** — Unrestricted iframe `src`. The fallback case renders an iframe with `src={videoUrl}` from the database without URL allowlisting. If a reel record is compromised, arbitrary content loads in the iframe. Fix: add URL validation or restrict to known video platforms (YouTube, Vimeo, etc.).

- [x] **apps/api/src/services/digest-generator.ts:99** — HTML injection risk in digest email. `data.topSports` and `data.userName` are interpolated directly into HTML without escaping. Fix: HTML-escape all interpolated values in `renderDigestHtml`.

- [x] **apps/api/src/routes/news.ts:313-349** — DELETE custom source uses userId from query/body, not from JWT. Anyone who knows a userId can delete their custom sources. Fix: use `req.auth?.userId` for authorization and require authentication.

- [x] **apps/web/src/lib/api.ts:312** — `fetchReports` returns `Promise<any[]>`. Fix: use `Promise<ContentReport[]>` from shared types.

- [x] **apps/web/src/components/ParentalPanel.tsx:78** — `digestPreview` state typed as `any`. Fix: define a `DigestPreview` type or import from shared.

## TODO: Suggestions (nice to have)

- [ ] **apps/api/src/middleware/parental-guard.ts:164** — `todayStart.setHours(0, 0, 0, 0)` uses server local time for daily time limit reset. Fix: use the profile's timezone to compute start-of-day.

- [ ] **apps/api/src/services/monitoring.ts:29,52** — Uses `require()` instead of dynamic `import()` for Sentry/PostHog, bypassing TypeScript type checking. Fix: use `await import('@sentry/node')` with type assertions.

- [ ] **apps/web/src/lib/api.ts + apps/mobile/src/lib/api.ts** — ~400 lines of nearly identical API client code. Fix: extract shared API client logic into `@sportykids/shared` or a shared API package.

- [ ] **apps/mobile/src/screens/*.tsx** — Navigation props typed as `any` (HomeFeed, Login, Register). Fix: use typed navigation props from React Navigation.

## Technical Debt Assessment

The changes introduce **moderate tech debt**, partially offset by capability additions:

**Increases debt:**
- Inconsistent authorization model (3 mechanisms: JWT, parental session, userId param) used unevenly, leaving many routes unprotected
- Duplicated web/mobile API clients (~400 lines each)
- `any` types in ParentalPanel and API client returns
- Hardcoded JWT fallback secret

**Reduces debt:**
- bcrypt migration from SHA-256
- `formatUser` utility preventing hash leaks
- Zod validation on all input boundaries
- SSRF protection on custom RSS URLs
- Structured error constants

**Net:** Slight increase. The inconsistent authorization model is the primary concern.

## Verification

```
Test Files: 14 passed (14)
Tests:      136 passed (136)
Duration:   1.14s
```

All tests pass. No regressions detected.

## Files Reviewed

- `apps/api/src/index.ts` — Entry point, middleware registration, cron jobs
- `apps/api/src/routes/auth.ts` — Auth endpoints with partial IDOR fix
- `apps/api/src/routes/news.ts` — News CRUD, search, trending, sync (unprotected)
- `apps/api/src/routes/parents.ts` — All parental routes (unprotected)
- `apps/api/src/routes/users.ts` — User CRUD, notification subscription
- `apps/api/src/routes/quiz.ts` — Quiz endpoints
- `apps/api/src/routes/teams.ts` — Team stats, sync (unprotected)
- `apps/api/src/routes/gamification.ts` — Stickers, achievements, streaks
- `apps/api/src/routes/reports.ts` — Content reports (update unprotected)
- `apps/api/src/routes/missions.ts` — Daily missions
- `apps/api/src/middleware/auth.ts` — JWT middleware (non-blocking + blocking)
- `apps/api/src/middleware/parental-guard.ts` — Format/sport/time/schedule enforcement
- `apps/api/src/services/auth-service.ts` — JWT, refresh tokens, password hashing
- `apps/api/src/services/cache.ts` — In-memory cache with TTL
- `apps/api/src/services/feed-ranker.ts` — Behavioral + static ranking
- `apps/api/src/services/gamification.ts` — Streaks, stickers, achievements
- `apps/api/src/services/team-stats-sync.ts` — TheSportsDB integration
- `apps/api/src/services/push-sender.ts` — Expo push notifications
- `apps/api/src/services/digest-generator.ts` — Weekly digest HTML/PDF
- `apps/api/src/services/mission-generator.ts` — Daily missions
- `apps/api/src/services/monitoring.ts` — Sentry/PostHog init
- `apps/api/src/utils/format-user.ts` — Password hash stripping
- `apps/api/src/utils/url-validator.ts` — SSRF prevention
- `apps/api/src/jobs/*.ts` — All 6 cron jobs
- `apps/api/prisma/schema.prisma` — Full data model (16 models)
- `apps/web/src/lib/api.ts` — Web API client (broken fetchSources route)
- `apps/web/src/lib/user-context.tsx` — Web user context
- `apps/web/src/lib/auth.ts` — Web auth tokens
- `apps/web/src/components/VideoPlayer.tsx` — Video player (unrestricted iframe)
- `apps/web/src/components/ParentalPanel.tsx` — Parental control panel
- `apps/mobile/src/lib/api.ts` — Mobile API client (broken fetchSources route)
- `apps/mobile/src/lib/auth.ts` — Mobile auth tokens
- `apps/mobile/src/lib/user-context.tsx` — Mobile user context
- `packages/shared/src/types/index.ts` — Shared types
- `packages/shared/src/constants/index.ts` — Shared constants
