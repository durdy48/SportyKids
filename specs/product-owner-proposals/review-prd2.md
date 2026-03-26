# Code Review: prd2.md (Sprint 3-4) — B-TF3, B-MP1, B-MP5

## Summary

The implementation delivers functional JWT auth, mobile parity (RSS catalog + streak + check-in), and push notifications with solid architecture. However, there are two critical security issues (password hash leaking via the users endpoint and an IDOR on the upgrade endpoint), a runtime bug in navigation, and several type mismatches that need attention before this can ship.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| JWT access/refresh tokens (15m / 7d) | B-TF3 | PASS | Implemented with rotation |
| Email/password auth (register, login) | B-TF3 | PASS | Simplified from social login (intentional per implementation-notes) |
| Auth middleware non-blocking (backward compat) | B-TF3 | PASS | Anonymous users continue to work |
| requireAuth / requireRole middleware | B-TF3 | PASS | Properly structured |
| Upgrade anonymous user to email account | B-TF3 | PASS | Endpoint exists, but has IDOR (see critical issues) |
| Link child to parent | B-TF3 | PASS | Requires parent role, validates child not already linked |
| Login screen (mobile) | B-TF3 | PASS | Email/password + anonymous option |
| Register screen (mobile) | B-TF3 | PASS | With role selector |
| Web auth client | B-TF3 | PASS | register, login, refresh, logout |
| Auth tests | B-TF3 | PASS | 10 tests covering tokens + passwords |
| Social login (Google, Microsoft, Facebook, Apple) | B-TF3 | SKIP | Intentionally deferred — acceptable for MVP per implementation-notes |
| NextAuth.js integration | B-TF3 | SKIP | Deferred with social login |
| Web login page | B-TF3 | SKIP | Web auth client exists but no login page UI |
| RSS Catalog screen (mobile) | B-MP1 | PASS | SectionList with sport groups, toggle, save |
| Daily check-in on mobile | B-MP1 | PASS | UserProvider calls check-in, shows alerts |
| StreakCounter component (mobile) | B-MP1 | PASS | Presentational component in HomeFeed header |
| Settings gear icon to access RSS Catalog | B-MP1 | PASS | In HomeFeed header |
| PushToken model in DB | B-MP5 | PASS | With userId, token (unique), platform, active |
| Subscribe endpoint accepts pushToken + platform | B-MP5 | PASS | Upsert logic, deactivate on disable |
| Push sender with Expo SDK | B-MP5 | PASS | Batching, receipt handling, DeviceNotRegistered deactivation |
| Streak reminder cron at 20:00 UTC | B-MP5 | PASS | Queries at-risk users, sends push |
| Push on quiz generation | B-MP5 | PASS | Dynamic import, sends to opted-in users |
| Push on team news (sync-feeds) | B-MP5 | PASS | Groups by team, notifies favoriteTeam users |
| Push on sticker award | B-MP5 | PASS | Non-blocking dynamic import in gamification.ts |
| Push on mission generation | B-MP5 | PASS | In generate-daily-missions.ts |
| Mobile push registration | B-MP5 | PASS | expo-notifications, Android channel, foreground handler |
| Notification tap deep-linking | B-MP5 | PASS | Via navigationRef + setupNotificationTapHandler |
| Push sender tests | B-MP5 | PASS | 8 tests covering send/skip/deactivate scenarios |
| Push respects user locale | B-MP5 | PARTIAL | Streak reminder uses user locale; other triggers hardcode 'es' |
| i18n keys for auth and push | B-TF3/B-MP5 | PASS | Both es.json and en.json have auth.* and push.* sections |

## TODO: Critical Issues (must fix)

- [x] **apps/api/src/routes/users.ts:152-158** — `formatUser()` does NOT strip `passwordHash` from the response. Since User now has a `passwordHash` field, `GET /api/users/:id` and `PUT /api/users/:id` both leak the bcrypt hash to any caller. This is a serious data exposure vulnerability (OWASP A01: Broken Access Control / A04: Insecure Design). Fix: add `passwordHash: undefined` (or use destructuring) in `formatUser()`, same as in auth.ts.

