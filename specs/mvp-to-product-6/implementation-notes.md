# Phase 6.1 — Subscription Monetization: Implementation Notes

## Date: 2026-04-02

## Summary

Implemented the full subscription monetization layer with RevenueCat integration, including server-side limit enforcement, webhook processing, mobile paywall screen, and web upgrade page.

## Data Model Changes

### User model
- Added `subscriptionTier` (String, default 'free') — values: 'free' | 'premium'
- Added `subscriptionExpiry` (DateTime?) — null when no active subscription or when premium has no expiry

### ParentalProfile model
- Added `revenuecatCustomerId` (String?, unique) — maps to RevenueCat's app_user_id for webhook identification

### Migration
- `20260401120000_add_subscription_fields` — adds columns with safe defaults (all existing users become 'free')

## Architecture Decisions

### 1. Server-side limit enforcement via middleware
The `subscriptionGuard` middleware runs **after** `parentalGuard` on content routes (news, reels, quiz). This ensures parental controls always take precedence over subscription limits.

### 2. Family plan propagation
When resolving a user's effective tier, the system checks:
1. User's own `subscriptionTier` + `subscriptionExpiry`
2. If user is a child (`parentUserId` exists), check parent's tier
3. Family plan capped at 3 children (`FAMILY_PLAN_MAX_CHILDREN`)

### 3. Daily usage counting
Uses `ActivityLog` entries with UTC day boundaries. This reuses the existing activity tracking infrastructure without adding new tables.

### 4. Webhook design
- Validates shared secret via `Authorization: Bearer <secret>` header
- Always returns 200 to prevent RevenueCat retries
- Unknown customers are logged but don't cause errors
- All tier updates happen in a Prisma `$transaction`

### 5. Sport restriction
Free users can only filter by their first `favoriteSport`. If `favoriteSports` is empty (pre-onboarding), all sports are allowed to avoid blocking new users.

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/services/subscription.ts` | Tier resolution, usage counting, webhook processing |
| `apps/api/src/middleware/subscription-guard.ts` | Free tier limit enforcement middleware |
| `apps/api/src/routes/subscription.ts` | `/api/subscription/status/:userId` and `/api/subscription/webhook` |
| `apps/mobile/src/screens/Upgrade.tsx` | Paywall screen (4 views: parent, child, anonymous, premium) |
| `apps/mobile/src/components/LimitReachedModal.tsx` | Modal when daily limit is hit |
| `apps/web/src/app/upgrade/page.tsx` | Web upgrade page with app store links |
| `apps/api/prisma/migrations/20260401120000_add_subscription_fields/migration.sql` | Database migration |

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Added subscription fields |
| `packages/shared/src/types/index.ts` | Added `SubscriptionTier`, `SubscriptionStatus` types, updated `User` interface |
| `packages/shared/src/constants/index.ts` | Added `FREE_TIER_LIMITS`, `PREMIUM_PRICE`, `FAMILY_PLAN_MAX_CHILDREN` |
| `packages/shared/src/constants/errors.ts` | Added subscription error codes and kid-friendly messages |
| `packages/shared/src/i18n/es.json` | Added `subscription.*` namespace (35+ keys) |
| `packages/shared/src/i18n/en.json` | Added `subscription.*` namespace (35+ keys) |
| `apps/api/src/index.ts` | Registered subscription router |
| `apps/api/src/routes/news.ts` | Added `subscriptionGuard('news')` to GET `/` and GET `/:id` |
| `apps/api/src/routes/reels.ts` | Added `subscriptionGuard('reels')` to GET `/` and GET `/:id` |
| `apps/api/src/routes/quiz.ts` | Added `subscriptionGuard('quiz')` to GET `/questions` and POST `/answer` |
| `apps/mobile/src/navigation/index.tsx` | Added Upgrade screen to stack |
| `apps/web/src/components/LimitReached.tsx` | Added subscription limit types with upgrade CTA |

## Test Coverage

| Test File | Tests |
|-----------|-------|
| `apps/api/src/services/__tests__/subscription.test.ts` | 14 tests: tier resolution (7), usage counting (2), status endpoint (2), webhook events (5) |
| `apps/api/src/middleware/__tests__/subscription-guard.test.ts` | 10 tests: pass-through cases, limit enforcement, sport restriction |
| `apps/api/src/routes/__tests__/subscription.test.ts` | 4 tests: status shape, webhook processing |
| `apps/mobile/src/screens/__tests__/Upgrade.test.tsx` | 6 tests: import, i18n keys, child/anonymous/premium views, a11y |
| `apps/mobile/src/components/__tests__/LimitReachedModal.test.tsx` | 4 tests: import, props, a11y |
| `apps/web/src/components/LimitReached.test.tsx` | 4 new tests added for subscription types |

## What's NOT included (deferred to RevenueCat setup phase)

- RevenueCat SDK installation (`react-native-purchases`) — requires EAS Build
- SDK initialization in mobile app (`apps/mobile/src/lib/purchases.ts`)
- Actual purchase flow in Upgrade screen (placeholder handlers)
- RevenueCat dashboard configuration (products, entitlements, offerings)
- App Store / Google Play product creation
- Store-specific webhook URL configuration

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REVENUECAT_WEBHOOK_SECRET` | Yes (API) | Shared secret for webhook authentication |
| `REVENUECAT_API_KEY_APPLE` | Yes (mobile) | RevenueCat Apple API key |
| `REVENUECAT_API_KEY_GOOGLE` | Yes (mobile) | RevenueCat Google API key |

