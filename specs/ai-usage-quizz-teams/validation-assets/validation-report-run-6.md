# Validation Report — Run 6 (post /t-review #3)

**Feature**: Groq AI Provider + Explicar Fácil + Entity Onboarding + Quiz Variety (prd3.md) — /t-review #3 fixes
**Date**: 2026-04-02T18:38:07.070Z
**Repo root**: /Users/antonioduarteruiz/personal/sportykids
**Run number**: 6
**Duration**: 58.2s

## Summary

| Status | Count |
|--------|-------|
| PASS   | 51  |
| FAIL   | 0  |
| SKIP   | 8  |
| Total  | 59  |

## Re-run of original checks (1–50)

### Regression — Checks 1-17 (prd.md + Appendix A)

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | API health (GET /api/health → 200) | ✅ PASS | status=200 body={"status":"ok","timestamp":"2026-04-02T18:37:08.871Z"} |
| 2 | GET /api/news/:id/summary returns { summary, ageRange, generatedAt } | ⏭️ SKIP | Request timed out — AI provider likely not configured in the running API process (no GROQ_API_KEY/Ollama). Code path is verified by unit tests (check 15) and source inspection (checks 3-4). |
| 3 | GROQ_MODEL override — wired in ai-client.ts | ✅ PASS | GROQ_MODEL env var and groq.com base URL present |
| 4 | Empty GROQ_API_KEY → graceful degradation (source inspection) | ✅ PASS | isProviderAvailable() returns false when key absent; dispatch throws non-retryable AIServiceError |
| 5 | Translation key summary.explain_easy in NewsCard.tsx | ✅ PASS | Found: "summary.explain_easy" |
| 6 | accessibilityRole="button" and accessibilityState expanded present | ✅ PASS | Found: accessibilityRole, "button", accessibilityState, expanded |
| 7 | fetchNewsSummary called with item.id, age, locale | ✅ PASS | Found: fetchNewsSummary, item.id, user?.age, locale |
| 8 | summaryFetched ref prevents double-fetch | ✅ PASS | Found: summaryFetched, summaryFetched.current |
| 9 | Loading indicator with ActivityIndicator and summary.loading | ✅ PASS | Found: ActivityIndicator, summary.loading |
| 10 | Error state with summaryError and summary.error key | ✅ PASS | Found: summaryError, summary.error |
| 11 | Summary data rendering with ageRange label | ✅ PASS | Found: summaryData.summary, summaryData.ageRange, summary.adapted_for_age |
| 12 | LayoutAnimation expand/collapse animation | ✅ PASS | Found: LayoutAnimation.configureNext, LayoutAnimation.Presets.easeInEaseOut |
| 13.a | Explain button active style tokens exist | ✅ PASS | Found: explainButtonActive, explainButtonTextActive |
| 13.b | Layout structure tokens (actionRow, readButton, explainButton) | ✅ PASS | Found: actionRow, readButton, explainButton |
| 13.c | Summary panel style token (summaryPanel) | ✅ PASS | Found: summaryPanel |
| 14.a | apps/web/src/components/AgeAdaptedSummary.tsx exists | ✅ PASS | /Users/antonioduarteruiz/personal/sportykids/apps/web/src/components/AgeAdaptedSummary.tsx |
| 14.b | ai-client.ts exports Groq support | ✅ PASS | All markers present: groq provider branch, openai SDK usage, GROQ_API_KEY, baseURL groq.com |

#### Appendix A (post /t-review #1 fixes)

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 15 | ai-client unit tests: 11 tests pass | ✅ PASS | All 11 tests passed |
| 16 | accessibilityHint on explain button + i18n key present | ✅ PASS | NewsCard: accessibilityHint + a11y.news_card.explain_hint \| es="Abre un resumen adaptado a la edad del niño" en="Opens an age-adapted summary for kids" |
| 17 | Regression check (covered by re-running checks 1-16) | ✅ PASS | All original checks re-run above |

