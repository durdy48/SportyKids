# Code Review: Groq AI Provider + Explicar Fácil Mobile

## Summary

The implementation satisfies every PRD requirement with clean, minimal diffs. The Groq provider follows the established pattern for OpenAI-compatible providers exactly, and the mobile `NewsCard` feature is complete and accessible. There are two real issues to fix: a test that cannot actually exercise the error-throw path as written (the `providerAvailable` cache blocks it), and a missing `accessibilityHint` on the explain button compared to the heart button's own pattern. The remaining items are low-priority suggestions. No security or data-flow problems were found.

---

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| `AIProvider` union includes `'groq'` | §4.1.1 | PASS | Line 12 of `ai-client.ts` |
| `getModelName` returns `llama-3.1-8b-instant` for groq (both purposes) | §4.1.2 | PASS | Lines 104 and 111 |
| `isProviderAvailable` checks `GROQ_API_KEY` presence | §4.1.3 | PASS | Lines 140–141 |
| `dispatch` case 'groq' guards key, uses `sendViaOpenAICompat` with correct base URL | §4.1.4 | PASS | Lines 329–340 |
| `GROQ_BASE_URL` env var overrides base URL | §4.1.4 | PASS | Line 338 |
| `GROQ_MODEL` env var overrides model | §4.1.2 | PASS | Lines 104, 111 |
| No new npm package needed | D2 | PASS | Uses existing `openai` SDK |
| `fetchNewsSummary` already exists in `api.ts`, no changes needed | §4.3 | PASS | Lines 162–170 of `api.ts` |
| "Explain it Easy" button present in mobile `NewsCard` | §4.2.2–4.2.5 | PASS | Lines 157–168 of `NewsCard.tsx` |
| Two-button `actionRow` layout | §4.2.5 | PASS | Lines 138–169 |
| Summary panel shows loading/error/success states | §4.2.5 | PASS | Lines 172–196 |
| `LayoutAnimation.configureNext` called before state update | D4, §4.2.3 | PASS | Lines 48–49 |
| `summaryFetched` ref prevents duplicate API calls | D5, AC-7 | PASS | Lines 32, 52 |
| Empty string treated as error (AC-8) | D6, §4.2.3 | PASS | Lines 59–62 |
| `accessibilityRole="button"` and `accessibilityState={{ expanded }}` on explain button | AC-4 | PASS | Lines 161–162 |
| `accessibilityLabel` uses `summary.explain_easy` key | AC-4 | PASS | Line 163 |
| `explainButtonActive` style turns yellow when open | AC-5 | PASS | Lines 319–322 |
| All UI strings use `t(key, locale)` — no hardcoded text | CLAUDE.md | PASS | All new strings use `t()` |
| All identifiers in English | CLAUDE.md | PASS | No Spanish identifiers introduced |
| `summary.*` i18n keys exist in both `es.json` and `en.json` | PRD §9 (no changes needed claim) | PASS | `explain_easy`, `adapted_for_age`, `loading`, `error` confirmed present |
| `CLAUDE.md` updated with Groq env vars | §4.4 | PASS | (per implementation-notes.md) |
| Unit tests for ai-client (Groq availability, dispatch error, model, base URL) | §7.1 | PARTIAL — see Critical #1 |
| Unit tests for mobile NewsCard | §7.2 | PARTIAL — see Warning #1 |

---

## TODO: Critical Issues (must fix)