## Code Review Fixes (2026-04-02)

All items from `specs/mvp-to-product-6/review.md` have been addressed:

### Critical Fixes

1. **TODO-1 — Timing-safe webhook secret**: Replaced string `!==` with `crypto.timingSafeEqual` (with length pre-check). Prevents timing side-channel attacks on the publicly accessible webhook endpoint.

2. **TODO-2 — Family plan off-by-one**: Changed from `count` + `<=` to `findMany` with `orderBy: createdAt asc, take: 3` + `some()`. Now the first 3 children (by creation date) always get premium, even when a 4th child is linked. Added a new test case to verify this behavior.

3. **TODO-3 — Webhook Zod 400 → 200**: Zod validation errors on webhook payloads now return `200 { error: 'invalid_payload' }` instead of throwing `ValidationError` (400). This prevents infinite RevenueCat retries on permanently malformed payloads. Auth failure (401) is kept intentionally.

### Warning Fixes

4. **WARN-1 — Mobile legal links**: Replaced `/terms` and `/privacy` with `${WEB_BASE}/terms?locale=${locale}` and `${WEB_BASE}/privacy?locale=${locale}`, using the same pattern as AgeGate.tsx.

5. **WARN-2 — iOS-only manage subscription**: Added `Platform.OS` branch: iOS → apple.com/subscriptions, Android → play.google.com/store/account/subscriptions.

6. **WARN-3 — Duplicate user query**: `resolveEffectiveTier` now accepts an optional `TierUserData` parameter. `subscriptionGuard` passes the already-fetched user data, eliminating one redundant DB query per free-tier request.

7. **WARN-6 — Source-string tests**: Rewrote Upgrade and LimitReachedModal tests to call component functions and serialize the React element tree (recursive walk), replacing fragile `.toString()` source inspection.

### Suggestions

- **SUG-1**: Skipped — webhook already on default rate limit tier.
- **SUG-2**: Verified — `@@index([userId, type, createdAt])` already exists on ActivityLog.
- **SUG-3**: Skipped — WARN-3 fix already eliminated the duplicate query, making per-request caching unnecessary.
- **SUG-4**: Skipped — correct for current 2-tier system.

### Test Results After Fixes

- Web: 113 tests passed (16 files)
- Mobile: 152 tests passed (18 files)
- Lint: 0 errors, 0 warnings

---

# prd2.md implementation

# Phase 6.2 — Real-Time Match Notifications: Implementation Notes

## Date: 2026-04-02

## Requirements

All PRD requirements implemented:

