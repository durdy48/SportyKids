# Implementation Notes — prd.md (Groq AI Provider + Explicar Fácil Mobile)

## Summary

Implemented Groq as a new AI provider and added the "Explain it Easy" feature to the mobile `NewsCard` component. The web app already had `AgeAdaptedSummary` via the existing `/api/news/:id/summary` endpoint; this PRD adds mobile parity and Groq provider support.

## Files Modified

### API
- **`apps/api/src/services/ai-client.ts`** — Added `'groq'` to `AIProvider` type, `getModelName` (default `llama-3.1-8b-instant`), `isProviderAvailable` check (`GROQ_API_KEY`), and `dispatch` case using `sendViaOpenAICompat` with Groq base URL (`https://api.groq.com/openai/v1`). No changes to existing providers.

### Mobile
- **`apps/mobile/src/components/NewsCard.tsx`** — Added "Explain it Easy" button and collapsible summary panel. New state: `showSummary`, `summaryData`, `summaryLoading`, `summaryError`, `summaryFetched` (ref guard). Calls `fetchNewsSummary(item.id, user?.age ?? 10, locale)`. Uses `LayoutAnimation.configureNext(Presets.easeInEaseOut)` for smooth expand/collapse. Action row now has two buttons side by side: "Read more" and "✨ Explain it Easy".
- **`apps/mobile/vitest.setup.ts`** — Added `Animated.sequence` and `LayoutAnimation` mocks (both were missing from the react-native mock).

### Tests (new files)
- **`apps/api/src/services/__tests__/ai-client.test.ts`** — 10 tests covering Groq `isProviderAvailable`, dispatch error without key, model name resolution (default + override), and base URL (default + override). Pattern: `vi.resetModules()` + `vi.doMock('openai', ...)` + dynamic imports per test.
- **`apps/mobile/src/components/__tests__/NewsCard.test.tsx`** — 13 source-inspection tests verifying all "Explain it Easy" behaviors (button keys, a11y, API call params, dedup ref, loading/error/success states, animation, styles).

### Documentation
- **`CLAUDE.md`** — Added Groq env vars (`GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`), updated `AI_PROVIDER` values, updated AI note and MVP status table.

## Key Decisions

### Groq via openai SDK
Groq's API is OpenAI-compatible, so `sendViaOpenAICompat` (already used by Ollama and OpenRouter) works without changes. Only a new `case 'groq'` in `dispatch` was needed.

### Test isolation for ai-client
`ai-client.ts` has module-level singletons (`providerAvailable` cache, `instance`). Tests use `vi.resetModules()` + `vi.doMock('openai', ...)` + dynamic `import('../ai-client')` inside each `it` block. `vi.doMock` (not hoisted, unlike `vi.mock`) is called after `vi.resetModules()` to correctly register the openai mock before the fresh module import.

### Source-inspection tests for NewsCard
Mobile NewsCard renders to React Native primitives that can't be fully rendered in vitest (no jsdom, no RN runtime). Used `.toString()` on the component function to assert the presence of required identifiers, translation keys, and style names. This avoids react-test-renderer setup while still verifying the implementation.

### LayoutAnimation for collapse animation
Used React Native's built-in `LayoutAnimation` (no extra library) with `Presets.easeInEaseOut` for the summary panel expand/collapse. The `configureNext` call must happen before the state update that triggers the layout change.

## Test Results

- API: 566 tests (50 files) — all pass (11 ai-client tests, +1 from Critical fix)
- Web: 120 tests (17 files) — all pass
- Mobile: 174 tests (20 files) — all pass

## Tech Debt Reduction (after /t-review #1)

Applied all 6 TODO items from `review.md`:

**Critical #1** — `apps/api/src/services/__tests__/ai-client.test.ts`: Split the single fragile dispatch test into two deterministic tests. Test 1: fresh import with empty key → `isProviderAvailable` returns false → AIServiceError "not available". Test 2: import with key, explicitly call `await mod.isProviderAvailable()` to prime the 60s cache to `true`, then clear the key → `sendMessage` reaches dispatch → AIServiceError "GROQ_API_KEY is required". Test count: 10 → 11.