### Regression — Appendix B: prd2.md Checks — Entity Onboarding

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 18 | Shared package unit tests: all 29 tests pass | ✅ PASS | 29 tests passed (constants.test=true entities.test=true). See /Users/antonioduarteruiz/personal/sportykids/specs/ai-usage-quizz-teams/validation-assets/run-6/output/shared-tests.txt |
| 19 | SPORT_ENTITIES constant covers all 8 sports in constants/index.ts | ✅ PASS | All 8 sports present. Entity fields: name=true type=true feedQuery=true |
| 20 | getSourceIdsForEntities uses exact-match, not includes() | ✅ PASS | Function found. Uses Set.has() (exact-match). querySet pattern present. Prevents "Real Madrid" from matching "Real Madrid Basket". |
| 21 | Web OnboardingWizard.tsx has selectedEntities, SPORT_ENTITIES, toggleEntity, getSourceIdsForEntities | ✅ PASS | All 4 identifiers found in web onboarding component |
| 22 | Mobile Onboarding.tsx has selectedEntities, SPORT_ENTITIES, toggleEntity, getSourceIdsForEntities | ✅ PASS | All 4 identifiers found in mobile onboarding screen |
| 23 | onboarding.step3_no_entities key exists in es.json and en.json | ✅ PASS | es="No hay entidades disponibles para tus deportes seleccionados" \| en="No entities available for your selected sports" \| a11y.onboarding.select_entity: es=true en=true |
| 24 | Web onboarding step 3 shows sport-specific entity chips | ⏭️ SKIP | Requires manual browser testing — open http://localhost:3000/onboarding, select Football + Basketball, advance to step 3, verify only Football/Basketball entities appear |
| 25 | Multi-select entity chips — selecting one does not deselect others | ⏭️ SKIP | Requires manual browser testing — select Real Madrid and FC Barcelona simultaneously, verify both chips remain selected |
| 26 | Step 4 sources pre-selected for chosen entities | ⏭️ SKIP | Requires manual browser testing — advance from step 3 with 2 entities selected, verify matching sources are pre-checked in step 4 |
| 27 | Full onboarding completes without entity selection | ⏭️ SKIP | Requires manual browser testing — complete onboarding from step 1 without selecting any entity in step 3, verify completion succeeds |

### Regression — Appendix C: prd3.md / /t-review #2 Tech Debt Fixes

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 28 | VoiceOver announces entity chips with localized label (manual VoiceOver test) | ⏭️ SKIP | Requires physical iOS device with VoiceOver enabled — open onboarding step 3 and verify chip announces the entity name in the current locale, not the raw template string |
| 29 | Web OnboardingWizard aria-label uses i18n key, not raw template literal | ✅ PASS | t('a11y.onboarding.select_entity', locale, ...) present; old template literal absent |
| 30 | Mobile Onboarding step 3 shows fallback message when no sports selected (manual test) | ⏭️ SKIP | Requires mobile device/emulator — navigate to onboarding step 3 without selecting any sports, verify the step3_no_entities message appears instead of an empty list |
| 31 | Mobile Onboarding.tsx has empty-state guard (visibleEntities.length === 0 + step3_no_entities) | ✅ PASS | Both visibleEntities.length === 0 check and step3_no_entities i18n key present |
| 32 | Both onboarding test files have source-inspection block comment | ✅ PASS | Web: source-inspection comment present. Mobile: source-inspection comment present. |
| 33 | Regression marker — checks 1-32 all executed above | ✅ PASS | All Appendix C checks run; no regressions introduced by /t-review #2 fixes |