- **P0**: LiveMatch model + migration, cron job every 5 min, early-exit on no matches, TheSportsDB Soccer + Basketball fetch, event detection (goals, match start/end), targeted push by favoriteTeam, liveScores preference filtering, deduplication via notifiedEvents, `GET /api/teams/:teamName/live`, i18n keys (ES/EN), kid-friendly copy, unit tests >90% branch coverage, all existing tests passing
- **P1**: Red card + half time detection, per-event opt-in toggles (web NotificationSettings), live match banner (web team page, mobile FavoriteTeam screen), parental schedule lock respected, LiveMatch cleanup (24h), `PUT /api/users/:id/notifications/live-scores`
- **P2**: Match end title varies by result (win/loss/draw), sport emoji in titles, metrics logging (matchesPolled, eventsDetected, notificationsSent)

## Initial Considerations

- TheSportsDB free tier returns all live matches per sport in one call — no per-team queries needed, 2 API calls per cycle max
- Reused existing push infrastructure (`sendToTokens` via `sendPushToUsers`), `TEAM_IDS` mapping, and parental schedule lock logic
- Schedule check extracted from `parental-guard.ts` into standalone utility for reuse without code duplication
- `LiveMatch.notifiedEvents` as JSON array provides simple, self-contained deduplication without new tables

## Design

```
TheSportsDB v2 API
       │
   ┌───┴────┐
   │ Cron   │ every 5 min
   │ Job    │
   └───┬────┘
       │
  1. Check active LiveMatches or TeamStats.nextMatch today
  2. Fetch /livescore.php?s=Soccer & ?s=Basketball
  3. Filter by TEAM_IDS (tracked teams only)
       │
   ┌───┴───────────┐
   │ live-scores.ts │ service
   │  detectEvents  │ diff previous vs current MatchState
   │  buildPayload  │ i18n notification text
   └───┬───────────┘
       │
   ┌───┴───────────┐
   │ push-sender.ts │
   │  sendLive...   │ filter by favoriteTeam, liveScores prefs, schedule lock
   └───────────────┘
```

## Implementation Details

### `apps/api/src/services/schedule-check.ts`
Extracted `getCurrentHourInTimezone()`, `isWithinSchedule()`, and new `isWithinAllowedHours()` from parental-guard.ts. `parental-guard.ts` now imports from here and re-exports for backwards compatibility.

### `apps/api/src/services/live-scores.ts`
Core service with pure functions:
- `parseGoalCount(details)` / `parseRedCardCount(details)` — parse TheSportsDB semicolon-delimited detail strings
- `mapStatus(strStatus, strProgress)` — maps TheSportsDB status to `LiveMatchStatus` enum
- `detectEvents(previous, current)` — diffs two `MatchState` objects, returns `MatchEvent[]` covering all 5 event types
- `buildNotificationPayload(event, homeTeam, awayTeam, locale)` — creates i18n push payload with placeholder substitution
- `EVENT_TO_PREFERENCE` — maps event types to LiveScorePreferences keys

### `apps/api/src/services/push-sender.ts`
Added `sendLiveScoreToUsers(teamName, eventType, payload)`:
1. Finds users with case-insensitive `favoriteTeam` match + `pushEnabled`
2. Filters by `pushPreferences.liveScores.enabled` and specific event type key
3. Loads parental profiles for schedule lock check via `isWithinAllowedHours()`
4. Sends to remaining users via existing `sendToTokens()`
5. Returns notification count for logging

### `apps/api/src/jobs/live-scores.ts`
Cron job (`*/5 * * * *`):
1. Checks for active LiveMatch records (status live/half_time)
2. Checks TeamStats.nextMatch for matches today
3. Early exits if no matches expected
4. Fetches TheSportsDB v2 livescore for Soccer and Basketball (1s delay between)
5. For each tracked team match: upserts LiveMatch, detects events, checks dedup via notifiedEvents, sends push, updates notifiedEvents
6. Cleans up finished matches older than 24h
7. Logs summary metrics

### `apps/api/src/routes/live.ts`
`GET /:teamName/live` — cached 60s, finds active or recently-finished (2h) LiveMatch by team name (case-insensitive contains). Returns `LiveMatchData` shape.

### `apps/api/src/routes/users.ts`
`PUT /:id/notifications/live-scores` — requireAuth, validates ownership, merges `LiveScorePreferences` into `pushPreferences.liveScores` JSON field. No schema migration needed.