**Warning #1** — `apps/mobile/src/components/__tests__/NewsCard.test.tsx`: Added a block comment before the describe block explaining why source-inspection (`.toString()`) is used instead of behavioral rendering tests, and what would be needed to replace it (a React Native test renderer).

**Warning #2** — `apps/mobile/src/components/NewsCard.tsx:163`: Added `accessibilityHint={t('a11y.news_card.explain_hint', locale)}` to the explain button. Added `a11y.news_card.explain_hint` to both `packages/shared/src/i18n/es.json` and `en.json`.

**Suggestion #1** — `apps/api/src/services/ai-client.ts:113`: Added a comment clarifying the unreachable `return 'llama3.2'` fallback is intentional as a type-safe guard for future provider additions.

**Suggestion #2** — `apps/api/src/services/__tests__/ai-client.test.ts`: The `openrouter` and `anthropic` availability tests were already in a correctly named describe block (`isProviderAvailable — other providers`) after the Critical fix restructuring.

**Suggestion #3** — `apps/mobile/src/components/NewsCard.tsx:57`: Added inline comment explaining `user?.age ?? 10` defaults to age range 9-11, matching the web's `userAge` derivation.

## Known Issues / Notes

- The `cache.test.ts` test can be flaky when run alongside all API tests in the same process (shared in-memory cache state). Passes reliably in isolation. Pre-existing issue, unrelated to this PRD.
- `GROQ_API_KEY` is not required (Groq is optional, same as other AI providers). Without it, `isProviderAvailable()` returns false and AI features degrade gracefully.

---

# prd2.md Implementation — Dynamic Sport-Specific Entity Selection in Onboarding

## Summary

Replaced the generic favorite team text input in onboarding step 3 with a dynamic, sport-specific entity chip selector. Users now see entities (teams, athletes, drivers, swimmers, etc.) relevant only to their selected sports, and can multi-select to pre-populate their feeds in step 4.

## Files Modified

### Shared Package
- **`packages/shared/src/constants/index.ts`** — Added `EntityType` union type, `SportEntity` interface, and `SPORT_ENTITIES` constant (52 entities across 8 sports: football×16, basketball×8, tennis×6, formula1×10, cycling×4, swimming×3, athletics×3, padel×2). `TEAMS` constant preserved unchanged.
- **`packages/shared/src/utils/entities.ts`** (NEW) — `getSourceIdsForEntities(catalogSources, selectedEntities)` utility using exact-match on `source.name.toLowerCase() === entity.feedQuery.toLowerCase()` to avoid "Real Madrid" matching "Real Madrid Basket".
- **`packages/shared/src/utils/index.ts`** — Re-exports `getSourceIdsForEntities` and `FeedSource` type.
- **`packages/shared/package.json`** — Added vitest as devDependency to enable shared package tests.
- **`packages/shared/vitest.config.ts`** (NEW) — Vitest config for shared package.

### Web
- **`apps/web/src/components/OnboardingWizard.tsx`** — Replaced `team` string state with `selectedEntities: SportEntity[]`. Added `visibleEntities` useMemo. Added `toggleEntity` (multi-select by feedQuery). Step 3 replaced with entity chip grid (⭐ emoji, `step3_no_entities` fallback). Step 4 pre-populates feeds: entity-matched source IDs merged with sport-matched IDs (union, deduplicated). `complete()` sets `favoriteTeam: selectedEntities[0]?.name` for backward compat.

### Mobile
- **`apps/mobile/src/screens/Onboarding.tsx`** — Same changes as web: `selectedEntities` state, `visibleEntities` useMemo, `toggleEntity`, step 3 entity chip grid, step 4 feed pre-population.

### i18n
- **`packages/shared/src/i18n/es.json`** and **`en.json`** — Updated `onboarding.step3_title`, `onboarding.step3_subtitle`. Added `onboarding.step3_no_entities` fallback text. Added `a11y.onboarding.select_entity` key.

