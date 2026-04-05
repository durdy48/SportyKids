# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added — Admin Dashboard (Phases S1–S6)

#### S1–S2: Infrastructure, Moderation & Reports
- Admin route group `(admin)/admin/*` with dedicated layout and `AdminSidebar` component
- `AdminTable<T>`, `AdminBadge`, `AdminMetricCard` reusable component library
- `requireRole('admin')` middleware for all admin endpoints
- `authFetch()` utility for admin API calls (auto-attaches JWT Bearer token)
- Content moderation dashboard — approve/reject news and reels, batch actions (up to 100), content age/sport filters
- `GET /api/admin/moderation/pending`, `PATCH /api/admin/content/:type/:id/approve|reject`, `POST /api/admin/content/batch`
- Content reports dashboard — filter by status/type, update report status
- `GET /api/admin/reports`, `PATCH /api/admin/reports/:id`

#### S3: Overview KPIs
- Admin overview page with KPI cards (users, content, pending, reports), Recharts PieChart for subscription breakdown
- System alert banners with severity levels and actionable links
- `GET /api/admin/overview` endpoint with 5-min cache and subscription tier breakdown
- Activity chart — `GET /api/admin/analytics/activity-chart` (30-day daily active users)

#### S4: Analytics Snapshots
- `AnalyticsSnapshot` Prisma model for daily metric aggregation (11 metric types)
- `compute-analytics` cron job (02:00 UTC) computing DAU, MAU, D1/D7 retention, sport activity, subscription breakdown, parental activation rate, consent rate, quiz engagement, missions completed/claimed
- Analytics dashboard with Recharts AreaChart (DAU/MAU trend), BarChart (retention), PolarArea (sport activity), PieChart (subscription breakdown)
- `GET /api/admin/analytics/snapshot?from&to&metrics`, `GET /api/admin/analytics/top-content?from&to&limit`

#### S5: Operations & Jobs
- `JobRun` Prisma model tracking execution history for all 11 cron jobs (status, duration, triggeredBy, error)
- `JobRunner` service wrapping all cron jobs with pre/post hooks writing JobRun records
- Manual job trigger with async execution (202 Accepted) and status polling
- Jobs dashboard showing real-time status, last run, duration, history (up to 50 entries per job)
- `GET /api/admin/jobs`, `POST /api/admin/jobs/:name/trigger`, `GET /api/admin/jobs/:name/history`
- RSS sources management — list, approve/reject sources
- `GET /api/admin/sources`, `PATCH /api/admin/sources/:id/status`

#### S6: Users & Organizations
- Users list with paginated table, search (debounced 300ms), role and tier filters
- User detail page — full profile, parental profile (with `scheduleLocked` computed field), recent activity, stats
- Change Tier modal (with RevenueCat warning), Change Role modal (with admin access warning), Revoke Sessions
- `GET /api/admin/users`, `GET /api/admin/users/:id` (explicit Prisma select, no passwordHash leak)
- `PATCH /api/admin/users/:id/tier`, `PATCH /api/admin/users/:id/role` (403 on self-change)
- `POST /api/admin/users/:id/revoke-tokens` — deletes all RefreshTokens for a user
- Organizations list with member count, search filter
- Organization detail page — Recharts AreaChart (30-day activity), members table, invite code with copy button
- `GET /api/admin/organizations`, `GET /api/admin/organizations/:id`, `PATCH /api/admin/organizations/:id`
- `POST /api/admin/organizations/:id/regenerate-code` (admin-scoped, separate from org-owner endpoint)

### Fixed
- `UserProvider` redirect bug — anonymous users were incorrectly redirected away from `/login` and `/register`
- `User.role` type in shared package extended to include `'admin'` (was limited to `'child' | 'parent'`)
- `AdminTable<T>` generic constraint relaxed from `Record<string, unknown>` to `object` for proper type inference
- Import paths for `auth/callback` and `organizations` pages corrected to use `@/` aliases after route group migration

### Added
- Groq AI provider integration with free tier support (14,400 req/day)
- Gemini AI provider support for content generation
- Circuit breakers per AI purpose (moderation vs generation) with provider fallback
- "Explicar Fácil" (Explain it Easy) button on mobile NewsCard with age-adapted summary panel
- Dynamic sport-specific entity selection during onboarding (shows relevant clubs/athletes/teams per sport)
- SPORT_ENTITIES catalog with 300+ teams, athletes, and personalities across 8 sports

### Changed
- Quiz generation now uses round-robin sport selection for daily variety
- Summary generation moved from background pre-generation to on-demand only
- AI client error handling improved with non-retryable error detection and better retry logging
- Age-adapted summaries component refined for improved readability

### Added — Phase 6: Post-Launch Growth