- [x] **apps/api/src/routes/auth.ts:196-247** — The `/api/auth/upgrade` endpoint accepts `userId` in the request body without any authentication check. Any anonymous request can convert any other user's anonymous account to an email account by supplying their userId. This is an IDOR vulnerability. Fix: either require authentication (the user must be logged in as that userId), or at minimum require proof of ownership (e.g., the user's existing session/localStorage ID must match).

- [x] **apps/mobile/src/navigation/index.tsx:103** — `locale` is referenced in `AppNavigator` but never destructured from `useUser()`. Line 88 only destructures `{ user, loading }`. This will cause a ReferenceError at runtime when the RssCatalog screen is defined, crashing the app. Fix: change line 88 to `const { user, loading, locale } = useUser();`.

## TODO: Warnings (should fix)

- [x] **apps/api/src/services/gamification.ts:243** — Push notification for sticker award hardcodes locale to `'es'`. Should query the user's locale from the database or pass it through from the caller. Same issue in sync-feeds.ts:44 and generate-daily-quiz.ts:201 and generate-daily-missions.ts:36.

- [x] **packages/shared/src/types/index.ts:4 vs apps/api/src/routes/users.ts:83** — Type mismatch: the shared `PushPreferences` interface declares `sports: string[]`, but the Zod schema in the subscribe endpoint validates `sports: z.boolean().default(true)`. The mobile push-notifications.ts:62 also passes `sports: true` (boolean). Either the shared type or all the consumers need to agree on the shape. This will cause type errors if strict typing is enforced.

- [x] **apps/api/src/routes/auth.ts:48-55** — `formatUser` is duplicated between `auth.ts` and `users.ts` with slightly different behavior (auth.ts strips passwordHash, users.ts does not). These should be consolidated into a shared utility to avoid drift and ensure consistent password hash stripping.

- [x] **apps/api/src/services/auth-service.ts:10** — `JWT_SECRET` defaults to `'dev-secret-change-in-production'` with a silent fallback. In production, an unset `JWT_SECRET` would result in signing tokens with a known secret. Consider throwing an error in non-dev environments if `JWT_SECRET` is not set, or at minimum log a prominent warning.

- [ ] **apps/web/src/lib/auth.ts:82-86** — Tokens are stored in `localStorage`, which is accessible to any JavaScript running on the page (XSS risk). For refresh tokens specifically, `httpOnly` cookies would be more secure. Acceptable for MVP but worth noting as tech debt for production.

- [ ] **apps/api/src/routes/auth.ts:61-100** — No rate limiting on `/api/auth/register` or `/api/auth/login`. Without rate limiting, these endpoints are vulnerable to brute force attacks and credential stuffing. Consider adding rate limiting middleware before production.

- [x] **apps/mobile/src/screens/Register.tsx:31-35** — The register call does not include `age` in the request body despite the schema accepting it (defaults to 10). A child registering would get age 10 regardless of their actual age. The form should either include an age picker or the post-registration flow should prompt for it.

## TODO: Suggestions (nice to have)

- [x] **apps/api/src/services/push-sender.ts:143-145** — The `(chunk[i] as any).to as string` cast is fragile. Consider typing the chunk messages properly or extracting the token before sending so the mapping is explicit.

- [ ] **apps/api/src/services/auth-service.ts:49** — `jwt.verify` returns `JwtPayload & jwt.JwtPayload`, but the cast `as JwtPayload` discards the JWT standard fields (iat, exp). This is fine functionally but a `pick` or validation step would be more robust.

- [x] **apps/mobile/src/lib/auth.ts:95-118** — `authFetch` implements token refresh on 401, but this wrapper is not used anywhere in the mobile codebase. All API calls in `api.ts` use raw `fetch`. Either migrate API calls to use `authFetch` or remove the dead code.

- [x] **apps/api/src/jobs/streak-reminder.ts:17-23** — The query fetches ALL users with streak >= 3 and pushEnabled, then filters in application code. For large user bases, this could be optimized by filtering `lastActiveDate` at the database level (e.g., `lastActiveDate < todayStart`).

- [ ] **apps/mobile/src/screens/Login.tsx:44** — The soccer ball emoji is used as the logo. This is hardcoded UI content that does not go through i18n. Not a translation concern per se, but worth noting for consistency.