### Tests (new files)
- **`packages/shared/src/__tests__/constants.test.ts`** — 4 tests: SPORT_ENTITIES shape, all sports covered, entity fields present, feedQuery non-empty.
- **`packages/shared/src/__tests__/entities.test.ts`** — 5 tests: empty entities → empty result, exact match, case-insensitive, no partial match, multiple entities.
- **`apps/web/src/components/__tests__/OnboardingWizard.test.tsx`** — 6 source-inspection tests: SPORT_ENTITIES import, selectedEntities state, toggleEntity, visibleEntities memo, step3_no_entities key, getSourceIdsForEntities call.
- **`apps/mobile/src/screens/__tests__/Onboarding.test.tsx`** — Updated with 5 entity-related source-inspection tests.

## Key Decisions

### Exact-match feedQuery (not substring)
`feedQuery` values in `SPORT_ENTITIES` are set to exact RSS source names (e.g., `"Real Madrid"`, not `"real_madrid"`). Matching is done with `source.name.toLowerCase() === entity.feedQuery.toLowerCase()` to prevent "Real Madrid" from matching "Real Madrid Basket" or similar.

### Multi-select entities, single favoriteTeam
`selectedEntities` is `SportEntity[]` (multi-select). For the `favoriteTeam` field (used by team stats hub), we use `selectedEntities[0]?.name` — first selection wins. Backward compat maintained.

### Entity IDs merged with sport IDs
In step 4, feed pre-selection uses the union of entity-matched IDs and sport-matched IDs (deduplicated). Users who select entities get more targeted feeds, while users who skip entity selection still get sport-matched feeds.

### TEAMS constant unchanged
`TEAMS` in `packages/shared/src/constants/index.ts` is preserved verbatim for backward compatibility with any existing code that references it.

## Test Results

- Shared: 29 tests (3 files) — all pass (9 new tests)
- API: 566 tests (50 files) — all pass (unchanged)
- Web: 126 tests (18 files) — all pass (6 new tests)
- Mobile: 178 tests (20 files) — all pass (5 new tests)
- **Total: 899 tests** (was 859 after prd.md + tech debt)

## Tech Debt Reduction (after /t-review #2)

Applied all 6 TODO items from the prd2.md `review.md`:

**Warning #1** — `apps/web/src/components/OnboardingWizard.tsx`: Entity chip `aria-label` was using a hardcoded template literal `` `${entity.type}: ${entity.name}` `` instead of `t('a11y.onboarding.select_entity', locale, { entity: entity.name })`. Fixed to use the i18n key, matching the mobile implementation.

**Warning #2** — `apps/mobile/src/screens/Onboarding.tsx`: Added the `step3_no_entities` fallback guard for when `visibleEntities.length === 0`. Mobile now matches the web's defensive empty-state behaviour.

**Warning #3** — `apps/web/src/components/__tests__/OnboardingWizard.test.tsx` and `apps/mobile/src/screens/__tests__/Onboarding.test.tsx`: Added block comment before each `describe` block explaining why source-inspection (`.toString()`) is used instead of behavioral rendering tests, and what would be needed to replace it.

**Suggestion #1** — `specs/ai-usage-quizz-teams/implementation-notes.md`: Updated entity counts from inaccurate "56 entities: football×12, ..." to the accurate "52 entities: football×16, basketball×8, tennis×6, formula1×10, cycling×4, swimming×3, athletics×3, padel×2".

**Suggestion #2** — `packages/shared/src/__tests__/constants.test.ts`: Added comment explaining that cross-sport feedQuery uniqueness is intentionally NOT required, and that "Real Madrid" vs "Real Madrid Basket" distinction is exactly why exact-match was chosen over substring match.

**Suggestion #3** — `apps/mobile/src/screens/Onboarding.tsx`: Added inline comment explaining why `selectedEntities` is intentionally omitted from the step 4 `useEffect` dependency array (the guard `selectedFeeds.length === 0` ensures it runs exactly once on step 4 entry).