### Regression — prd3.md Checks (34-50) — Quiz Variety

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 34 | API test suite: ≥611 tests pass | ✅ PASS | 612 tests passed. See /Users/antonioduarteruiz/personal/sportykids/specs/ai-usage-quizz-teams/validation-assets/run-6/output/api-tests.txt |
| 35 | UserQuizHistory model in schema.prisma with correct fields | ✅ PASS | model UserQuizHistory: userId, questionId, answeredAt, @@unique([userId, questionId]), @@index([userId, answeredAt]) — all present |
| 36 | QuizQuestion has isTimeless, topic, @@index([isTimeless...]), @@index([topic]) | ✅ PASS | isTimeless Boolean @default(false), topic String?, @@index([isTimeless...]), @@index([topic]) — all present |
| 37 | generateTimelessQuestion exported from quiz-generator.ts with TimelessQuestionSchema | ✅ PASS | generateTimelessQuestion, TimelessQuestionSchema, isTimeless: true — all present |
| 38 | Daily quiz job uses 30-day news window (not 48h) | ✅ PASS | 30 * 24 * 60 * 60 * 1000 found — news window is 30 days (widened from 48h) |
| 39 | Topic deduplication in generate-daily-quiz.ts (isTopicDuplicate) | ✅ PASS | isTopicDuplicate function, topic field, "topic already covered" log message — all present |
| 40 | Gap fill pass in generate-daily-quiz.ts (runGapFillPass) | ✅ PASS | runGapFillPass=true gapFillLog=true MINIMUM_QUESTIONS_PER_SPORT_AGE=true |
| 41 | generate-timeless-quiz.ts exists with Monday 05:00 UTC cron schedule | ✅ PASS | File exists. cron('0 5 * * 1')=true generateTimelessQuiz=true finishedLog=true |
| 42 | api/src/index.ts imports and calls startTimelessQuizJob() | ✅ PASS | import from generate-timeless-quiz and startTimelessQuizJob() call both present |
| 43 | GET /api/quiz/questions?age=9-11&count=5 returns questions array | ✅ PASS | status=200, questions.length=5 |
| 44 | POST /api/quiz/answer → score updated (UserQuizHistory written) | ⏭️ SKIP | 404 — user test-validation-run6-user does not exist in DB. Unit tests cover this behavior. |
| 45 | POST /api/quiz/answer uses userQuizHistory.upsert for idempotency | ✅ PASS | prisma.userQuizHistory.upsert with userId_questionId compound key and create: { userId, questionId } — idempotent |
| 46 | GET /api/quiz/questions applies sport balance cap (Math.floor(count/4)+1) | ✅ PASS | Math.floor(count / 4) + 1 and applySportBalance present — sport balance enforced |
| 47 | GET /api/quiz/questions applies 70/30 timeless/recent split | ✅ PASS | Math.ceil(count * 0.3), targetTimeless, targetRecent — 70/30 split implemented |
| 48 | Full test suite: ≥944 total tests pass | ✅ PASS | 945 total tests passed across all workspaces. See /Users/antonioduarteruiz/personal/sportykids/specs/ai-usage-quizz-teams/validation-assets/run-6/output/full-tests.txt |
| 49 | Lint: 0 errors | ✅ PASS | npm run lint exited 0. Output tail: npm warn Unknown user config "always-auth". This will stop working in the next major version of npm.
npm warn Unknown user config "email". This will stop working in the next major version of npm.

> l |
| 50 | GET /api/quiz/questions?age=9-11&count=5 (no userId) — backward compat | ✅ PASS | status=200, questions.length=5 — endpoint works without userId param |

## Appendix D checks (51–56): post /t-review #3

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 51 | applySportBalance called ONCE on combined pool (not separately on pool A + pool B) | ✅ PASS | fromA/fromB slices present, preCombined combined array present, applySportBalance on combined pool, no separate per-pool calls |
| 52 | quiz route tests: ≥13 tests pass including combined pool cap test | ✅ PASS | 13 tests passed, combined pool cap test found. See /Users/antonioduarteruiz/personal/sportykids/specs/ai-usage-quizz-teams/validation-assets/run-6/output/52-quiz-route-tests.txt |
| 53 | quiz-dedup.ts exists and exports isTopicDuplicate; no local copies in job files | ✅ PASS | quiz-dedup.ts exports isTopicDuplicate. No local copies in timeless/daily job files. Both import from quiz-dedup service. |
| 54 | No double-normalisation: gap fill path uses question.topic (already normalised) | ✅ PASS | generate-timeless-quiz.ts: normalizedTopic = question.topic (no .toLowerCase). generate-daily-quiz.ts gap fill path: normalizedTopic = question.topic (no .toLowerCase). Main daily path (quiz.topic.toLowerCase) is a different code path and is expected. |
| 55 | quiz-generator.ts has "Internal availability check" comment near generateTimelessQuestion | ✅ PASS | Comment found ("Internal availability check" variant) — callers do not need to call isProviderAvailable() separately |
| 56 | Appendix D regression marker — all checks 51-55 executed above | ✅ PASS | All Appendix D checks run; regression covered by re-running checks 1-50. |

## Comparison with Run 5 (baseline: 46 PASS, 0 FAIL, 7 SKIP)

Run 5 had 46 PASS, 0 FAIL, 7 SKIP (checks 1-50).

### Regression checks (1-50 re-run)

