# Phase 6.1 — Subscription Monetization: Validation Checklist

## Date: 2026-04-02

## Automated Tests

- [x] `npm run test:web` — 113 tests passed (16 files)
- [x] `npm run test:mobile` — 149 tests passed (18 files)
- [x] API subscription tests — 34 tests passed (3 files)
- [x] `npm run lint` — 0 errors, 0 warnings

## Data Model (AC-1)

- [x] `subscriptionTier` field exists on User model with default `'free'`
- [x] `subscriptionExpiry` field exists on User model as nullable DateTime
- [x] `revenuecatCustomerId` field exists on ParentalProfile with unique constraint
- [x] Migration SQL created (`20260401120000_add_subscription_fields`)
- [x] Migration is additive-only (safe for existing data)

## Subscription Status Endpoint (AC-2)

- [x] `GET /api/subscription/status/:userId` returns correct tier, limits, and usage
- [x] Children inherit premium status from parent via `parentUserId`
- [x] Usage counts use UTC day boundaries
- [x] Expired subscriptions treated as free tier
- [x] Requires authentication (`requireAuth` middleware)

## Webhook (AC-3)

- [x] `POST /api/subscription/webhook` validates shared secret in Authorization header
- [x] Returns 401 for invalid/missing secret
- [x] `INITIAL_PURCHASE` sets parent + children to premium
- [x] `EXPIRATION` reverts parent + children to free
- [x] `RENEWAL` updates subscriptionExpiry
- [x] `CANCELLATION` does NOT immediately revoke (waits for expiry)
- [x] `BILLING_ISSUE` logs warning, keeps premium
- [x] Unknown customer returns 200 (no retry)
- [x] All updates in Prisma transaction

## Free Tier Limits (AC-4)

- [x] Free users limited to 5 news reads/day
- [x] Free users limited to 5 reel views/day
- [x] Free users limited to 3 quiz questions/session
- [x] Free users restricted to first `favoriteSport`
- [x] Premium users have no limits
- [x] Parental guard runs before subscription guard
- [x] 403 responses include error, limitType, limit, used, tier fields

## Family Plan (AC-5)

- [x] Parent premium propagates to up to 3 children
- [x] 4th+ child does NOT get premium
- [x] Parent expiration reverts all children to free

## Mobile (AC-6, AC-7)

- [x] Upgrade screen with feature comparison table
- [x] Monthly and yearly pricing buttons (placeholder for RevenueCat SDK)
- [x] Restore purchases button
- [x] Anonymous users see "Create an account" → Register
- [x] Children see "Ask your parent" → ParentalControl
- [x] Premium users see "Manage subscription"
- [x] LimitReachedModal with per-type messages (news, reels, quiz, sport)
- [x] Upgrade screen added to navigation stack

## Web (AC-8)

- [x] `/upgrade` page with feature comparison and app store links
- [x] LimitReached shows upgrade button for subscription-related errors
- [x] Subscription types navigate to /upgrade instead of /

## i18n (AC-9)

- [x] All subscription UI text uses `t()` with `subscription.*` keys
- [x] `es.json` has complete subscription key coverage (35+ keys)
- [x] `en.json` has complete subscription key coverage (35+ keys)
- [x] Kid-friendly error messages for subscription limits in both languages
- [x] No hardcoded visible text in subscription components

## Security (AC-10)

- [x] Webhook validates shared secret
- [x] Children cannot initiate purchases (UI prevents)
- [x] subscriptionTier not settable via PUT /api/users (only via webhook)
- [x] Rate limiting applies to webhook (default tier)

## Not Validated (requires RevenueCat setup)

- [ ] RevenueCat sandbox purchase on iOS Simulator
- [ ] RevenueCat sandbox purchase on Android Emulator
- [ ] Restore purchases on fresh install
- [ ] Webhook fires in RevenueCat dashboard after sandbox purchase
- [ ] Free tier limits with real API (manual article counting)

---

## Appendix: Code Review Fixes Validation (2026-04-02)

### TODO-1: Timing-safe webhook secret

- [x] `crypto.timingSafeEqual` used with `Buffer.from()` for constant-time comparison
- [x] Length mismatch checked before calling `timingSafeEqual` (prevents `RangeError`)
- [x] `ValidationError` import removed (no longer used)