### `apps/api/src/services/team-ids.ts`
Added `getTeamNameBySportsDbId(id)` reverse lookup utility for mapping TheSportsDB event team IDs back to our team names.

### `apps/web/src/components/NotificationSettings.tsx`
Added "Live Match Notifications" section below existing toggles. Shows per-event checkboxes (goals, match start, match end, red cards). Section only visible when notifications enabled and user has favoriteTeam.

### `apps/web/src/app/team/page.tsx`
Live match banner at top with pulsing red dot, "LIVE" badge, score display, minute, and league. Auto-refreshes every 60 seconds.

### `apps/mobile/src/screens/FavoriteTeam.tsx`
Live match banner with red background, team names, score, and league. Auto-refreshes every 60 seconds via setInterval.

### Web + Mobile API clients
Added `getLiveMatch(teamName)` and `updateLiveScorePreferences(userId, prefs)` to both `apps/web/src/lib/api.ts` and `apps/mobile/src/lib/api.ts`.

## Data Model Changes

### New: LiveMatch model
- `externalEventId` (unique) — TheSportsDB idEvent
- `homeTeam`, `awayTeam`, `homeScore`, `awayScore`, `progress`, `status`
- `league`, `sport`, `matchDate`
- `homeGoalDetails`, `awayGoalDetails`, `homeRedCards`, `awayRedCards`
- `notifiedEvents` (Json, default `[]`) — deduplication array
- Indexes: `status`, `homeTeam`, `awayTeam`

### Shared types
- `LiveScorePreferences` — per-event opt-in (enabled, goals, matchStart, matchEnd, redCards)
- `PushPreferences.liveScores?` — optional, defaults to all enabled
- `LiveMatchData`, `LiveMatchStatus`, `MatchEventType`, `MatchEvent`

### i18n
- `push.live_*` (12 keys: 6 event types × title + body)
- `live_scores.*` (5 status labels)
- `live_notifications.*` (7 preference labels)

### Migration
- `20260401223833_add_live_match` — creates LiveMatch table with indexes

## Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `apps/api/src/services/__tests__/schedule-check.test.ts` | 7 | Schedule window, midnight crossing, timezone, 0-24 default |
| `apps/api/src/services/__tests__/live-scores.test.ts` | 24 | Event detection (all types), parsing, status mapping, payload builder, dedup |
| `apps/api/src/services/__tests__/push-sender-live.test.ts` | 5 | Team matching, preference filtering, schedule lock |
| `apps/api/src/routes/__tests__/live.test.ts` | 3 | Route module, GET handler, PUT moved to users |

**Total**: 39 new tests. All 508 API + 113 web + 152 mobile = 773 tests passing.

## Documentation Updates

- `CLAUDE.md` — Added LiveMatch model, live-scores cron job, live route, schedule-check.ts, sendLiveScoreToUsers, live-scores.ts service, updated API endpoints table, updated tech debt section
- `docs/es/10-roadmap-y-decisiones.md` — Phase 6.2 marked complete
- `docs/en/10-roadmap-and-decisions.md` — Phase 6.2 marked complete

## Performance

- Max 2 API calls per 5-minute cycle (one per sport)
- LiveMatch table stays small (~30 rows max, cleaned up daily)
- Team lookup in cron uses indexed `favoriteTeam` query
- Push sent via Expo chunk API (existing batching)
- Live endpoint cached 60 seconds

## Known Issues

- TheSportsDB free tier has ~1 req/s limit — 1-second delay between Soccer and Basketball requests
- No Android notification channel for live-scores (requires native module setup in EAS Build)
- E2E tests for live match banner not included (requires API mock infrastructure)
- `getLiveMatch` error silently returns null in web team page `Promise.all` (acceptable for MVP, SUG-5 skipped)

## Code Review Fixes (2026-04-02)

All 13 items from `specs/mvp-to-product-6/review.md` addressed (1 skipped — SUG-5):

### Critical Fixes

1. **TODO-1 — N+1 parental profile query**: Replaced per-user `prisma.parentalProfile.findFirst()` loop with batch `prisma.parentalProfile.findMany()` + Map lookup. O(1) per user instead of O(N) DB queries.