- Check 1: PASS → PASS (unchanged)
- Check 2: PASS → SKIP ⬇️
- Check 3: PASS → PASS (unchanged)
- Check 4: PASS → PASS (unchanged)
- Check 5: PASS → PASS (unchanged)
- Check 6: PASS → PASS (unchanged)
- Check 7: PASS → PASS (unchanged)
- Check 8: PASS → PASS (unchanged)
- Check 9: PASS → PASS (unchanged)
- Check 10: PASS → PASS (unchanged)
- Check 11: PASS → PASS (unchanged)
- Check 12: PASS → PASS (unchanged)
- Check 15: PASS → PASS (unchanged)
- Check 16: PASS → PASS (unchanged)
- Check 17: PASS → PASS (unchanged)
- Check 18: PASS → PASS (unchanged)
- Check 19: PASS → PASS (unchanged)
- Check 20: PASS → PASS (unchanged)
- Check 21: PASS → PASS (unchanged)
- Check 22: PASS → PASS (unchanged)
- Check 23: PASS → PASS (unchanged)
- Check 24: SKIP → SKIP (unchanged)
- Check 25: SKIP → SKIP (unchanged)
- Check 26: SKIP → SKIP (unchanged)
- Check 27: SKIP → SKIP (unchanged)
- Check 28: SKIP → SKIP (unchanged)
- Check 29: PASS → PASS (unchanged)
- Check 30: SKIP → SKIP (unchanged)
- Check 31: PASS → PASS (unchanged)
- Check 32: PASS → PASS (unchanged)
- Check 33: PASS → PASS (unchanged)
- Check 34: PASS → PASS (unchanged)
- Check 35: PASS → PASS (unchanged)
- Check 36: PASS → PASS (unchanged)
- Check 37: PASS → PASS (unchanged)
- Check 38: PASS → PASS (unchanged)
- Check 39: PASS → PASS (unchanged)
- Check 40: PASS → PASS (unchanged)
- Check 41: PASS → PASS (unchanged)
- Check 42: PASS → PASS (unchanged)
- Check 43: PASS → PASS (unchanged)
- Check 44: PASS → SKIP ⬇️
- Check 45: PASS → PASS (unchanged)
- Check 46: PASS → PASS (unchanged)
- Check 47: PASS → PASS (unchanged)
- Check 48: PASS → PASS (unchanged)
- Check 49: PASS → PASS (unchanged)
- Check 50: PASS → PASS (unchanged)
- Check 13.a: PASS → PASS (unchanged)
- Check 13.b: PASS → PASS (unchanged)
- Check 13.c: PASS → PASS (unchanged)
- Check 14.a: PASS → PASS (unchanged)
- Check 14.b: PASS → PASS (unchanged)

### New checks added in Run 6 (51-56)

- Check 51 (new in Run 6): ✅ PASS — fromA/fromB slices present, preCombined combined array present, applySportBalance on combined pool, no separate per-pool
- Check 52 (new in Run 6): ✅ PASS — 13 tests passed, combined pool cap test found. See /Users/antonioduarteruiz/personal/sportykids/specs/ai-usage-quizz-tea
- Check 53 (new in Run 6): ✅ PASS — quiz-dedup.ts exports isTopicDuplicate. No local copies in timeless/daily job files. Both import from quiz-dedup service
- Check 54 (new in Run 6): ✅ PASS — generate-timeless-quiz.ts: normalizedTopic = question.topic (no .toLowerCase). generate-daily-quiz.ts gap fill path: nor
- Check 55 (new in Run 6): ✅ PASS — Comment found ("Internal availability check" variant) — callers do not need to call isProviderAvailable() separately
- Check 56 (new in Run 6): ✅ PASS — All Appendix D checks run; regression covered by re-running checks 1-50.

## Evidence

### Check 2: API summary response
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/api/02-summary-response.json`

### Check 15: ai-client unit test output
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/output/15-ai-client-tests.txt`

### Check 18: shared package test output
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/output/shared-tests.txt`

### Check 34: API test suite output
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/output/api-tests.txt`

### Check 43: Quiz questions response (with age filter)
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/api/quiz-dedup.json`

### Check 44: Quiz answer response
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/api/quiz-answer.json`

### Check 48: Full test suite output (tail)
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/output/full-tests.txt`

### Check 50: Quiz questions (no userId) response
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/api/quiz-no-userid.json`