- [x] **apps/mobile/src/lib/push-notifications.ts:48** — `getExpoPushTokenAsync()` is called without a `projectId`. The PRD spec passes `Constants.expoConfig?.extra?.eas?.projectId`. Without it, the call may fail in standalone builds (works in Expo Go but not in production builds).

## Technical Debt Assessment

**New debt introduced:**
1. `formatUser` duplication across auth.ts and users.ts — needs consolidation
2. `authFetch` wrapper in mobile is dead code (not used by any API calls)
3. Push notification locale is hardcoded to 'es' in 4 out of 5 trigger points
4. `PushPreferences.sports` type inconsistency between shared types and runtime usage
5. No rate limiting on auth endpoints
6. Refresh tokens stored in localStorage/AsyncStorage (not httpOnly cookies)
7. No expired refresh token cleanup job (tokens accumulate in DB)

**Existing debt addressed:**
- Auth was a placeholder comment — now has real JWT implementation
- Push notifications were UI stubs — now have server-side delivery
- Mobile was missing RSS catalog and check-in — now has both

**Overall quality:** The implementation is well-structured with clean separation of concerns. Services are properly isolated, tests cover the critical paths, error handling exists at all boundaries, and backward compatibility with anonymous users is maintained. The critical issues are real blockers that need fixing before any user-facing deployment, but the architecture is sound.

## Files Reviewed

- `apps/api/src/services/auth-service.ts` — Clean JWT + bcrypt implementation with token rotation
- `apps/api/src/middleware/auth.ts` — Good: proper Express Request augmentation via `declare global`
- `apps/api/src/routes/auth.ts` — Functional but has IDOR on /upgrade, duplicated formatUser
- `apps/mobile/src/lib/auth.ts` — Solid auth client with refresh-on-401 logic (unused)
- `apps/mobile/src/screens/Login.tsx` — Clean UI, proper i18n usage
- `apps/mobile/src/screens/Register.tsx` — Missing age input, otherwise well built
- `apps/web/src/lib/auth.ts` — Web parity with SSR guards, localStorage tokens
- `apps/api/src/services/auth-service.test.ts` — Good coverage of token lifecycle and password hashing
- `apps/mobile/src/components/StreakCounter.tsx` — Simple, correct presentational component
- `apps/mobile/src/screens/RssCatalog.tsx` — Well-structured SectionList with dirty state tracking
- `apps/api/src/services/push-sender.ts` — Proper batching, receipt handling, preference filtering
- `apps/api/src/jobs/streak-reminder.ts` — Correct logic, minor optimization opportunity
- `apps/mobile/src/lib/push-notifications.ts` — Complete: permissions, Android channel, tap handler
- `apps/api/src/services/push-sender.test.ts` — Good mock setup, covers key scenarios
- `apps/api/prisma/schema.prisma` — PushToken and RefreshToken models match PRD spec
- `apps/api/src/index.ts` — Auth middleware globally applied, streak-reminder job registered
- `apps/api/src/routes/users.ts` — CRITICAL: leaks passwordHash in formatUser
- `apps/api/src/services/gamification.ts` — Push integration via dynamic import (non-blocking)
- `apps/api/src/jobs/sync-feeds.ts` — Team news push after sync, well structured
- `apps/api/src/jobs/generate-daily-quiz.ts` — Push notification after generation
- `apps/api/src/jobs/generate-daily-missions.ts` — Push per user, non-blocking
- `apps/mobile/src/lib/user-context.tsx` — Check-in, streak alerts, push registration on load
- `apps/mobile/src/lib/api.ts` — subscribeNotifications updated with pushToken/platform
- `apps/mobile/src/navigation/index.tsx` — BUG: `locale` not destructured, will crash at runtime
- `apps/mobile/src/screens/HomeFeed.tsx` — StreakCounter + settings gear integrated
- `apps/mobile/src/App.tsx` — Notification tap handler setup with proper cleanup
- `packages/shared/src/types/index.ts` — AuthResponse, LoginRequest, RegisterRequest added
- `packages/shared/src/i18n/es.json` — auth.* and push.* sections present
- `packages/shared/src/i18n/en.json` — auth.* and push.* sections present

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | 11 test files, 91 tests — all passing |
| Prisma schema | Valid, 3 migrations applied |
| TypeScript compilation | No blocking errors |
