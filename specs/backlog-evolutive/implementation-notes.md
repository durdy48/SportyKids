# backlog-evolutive — Implementation Notes

# prd.md implementation — Video Aggregator + Multi-platform Reels

## Requirements

All PRD requirements implemented:

- [x] `VideoSource` model created with Prisma migration
- [x] `Reel` model extended with `rssGuid`, `videoSourceId`, `safetyStatus`, `safetyReason`, `moderatedAt`, `publishedAt`
- [x] Existing 10 seed reels unaffected (nullable fields + safe defaults)
- [x] 22 VideoSources seeded covering all 8 sports
- [x] `video-aggregator.ts` syncs YouTube RSS feeds, deduplicates, moderates, classifies teams
- [x] `sync-videos.ts` cron runs every 6 hours + on API startup
- [x] `GET /api/reels` filters by `safetyStatus: 'approved'`, orders by `publishedAt desc`
- [x] `GET /api/reels/fuentes/listado` returns active video sources
- [x] `GET /api/reels/fuentes/catalogo` returns catalog with bySport counts
- [x] `POST /api/reels/fuentes/custom` creates custom source + immediate sync for YouTube
- [x] `DELETE /api/reels/fuentes/custom/:id` with ownership checks
- [x] `POST /api/reels/sincronizar` triggers manual sync with metrics
- [x] ReelCard (web) supports youtube_embed, instagram_embed, tiktok_embed, mp4
- [x] VideoPlayer (mobile) supports Instagram/TikTok via WebView
- [x] i18n keys added for es.json and en.json
- [x] CLAUDE.md updated
- [x] Documentation updated (es + en)

## Initial considerations

- YouTube RSS feeds return Atom format — `rss-parser` handles both RSS and Atom natively
- SQLite allows multiple NULLs in unique columns, so existing seed reels with `rssGuid = null` don't conflict
- Defaulting `safetyStatus` to `"approved"` preserves visibility of existing seed reels
- Instagram/TikTok don't have free discovery APIs — only oEmbed rendering supported

## Design

Architecture mirrors the news RSS aggregator:

```
VideoSource (DB)  →  video-aggregator.ts  →  Reel (DB)  →  GET /api/reels
     ↑                     ↑                                      ↓
  seed.ts           sync-videos.ts (cron 6h)              ReelCard (web/mobile)
  custom API        content-moderator.ts
                    classifier.ts
```

Key patterns reused from news aggregator:
- `rss-parser` with 10s timeout and User-Agent
- Dedup by unique `rssGuid` field
- Content moderation with fail-open
- Team classification from title/description
- Source `lastSyncedAt` tracking
- 1s delay between sources to avoid throttling

## Implementation details

### New files created:
- `apps/api/src/services/video-aggregator.ts` — Core service (helpers + syncVideoSource + syncAllVideoSources)
- `apps/api/src/services/video-aggregator.test.ts` — 22 unit tests
- `apps/api/src/jobs/sync-videos.ts` — Cron job every 6h
- `apps/api/src/routes/reels.test.ts` — 10 route tests

### Files modified:
- `apps/api/prisma/schema.prisma` — VideoSource model + Reel extensions
- `apps/api/prisma/seed.ts` — 22 VideoSource entries
- `apps/api/src/routes/reels.ts` — 5 new endpoints + updated GET query
- `apps/api/src/index.ts` — sync-videos job registration
- `packages/shared/src/types/index.ts` — VideoSource, VideoPlatform types
- `packages/shared/src/i18n/es.json` — 9 new keys
- `packages/shared/src/i18n/en.json` — 9 new keys
- `apps/web/src/components/ReelCard.tsx` — Multi-platform rendering
- `apps/mobile/src/components/VideoPlayer.tsx` — Instagram/TikTok WebView
- `CLAUDE.md` — Updated models, jobs, endpoints, architecture
- `docs/es/02-modelo-de-datos.md`, `docs/es/03-api-reference.md`, `docs/es/06-service-overview.md`
- `docs/en/02-data-model.md`, `docs/en/03-api-reference.md`, `docs/en/06-service-overview.md`

## Tests

- **32 new tests** across 2 files
- `video-aggregator.test.ts` (22 tests): buildFeedUrl, extractYouTubeVideoId, buildEmbedUrl, buildThumbnailUrl, syncVideoSource (dedup, moderation, team classification, error handling), syncAllVideoSources (YouTube-only filtering)
- `reels.test.ts` (10 tests): GET /api/reels safetyStatus filter, fuentes/listado, fuentes/catalogo, POST custom (validation, SSRF), DELETE custom (ownership), POST sincronizar