### TODO-2: Family plan off-by-one

- [x] `prisma.user.findMany` with `orderBy: createdAt asc, take: 3` replaces `prisma.user.count`
- [x] `some()` check on first 3 children IDs determines if requesting child gets premium
- [x] New test: "returns premium for 3rd child but free for 4th child (first 3 get premium)"
- [x] Existing tests updated to use `findMany` mocks instead of `count`

### TODO-3: Webhook Zod errors return 200

- [x] Zod validation errors return `200 { error: 'invalid_payload' }` instead of throwing
- [x] `logger.warn` logs the Zod error details for debugging
- [x] Auth failure (401) preserved for config error visibility

### WARN-1: Mobile legal links

- [x] `${WEB_BASE}/terms?locale=${locale}` replaces `/terms`
- [x] `${WEB_BASE}/privacy?locale=${locale}` replaces `/privacy`
- [x] `WEB_BASE` imported from `../config`

### WARN-2: Platform-aware manage subscription

- [x] `Platform` imported from `react-native`
- [x] iOS → `https://apps.apple.com/account/subscriptions`
- [x] Android → `https://play.google.com/store/account/subscriptions`

### WARN-3: Duplicate user query eliminated

- [x] `resolveEffectiveTier` accepts optional `TierUserData` parameter
- [x] `subscriptionGuard` passes user data from its existing query
- [x] Backward compatible — `userData` is optional, falls back to DB query

### WARN-6: Mobile tests rewritten

- [x] Upgrade test: 7 tests using `serializeElement()` recursive tree walk
- [x] LimitReachedModal test: 5 tests using same pattern
- [x] Tests verify rendered i18n keys, not source code strings
- [x] Tests verify accessibility attributes on rendered elements

### SUG-2: ActivityLog index verified

- [x] `@@index([userId, type, createdAt])` present in `schema.prisma` line 223

### Full Test Results

- [x] `npm run test:web` — 113 tests passed (16 files)
- [x] `npm run test:mobile` — 152 tests passed (18 files)
- [x] `npm run lint` — 0 errors, 0 warnings

---

# Human Validation — prd2.md (Real-Time Match Notifications)

## Prerequisites

Start the test environment:

```bash
bash specs/mvp-to-product-6/create-environment.sh
```

## Automated Tests

- [x] API: 508 tests passed (46 files)
- [x] Web: 113 tests passed (16 files)
- [x] Mobile: 152 tests passed (18 files)
- [x] Lint: 0 errors, 0 warnings

## Validation Steps

### LiveMatch Data Model (P0)

1. **Action**: Run `npx prisma db push --accept-data-loss` in `apps/api/` and check the database has a `LiveMatch` table
   **Expected**: Table exists with columns: id, externalEventId, homeTeam, awayTeam, homeScore, awayScore, progress, status, league, sport, matchDate, homeGoalDetails, awayGoalDetails, homeRedCards, awayRedCards, lastPolledAt, notifiedEvents, createdAt, updatedAt

### Live Score API Endpoint (P0)

2. **Action**: `curl http://localhost:3001/api/teams/Real%20Madrid/live`
   **Expected**: Returns JSON with `{ "live": false, "match": null }` or a 404 when no LiveMatch exists (expected in dev environment)

3. **Action**: Insert a test LiveMatch via Prisma Studio or direct SQL, then hit the endpoint again
   **Expected**: Returns the live match data with homeTeam, awayTeam, homeScore, awayScore, progress, status, league, sport, matchDate

### Live Score Preferences Endpoint (P1)

4. **Action**: `curl -X PUT http://localhost:3001/api/users/<userId>/notifications/live-scores -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{"enabled": true, "goals": true, "matchStart": false}'`
   **Expected**: Returns `{ "liveScores": { "enabled": true, "goals": true, "matchStart": false, "matchEnd": true, "redCards": true } }`

5. **Action**: Try updating preferences for a different user
   **Expected**: Returns validation error

### Cron Job (P0)

6. **Action**: Check API logs on startup for `live-scores:poll` entries
   **Expected**: Cron job starts, logs `live-scores:poll:skip` with reason `no_matches_today` (expected in dev)

### Web — Notification Settings (P1)