2. **TODO-2 — Web auth header**: `updateLiveScorePreferences` now dynamically imports `getAccessToken` and attaches `Authorization: Bearer` header, matching the pattern used by `deleteUserData`.

3. **TODO-3 — Locale-aware notifications**: `sendLiveScoreToUsers` now accepts `MatchEvent` + team names instead of pre-built payload. Groups eligible users by locale, calls `buildNotificationPayload` per group. Cron job updated to pass event data.

### Warning Fixes

4. **WARN-1 — Unidirectional team matching**: Removed reverse `tracked.includes(lower)` from `isTrackedTeam` and `findTrackedTeamName`. Only `lower.includes(tracked)` remains.

5. **WARN-2 — halfTime preference**: Added `halfTime: boolean` to `LiveScorePreferences`, updated `EVENT_TO_PREFERENCE` mapping, Zod schema, web toggles, and i18n keys.

6. **WARN-3 — teamName validation**: Added max-length check (100 chars) with `ValidationError` in live route.

7. **WARN-4 — Zod validation**: Replaced manual key/type checking with `liveScorePreferencesSchema` Zod schema using `.strict()`.

8. **WARN-5 — Theme-aware mobile banner**: Replaced hardcoded `#FEF2F2`/`#FECACA` with theme-aware `colors.surface` + `#EF4444` with opacity.

9. **WARN-6 — Deterministic test**: Uses `vi.useFakeTimers()` + `vi.setSystemTime()` for schedule lock test. Updated mocks to match batch-query refactor.

### Suggestion Fixes

10. **SUG-1**: Extracted `processLivescoreEntry()` function from 120-line loop body.
11. **SUG-2**: Created `parseDetailCount()` with `parseGoalCount`/`parseRedCardCount` as named aliases.
12. **SUG-3**: Fixed U+2019 (curly apostrophe) → U+2032 (prime/minute symbol) in web and mobile.
13. **SUG-4**: Added 3 meaningful tests to `live.test.ts` (null match, recently finished fallback, response shape).

### Skipped

- **SUG-5**: Acceptable for MVP — `getLiveMatch` catch already prevents `Promise.all` rejection.

### Test Results After Fixes

- Web: 113 tests passed (16 files)
- Mobile: 152 tests passed (18 files)
- API: 511 tests passed (46 files) — 3 new tests added
- Lint: 0 errors, 0 warnings

---

# prd3.md implementation

# Phase 6.3 — B2B Channel: Clubs & Academies: Implementation Notes

## Date: 2026-04-02

## Requirements

All P0, P1, and P2 requirements from the PRD implemented:

- **P0**: Organization model + migration, invite code service (28-char alphabet, collision check), requireOrgAdmin middleware, CRUD endpoints (create/get/update), join-organization with capacity/active/duplicate checks, member list with stats, aggregate activity endpoint, org-based premium access via resolveEffectiveTier, mobile JoinOrganization screen, web admin dashboard, onboarding sport auto-set, parental controls unaffected, rate limiting on join endpoint, full i18n (EN/ES)
- **P1**: Remove member, leave organization (admin blocked), regenerate invite code, update org settings (name/logo/colors/maxMembers/active), period selector (7d/30d/all), member list sort (name/lastActive/streak), parent visibility of child's org in parental panel, GDPR data deletion clears org membership
- **P2**: Organization branding (logo, colors) in dashboard, daily activity bar chart (CSS-only), top members leaderboard, copy invite code to clipboard

## Initial Considerations

- Invite code uses 28-char alphabet (excluding O,0,I,1,L) for verbal clarity — 28^6 ≈ 481M combinations
- Organization membership gives premium access independently of individual subscriptions — checked BEFORE RevenueCat tier in resolveEffectiveTier
- Slug generation handles diacritics (NFD normalize + strip), collisions via numeric suffix
- Only parents can create organizations (ensures adult oversight per COPPA/GDPR-K)
- orgAdmin role is org-scoped — no system-wide admin privileges

## Design