- [x] **`apps/api/src/services/__tests__/ai-client.test.ts:90-103`** — The "throws AIServiceError when GROQ_API_KEY is empty" test cannot reach the `dispatch` guard. The module is imported with `GROQ_API_KEY=gsk_key`, so `isProviderAvailable()` sets `providerAvailable = true` and caches it for 60 s. Clearing the key with `vi.stubEnv('GROQ_API_KEY', '')` **after** the import does not reset `providerAvailable`, so `sendMessage` passes the availability check, enters `dispatch`, reads the now-empty env var, and throws — this accidentally works, but only because the 60-second cache happens to have a stale `true` value from the earlier stub. The test is fragile: if `vi.resetModules()` in `beforeEach` runs after another test that left `providerAvailable = false`, this test will throw an `AIServiceError` for the wrong reason (`provider not available` instead of `GROQ_API_KEY is required`). Fix: after `vi.stubEnv('GROQ_API_KEY', '')`, also call `vi.stubEnv('AI_PROVIDER', 'groq')` again and import **freshly** so that `providerAvailable` is `null`. To force dispatch to run with no key, set `GROQ_API_KEY` only after `isProviderAvailable` is bypassed — the simplest fix is to do a fresh import with `GROQ_API_KEY=''` so `isProviderAvailable` returns `false` immediately, then verify the error message is "not available" (which is also a valid test for the graceful-degradation path). Alternatively, split into two tests: one for the availability-false path and one mocking `isProviderAvailable` to return `true`.

---

## TODO: Warnings (should fix)

- [x] **`apps/mobile/src/components/__tests__/NewsCard.test.tsx` (all tests)** — All 13 tests use `NewsCard.toString()` to assert identifier presence. This approach tests that the source code *contains certain strings* rather than that the component *behaves correctly at runtime*. It will give false positives if an identifier is present but unreachable (dead branch), and it will not catch regressions where, for example, `summaryFetched.current` is set before the fetch succeeds (causing the error state to be shown on retry). The PRD (§7.2) explicitly requests behavioral tests: "Pressing the button calls `fetchNewsSummary` once", "While loading, renders `ActivityIndicator`", etc. Given the project uses `vitest` without a full React Native renderer in this environment, the current approach is a pragmatic workaround — but the implementation-notes.md acknowledges it as a limitation. At minimum, add a comment in the test file explaining why source-inspection is used instead of rendering, so future maintainers do not mistake it for the intended testing strategy.

- [x] **`apps/mobile/src/components/NewsCard.tsx:163`** — The explain button has `accessibilityLabel` and `accessibilityRole` but no `accessibilityHint`, unlike the heart button (line 91) which has `accessibilityHint={t('a11y.news_card.save_hint', locale)}`. For a button whose behaviour (expanding a hidden panel) is non-obvious, a hint such as `t('a11y.news_card.explain_hint', locale)` would improve the screen-reader experience for the 6-14 age group this app targets. The i18n key would need to be added to `es.json` / `en.json`.

---

## TODO: Suggestions (nice to have)

- [x] **`apps/api/src/services/ai-client.ts:113`** — The fallback `return 'llama3.2'` at the bottom of `getModelName` is now unreachable because all four providers are handled by explicit `if` guards before it. Consider adding a TypeScript exhaustive-check comment or removing the dead fallback to reduce noise. The compiler does not catch this because `AIProvider` is a string union and the function's return type is inferred as `string`.

- [x] **`apps/api/src/services/__tests__/ai-client.test.ts:74-86`** — The two tests for `openrouter` and `anthropic` availability (lines 74-86) are included in a `describe` block titled "ai-client — Groq provider". They belong in a separate describe for clarity, or in the existing provider tests if such a block exists, rather than being mixed into the Groq-specific suite.

- [x] **`apps/mobile/src/components/NewsCard.tsx:57`** — `user?.age ?? 10` silently defaults to age 10 (mapping to age range 9-11) for users without an `age` field. The PRD documents this is intentional and matches the web's `userAge` derivation. A short inline comment would make the intent explicit for the next developer.

---

## Technical Debt Assessment

No new technical debt was introduced. The implementation is consistent with the existing codebase patterns: Groq follows the exact same code path as OpenRouter, and the mobile feature mirrors the web's `AgeAdaptedSummary` approach. The only pre-existing concern carried into this diff is the source-inspection test strategy for mobile, which is acknowledged in the implementation notes.

---

## Files Reviewed