#### 6.1 Subscription Monetization
- Free/premium two-tier subscription model with server-side limit enforcement (`subscriptionGuard` middleware)
- Free tier: 5 news/day, 5 reels/day, 3 quiz/day, 1 sport; Premium: unlimited
- `resolveEffectiveTier()` checks org membership → individual subscription → parent family plan
- RevenueCat webhook processing (`POST /api/subscription/webhook`) with timing-safe secret validation
- Family plan: parent premium propagates to up to 3 children (oldest by creation date)
- `GET /api/subscription/status/:userId` with ownership/parent IDOR check
- Mobile Upgrade screen (role-aware: parent/child/anonymous/premium views)
- Mobile `LimitReachedModal` with per-type messages (news, reels, quiz, sport)
- Web `/upgrade` page with feature comparison and app store links (env-configurable)
- Web `LimitReached` component with subscription limit types and upgrade CTA
- Subscription guard caps query `limit` to remaining daily allowance for free users
- 35+ i18n keys (`subscription.*`) in ES and EN

#### 6.2 Real-Time Match Notifications
- `LiveMatch` model for tracking live match state with event deduplication via `notifiedEvents` JSON
- Live scores cron job (every 5 min) polling TheSportsDB v2 for Soccer and Basketball
- Event detection: goals, match start/end, half time, red cards via state diffing
- Targeted push notifications by `favoriteTeam` with per-locale payload building
- Per-event opt-in preferences (`LiveScorePreferences`) stored in `pushPreferences.liveScores`
- Parental schedule lock respected for live notifications (batch profile fetch)
- `GET /api/teams/:teamName/live` endpoint (cached 60s, min 3-char validation)
- `PUT /api/users/:id/notifications/live-scores` with Zod strict schema
- Live match banner on web team page and mobile FavoriteTeam screen (auto-refresh 60s)
- Web NotificationSettings extended with live score per-event toggles
- Schedule check extracted to reusable `schedule-check.ts` utility
- 25+ i18n keys (`push.live_*`, `live_scores.*`, `live_notifications.*`) in ES and EN

#### 6.3 B2B Channel: Clubs & Academies
- `Organization` model with invite codes (6-char, crypto-secure, excludes ambiguous chars)
- Org creation restricted to parents, atomic via `prisma.$transaction()`
- Join organization flow with atomic capacity check via `prisma.$transaction()`
- `requireOrgAdmin` middleware for org-scoped admin authorization
- 8 organization REST endpoints (CRUD, join, members, activity, leave, regenerate-code)
- Activity aggregation via `prisma.activityLog.groupBy` (no unbounded memory load)
- Org membership grants premium access (checked first in `resolveEffectiveTier`)
- Slug generation with diacritic handling and collision avoidance; stable on name updates
- Web organization admin dashboard (activity summary, CSS bar chart, member list, settings)
- Web `JoinOrgModal` and `OrgSettings` with Escape key + auto-focus accessibility
- Mobile `JoinOrganization` screen with 6-char code input, auto-advance, haptic feedback
- 35+ i18n keys (`org.*`, `a11y.org_*`) in ES and EN

#### Bug fixes and improvements
- Removed age filter from news FiltersBar (unused, added UI noise)
- `buttons.load_more` i18n key made generic ("Cargar más" / "Load more")
- Reels page shows `LimitReached` paywall when free tier limit hit
- HomeFeed hides news cards when parental/subscription block is active
- ParentalPanel shows error banner when save fails (instead of silent swallow)
- `invite-code.ts` uses `crypto.randomInt()` for secure code generation
- `subscription-guard.ts` prefers JWT userId over query/header (IDOR prevention)
- `subscription/status` endpoint validates caller is owner or parent
- `live-scores.ts` uses `String.replaceAll()` for notification templates
- Web modals (`OrgSettings`, `JoinOrgModal`) support Escape key dismissal
- `OrgSettings` imports `COLORS` from shared instead of hardcoded hex values
- `quizQuestionsPerSession` renamed to `quizPerDay` for consistency