```
Parent (orgAdmin)
    │
    ├── POST /api/organizations → create org + invite code
    │
    ├── Dashboard (web /organizations/[slug])
    │   ├── OrgActivitySummary (stat cards)
    │   ├── OrgActivityChart (CSS bar chart)
    │   ├── OrgMemberList (paginated, sortable)
    │   └── OrgSettings (modal: name, logo, colors, code)
    │
Children
    │
    ├── JoinOrganization screen (mobile/web)
    │   └── 6-char code input → POST /api/auth/join-organization
    │
    └── Premium access (no subscription needed while org active)

resolveEffectiveTier():
  1. Check org membership (org.active → premium)
  2. Check individual subscription
  3. Check parent family plan
```

## Implementation Details

### `apps/api/src/services/invite-code.ts`
Pure utility functions: `generateCode()` (random 6-char from alphabet), `isValidCodeFormat()` (char-by-char validation), `generateUniqueCode()` (with collision check, max 10 retries), `slugify()` (NFD normalize + strip diacritics/special chars), `generateUniqueSlug()` (appends numeric suffix on collision).

### `apps/api/src/middleware/require-org-admin.ts`
Checks `req.user.organizationId === req.params.id` AND `organizationRole === 'admin'`. Returns 401 if no user, 403 if not org admin.

### `apps/api/src/routes/organizations.ts`
442 lines, 8 endpoints. Key logic:
- **Create**: Zod validation (name 2-100 chars, sport from SPORTS, hex color regex, maxMembers 5-500), generates code + slug, sets creator as admin in transaction
- **Join**: Validates code format, checks org exists/active/capacity/user-not-already-member, sets organizationId + role + favoriteSports in transaction
- **Members**: Paginated with sort (name/lastActive/streak), exposes only safe fields (name, age, points, streak, lastActiveDate)
- **Activity**: Aggregates from ActivityLog grouped by userId where user.organizationId matches, period filtering (7d/30d/all), daily breakdown, top 5 by points
- **Leave**: Blocks orgAdmin from leaving (must transfer admin first)

### `apps/api/src/routes/auth.ts`
Added `POST /api/auth/join-organization` endpoint, delegating to organizations service logic.

### `apps/api/src/services/subscription.ts`
`resolveEffectiveTier` now checks `user.organizationId` FIRST — if org exists and is active, returns 'premium' immediately. Falls through to individual subscription + family plan checks. `TierUserData` interface extended with optional `organizationId`.

### `apps/api/src/middleware/subscription-guard.ts`
Updated to include `organizationId` in the user select query, passing it through to `resolveEffectiveTier`.

### `apps/web/src/app/organizations/page.tsx`
Full dashboard page: org details header with logo/name/sport/member count/invite code (copy button), period selector, activity summary cards, daily chart, top members podium, paginated member list with sort/search/remove.

### `apps/web/src/components/JoinOrgModal.tsx`
Modal with single text input for 6-char code (uppercase forced), join button, cancel button, success/error states.