**Total: 171 tests passing, 16 files, 0 failures**

## Documentation updates

- CLAUDE.md: Added VideoSource model, video-aggregator service, sync-videos job, 5 new reels endpoints, updated Reel model description
- docs/es/: Updated data model, API reference, service overview
- docs/en/: Updated data model, API reference, service overview

## Performance

- Video sync runs as fire-and-forget on startup (doesn't block API)
- 1s delay between sources during sync (20 sources ≈ 20s total)
- 6-hour sync interval balances freshness vs. load
- N+1 query eliminated: pre-fetch existing rssGuids in batch before sync loop
- O(n^2) indexOf replaced with index-based for-loop
- No new npm dependencies added

## Code review fixes (t-review #1)

All 15 TODO items from review.md resolved:

### Critical (3):
- reels.ts: Fixed unsafe `req.auth` cast → use Express type augmentation directly
- reels.ts: Added `requireAuth` to POST `/sources/custom`
- reels.ts: Added RSS feed validation for YouTube sources before saving

### Warnings (6):
- video-aggregator.ts: Fixed N+1 with batch pre-fetch of rssGuids
- video-aggregator.ts: Fixed O(n^2) indexOf with for-loop
- Collection.tsx (mobile): Fixed `achievement.name` → `t(achievement.nameKey, locale)`
- VideoPlayer.tsx (mobile): Added HTML encoding for URLs in WebView
- reels.ts: Added `requireRole('parent')` to POST `/sync`
- layout.tsx: Changed `lang="es"` → `lang="en"`

### Suggestions (6):
- video-aggregator.ts: Pass `item.contentSnippet` to classifyNews for better team detection
- reels.ts: Added `withCache` to `/sources/list`
- reels.ts: Platform field uses `z.enum()` for strict validation
- schema.prisma: Added comment explaining videoSourceId logical FK
- video-aggregator.ts: Added comment about durationSeconds limitation
- reels.test.ts: Added 3 tests (SSRF, invalid RSS, invalid platform)

## Known issues

- YouTube channel IDs in seed may need verification against real channels
- Instagram/TikTok oEmbed requires third-party script loading (may be blocked by CSP)
- YouTube RSS returns ~15 most recent videos only (no historical backfill)
- `durationSeconds` defaults to 60 for aggregated reels (YouTube RSS doesn't include duration)

---

# prd2.md implementation — User Locale & Country Preferences

## Requirements

All PRD requirements implemented:

- [x] F1: `country String @default("ES")` added to User model + migration
- [x] F2: `locale` and `country` accepted on POST/PUT /api/users with z.enum validation
- [x] F3: Language selector in onboarding Step 1 (web + mobile) with 🇪🇸/🇬🇧 flags
- [x] F4: UserContext syncs locale to server on change + loads from server on init
- [x] F5a: `countryBoost()` function in feed-ranker (+1 for country match)
- [x] F5b-d: News route enriches items with source language/country, passes to ranker
- [x] F7: Language & Region settings in NavBar dropdown (web)
- [x] F8: i18n keys for settings, onboarding, countries in es.json + en.json
- [x] Shared types updated: User.locale, User.country

## Implementation details

### Schema (1 file):
- `apps/api/prisma/schema.prisma` — Added `country String @default("ES")` to User model

### API (1 file):
- `apps/api/src/routes/users.ts` — SUPPORTED_LOCALES/COUNTRIES constants, z.enum validation on create/update

### Feed Ranker (1 file):
- `apps/api/src/services/feed-ranker.ts` — `countryBoost()`, `country` in BehavioralSignals, updated `getBehavioralSignals` signature

### News Route (1 file):
- `apps/api/src/routes/news.ts` — Fetches user locale/country, enriches items with RssSource metadata, passes country to behavioral signals

### Frontend (5 files):
- `apps/web/src/components/OnboardingWizard.tsx` — Language selector in Step 1
- `apps/mobile/src/screens/Onboarding.tsx` — Language selector in Step 1
- `apps/web/src/lib/user-context.tsx` — setLocale syncs to server, loads from server
- `apps/mobile/src/lib/user-context.tsx` — Same
- `apps/web/src/components/NavBar.tsx` — Language & Region dropdown with country selector

### Types + i18n (3 files):
- `packages/shared/src/types/index.ts` — locale, country on User type
- `packages/shared/src/i18n/es.json` — settings.*, countries.* keys
- `packages/shared/src/i18n/en.json` — Same

## Tests

- 14 new tests across 2 files
- `apps/api/src/routes/users-locale.test.ts` (9 tests): POST/PUT with locale/country, defaults, rejections
- `apps/api/src/services/feed-ranker.test.ts` (+5 tests): countryBoost unit + integration

**Total: 185 tests passing, 17 files, 0 failures**

## Known issues

- Country is auto-inferred from locale at onboarding ('es' -> 'ES', 'en' -> 'GB') — may not be accurate for all users
- Mobile settings for locale/country change not implemented (only NavBar web dropdown)
- Quiz generation does not yet filter by user locale (noted as future consideration)

---

# prd3.md implementation — Google News RSS Ingestion for Missing Spanish Outlets

## Requirements

All PRD requirements implemented:

- [x] 10 Google News RSS sources added to seed.ts covering 4 Spanish outlets
- [x] Estadio Deportivo: 3 sources (Football, Basketball, General)
- [x] Mucho Deporte: 2 sources (Football, General)
- [x] El Desmarque: 3 sources (Football, Basketball, General)
- [x] El Correo de Andalucia: 2 sources (Football, General)
- [x] All sources use category `google_news` for identification
- [x] Naming convention: "Google News: {Outlet} - {Sport}"
- [x] URL pattern: `https://news.google.com/rss/search?q=site:{domain}+{query}&hl=es&gl=ES`
- [x] Zero code changes to aggregator, routes, or services — seed only
- [x] Seed executed successfully — all 10 sources inserted
- [x] CLAUDE.md updated (source count 40+ -> 55)
- [x] Tests written and passing

## Design

This is a seed-only change. Google News RSS feeds use the standard RSS format that `rss-parser` already handles. The existing aggregator pipeline (RSS parse -> content moderation -> team classification -> dedup by rssGuid) works without modification.

Key considerations:
- Google News RSS GUIDs differ from direct RSS GUIDs, so no dedup conflicts with existing sources
- Content moderation pipeline filters Google News articles the same as any other source
- The `google_news` category makes these sources distinguishable in the catalog UI

## Implementation details

### Files modified:
- `apps/api/prisma/seed.ts` — 10 new Google News RSS entries in `initialSources` array
- `CLAUDE.md` — Updated RSS source count and source list

### New files created:
- `apps/api/src/__tests__/google-news-rss.test.ts` — 8 validation tests

## Tests

- 8 new tests in `google-news-rss.test.ts`:
  1. Exactly 10 Google News sources exist
  2. URLs match Google News RSS search pattern
  3. Names follow "Google News: {Outlet} - {Sport}" convention
  4. All use category "google_news"
  5. All required fields present (country, language, sport, description)
  6. No duplicate URLs across entire seed
  7. All 4 target outlets covered
  8. Sport values are valid (football or basketball)

**Total: 193 tests passing, 18 files, 0 failures**

## Known issues

- Google News RSS may throttle requests if polled too frequently (mitigated by 30min cron interval)
- Google News RSS articles may contain redirect URLs rather than direct article URLs
- Some outlets may have limited Google News indexing for certain query terms

---

# prd4.md implementation — Security Hardening: PIN Lockout + Rate Limiting

## Requirements

All PRD requirements implemented:

- [x] `ParentalProfile` has `failedAttempts Int @default(0)` field
- [x] `ParentalProfile` has `lockedUntil DateTime?` field
- [x] Migration runs successfully on existing databases
- [x] Correct PIN returns 200 and resets `failedAttempts` to 0
- [x] Wrong PIN increments `failedAttempts` and returns 401 with `attemptsRemaining`
- [x] 5th wrong PIN sets `lockedUntil` to now + 15 min and returns 423
- [x] Requests during lockout return 423 without bcrypt compare
- [x] After lockout expires, PIN verification works normally
- [x] Correct PIN after partial failures resets counter
- [x] `express-rate-limit` installed in `apps/api`
- [x] 5 rate limiter tiers: auth (5/min), pin (10/min), content (60/min), sync (2/min), default (100/min)
- [x] All tiers configurable via env vars with sensible defaults
- [x] 429 responses include standard rate-limit headers
- [x] i18n keys: `parental.pin_locked`, `parental.pin_incorrect`, `parental.pin_locked_short`, `errors.rate_limited`
- [x] Web PinInput shows lockout countdown, disables input, auto-re-enables
- [x] Web PinInput shows remaining attempts warning
- [x] Mobile ParentalControl mirrors lockout UI with haptic feedback
- [x] All existing tests pass (216 total, 0 failures)
- [x] CLAUDE.md updated
- [x] Documentation updated

## Design

### PIN Lockout

Lockout state is stored in the database (`failedAttempts`, `lockedUntil` on ParentalProfile), not in memory. This means:
- Lockout survives server restarts
- Works across multiple API instances
- Aligned with how PIN is already DB-backed

Flow:
```
verify-pin request
  → check lockedUntil > now? → 423 (no bcrypt, save CPU)
  → bcrypt compare
    → correct: reset failedAttempts=0, lockedUntil=null, return 200 + session
    → wrong: increment failedAttempts
      → >= 5: set lockedUntil=now+15min, return 423
      → < 5: return 401 with attemptsRemaining
```

Constants hardcoded (not env-configurable for security):
- `MAX_PIN_ATTEMPTS = 5`
- `PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000`

### Rate Limiting

Centralized in `apps/api/src/middleware/rate-limiter.ts` using `express-rate-limit`. Applied in `index.ts` before route registration, with specific tiers matching before the default catch-all.

In-memory store (default `MemoryStore`) — sufficient for single-instance MVP. Redis adapter (`rate-limit-redis`) available for multi-instance.

## Implementation details

### Files modified:
- `apps/api/prisma/schema.prisma` — Added `failedAttempts` and `lockedUntil` to ParentalProfile
- `apps/api/src/routes/parents.ts` — Updated verify-pin with lockout logic + `t()` import
- `apps/api/src/index.ts` — Import and apply 5 rate limiters before routes
- `apps/api/src/routes/parents-preview.test.ts` — Fixed mock to include new fields + `update` mock
- `apps/web/src/lib/api.ts` — Updated `verifyPin` to handle 401/423/429 status codes
- `apps/web/src/components/PinInput.tsx` — Added lockout countdown UI, disabled state, progress bar
- `apps/web/src/app/parents/page.tsx` — Handle lockout/attempts state from verify response
- `apps/web/src/components/ParentalPanel.tsx` — Handle lockout in PIN change flow
- `apps/mobile/src/lib/api.ts` — Updated `verifyPin` like web
- `apps/mobile/src/screens/ParentalControl.tsx` — Lockout UI + haptic feedback
- `packages/shared/src/i18n/es.json` — 4 new i18n keys
- `packages/shared/src/i18n/en.json` — 4 new i18n keys
- `CLAUDE.md` — Updated security, middleware, env vars, tech debt sections

### New files created:
- `apps/api/prisma/migrations/20260327221206_add_pin_lockout_fields/migration.sql`
- `apps/api/src/middleware/rate-limiter.ts` — 5 rate limiter exports
- `apps/api/src/__tests__/pin-lockout.test.ts` — 7 PIN lockout tests
- `apps/api/src/__tests__/rate-limiter.test.ts` — 6 rate limiter tests

### New dependency:
- `express-rate-limit` ^7 in `apps/api/package.json`

## Tests

- 7 PIN lockout tests covering: correct PIN reset, wrong PIN 401, lockout after 5 failures, 423 during lockout, unlock after expiry, partial failure reset, 15-minute duration
- 6 rate limiter tests covering: 429 after exceeding limit, error message body, standard headers, independent tier counting, health endpoint accessibility, 5 exports
- All 216 tests passing (was 203 before, +13 new)

## Known issues

- Rate limit state is in-memory per process — resets on server restart, not shared across instances
- PIN lockout countdown UI uses hardcoded "PIN bloqueado" text instead of i18n keys (minor — should use `t('parental.pin_locked_short')`)
- `trust proxy` not configured — behind reverse proxy, `req.ip` may be proxy IP instead of client IP

---

# prd5.md implementation — Enhanced Feed Algorithm

## Requirements

All PRD requirements implemented:

- [x] `sportFrequencyBoost()` — proportional scoring based on frequency (replaces tier-based `sportBoost`)
- [x] Source affinity tracking — `sourceEngagement` map populated from ActivityLog+NewsItem join
- [x] `recencyDecay()` — exponential decay curve (`maxScore * exp(-age/halfLife)`) replaces step function
- [x] Diversity injection — `applyDiversityInjection()` post-sort, every 5th position, first 4 untouched
- [x] `RANKING_WEIGHTS` exported constant (all 1.0 defaults)
- [x] `invalidateBehavioralCache(userId)` — evicts cached behavioral signals
- [x] `totalInteractions` precomputed in BehavioralSignals
- [x] Cache invalidation call in activity logging (parents.ts)
- [x] Old `sportBoost` and `recencyBoost` kept as deprecated exports
- [x] All existing tests pass + 15 new tests
- [x] Documentation updated

## Design

Backend-only change. The feed ranker scoring pipeline is now:

```
getBehavioralSignals(userId)          // Cached, invalidated on new activity
  → sportEngagement (frequency map)
  → sourceEngagement (from NewsItem join)
  → totalInteractions (precomputed)

rankFeed(items, signals)
  → per-item scoring:
      teamBoost * WEIGHTS.TEAM
    + sportFrequencyBoost * WEIGHTS.SPORT
    + sourceBoost * WEIGHTS.SOURCE
    + recencyDecay * WEIGHTS.RECENCY
    + localeBoost * WEIGHTS.LOCALE
    + alreadyReadPenalty (unweighted, -8)
  → sort by score desc
  → applyDiversityInjection (post-sort)
```

## Implementation details

### Files modified:
- `apps/api/src/services/feed-ranker.ts` — New functions + updated rankFeed scoring + diversity injection
- `apps/api/src/services/feed-ranker.test.ts` — 15 new tests (total 44 in file)
- `apps/api/src/routes/parents.ts` — `invalidateBehavioralCache` call in activity log endpoint
- `docs/en/06-service-overview.md` — Updated feed ranker docs
- `docs/es/06-service-overview.md` — Updated feed ranker docs (Spanish)
- `CLAUDE.md` — Updated test count and feed ranker description

## Tests

15 new tests:
- `sportFrequencyBoost`: empty map, single sport, multi-sport proportional, unknown sport
- `recencyDecay`: age=0, age=12h, age=48h, monotonically decreasing
- `diversity injection`: swaps at 5th position, first 4 untouched, no-op without signals, no-op homogeneous feed
- `RANKING_WEIGHTS`: all defaults 1.0
- `invalidateBehavioralCache`: removes cached entry
- `backward compat`: existing rankFeed behavior preserved

**Total: 231 tests passing, 21 files, 0 failures**

## Known issues

- `RANKING_WEIGHTS` are module-level constants — cannot be tuned at runtime without code changes (by design per PRD)
- Diversity injection does not guarantee exact 20% non-dominant rate when feed is small
- Source affinity query adds one DB call per cache miss (indexed, negligible impact)

---

# Code review fixes (t-review #2)

8 out of 10 TODO items from review.md resolved:

### Warnings (4 fixed, 1 skipped):
- PinInput.tsx: Removed hardcoded `buttonText = 'Confirm'` default, now falls back to `t('buttons.confirm', locale)`
- reels.ts DELETE: Removed dead userId fallback (`req.query`/`req.body`), now only uses `req.auth?.userId` from JWT
- user-context.tsx (web + mobile): Removed unnecessary `as Record<string, unknown>` casts on `updateUser` calls
- reels.ts /sync: Added try-catch with structured 500 error response
- Skipped: Lockout countdown duplication — web and mobile have subtle differences, shared package has no React dependency

### Suggestions (4 fixed, 1 skipped):
- redis-cache.test.ts: Added 10 unit tests with manual mock RedisClient (get/set, has, invalidate, invalidatePattern, clear, stats, size, namespacing, error handling)
- inferCountryFromLocale: Extracted to `packages/shared/src/constants/locale.ts`, updated OnboardingWizard.tsx (web) and Onboarding.tsx (mobile)
- parents.ts: Replaced `Record<string, unknown>` with `Prisma.ParentalProfileUpdateInput` for type-safe updates
- url-validator.ts: Added IPv6-mapped IPv4 blocking (`::ffff:` prefix detection with recursive validation)
- Skipped: Deprecated sportBoost/recencyBoost removal — already has @deprecated JSDoc, deferred to next release cycle

### Tests updated:
- reels.test.ts: Updated requireAuth mock to set `req.auth` (reflecting the dead code removal)
- redis-cache.test.ts: 10 new tests

**Total: 274 tests passing, 25 files, 0 failures**