### Added
- Asset generation script (`generate-assets.mjs`) — produces 5 PNG assets (icon, adaptive-icon, splash-icon, favicon, feature-graphic) via sharp SVG overlay with self-validation
- Dynamic `API_BASE` resolution — fallback chain: env var → EAS channel → debugger host → localhost; exported `resolveApiBase()` for testability
- Multi-stage production Dockerfile for API — deps/builder/runner stages, non-root user, OpenSSL for Prisma, PORT 8080
- Fly.io deployment configuration (`fly.toml`) — Madrid region, health check, auto-stop/start, Prisma migrate as release command
- CI/CD deploy job in GitHub Actions — automated `fly deploy` on push to main with concurrency protection
- EAS Build & Submit config — channels (development/preview/production), env vars, autoIncrement, appVersionSource remote, submit placeholders
- Store account setup documentation in EN and ES (`docs/en/11-store-deployment.md`, `docs/es/11-despliegue-tiendas.md`)
- ASO metadata in EN and ES (`store-metadata/{en,es}.json`) — name, subtitle, description, keywords, category
- Splash screen integration with `expo-splash-screen` — `preventAutoHideAsync` before mount, `hideAsync` on root layout
- Mobile `.env.example` template for environment variables
- 9 unit tests for `resolveApiBase()` covering all fallback paths
- React Native Error Boundary — class component wrapping entire app, kid-friendly crash screen with restart button, Sentry reporting via dynamic import
- JWT tokens in `expo-secure-store` — encrypted storage (Keychain/Keystore) with AsyncStorage fallback and transparent migration on startup
- Centralized child-safe YouTube embed utilities in shared package (`buildYouTubeEmbedUrl`, `extractYouTubeVideoId`, `getYouTubePlayerVars`) with `sandbox` attribute on web iframes
- Fail-closed content moderation in production — AI failure leaves content as `pending` instead of auto-approving; override via `MODERATION_FAIL_OPEN` env var
- `GET /api/admin/moderation/pending` endpoint (requireAuth + requireRole admin) returning flat pending array with summary, pendingMinutes, oldestPendingMinutes
- Stale pending content detection in sync-feeds cron — warns when articles are pending > 30 minutes
- `authFetch()` wrapper in mobile API client — attaches JWT Authorization header to all requests with automatic token refresh on 401
- Interactive sport filter chips in mobile Parental Control "Contenido" section — toggles `allowedSports` on the parental profile
- i18n keys for crash screen (crash_title, crash_message, restart) in ES and EN
- `crash` entry in `KID_FRIENDLY_ERRORS` constants

### Changed
- `apps/mobile/src/config.ts` replaced hardcoded local IP with environment-aware `resolveApiBase()` function
- `apps/mobile/app.json` updated with icon, splash, adaptiveIcon, and favicon asset references
- `apps/mobile/eas.json` restructured with channels, env vars, autoIncrement, and submit placeholders
- `.gitignore` extended with mobile `.env` and `google-service-account.json` exclusions
- Mobile API client uses `authFetch()` instead of bare `fetch()` for all API calls
- Web VideoPlayer sets `allowFullScreen={false}` on all iframes (not just YouTube)
- Mobile VideoPlayer uses centralized `getYouTubePlayerVars()` from shared package
- Content moderator returns `'pending'` status type in `ModerationResult`
- `requireRole()` middleware accepts `'admin'` role
- ErrorBoundary uses `COLORS` constants from shared package instead of hardcoded hex values

### Fixed
- Mobile app 401 errors after registration — JWT tokens were stored but never sent in API requests
- Parental Control sport chips were read-only `<View>` elements reading `user.favoriteSports` instead of interactive `<TouchableOpacity>` toggling `profile.allowedSports`
- Admin moderation endpoint used non-existent `content` field in Prisma select — changed to `summary`
- YouTube embed `disablekb` parameter was set to `0` (enabled) instead of `1` (disabled)

- Age gate screen (web + mobile) with three paths: adult (18+), teen (13-17), child (<13 with parental consent + mandatory PIN)
- Privacy Policy page (`/privacy`) with full COPPA/GDPR-K compliant draft in Spanish and English
- Terms of Service page (`/terms`) with i18n support (ES/EN)
- `DELETE /api/users/:id/data` endpoint for GDPR Art. 17 right to erasure — hard deletes all user data in a single transaction
- Account deletion UI in Parental Controls (web + mobile) with confirmation dialog
- Parental consent fields on User model: `ageGateCompleted`, `consentGiven`, `consentDate`, `consentBy`
- Analytics consent gating: PostHog and Sentry disabled until parental consent is given
- Schedule lock guard on mobile — all content tabs show a friendly bedtime screen when outside allowed hours
- Legal links (Privacy Policy / Terms of Service) in login, register, onboarding, and parental control screens (web + mobile)
- `WEB_BASE` configurable constant in mobile config for legal page URLs
- `LegalReviewBanner` shared component for highlighting sections needing legal review
- i18n keys for age gate, legal pages, and account deletion in ES and EN

### Changed
- Onboarding wizard now creates users with consent fields set (web + mobile)
- `initAnalytics()` on web requires explicit consent to initialize PostHog
- API `trackEvent()` checks user consent before sending PostHog events
- Delete endpoint accepts parental session as alternative to JWT for anonymous users
- Delete transaction nullifies `parentUserId` on children before deleting a parent account
- Legal links use Next.js `<Link>` components instead of `<a>` tags
- Mobile legal page links use configurable `WEB_BASE` instead of hardcoded localhost