| File | Notes |
|---|---|
| `apps/api/src/services/ai-client.ts` | Clean. The Groq case is a minimal, correct addition. Types, error handling, env var patterns, and the singleton all conform to the established structure. |
| `apps/mobile/src/components/NewsCard.tsx` | Clean. All new state, handler, JSX, and styles match the PRD spec. `LayoutAnimation.configureNext` is correctly called before the state update. All UI strings use `t()`. No hardcoded user-visible text. |
| `apps/mobile/vitest.setup.ts` | `Animated.sequence` and `LayoutAnimation` mocks are correctly placed in the `react-native` mock object. No issues. |
| `apps/api/src/services/__tests__/ai-client.test.ts` | Good coverage of model resolution and base URL. The dispatch-error test has a fragile dependency on module-singleton state (see Critical #1). |
| `apps/mobile/src/components/__tests__/NewsCard.test.tsx` | All 13 assertions pass the intent check but are source-inspection rather than behavioral (see Warning #1). Mock setup and `beforeEach` cleanup are correct. |
| `apps/mobile/src/lib/api.ts` — `fetchNewsSummary` | Confirmed at lines 162-170: signature matches what `NewsCard.tsx` passes (`newsId: string, age: number, locale: string`). No changes needed, no issues. |
| `packages/shared/src/i18n/es.json` | `summary.explain_easy`, `summary.adapted_for_age`, `summary.loading`, `summary.error` all confirmed present. |
| `packages/shared/src/i18n/en.json` | Same four keys confirmed present. |

---

## Verification

Run on 2026-04-02. All suites run independently from repo root.

| Suite | Files | Tests | Result |
|---|---|---|---|
| API (`apps/api`) | 50 | 565 | ✅ All pass |
| Web (`apps/web`) | 17 | 120 | ✅ All pass |
| Mobile (`apps/mobile`) | 20 | 174 | ✅ All pass |
| **Total** | **87** | **859** | ✅ |

**Lint**: `eslint .` — no errors, no warnings.

**TypeCheck**: Pre-existing errors exist in `push-sender.ts`, `redis-cache.ts`, `subscription.ts`, `ErrorBoundary.tsx`, `ParentalControl.tsx`, `Reels.tsx` (all on `main`, unrelated to this feature). No new typecheck errors introduced by this diff.

Note: the dispatch-error test (Critical #1) currently passes due to incidental cache state. The issue will manifest if test ordering changes. Reproduce by running that single test in isolation first.

---

# Code Review: prd2.md — Dynamic Sport-Specific Entity Selection

## Summary

The implementation correctly replaces the static team text input in onboarding step 3 with a sport-aware, multi-select entity chip grid. All `feedQuery` values have been verified against `apps/api/prisma/seed.ts` and are exact matches. The core logic (exact-match deduplication, `visibleEntities` useMemo, step 4 feed merge) is solid. Two warnings stand out: the web `aria-label` on entity chips uses a hardcoded template string instead of the `t()` helper (inconsistent with the rest of the codebase), and the mobile step 3 omits the `step3_no_entities` fallback that the web correctly includes. Neither breaks functionality but both deviate from project standards.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| `EntityType` union and `SportEntity` interface in constants | §4.1 | PASS | `packages/shared/src/constants/index.ts` lines 87–99 |
| `SPORT_ENTITIES` covers all 8 SPORTS keys | §4.1 | PASS | All 8 sports present; verified against seed |
| All `feedQuery` values exactly match seed source names | §4.1, D3 | PASS | Every value verified against `apps/api/prisma/seed.ts` (see notes below) |
| `TEAMS` constant preserved unchanged | §4.1, D5, AC-12 | PASS | `TEAMS` is untouched |
| Exact-match logic in `getSourceIdsForEntities` (`===`, not `includes`) | §4.2, D3 | PASS | `entities.ts` line 19: `querySet.has(source.name.toLowerCase())` |
| "Real Madrid" does NOT match "Real Madrid Basket" | AC-9 | PASS | Set lookup prevents substring collision |
| `getSourceIdsForEntities` in shared utils, exported from `utils/index.ts` | §4.7 | PASS | Exported at line 39 of `utils/index.ts` |
| Web: `team` state removed, `selectedEntities: SportEntity[]` added | §4.3 | PASS | `OnboardingWizard.tsx` line 40 |
| Web: `visibleEntities` useMemo filters by selected sports | §4.3 | PASS | Lines 132–134 |
| Web: `toggleEntity` uses `feedQuery` as identity key | §4.3 | PASS | Lines 136–141 |
| Web: step 3 renders entity chip grid with `⭐` emoji | §4.3, AC-11 | PASS | Lines 416–456 |
| Web: `step3_no_entities` fallback when `visibleEntities.length === 0` | §4.3 | PASS | Line 428 |
| Web: step 4 merges entity IDs with sport IDs (union/dedup) | §4.3, AC-7, AC-8 | PASS | Lines 79–84 |
| Web: `favoriteTeam: selectedEntities[0]?.name` backward compat | §4.3 | PASS | `complete()` line 241 |
| Web: step 3 is optional (`canAdvance` returns true) | §4.3, AC-6 | PASS | Line 221 |
| Mobile: mirrors all web changes | §4.5 | PASS (partial) | Missing `step3_no_entities` fallback — see Warning #1 |
| Mobile: `visibleEntities` useMemo | §4.5 | PASS | Lines 128–131 |
| Mobile: `toggleEntity` | §4.5 | PASS | Lines 133–138 |
| Mobile: step 4 merges entity IDs with sport IDs | §4.5 | PASS | Lines 80–88 |
| Mobile: `accessibilityState={{ selected: isSelected }}` on chips | §4.5 | PASS | Line 336 |
| Mobile: `accessibilityLabel` uses `a11y.onboarding.select_entity` key | §4.5 | PASS | Lines 332–334 |
| i18n: `onboarding.step3_title` updated in en.json and es.json | §4.6 | PASS | Lines 113 in both files |
| i18n: `onboarding.step3_subtitle` updated in en.json and es.json | §4.6 | PASS | Lines 114 in both files |
| i18n: `onboarding.step3_no_entities` added to en.json and es.json | §4.6 | PASS | Lines 115 in both files |
| i18n: `a11y.onboarding.select_entity` added to en.json and es.json | §4.6 | PASS | Line 732 in both files |
| Unit tests: `SPORT_ENTITIES` shape and completeness | §7.1 | PASS | `constants.test.ts` — 4 tests |
| Unit tests: `getSourceIdsForEntities` (exact match, no collision, dedup) | §7.2 | PASS | `entities.test.ts` — 5 tests |
| Component tests: web `OnboardingWizard` | §7.3 | PARTIAL | 6 source-inspection tests — see Warning #2 |
| Component tests: mobile `Onboarding` | §7.4 | PARTIAL | 5 source-inspection tests — see Warning #2 |

## TODO: Critical Issues (must fix)

None.

## TODO: Warnings (should fix)

- [x] **`apps/web/src/components/OnboardingWizard.tsx:442`** — The entity chip `aria-label` uses a hardcoded template string: `` `${entity.type}: ${entity.name}` ``. Every other accessible label in both Onboarding components uses `t(key, locale, params)` for i18n compliance. This label will always render in English regardless of the user's locale. The PRD specifies `a11y.onboarding.select_entity` as the key for entity accessibility labels; the web implementation ignores it (the mobile correctly uses `t('a11y.onboarding.select_entity', locale, { entity: entity.name })`). Fix: replace the template string with `t('a11y.onboarding.select_entity', locale, { entity: entity.name })` to match the mobile and the PRD spec, and optionally retain or extend the key to include the entity type.

- [x] **`apps/mobile/src/screens/Onboarding.tsx` — step 3 missing `step3_no_entities` fallback** — The web's step 3 renders `{t('onboarding.step3_no_entities', locale)}` when `visibleEntities.length === 0`. The mobile step 3 unconditionally renders `<View style={s.grid}>` and calls `.map()` on `visibleEntities` without the empty-state guard. Since `visibleEntities` is derived from `sports` which is validated non-empty before step 3 is reachable (`canAdvance` at step 2 requires `sports.length > 0`), this will not crash in practice — but if a sport is added to `SPORTS` before its entities are added to `SPORT_ENTITIES`, the mobile would show an empty grid with no explanation, while the web would show the fallback message. The defensive guard should be present for parity and future-proofing.

- [x] **Web and Mobile component tests use source-inspection (`.toString()`) exclusively** — Same limitation as noted in the prd.md review. These tests verify identifier presence in the source string, not runtime behaviour. Notably absent: a test that confirms toggling a chip actually updates `selectedEntities`, or that `getSourceIdsForEntities` is called with the correct `selectedEntities` argument when entering step 4. The `entities.test.ts` unit tests cover the utility function adequately, but the integration path (entity chip → `selectedEntities` → step 4 pre-population) is not tested behaviourally. This is acceptable given the RN renderer constraint, but a comment should be added to both component test files explaining the limitation (as was done in the prd.md review's Warning #1 resolution).

## TODO: Suggestions (nice to have)

- [x] **`packages/shared/src/constants/index.ts` — `SPORT_ENTITIES` entity counts differ from implementation-notes.md** — The notes claim "football×12" but the constant has 16 football entries, "tennis×8" but the constant has 6 entries, "swimming×5" but 3 entries, "athletics×5" but 3 entries, "cycling×6" but 4 entries, "formula1×8" entries (accurate), "basketball×8" (accurate), "padel×4" but 2 entries. The counts in `implementation-notes.md` are inaccurate but this has no functional impact. Consider updating `implementation-notes.md` to reflect the actual counts (football×16, basketball×8, tennis×6, formula1×10, cycling×4, swimming×3, athletics×3, padel×2 = 52 total entities).

- [x] **`packages/shared/src/__tests__/constants.test.ts` — PRD-specified test for cross-sport feedQuery uniqueness is missing** — The PRD (§7.1) lists "No two entities within the same sport share the same feedQuery" (implemented) but does not explicitly require a cross-sport uniqueness test. However, "Real Madrid" (football) and "Real Madrid Basket" (basketball) have different `feedQuery` values by design — so cross-sport uniqueness is intentionally not required. This is fine as-is. A comment noting this design choice in the test file would help future maintainers who might add the cross-sport uniqueness test unnecessarily.

- [x] **`apps/mobile/src/screens/Onboarding.tsx` — `selectedEntities` not in `useEffect` deps** — The step 4 `useEffect` dependency array is `[step, sources, sports]` with `// eslint-disable-line react-hooks/exhaustive-deps`. The `selectedEntities` state used inside the effect is not listed. This is the same pattern flagged in the PRD review checklist. Since the effect is guarded by `selectedFeeds.length === 0` (runs only once per onboarding session), `selectedEntities` will always reflect the user's current selections at the point of step 4 entry. It is not a real bug in the current flow. However, if step navigation is ever made non-linear (e.g., the user can jump back to step 2, change a sport, then jump forward), the guard would prevent the effect from re-running with updated `selectedEntities`. Adding a comment explaining why `selectedEntities` is intentionally omitted would clarify this for future maintainers.

## Technical Debt Assessment

No new technical debt introduced. The `getSourceIdsForEntities` utility is clean, correctly scoped, and fully tested. The `SPORT_ENTITIES` constant is complete and verified against the seed. The source-inspection test pattern for mobile/web components is an inherited limitation from prd.md and is not made worse here. The web aria-label regression (Warning #1) is a minor oversight that should be corrected before a production release.

## Files Reviewed

| File | Notes |
|---|---|
| `packages/shared/src/constants/index.ts` | `SPORT_ENTITIES` data verified against `apps/api/prisma/seed.ts`. All 52 `feedQuery` values are exact seed names. `EntityType` and `SportEntity` types are correctly defined. `TEAMS` untouched. |
| `packages/shared/src/utils/entities.ts` | Clean. Exact-match via `Set.has()` on lowercased names. Early return on empty `selectedEntities`. No issues. |
| `packages/shared/src/utils/index.ts` | `getSourceIdsForEntities` and `FeedSource` correctly exported at lines 39–40. |
| `packages/shared/src/__tests__/constants.test.ts` | 4 tests cover shape, completeness, feedQuery uniqueness per sport, and no leading/trailing whitespace. All PRD §7.1 requirements met. |
| `packages/shared/src/__tests__/entities.test.ts` | 5 tests cover empty input, no match, exact match (case-insensitive), Real Madrid collision prevention (AC-9), and multi-entity deduplication. All PRD §7.2 requirements met. |
| `apps/web/src/components/OnboardingWizard.tsx` | Step 3 implementation correct and matches PRD spec. `aria-label` on entity chips uses hardcoded template string instead of `t()` — see Warning #1. Step 4 merge logic is correct. `complete()` uses `selectedEntities[0]?.name` for backward compat. |
| `apps/mobile/src/screens/Onboarding.tsx` | Step 3 implementation correct except for missing empty-state guard — see Warning #2. `accessibilityLabel` correctly uses `t('a11y.onboarding.select_entity', ...)`. Step 4 merge logic correct. `complete()` uses `selectedEntities[0]?.name` for backward compat. |
| `packages/shared/src/i18n/en.json` | `step3_title`, `step3_subtitle`, `step3_no_entities` and `a11y.onboarding.select_entity` all present. Template syntax uses `{entity}` (single braces) consistent with `t()` interpolation format. |
| `packages/shared/src/i18n/es.json` | Same four keys present. Spanish translations correct. |
| `apps/web/src/components/__tests__/OnboardingWizard.test.tsx` | 6 source-inspection tests. Covers: SPORT_ENTITIES import, selectedEntities state, toggleEntity, getSourceIdsForEntities call, ⭐ emoji, TEAMS.map absence. No comment explaining source-inspection limitation — see Warning #2. |
| `apps/mobile/src/screens/__tests__/Onboarding.test.tsx` | 5 entity-specific source-inspection tests plus 4 pre-existing tests. Covers: SPORT_ENTITIES import, accessibilityState, toggleEntity, select_entity a11y key, getSourceIdsForEntities call. No comment explaining source-inspection limitation — see Warning #2. |

## Verification

Run date: 2026-04-02

| Suite | Files | Tests | Result |
|---|---|---|---|
| Shared (`packages/shared`) | 3 | 29 | All pass |
| API (`apps/api`) | 50 | 566 | All pass |
| Web (`apps/web`) | 18 | 126 | All pass |
| Mobile (`apps/mobile`) | 20 | 178 | All pass |
| **Total** | **91** | **899** | **All pass** |

**Lint**: `eslint .` — no errors, no warnings.

---

# Code Review: prd3.md — Quiz Variety (Per-User Dedup, Timeless Trivia, Sport Balance)

## Summary

The implementation is substantially correct and complete. All nine PRD requirements are present with solid test coverage (944 total tests passing, 0 failures). Two structural issues require attention: a sport-balance bug where the per-pool cap does not enforce the PRD's "across the combined set" constraint, and duplicated `isTopicDuplicate` logic that lives verbatim in two separate job files. Two minor observations (double-normalisation of topic and an inconsistent `isProviderAvailable` call in quiz-generator) are safe but worth cleaning up for consistency.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| `UserQuizHistory` model with per-user dedup, 60-day window, cascade delete | §3.1 | PASS | `schema.prisma` lines 187–198: `@@unique([userId, questionId])`, `@@index([userId, answeredAt])`, cascade on User and QuizQuestion |
| `isTimeless` + `topic` fields on `QuizQuestion` | §3.2 | PASS | `schema.prisma` lines 177–178, indexes at lines 183–184 |
| `generateTimelessQuestion()` in quiz-generator.ts | §4.1 | PASS | `quiz-generator.ts` lines 231–298 |
| Weekly timeless cron job (Monday 05:00 UTC) | §4.2 | PASS | `generate-timeless-quiz.ts` line 150: `'0 5 * * 1'`; registered in `index.ts` line 119 |
| Per-sport gap fill pass in daily quiz job | §4.3 | PASS | `generate-daily-quiz.ts` lines 271–326: `runGapFillPass()` called at line 221 |
| Topic dedup 30-day exact-match string check | §4.4 | PASS | Both files check `prisma.quizQuestion.findFirst` with 30-day cutoff before persisting |
| `GET /api/quiz/questions` updated: `userId` → answeredIds → 70/30 pool split | §5.1 | PASS | `quiz.ts` lines 75–179 |
| Sport balance cap `floor(N/4)+1` | §5.2 | **ISSUE** | Cap applied per-pool independently, not across the combined A+B result (see Critical Issues) |
| `POST /api/quiz/answer` non-blocking upsert to `UserQuizHistory` | §5.3 | PASS | `quiz.ts` lines 279–290: fire-and-forget `.catch()` pattern |

## TODO: Critical Issues (must fix)

- [x] **apps/api/src/routes/quiz.ts:156–157** — **Sport balance cap is applied per-pool, not across the combined result.** `applySportBalance(shuffledA, maxPerSport, targetRecent)` and `applySportBalance(shuffledB, maxPerSport, targetTimeless)` are called independently. For `count=5`, `maxPerSport=2`. Pool A can contribute up to 2 football questions and pool B can also contribute up to 2 football questions, yielding up to 4 football questions in the final 5-question set — violating the PRD guarantee "no single sport appears more than `floor(count/4)+1` times across the combined selected set."

  Fix: after `combined = [...selectedRecent, ...selectedTimeless]`, apply a second combined-level cap. Replace the final Fisher-Yates call at line 178 with: `applySportBalance(fisherYatesShuffle(combined), maxPerSport, count)` — or accumulate a single combined `counts` map across both pool selections. The `applySportBalance` function signature already supports this; it just needs to be called once on the merged array rather than twice on each pool.

## TODO: Warnings (should fix)

- [x] **apps/api/src/jobs/generate-timeless-quiz.ts:27–37 and apps/api/src/jobs/generate-daily-quiz.ts:77–87** — **Duplicated `isTopicDuplicate` function.** The function body is byte-for-byte identical in both files (same constant `TOPIC_DEDUP_WINDOW_DAYS = 30`, same Prisma query). Any future change (e.g. adjusting the dedup window) must be applied in both places or they will drift.

  Fix: extract the function to a shared location, e.g. `apps/api/src/services/quiz-dedup.ts`, export it as `isTopicDuplicate(topic: string): Promise<boolean>`, and import it in both job files. This is a one-file extraction with two import changes.

- [x] **apps/api/src/services/quiz-generator.ts:262 and apps/api/src/jobs/generate-timeless-quiz.ts:71** — **Double-normalisation of `topic`.** `generateTimelessQuestion` already normalises the topic before returning (`.toLowerCase().trim().slice(0, 80)`). The caller in `generate-timeless-quiz.ts:71` normalises it again with the identical expression — always a no-op. Same redundancy at `generate-daily-quiz.ts:292` inside `runGapFillPass`.

  Fix: remove the redundant normalisation in both callers. In `generate-timeless-quiz.ts:71`, change to: `const normalizedTopic = question.topic;`. In `generate-daily-quiz.ts:292`, same change.

## TODO: Suggestions (nice to have)

- [x] **apps/api/src/services/quiz-generator.ts:236** — **`generateTimelessQuestion` checks `isProviderAvailable()` internally, but callers in the job files also check it before calling.** `generateQuizFromNews` does not check internally (relying on callers), while `generateTimelessQuestion` checks availability itself. This inconsistency means callers must know which convention each function uses. A comment on `generateTimelessQuestion` clarifying that it checks availability internally (and callers don't need to) would prevent double-checking from being accidentally removed.

- [x] **apps/api/src/routes/quiz.ts:104–110** — **Pool A filter includes `expiresAt: null` which could match non-timeless daily questions.** Pool A intends "recent/daily non-expired" questions. The `OR: [{expiresAt: null}, {expiresAt: {gt: now}}]` clause means any `isTimeless=false, generatedAt NOT NULL` question with `expiresAt=null` would appear in pool A indefinitely. New daily questions always set `expiresAt` to 48h, so this is benign today — but if any future code path creates a non-timeless question without an expiry, it leaks into pool A silently. Consider tightening to `expiresAt: {gt: now}` only for pool A, since timeless questions are already routed to pool B via `isTimeless: true`.

- [x] **apps/api/src/jobs/generate-timeless-quiz.ts:63** — **Timeless quiz job hardcodes locale `'es'`** for all question generations. This matches the daily quiz job's existing pattern and is a known pre-existing limitation, not a regression. Noted for future improvement if multi-locale timeless trivia is desired.

## Technical Debt Assessment

The prd3.md implementation adds clear, well-tested code with no regressions and no new dependencies. The sport-balance bug is the only issue that breaks a stated PRD contract, contained to a single call site in `quiz.ts`. The duplicated `isTopicDuplicate` function is the main maintainability risk going forward. Both issues are small and self-contained. The rest of the implementation (schema, generation service, API route, all four test files) follows the established patterns correctly.

## Files Reviewed

| File | Notes |
|---|---|
| `apps/api/prisma/schema.prisma` lines 166–198 | `UserQuizHistory` model and `QuizQuestion` additions correct; cascade delete, unique constraint, and indexes match PRD |
| `apps/api/src/services/quiz-generator.ts` | `generateTimelessQuestion` and `buildTimelessSystemPrompt` well-structured; double-normalisation benign but redundant |
| `apps/api/src/jobs/generate-timeless-quiz.ts` | Cron schedule correct (`0 5 * * 1`); retry-on-collision logic correct; `isTopicDuplicate` duplicated from daily job |
| `apps/api/src/jobs/generate-daily-quiz.ts` | 30-day news window, topic dedup, and `runGapFillPass` all correct; `isTopicDuplicate` duplicated from timeless job |
| `apps/api/src/routes/quiz.ts` | `userId` dedup, pool construction, seed fallback, and non-blocking upsert all correct; sport balance cap has cross-pool bug |
| `apps/api/src/index.ts` lines 35, 119 | `startTimelessQuizJob` imported and called alongside other job registrations |
| `apps/api/src/jobs/__tests__/generate-timeless-quiz.test.ts` | All paths covered: happy path, topic collision retry, max retries, null return, provider unavailable, DB error |
| `apps/api/src/jobs/__tests__/generate-daily-quiz.test.ts` | 30-day window, topic dedup skip/create, gap fill trigger/skip, provider unavailable all covered |
| `apps/api/src/routes/__tests__/quiz.test.ts` | Dedup with/without userId, 70/30 mix, sport balance, seed fallback, answer upsert, idempotency, wrong answer all covered |
| `apps/api/src/services/__tests__/quiz-generator.test.ts` | Happy path, AI failure, invalid JSON, Zod validation, all 8 sports, topic normalisation, news-based topic covered |

## Verification

Tests verified as passing in Run 5: 944 total tests, 46 PASS validation checks, 0 FAIL. Lint: 0 errors. The sport balance bug does not have a failing test because the existing sport balance test only tests pool A in isolation (pool B is empty in that test), so the cross-pool overflow path is not exercised.