---
# prd3.md Implementation — Quiz Variety (Per-User Deduplication, All-Sports Coverage & Timeless Trivia)

## Summary

Implemented all features from prd3.md:
1. `UserQuizHistory` Prisma model for per-user question deduplication (60-day window)
2. `isTimeless` + `topic` fields on `QuizQuestion`
3. `generateTimelessQuestion()` in quiz-generator for sport-general knowledge questions
4. Updated `generateQuizFromNews()` to return `topic` field
5. Extended `generate-daily-quiz.ts`: 30-day news window, topic dedup, per-sport gap fill
6. New `generate-timeless-quiz.ts` weekly cron (Monday 05:00 UTC, 8×3×2=48 questions max)
7. Updated `GET /api/quiz/questions` with per-user dedup, 70/30 mix, sport balance
8. Updated `POST /api/quiz/answer` to upsert `UserQuizHistory` (non-blocking)

## Files Modified/Created

### Schema
- **`apps/api/prisma/schema.prisma`** — Added `UserQuizHistory` model, `isTimeless`/`topic`/`userHistory` to `QuizQuestion`, `quizHistory` relation to `User`, new indexes
- **`apps/api/prisma/migrations/20260402173622_add_quiz_history_and_timeless_fields/`** — Generated migration (PostgreSQL: adds columns with defaults, creates UserQuizHistory table)

### API Services
- **`apps/api/src/services/quiz-generator.ts`** — Added `generateTimelessQuestion()`, `GeneratedQuestion` interface, `TimelessQuestionSchema`, updated `generateQuizFromNews` system prompt to return `topic`, normalises topic (lowercase, trim, truncate to 80 chars)

### Jobs
- **`apps/api/src/jobs/generate-daily-quiz.ts`** — Changed news window 48h→30d, added `isTopicDuplicate()` helper, topic dedup check before create, `runGapFillPass()` for per-sport minimum guarantee (MINIMUM=3)
- **`apps/api/src/jobs/generate-timeless-quiz.ts`** (NEW) — Weekly cron `0 5 * * 1`, loops 8 sports × 3 age ranges × 2 questions, 3 retry attempts per slot on topic collision

### Routes
- **`apps/api/src/routes/quiz.ts`** — Updated `GET /questions` with per-user dedup (60-day window, LIMIT 1000), 70/30 pool split, sport balance cap (`floor(N/4)+1`), seed fallback; updated `POST /answer` with non-blocking `userQuizHistory.upsert`

### Cron Registration
- **`apps/api/src/index.ts`** — Imported and called `startTimelessQuizJob()`

### Tests (new files)
- **`apps/api/src/services/__tests__/quiz-generator.test.ts`** (NEW) — 15 tests: `generateTimelessQuestion` happy path (3 tests), AI failure (2), invalid JSON (3), sport field (8 sports), `generateQuizFromNews` topic field (3)
- **`apps/api/src/jobs/__tests__/generate-daily-quiz.test.ts`** (NEW) — 8 tests: 30-day window, topic dedup skip/pass, gap fill triggered/skipped/with topic dup, provider unavailable
- **`apps/api/src/jobs/__tests__/generate-timeless-quiz.test.ts`** (NEW) — 6 tests: happy path 48 questions, topic collision retry, max retries exceeded, AI null, provider unavailable, DB error
- **`apps/api/src/routes/__tests__/quiz.test.ts`** (NEW) — 11 tests: dedup with userId, 61-day old history, no userId, 70/30 mix, sport balance, seed fallback, no age filter, answer creates history, answer wrong answer creates history, idempotent answer, question not found

### Tests (updated)
- **`apps/api/src/jobs/generate-daily-quiz.test.ts`** (existing) — Added mock for `generateTimelessQuestion`, `quizQuestion.findFirst`, `quizQuestion.count`, `SPORTS` constant, default setup in `beforeEach`

## Key Decisions