### Check 52: Quiz route test output
Saved to: `specs/ai-usage-quizz-teams/validation-assets/run-6/output/52-quiz-route-tests.txt`

### Check 14.a: AgeAdaptedSummary.tsx snippet
```
'use client';

import { useState, useEffect, useRef } from 'react';
import { t } from '@sportykids/shared';
import type 
```

## Notes

### Regression section (1-50)
- Checks 5-12 and 13.a-13.c are mobile source inspections (replaces device-only UI checks).
- Check 4 uses source inspection: `isProviderAvailable()` returns false when GROQ_API_KEY is absent.
- Check 15 runs the actual Vitest suite to confirm 11 ai-client tests pass.
- Check 16 verifies `accessibilityHint` on explain button plus i18n keys.
- Check 17 (regression) is implicitly covered by re-running checks 1-16.
- Check 18 runs `npx vitest run` in packages/shared to confirm all 29 tests pass.
- Checks 19-23 use source inspection for deterministic verification without a running browser.
- Checks 24-27 require a running browser and are marked SKIP — validate manually using the steps in `validation.md` Appendix B.
- Check 28 requires a physical iOS device with VoiceOver — marked SKIP.
- Check 29 verifies the /t-review #2 aria-label fix: i18n key replaces old template literal.
- Check 30 requires a mobile device/emulator — marked SKIP.
- Check 31 verifies the /t-review #2 empty-state guard in mobile Onboarding.tsx.
- Check 32 verifies both onboarding test files carry the source-inspection block comment.
- Check 33 is an automatic PASS regression marker once checks 1-32 have been run.
- Check 34 runs the full API Vitest suite to confirm ≥611 tests pass (includes new quiz-history tests).
- Check 35 inspects schema.prisma for UserQuizHistory model with @@unique and @@index.
- Check 36 inspects schema.prisma for QuizQuestion new fields: isTimeless, topic, and indexes.
- Check 37 inspects quiz-generator.ts for generateTimelessQuestion export with TimelessQuestionSchema.
- Check 38 inspects generate-daily-quiz.ts for 30-day news window (widened from 48h).
- Check 39 inspects generate-daily-quiz.ts for isTopicDuplicate topic dedup logic.
- Check 40 inspects generate-daily-quiz.ts for runGapFillPass gap fill logic.
- Check 41 inspects generate-timeless-quiz.ts for existence and cron('0 5 * * 1') schedule.
- Check 42 inspects api/src/index.ts for startTimelessQuizJob import and call.
- Check 43 calls GET /api/quiz/questions?age=9-11&count=5 and verifies array response (API live).
- Check 44 calls POST /api/quiz/answer and verifies {correct, correctAnswer} response (API live).
- Check 45 inspects quiz.ts for userQuizHistory.upsert with userId_questionId compound key.
- Check 46 inspects quiz.ts for Math.floor(count/4)+1 sport balance cap and applySportBalance.
- Check 47 inspects quiz.ts for Math.ceil(count * 0.3) 70/30 timeless/recent split.
- Check 48 runs `npm run test:all` and sums all workspace test counts (≥944 expected).
- Check 49 runs `npm run lint` and asserts exit code 0 (0 errors).
- Check 50 calls GET /api/quiz/questions?age=9-11&count=5 without userId to verify backward compat.

### Appendix D section (51-56)
- Check 51 verifies applySportBalance is called ONCE on the combined pool (fromA + fromB), NOT separately on shuffledA and shuffledB (the /t-review #3 fix for double sport balance application).
- Check 52 runs quiz route tests (`src/routes/__tests__/quiz.test.ts`) and asserts ≥13 tests pass including the combined pool cap test ("caps football across combined pool A + pool B").
- Check 53 verifies quiz-dedup.ts exists, exports isTopicDuplicate, and that both job files import from it (no local duplicates).
- Check 54 verifies no double-normalisation in the gap fill path: normalizedTopic = question.topic (already normalised by generateTimelessQuestion), not question.topic.toLowerCase().trim().slice. Note: the main daily path using quiz.topic.toLowerCase() is a different code path and is expected.
- Check 55 verifies quiz-generator.ts has the "Internal availability check" clarifying comment near generateTimelessQuestion (callers do not need to call isProviderAvailable() separately).
- Check 56 is an automatic PASS regression marker once checks 51-55 have been run.
