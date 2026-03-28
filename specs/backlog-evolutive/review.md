# Code Review: Backlog Evolutive (6 PRDs)

## Summary

Overall quality is **good** for an MVP. All 6 PRDs are fully implemented with consistent patterns, proper i18n, English API routes, Zod validation, and SSRF prevention. No critical/blocking issues found. Pass with notes -- several should-fix items before beta.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| VideoSource model + Reel extensions | prd.md | OK | Migration, seed, all fields present |
| video-aggregator.ts service | prd.md | OK | YouTube RSS sync, dedup, moderation, team classification |
| sync-videos.ts cron (6h) | prd.md | OK | Fire-and-forget on startup + cron |
| 5 new reels endpoints | prd.md | OK | sources/list, sources/catalog, sources/custom, DELETE, sync |
| ReelCard multi-platform (web) | prd.md | OK | youtube_embed, instagram_embed, tiktok_embed, mp4 |
| VideoPlayer multi-platform (mobile) | prd.md | OK | Instagram/TikTok via WebView with HTML encoding |
| 22+ VideoSources seeded | prd.md | OK | 22 sources covering all 8 sports |
| GET /api/reels filters approved only | prd.md | OK | safetyStatus: 'approved' in where clause |
| User country field + migration | prd2.md | OK | `country String @default("ES")` |
| locale/country validation | prd2.md | OK | z.enum with SUPPORTED_LOCALES/COUNTRIES |
| Language selector in onboarding | prd2.md | OK | Web + Mobile, Step 1 |
| UserContext sync to server | prd2.md | OK | setLocale fires PUT /api/users/:id |
| countryBoost in feed ranker | prd2.md | OK | +1 for country match, case-insensitive |
| 10 Google News RSS sources | prd3.md | OK | Seed-only, category: google_news |
| Zero code changes to aggregator | prd3.md | OK | Confirmed -- only seed.ts modified |
| PIN lockout (5 attempts, 15min) | prd4.md | OK | failedAttempts/lockedUntil on ParentalProfile, DB-stored |
| express-rate-limit 5 tiers | prd4.md | OK | auth(5), pin(10), content(60), sync(2), default(100) |
| PinInput lockout UI | prd4.md | OK | Web countdown + mobile haptic feedback |
| sportFrequencyBoost | prd5.md | OK | Proportional frequency-weighted scoring |
| Source affinity tracking | prd5.md | OK | ActivityLog + NewsItem join |
| recencyDecay (exponential) | prd5.md | OK | exp(-age/halfLife) curve |
| Diversity injection | prd5.md | OK | Every 5th position, first 4 untouched |
| RANKING_WEIGHTS | prd5.md | OK | Module-level constant, all 1.0 |
| Cache invalidation on activity | prd5.md | OK | invalidateBehavioralCache called in parents.ts |
| CacheProvider interface | prd6.md | OK | Formal interface with sync/async support |
| RedisCache implementation | prd6.md | OK | ioredis, SCAN for patterns, key prefix |
| createCache factory | prd6.md | OK | Fallback to InMemory on Redis failure |
| OAuth placeholder routes (501) | prd6.md | OK | 4 routes: google, google/callback, apple, apple/callback |
| AuthProvider type extension | prd6.md | OK | 'google' | 'apple' added |
| .env.example complete | prd6.md | OK | All variables documented |
| docker-compose Redis service | prd6.md | OK | Redis 7 Alpine with health check |

## TODO: Critical Issues (must fix)

None

## TODO: Warnings (should fix)