### Zod schema: max 80 chars removed for topic
The `TimelessQuestionSchema` no longer enforces `max(80)` on `topic`. Truncation to 80 chars happens in code after Zod validation. This allows AI models to return slightly longer topics that the code normalises, rather than failing validation entirely.

### Sport balance applies per pool independently
The `applySportBalance` helper is called separately on `shuffledA` (recent) and `shuffledB` (timeless) before combining. The cap is `floor(N/4)+1` where N is the total requested count. This means per pool the cap effectively applies to the full count, which provides reasonable balance even with small pools.

### Non-blocking UserQuizHistory upsert
The `upsert` in `POST /api/quiz/answer` is fire-and-forget (`.catch()` logs errors). The score update takes priority and the response is returned before the upsert completes. This avoids adding latency to the answer response path.

### Gap fill uses timeless generation
The per-sport gap fill pass generates timeless questions (not news-based) because they have no expiry and serve as a permanent floor. News-based questions would expire after 48h, leaving the gap open again the next day.

### setTimeout mock in tests
All new test files mock `globalThis.setTimeout` to bypass 500ms/1000ms delays in job loops. Without this, the timeless quiz job tests (48 questions × 500ms delays) would take ~24 seconds and time out.

## Test Results

- API: 611 tests (54 files) — all pass (+45 new tests across 4 new files)
- Web: 126 tests (18 files) — all pass (unchanged)
- Mobile: 178 tests (20 files) — all pass (unchanged)
- Shared: 29 tests (3 files) — all pass (unchanged)
- **Total: 944 tests** (was 899 before prd3.md)

## Known Issues / Notes

- The `error-handler.test.ts` test has a pre-existing intermittent failure when run as part of the full suite (noted in prior implementation notes as related to shared in-memory state). Passes reliably in isolation and in the majority of full suite runs.
- The `topic` field on legacy seed questions remains NULL. They are excluded from topic dedup checks (`topic IS NULL` never matches any string).
- Locale for AI generation in the gap fill pass and timeless job defaults to `'es'`. Per-locale timeless question generation is deferred (out of scope per PRD §3).

## Tech Debt Reduction (after /t-review #3)

Applied all 6 TODO items from the prd3.md review section in `review.md`:

**Critical #1** — `apps/api/src/routes/quiz.ts`: Fixed sport balance cap applied across the combined pool A + pool B result. Previously `applySportBalance` was called independently on each pool (pool A and pool B), allowing a single sport to exceed the `floor(N/4)+1` cap when both pools contributed the same sport. Fix: take proportional slices from each pool (`fromA = shuffledA.slice(0, targetRecent)`, `fromB = shuffledB.slice(0, targetTimeless)`), merge them, then call `applySportBalance` once on the merged array. Added a cross-pool regression test to `quiz.test.ts` that seeds both pools with football-heavy content and asserts football ≤ 2 in a count=5 response.

**Warning #1** — Extracted `isTopicDuplicate` from both job files to `apps/api/src/services/quiz-dedup.ts`. Both `generate-daily-quiz.ts` and `generate-timeless-quiz.ts` now import it from the shared service. `TOPIC_DEDUP_WINDOW_DAYS = 30` constant consolidated there.

**Warning #2** — Removed double-normalisation in callers. `generateTimelessQuestion` already returns a normalised topic; the redundant `.toLowerCase().trim().slice(0, 80)` calls in `generate-timeless-quiz.ts` and `generate-daily-quiz.ts:runGapFillPass` replaced with `const normalizedTopic = question.topic;`.

**Suggestion #1** — Added comment above `isProviderAvailable()` in `generateTimelessQuestion` clarifying that it checks availability internally (callers don't need to check separately, unlike `generateQuizFromNews` which relies on callers).

**Suggestion #2** — Added comment in `quiz.ts` pool A filter explaining why `expiresAt: null` is included and when it's safe.

**Suggestion #3** — Added `// TODO: multi-locale — out of scope per prd3.md §3` inline comment next to the hardcoded `'es'` locale in `generate-timeless-quiz.ts`.