7. **Action**: Navigate to the parents panel → notification settings
   **Expected**: "Live Match Notifications" section visible with checkboxes for Goals, Match start, Match end, Red cards. Section disabled if notifications are off or no favoriteTeam.

8. **Action**: Toggle live score preferences on/off
   **Expected**: Changes are saved (saved indicator appears)

### Web — Team Page Live Banner (P1)

9. **Action**: Navigate to `/team` page
   **Expected**: If no live match exists, no banner is shown. If a LiveMatch is seeded, a red "LIVE" banner shows with pulsing dot, score, minute, and league.

### Mobile — FavoriteTeam Live Banner (P1)

10. **Action**: Open the FavoriteTeam screen in mobile app
    **Expected**: Same behavior as web — live banner when match exists, nothing when no match

### i18n (P0)

11. **Action**: Check `packages/shared/src/i18n/es.json` and `en.json` for `push.live_*`, `live_scores.*`, `live_notifications.*` keys
    **Expected**: All keys present in both files with appropriate Spanish/English translations

### Event Detection Logic (P0)

12. **Action**: Run `cd apps/api && npx vitest run src/services/__tests__/live-scores.test.ts`
    **Expected**: 24 tests pass covering: match start/end/half time detection, goal detection (home/away/multiple), red card detection, deduplication, status mapping, payload building

### Schedule Lock Respect (P1)

13. **Action**: Run `cd apps/api && npx vitest run src/services/__tests__/schedule-check.test.ts`
    **Expected**: 7 tests pass covering: within-range, outside-range, midnight crossing, 0-24 default, timezone conversion

### Push Sender Extension (P1)

14. **Action**: Run `cd apps/api && npx vitest run src/services/__tests__/push-sender-live.test.ts`
    **Expected**: 5 tests pass covering: team matching, preference filtering, schedule lock filtering

---

## Appendix A: Re-validation after /t-review #1

### TODO-1: N+1 parental profile query eliminated

15. **Action**: Read `apps/api/src/services/push-sender.ts` and check `sendLiveScoreToUsers`
    **Expected**: Uses `prisma.parentalProfile.findMany({ where: { userId: { in: ... } } })` with a `Map` lookup instead of per-user `findFirst` in the loop

### TODO-2: Web auth header on updateLiveScorePreferences

16. **Action**: Read `apps/web/src/lib/api.ts` and find `updateLiveScorePreferences`
    **Expected**: Uses `getAccessToken()` and passes `Authorization: Bearer` header (not plain `fetch`)

### TODO-3: Locale-aware notifications

17. **Action**: Read `apps/api/src/services/push-sender.ts` sendLiveScoreToUsers
    **Expected**: Groups users by locale and calls `buildNotificationPayload` per locale group. No hardcoded `'es'` locale.

### WARN-1: Unidirectional team matching

18. **Action**: Read `apps/api/src/jobs/live-scores.ts` and find `isTrackedTeam`
    **Expected**: Only uses `lower.includes(tracked)`, NOT `tracked.includes(lower)`

### WARN-2: halfTime preference

19. **Action**: Check `packages/shared/src/types/index.ts` for `LiveScorePreferences`
    **Expected**: Has `halfTime: boolean` field. `EVENT_TO_PREFERENCE` maps `half_time` to `'halfTime'`.

### WARN-3: teamName input validation

20. **Action**: Read `apps/api/src/routes/live.ts`
    **Expected**: Validates `teamName.length > 100` with `ValidationError`

### WARN-4: Zod validation on preferences

21. **Action**: Read `apps/api/src/routes/users.ts` live-scores route
    **Expected**: Uses `liveScorePreferencesSchema` Zod schema with `.strict()`

### WARN-5: Theme-aware mobile banner

22. **Action**: Read `apps/mobile/src/screens/FavoriteTeam.tsx` live banner styles
    **Expected**: Uses theme-aware colors (no hardcoded `#FEF2F2` or `#FECACA`)

### WARN-6: Deterministic schedule test

23. **Action**: Read `apps/api/src/services/__tests__/push-sender-live.test.ts`
    **Expected**: Uses `vi.useFakeTimers()` or `vi.setSystemTime()` for schedule lock test

### SUG-1: Extracted processLivescoreEntry

24. **Action**: Read `apps/api/src/jobs/live-scores.ts`
    **Expected**: Has a `processLivescoreEntry()` function extracted from the main loop