- [x] **apps/web/src/components/PinInput.tsx:20** -- Default `buttonText = 'Confirm'` is a hardcoded English string. Although all callers override it, the default should use an i18n key or be removed to prevent accidental display of untranslated text. **Fixed**: Removed hardcoded default, falls back to `t('buttons.confirm', locale)`.
- [x] **apps/api/src/routes/reels.ts:148-155** -- Dead fallback userId logic in DELETE handler: `req.query.userId` / `req.body?.userId` fallback is unreachable since `requireAuth` middleware is applied. Remove the fallback to eliminate confusion and a theoretical userId spoofing surface. **Fixed**: Now uses only `req.auth?.userId`, returns 401 if missing. Updated test mock to set `req.auth`.
- [ ] **apps/web/src/components/PinInput.tsx:35-55 + apps/mobile/src/screens/ParentalControl.tsx:80-96** -- Duplicated lockout countdown timer logic (setInterval + clearInterval + Math.max). **Skipped**: Web and mobile implementations have subtle differences (mobile uses useRef and resets lockedUntil state; web doesn't). The shared package has no React dependency. Extracting ~10 lines to a shared hook would add more complexity than it removes.
- [x] **apps/web/src/lib/user-context.tsx:179 + apps/mobile/src/lib/user-context.tsx:165** -- Unnecessary `as Record<string, unknown>` cast on `updateUser` calls. The function already accepts the correct type; remove the cast to preserve type safety. **Fixed**: Removed unnecessary casts.
- [x] **apps/api/src/routes/reels.ts:184** -- The `/sync` endpoint calls `syncAllVideoSources()` without try-catch. If sync throws, Express returns a generic 500. Add try-catch for a structured error response, since this is a user-facing parent endpoint. **Fixed**: Added try-catch with structured 500 error response.

## TODO: Suggestions (nice to have)

- [x] **apps/api/src/services/redis-cache.ts** -- Add unit tests with a mock Redis client (ioredis-mock or manual mock). Currently the only coverage is through the createCache factory fallback test. **Fixed**: Added 10 unit tests in `redis-cache.test.ts` with manual mock RedisClient.
- [x] **apps/web/src/components/OnboardingWizard.tsx:211 + apps/mobile/src/screens/Onboarding.tsx:163** -- Extract duplicated country inference logic (`locale === 'es' ? 'ES' : 'GB'`) to a shared utility function `inferCountryFromLocale(locale)` in `packages/shared`. **Fixed**: Added `inferCountryFromLocale()` to `packages/shared/src/constants/locale.ts`, updated both consuming files.
- [x] **apps/api/src/routes/parents.ts:73,301** -- Replace `Record<string, unknown>` with `Prisma.ParentalProfileUpdateInput` for Prisma update objects to leverage type-safe updates. **Fixed**: Imported `Prisma` type, replaced `Record<string, unknown>` with `Prisma.ParentalProfileUpdateInput` in the update handler.
- [ ] **apps/api/src/services/feed-ranker.ts** -- Schedule removal of deprecated `sportBoost()` and `recencyBoost()` exports after one release cycle. They are kept for backward compat but add dead code weight. **Skipped**: Already has `@deprecated` JSDoc. Removal requires coordinating with external consumers. Will remove in next release cycle.
- [x] **apps/api/src/utils/url-validator.ts** -- Add IPv6-mapped IPv4 address blocking (`::ffff:127.0.0.1`, `::ffff:10.x.x.x`) to the SSRF prevention. Current check only covers IPv4 ranges. **Fixed**: Added IPv6-mapped IPv4 detection that recursively validates the embedded IPv4 address.

## Technical Debt Assessment

The changes are **neutral to slightly positive** on technical debt:

**Debt reduced:**
- CacheProvider interface replaces ad-hoc InMemoryCache singleton with a formal abstraction
- Rate limiting closes a security gap (no rate limiting existed before)
- PIN lockout closes a brute-force vulnerability
- Feed ranker replaces coarse step functions with smooth, testable scoring functions
- API routes fully migrated to English (was mixed Spanish/English)

**Debt introduced (minor):**
- Duplicated lockout countdown logic between web and mobile (should be shared hook)
- Duplicated country inference logic (should be shared utility)
- `sportBoost`/`recencyBoost` kept as deprecated exports (dead code weight)
- RedisCache lacks unit tests

**Net assessment:** The security and architectural improvements outweigh the minor duplication introduced.

## Files Reviewed

- `apps/api/prisma/schema.prisma` -- VideoSource model, Reel extensions, ParentalProfile lockout fields, User country field. All correct.
- `apps/api/prisma/seed.ts` -- 22 VideoSources, 10 Google News sources. Proper dedup pattern.
- `apps/api/src/index.ts` -- Rate limiters applied before routes, video sync job registered. Correct order.
- `apps/api/src/routes/reels.ts` -- 5 new endpoints, safetyStatus filter, requireAuth on custom/sync. Dead userId fallback noted.
- `apps/api/src/routes/users.ts` -- SUPPORTED_LOCALES/COUNTRIES with z.enum validation. Clean.
- `apps/api/src/routes/parents.ts` -- PIN lockout logic, activity logging with cache invalidation. Solid.
- `apps/api/src/routes/auth.ts` -- OAuth 501 placeholders, auth upgrade IDOR protection. Good.
- `apps/api/src/routes/news.ts` -- Source metadata enrichment for ranker. Batch query pattern.
- `apps/api/src/services/video-aggregator.ts` -- YouTube RSS sync, batch pre-fetch, 1s delay, moderation. Well-structured.
- `apps/api/src/services/feed-ranker.ts` -- sportFrequencyBoost, recencyDecay, diversity injection, RANKING_WEIGHTS. Excellent test coverage.
- `apps/api/src/services/cache.ts` -- CacheProvider interface, createCache factory, async withCache. Clean.
- `apps/api/src/services/redis-cache.ts` -- SCAN-based invalidation, key prefix, stats tracking. Needs tests.
- `apps/api/src/middleware/rate-limiter.ts` -- 5 tiers, env-configurable, standardHeaders. Correct.
- `apps/api/src/jobs/sync-videos.ts` -- Cron every 6h + manual sync. Mirrors sync-feeds pattern.
- `apps/web/src/components/PinInput.tsx` -- Lockout countdown UI, disabled state, progress bar. Hardcoded default noted.
- `apps/web/src/components/ReelCard.tsx` -- Multi-platform rendering with getEmbedRenderer. Clean.
- `apps/web/src/components/OnboardingWizard.tsx` -- Language selector in Step 1. Country inference duplicated.
- `apps/web/src/components/NavBar.tsx` -- Language & Region dropdown. i18n keys used.
- `apps/web/src/lib/user-context.tsx` -- Locale sync to server, loads from server on init. Unnecessary cast.
- `apps/mobile/src/components/VideoPlayer.tsx` -- WebView for Instagram/TikTok, htmlEncode for XSS prevention.
- `apps/mobile/src/screens/Onboarding.tsx` -- Language selector matching web. Country inference duplicated.
- `apps/mobile/src/screens/ParentalControl.tsx` -- Lockout UI + haptic. Timer logic duplicated.
- `packages/shared/src/types/index.ts` -- VideoSource, VideoPlatform, AuthProvider types. Clean.
- `packages/shared/src/i18n/es.json` + `en.json` -- All new keys present for all 6 PRDs.
- Test files (24 files, 263 tests) -- All passing, good coverage across video aggregator, feed ranker, PIN lockout, rate limiter, user locale, Google News RSS.

## Verification

```
Test suite: 25 files, 274 tests, 0 failures
Duration: 2.26s
```

All tests pass after tech debt reduction (11 new tests added: 10 RedisCache + 1 test file updated).