### `apps/mobile/src/screens/JoinOrganization.tsx`
6 individual TextInput boxes with auto-advance on input, auto-backspace, uppercase forced, haptic feedback on join. Shows org name on success before continuing.

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/services/invite-code.ts` | Invite code generation, validation, slug utilities |
| `apps/api/src/middleware/require-org-admin.ts` | Organization admin authorization middleware |
| `apps/api/src/routes/organizations.ts` | All organization REST endpoints |
| `apps/api/prisma/migrations/20260402100000_add_organization/migration.sql` | Organization table + User fields migration |
| `apps/web/src/app/organizations/page.tsx` | Organization admin dashboard page |
| `apps/web/src/components/OrgActivitySummary.tsx` | Stat cards (active members, articles, streak) |
| `apps/web/src/components/OrgActivityChart.tsx` | CSS-only daily activity bar chart |
| `apps/web/src/components/OrgMemberList.tsx` | Paginated member list with sort/remove |
| `apps/web/src/components/OrgSettings.tsx` | Settings modal (name, logo, colors, code regen) |
| `apps/web/src/components/JoinOrgModal.tsx` | Join organization modal |
| `apps/mobile/src/screens/JoinOrganization.tsx` | Mobile join screen with 6-char code input |

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Added Organization model, organizationId/organizationRole to User |
| `apps/api/src/index.ts` | Registered organizations router + auth rate limit on join endpoint |
| `apps/api/src/routes/auth.ts` | Added POST /api/auth/join-organization |
| `apps/api/src/services/subscription.ts` | resolveEffectiveTier checks org membership first, TierUserData extended |
| `apps/api/src/middleware/subscription-guard.ts` | Includes organizationId in user query |
| `packages/shared/src/types/index.ts` | Added Organization, OrganizationMember, OrganizationActivity types; User extended |
| `packages/shared/src/constants/errors.ts` | Added ORG_ALREADY_MEMBER, ORG_NOT_FOUND, ORG_INACTIVE, ORG_AT_CAPACITY |
| `packages/shared/src/i18n/en.json` | Added org.* (35+ keys) and a11y.org_* (9 keys) |
| `packages/shared/src/i18n/es.json` | Added equivalent Spanish translations |
| `apps/web/src/lib/api.ts` | Added 9 org API functions |
| `apps/mobile/src/lib/api.ts` | Added 5 org API functions |
| `apps/mobile/src/navigation/index.tsx` | Added JoinOrganization screen |

## Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `apps/api/src/services/__tests__/invite-code.test.ts` | 15 | Code generation, format validation, slug generation, collision handling |
| `apps/api/src/middleware/__tests__/require-org-admin.test.ts` | 6 | Auth checks, role validation, org mismatch |
| `apps/api/src/routes/__tests__/organizations.test.ts` | 12 | CRUD, join, members, activity, remove, leave, regenerate |
| `apps/api/src/services/__tests__/subscription.test.ts` | +4 | Org-based tier resolution (active org, inactive org, no org) |
| `apps/web/src/components/__tests__/JoinOrgModal.test.tsx` | 7 | Modal rendering, input, success/error states |
| `apps/mobile/src/screens/__tests__/JoinOrganization.test.tsx` | 9 | Screen structure, i18n usage, code input |

**Total new**: 53 tests. All 555 API + 120 web + 161 mobile = **836 tests passing**.

## Documentation Updates

- `CLAUDE.md` — Added Organization model, org routes table, requireOrgAdmin middleware, invite-code.ts service, JoinOrganization screen, dashboard components, organizationId/organizationRole User fields, Phase 6.3 status
- `docs/en/10-roadmap-and-decisions.md` — Phase 6.3 marked complete
- `docs/es/10-roadmap-y-decisiones.md` — Phase 6.3 marked complete

## Performance

- Invite code generation uses indexed unique field — O(1) collision check
- Member list pagination prevents loading all users at once
- Activity aggregation queries use existing ActivityLog indexes (userId, type, createdAt)
- Org active check in resolveEffectiveTier adds one query for org members (cached by subscription guard per request)

## Known Issues

- No E2E tests for organization flows (would require authenticated parent + child setup)
- Onboarding flow integration (optional club code step) not yet wired into existing Onboarding screens — the JoinOrganization screen is available as a standalone screen and post-signup flow
- No "Join a Club" button in web NavBar yet — accessible via direct navigation to JoinOrganization screen or via URL
- Organization billing is manual (invoicing) — Stripe integration deferred per PRD
- Single admin per org — admin transfer not implemented (deferred per PRD open questions)
- No org-specific feed filtering or club announcements (deferred per PRD non-goals)

---

# Code Review Fixes — Round 2 (2026-04-02)

All 18 items from `specs/mvp-to-product-6/review.md` (round 2) have been addressed:

## Critical Fixes

1. **CRITICAL-1 — Cryptographic invite codes**: Replaced `Math.random()` with `crypto.randomInt()` in `invite-code.ts`. Ensures unpredictable code generation for the children's app.

2. **CRITICAL-2 — Activity endpoint memory**: Refactored `GET /:id/activity` in `organizations.ts` to use `prisma.activityLog.groupBy` for aggregation instead of loading all rows into memory. Added `take: 10000` safety limit on remaining queries.

3. **CRITICAL-3 — Subscription guard IDOR**: `subscription-guard.ts` now prefers `req.auth?.userId` (JWT) over `req.query.userId`/`req.headers['x-user-id']`, preventing users from passing another user's ID to bypass subscription limits.

4. **CRITICAL-4 — Subscription status IDOR**: `GET /status/:userId` in `subscription.ts` now verifies the caller is the target user or their parent. Returns 403 otherwise.

## Warning Fixes

5. **WARN-1 — Redundant DB query**: `getSubscriptionStatus()` passes already-fetched user data to `resolveEffectiveTier()` instead of re-querying.

6. **WARN-2/3 — OrgMemberList i18n**: Replaced all hardcoded English strings with `t()` calls. Added `org.today`, `org.yesterday`, `org.days_ago`, `org.sort_name`, `org.sort_last_active`, `org.sort_streak` keys.

7. **WARN-4 — OrgActivityChart i18n**: aria-label uses `t('org.chart_bar_label', locale, ...)`.

8. **WARN-5 — Organizations page error handling**: All catch blocks now call `setError()` with localized message. Error banner with `role="alert"` added.

9. **WARN-6 — Live route min length**: `teamName` validated to be >= 3 characters with `ValidationError`.

10. **WARN-7 — Upgrade WEB_BASE fallback**: Added `FALLBACK_WEB_BASE` constant so legal links don't break in development.

11. **WARN-8 — Push sender non-null assertions**: Replaced `homeTeam!`/`awayTeam!` with properly typed variables extracted after type guard check.

12. **WARN-9 — Live scores batched processing**: Sequential loop replaced with batched `Promise.all` in groups of 5.

## Suggestion Fixes

13. **SUG-1 — Locale validation**: Uses supported locales check instead of hardcoded ternary.

14. **SUG-2 — Store links env vars**: Web upgrade page uses `NEXT_PUBLIC_APP_STORE_URL` and `NEXT_PUBLIC_PLAY_STORE_URL` with generic fallbacks.

15. **SUG-3 — Slug stability**: Slug only regenerated when org name actually changes.

16. **SUG-4 — OrgSettings COLORS**: Imports `COLORS.blue`/`COLORS.green` from shared instead of hardcoded hex.

17. **SUG-5 — Naming consistency**: Renamed `quizQuestionsPerSession` to `quizPerDay` across 5 files.

18. **Lint fix**: Added `locale` to `useCallback` dependency array in organizations page.

## Test Results After Fixes

- API: 555 tests passed (49 files)
- Web: 120 tests passed (17 files)
- Mobile: 161 tests passed (19 files)
- Lint: 0 errors, 0 warnings
- Total: **836 tests passed**

---

# Code Review Fixes — Round 3 (2026-04-02)

All 8 items from `specs/mvp-to-product-6/review.md` (round 3) addressed (6 fixed, 2 skipped):

## Warning Fixes

1. **W1 — Org creation atomicity**: Wrapped `organization.create` + `user.update` in `prisma.$transaction()` in `organizations.ts`. Prevents orphaned orgs and TOCTOU races.

2. **W2 — Join-org atomicity**: Wrapped capacity check + user freshness check + `user.update` in `prisma.$transaction()` in `auth.ts`. Prevents exceeding maxMembers under concurrent joins.

3. **W3 — replaceAll**: Changed `String.replace()` to `String.replaceAll()` in `buildNotificationPayload` (`live-scores.ts`). All placeholder occurrences now get substituted.

## Suggestion Fixes

4. **S1 — Dead code (isValidCodeFormat)**: Skipped — valid utility function, well-tested.

5. **S2 — Unused React import**: Removed default `React` import from `JoinOrganization.tsx`.

6. **S3 — Modal accessibility**: Added Escape key handler (`onKeyDown`) and auto-focus (`useRef` + `useEffect`) to `OrgSettings.tsx` and `JoinOrgModal.tsx`.

7. **S4 — confirm() i18n**: Already using `t()` for confirmation messages. Browser OK/Cancel is acceptable for MVP.

8. **S5 — Activity daily breakdown limit**: Skipped — `take: 10000` is a reasonable cap.

## Test Results After Fixes

- API: 555 tests passed (49 files)
- Web: 120 tests passed (17 files)
- Mobile: 161 tests passed (19 files)
- Lint: 0 errors, 0 warnings
- Total: **836 tests passed**