### SUG-2: Unified parseDetailCount

25. **Action**: Read `apps/api/src/services/live-scores.ts`
    **Expected**: `parseGoalCount` and `parseRedCardCount` are aliases for `parseDetailCount`

### SUG-3: Minute symbol

26. **Action**: Check web team page and mobile FavoriteTeam for progress display
    **Expected**: Uses U+2032 (prime ′) not U+2019 (curly apostrophe ')

### Regression check

27. **Action**: Re-run all original validation steps (1-14) and verify no regressions
    **Expected**: All original checks still pass

---

# Human Validation — prd3.md (B2B Channel: Clubs & Academies)

## Prerequisites

Start the test environment:

```bash
bash specs/mvp-to-product-6/create-environment.sh
```

## Automated Tests

- [x] API: 555 tests passed (49 files)
- [x] Web: 120 tests passed (17 files)
- [x] Mobile: 161 tests passed (19 files)
- [x] Lint: 0 errors, 0 warnings

## Validation Steps

### Organization Data Model (P0)

1. **Action**: Run `npx prisma db push --accept-data-loss` in `apps/api/` and check the database has an `Organization` table
   **Expected**: Table exists with columns: id, name, slug, sport, logoUrl, customColors, inviteCode, maxMembers, active, createdBy, createdAt, updatedAt. User table has organizationId and organizationRole columns.

### Create Organization (P0)

2. **Action**: Register a parent account, then `curl -X POST http://localhost:3001/api/organizations -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{"name": "CD Leganes Academy", "sport": "football"}'`
   **Expected**: Returns 201 with org details including a 6-char invite code (uppercase alphanumeric, no O/0/I/1/L), slug `cd-leganes-academy`, memberCount 0. Creator's organizationRole is set to 'admin'.

3. **Action**: Try creating an org with a child account
   **Expected**: Returns 403 (only parents can create orgs)

### Join Organization (P0)

4. **Action**: Register a child account, then `curl -X POST http://localhost:3001/api/auth/join-organization -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{"inviteCode": "<code from step 2>"}'`
   **Expected**: Returns 200 with organizationId, organizationName, sport. User's favoriteSports is set to the org's sport.

5. **Action**: Try joining again with the same user
   **Expected**: Returns 409 (already belongs to an org)

6. **Action**: Try joining with an invalid code format (e.g., "abc")
   **Expected**: Returns 400 (validation error)

7. **Action**: Try joining with a non-existent valid-format code (e.g., "ZZZZZZ")
   **Expected**: Returns 404 (no org with that code)

### Premium Access via Org (P0)

8. **Action**: With the child who joined the org, access content endpoints (news, reels, quiz)
   **Expected**: No subscription limits applied — org membership grants premium access

9. **Action**: Deactivate the org (PUT with active: false), then try content access again
   **Expected**: Child falls back to free tier limits

### Member List (P0)

10. **Action**: `curl http://localhost:3001/api/organizations/<orgId>/members -H 'Authorization: Bearer <admin-token>'`
    **Expected**: Returns paginated member list with: id, name, age, totalPoints, currentStreak, lastActiveDate, joinedAt. Does NOT expose email or parental info.

11. **Action**: Try accessing member list with a non-admin token
    **Expected**: Returns 403

### Activity Dashboard (P0)

12. **Action**: `curl http://localhost:3001/api/organizations/<orgId>/activity?period=7d -H 'Authorization: Bearer <admin-token>'`
    **Expected**: Returns summary (totalMembers, activeMembers, totals for news/reels/quiz, averageStreak, averagePoints), daily breakdown array, topMembers (top 5)

### Remove Member (P1)

13. **Action**: `curl -X DELETE http://localhost:3001/api/organizations/<orgId>/members/<childId> -H 'Authorization: Bearer <admin-token>'`
    **Expected**: Returns 200. Child's organizationId and organizationRole are set to null.

### Leave Organization (P1)

14. **Action**: Have a member call `curl -X POST http://localhost:3001/api/organizations/<orgId>/leave -H 'Authorization: Bearer <member-token>'`
    **Expected**: Returns 200. Member's organizationId is cleared.

15. **Action**: Have the admin try to leave
    **Expected**: Returns 403 (admin cannot leave their own org)

### Regenerate Code (P1)

16. **Action**: `curl -X POST http://localhost:3001/api/organizations/<orgId>/regenerate-code -H 'Authorization: Bearer <admin-token>'`
    **Expected**: Returns 200 with new inviteCode. Old code no longer works for joining.

### Update Organization (P1)

17. **Action**: `curl -X PUT http://localhost:3001/api/organizations/<orgId> -H 'Content-Type: application/json' -H 'Authorization: Bearer <admin-token>' -d '{"name": "CD Leganes Youth Academy", "maxMembers": 50}'`
    **Expected**: Returns 200 with updated fields. Sport cannot be changed.

### Rate Limiting (P0)

18. **Action**: Send 6+ join-organization requests within 1 minute from the same IP
    **Expected**: 6th request returns 429 (rate limited)

### Web Dashboard (P0)

19. **Action**: Navigate to `/organizations` page while logged in as org admin
    **Expected**: Dashboard shows org name, sport, member count, invite code with copy button, activity summary cards, daily chart, top members, and paginated member list

### Web Join Modal (P1)

20. **Action**: Open JoinOrgModal component (accessible from settings/NavBar)
    **Expected**: Shows 6-char code input, Join button (disabled until 6 chars), Cancel button. Success shows org name.

### Mobile Join Screen (P0)

21. **Action**: Open JoinOrganization screen on mobile
    **Expected**: 6 individual character boxes, auto-advance on input, uppercase forced, Join button, Skip link. Success flow shows org name.

### i18n (P0)

22. **Action**: Check `packages/shared/src/i18n/es.json` and `en.json` for `org.*` and `a11y.org_*` keys
    **Expected**: All keys present in both files (35+ org keys, 9 a11y keys) with appropriate translations

### GDPR Data Deletion (P1)

23. **Action**: Delete a user who belongs to an org via `DELETE /api/users/:id/data`
    **Expected**: User is removed. Organization member list no longer includes them.

### Invite Code Service Tests

24. **Action**: `cd apps/api && npx vitest run src/services/__tests__/invite-code.test.ts`
    **Expected**: 15 tests pass covering code generation, format validation, slug generation, collision handling

### Authorization Middleware Tests

25. **Action**: `cd apps/api && npx vitest run src/middleware/__tests__/require-org-admin.test.ts`
    **Expected**: 6 tests pass covering auth checks, role validation, org mismatch

### Organization Route Tests

26. **Action**: `cd apps/api && npx vitest run src/routes/__tests__/organizations.test.ts`
    **Expected**: 12 tests pass covering CRUD, join, members, activity, remove, leave, regenerate

### Subscription Integration Tests

27. **Action**: `cd apps/api && npx vitest run src/services/__tests__/subscription.test.ts`
    **Expected**: All tests pass including 4 new tests for org-based tier resolution

---

## Appendix A: Re-validation after /t-review #2

These steps verify the fixes applied by `/t-reduce-tech-debt` after the second code review round.

### Security Fixes

28. **Action**: Read `apps/api/src/services/invite-code.ts` and verify `crypto.randomInt` is used instead of `Math.random`.
    **Expected**: `import { randomInt } from 'crypto'` at top, `ALPHABET[randomInt(ALPHABET.length)]` in `generateCode()`. No `Math.random` calls.

29. **Action**: Read `apps/api/src/middleware/subscription-guard.ts` and verify JWT userId takes precedence.
    **Expected**: `req.auth?.userId` is checked first and used when available. Falls back to `req.query.userId` or `req.headers['x-user-id']` only for unauthenticated requests.

30. **Action**: Read `apps/api/src/routes/subscription.ts` and verify ownership check on `GET /status/:userId`.
    **Expected**: After `requireAuth`, the route checks `req.auth.userId === req.params.userId` OR the caller is the parent (`parentUserId === req.auth.userId`). Returns 403 otherwise.

### Performance Fixes

31. **Action**: Read `apps/api/src/routes/organizations.ts` activity endpoint and verify it uses `groupBy` instead of loading all logs.
    **Expected**: Uses `prisma.activityLog.groupBy` for aggregation. Any remaining `findMany` has a `take` limit.

32. **Action**: Read `apps/api/src/services/subscription.ts` `getSubscriptionStatus()` and verify no redundant DB query.
    **Expected**: `resolveEffectiveTier()` receives the already-fetched user data as parameter instead of re-querying.

33. **Action**: Read `apps/api/src/jobs/live-scores.ts` and verify batched processing.
    **Expected**: Live score entries are processed in batches (e.g., groups of 5 via `Promise.all`) instead of purely sequential loop.

### i18n Fixes

34. **Action**: Read `apps/web/src/components/OrgMemberList.tsx` and verify no hardcoded English strings.
    **Expected**: "Today", "Yesterday", "d ago", sort options all use `t()` with i18n keys. Keys `org.today`, `org.yesterday`, `org.days_ago`, `org.sort_name`, `org.sort_last_active`, `org.sort_streak` exist in both `en.json` and `es.json`.

35. **Action**: Read `apps/web/src/components/OrgActivityChart.tsx` and verify aria-label uses i18n.
    **Expected**: `aria-label` uses `t('org.chart_bar_label', locale, ...)` instead of hardcoded English.

### Error Handling Fixes

36. **Action**: Read `apps/web/src/app/organizations/page.tsx` and verify catch blocks show errors.
    **Expected**: Catch blocks call `setError(...)` with a localized message. Error banner rendered with `role="alert"`.

### Other Fixes

37. **Action**: Read `apps/mobile/src/screens/Upgrade.tsx` and verify WEB_BASE fallback.
    **Expected**: Legal links use `WEB_BASE || FALLBACK_WEB_BASE` (or similar fallback) so links don't break when WEB_BASE is undefined.

38. **Action**: Read `apps/api/src/routes/live.ts` and verify minimum teamName length.
    **Expected**: `teamName` is validated to be at least 3 characters. Returns `ValidationError` if shorter.

39. **Action**: Read `apps/api/src/routes/organizations.ts` update endpoint and verify slug stability.
    **Expected**: Slug is only regenerated when the org name actually changes (compares old vs new).

40. **Action**: Read `apps/web/src/components/OrgSettings.tsx` and verify COLORS import.
    **Expected**: Default colors use `COLORS.blue` and `COLORS.green` from `@sportykids/shared` instead of hardcoded hex values.

### Regression Check

41. **Action**: Re-run all test suites: `npm run test:web`, `npm run test:mobile`, `cd apps/api && npx vitest run`, `npm run lint`.
    **Expected**: All tests pass, 0 lint errors/warnings. Counts should be >= 836 total (120 web + 161 mobile + 555 API).

---

## Appendix B: Re-validation after /t-review #3

These steps verify the fixes applied by `/t-reduce-tech-debt` after the third code review round.

### Race Condition Fixes

42. **Action**: Read `apps/api/src/routes/organizations.ts` create endpoint and verify atomic transaction.
    **Expected**: `prisma.$transaction()` wraps both `organization.create` and `user.update` calls. No writes happen outside the transaction.

43. **Action**: Read `apps/api/src/routes/auth.ts` join-organization endpoint and verify atomic transaction.
    **Expected**: `prisma.$transaction()` wraps the capacity re-check, user freshness re-check, and `user.update`. Member count is verified inside the transaction.

### String Replace Fix

44. **Action**: Read `apps/api/src/services/live-scores.ts` `buildNotificationPayload` function.
    **Expected**: Uses `replaceAll()` instead of `replace()` for both title and body template processing.

### Accessibility Fixes

45. **Action**: Read `apps/web/src/components/OrgSettings.tsx` and verify Escape key handling.
    **Expected**: Modal overlay has `onKeyDown` handler that closes on Escape, `tabIndex={-1}`, and auto-focus via `useRef`/`useEffect`.

46. **Action**: Read `apps/web/src/components/JoinOrgModal.tsx` and verify same Escape key handling.
    **Expected**: Same Escape key handler, tabIndex, and auto-focus pattern as OrgSettings.

### Cleanup

47. **Action**: Read `apps/mobile/src/screens/JoinOrganization.tsx` line 1.
    **Expected**: No unused `React` default import. Only named imports from 'react' (useState, useRef, etc.).

### Regression Check

48. **Action**: Re-run all test suites: `npm run test:web`, `npm run test:mobile`, `cd apps/api && npx vitest run`, `npm run lint`.
    **Expected**: All tests pass, 0 lint errors/warnings. Counts should be >= 836 total.
