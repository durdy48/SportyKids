# Human Validation — prd.md (Groq AI Provider + Explicar Fácil Mobile)

## Prerequisites

Start the test environment:

```bash
GROQ_API_KEY=gsk_your_key_here bash specs/ai-usage-quizz-teams/create-environment.sh
```

Get a free Groq API key at https://console.groq.com (requires sign-up, no credit card).

---

## Validation Steps

### 1. Groq Provider Configuration

1. **Action**: Set `AI_PROVIDER=groq` and `GROQ_API_KEY=gsk_...` in the API `.env` (or export before `npm run dev:api`)
   **Expected**: API starts without errors. Log shows no AI-related warnings at startup.

2. **Action**: Call `GET /api/news` to fetch some news, then call `GET /api/news/<any-id>/summary?age=10&locale=es`
   **Expected**: Returns `{ summary: "...", ageRange: "9-11", generatedAt: "..." }` within ~3 seconds. Summary is in Spanish and child-friendly.

3. **Action**: Set `GROQ_MODEL=llama-3.3-70b-versatile` and repeat the summary call
   **Expected**: Response still returns a valid summary (different model used internally, no user-visible change).

4. **Action**: Set `GROQ_API_KEY=` (empty) and call the summary endpoint
   **Expected**: API returns an error (500 or appropriate error code). Does NOT crash the API process.

---

### 2. Explicar Fácil — Mobile App (React Native / Expo)

> Open the app on a device or simulator with `npm run dev:mobile` (ensure `API_BASE` points to your running API).

5. **Action**: Open the home feed and find any news card
   **Expected**: Each card now has two buttons in a row: "Leer más" (blue) on the left, and "✨ Explicar Fácil" (outlined) on the right.

6. **Action**: Tap "✨ Explicar Fácil" on a news card
   **Expected**:
   - The button background changes to yellow (`#FACC15`)
   - A summary panel slides/expands below the action row (smooth animation)
   - A loading spinner appears briefly while the API call is in progress

7. **Action**: Wait for the summary to load
   **Expected**:
   - A green badge appears showing "Adaptado para X-X años"
   - The age-adapted summary text is displayed below the badge
   - Summary is concise, child-friendly language

8. **Action**: Tap "✨ Explicar Fácil" again (panel is open)
   **Expected**: Panel collapses smoothly. Button returns to outlined (non-active) style.

9. **Action**: Tap "✨ Explicar Fácil" on the same card again (re-open)
   **Expected**: Summary appears instantly WITHOUT a loading spinner (cached — `summaryFetched` ref guard prevents duplicate API calls).

10. **Action**: Test with `GROQ_API_KEY` unset or invalid
    **Expected**: After tapping the button, spinner shows briefly, then an error message appears in the panel (e.g. "No se pudo obtener el resumen"). The app does NOT crash.

11. **Action**: Open a news card that has no image
    **Expected**: The heart button, action row, and explain panel all render correctly without layout issues.

12. **Action**: Open a card, tap "Explicar Fácil", let it load, then tap "Leer más"
    **Expected**: Opens the article URL in the browser. The summary panel state is unchanged (still visible).

---

### 3. Accessibility

13. **Action**: Enable VoiceOver/TalkBack and focus the "Explicar Fácil" button
    **Expected**:
    - Button is announced as a "button"
    - When expanded, `accessibilityState.expanded = true` is reflected in the announcement
    - Label reads "Explicar fácil" (from `summary.explain_easy` translation key)

---

### 4. Web Parity Check

14. **Action**: Open the web app at `http://localhost:3000`, navigate to the news feed, click "Explicar" on any card
    **Expected**: The existing `AgeAdaptedSummary` component works as before (unchanged). The Groq provider is now being used if `AI_PROVIDER=groq`.

---

## Appendix A: Re-validation after /t-review #1

The following steps verify the fixes applied by `/t-reduce-tech-debt` after the first code review round.

15. **Action** (review Critical #1): Run the ai-client unit tests in isolation: `cd apps/api && npx vitest run src/services/__tests__/ai-client.test.ts`
    **Expected**: All 11 tests pass. The "throws AIServiceError (GROQ_API_KEY required) when dispatch runs with empty key" test passes deterministically — it no longer relies on incidental cache state.

16. **Action** (review Warning #2): Enable VoiceOver/TalkBack and focus the "✨ Explicar Fácil" button on a news card.
    **Expected**: Screen reader announces a hint in addition to the label — e.g. "Abre un resumen adaptado a la edad del niño" (ES) or "Opens an age-adapted summary for kids" (EN). This is the new `accessibilityHint` added at `NewsCard.tsx:163`.

17. **Action** (regression check): Re-run all original validation steps 1–14 above.
    **Expected**: All original steps still pass. No regressions introduced by the review fixes.

---

# Human Validation — prd2.md (Dynamic Sport-Specific Entity Selection in Onboarding)

## Appendix B: prd2.md validation steps

The following steps verify the Dynamic Sport-Specific Entity Selection feature added in prd2.md.

18. **Action**: Run the shared package unit tests: `cd packages/shared && npx vitest run`
    **Expected**: All 29 tests pass. The 4 `constants.test.ts` tests (SPORT_ENTITIES shape, 8 sports covered, entity fields, feedQuery non-empty) and 5 `entities.test.ts` tests (getSourceIdsForEntities: empty, exact match, case-insensitive, no partial match, multiple entities) all pass.

19. **Action** (source inspection): Verify `SPORT_ENTITIES` constant exists in `packages/shared/src/constants/index.ts` and covers all 8 sports (`football`, `basketball`, `tennis`, `swimming`, `athletics`, `cycling`, `formula1`, `padel`).
    **Expected**: Each sport key present in `SPORT_ENTITIES` with at least 1 entity. Each entity has `name`, `type`, and `feedQuery` fields.

20. **Action** (source inspection): Verify `getSourceIdsForEntities` utility in `packages/shared/src/utils/entities.ts` uses exact-match (not `includes`).
    **Expected**: The function uses `===` comparison (or equivalent equality check), not `includes()` or `startsWith()` — this prevents "Real Madrid" from matching "Real Madrid Basket".

21. **Action** (source inspection): Verify `OnboardingWizard.tsx` uses `selectedEntities` state and `SPORT_ENTITIES`.
    **Expected**: `selectedEntities` state, `SPORT_ENTITIES` import, `toggleEntity` function, and `getSourceIdsForEntities` call all present in the web onboarding component.

22. **Action** (source inspection): Verify mobile `Onboarding.tsx` uses `selectedEntities` state and `SPORT_ENTITIES`.
    **Expected**: Same identifiers as check 21 present in the mobile onboarding screen.

23. **Action** (source inspection): Verify `step3_no_entities` i18n key exists in both `es.json` and `en.json`.
    **Expected**: Key `onboarding.step3_no_entities` present in both locale files with non-empty string values.

24. **Action**: Open the web app at `http://localhost:3000/onboarding`. On step 1 select "Football" and "Basketball". Advance to step 3.
    **Expected**: Step 3 shows entity chips specific to Football and Basketball (e.g. Real Madrid, FC Barcelona, Los Angeles Lakers, etc.). No entities from Tennis, Cycling, or other sports appear.

25. **Action**: In step 3, tap/click multiple entity chips (e.g. "Real Madrid" and "FC Barcelona").
    **Expected**: Both chips appear selected/highlighted simultaneously. Multi-select works — selecting one chip does not deselect the other.

26. **Action**: Advance from step 3 to step 4 with 2 entities selected.
    **Expected**: Step 4 (feed source selection) shows sources pre-selected that match the chosen entities. Entity-matched sources are checked/pre-populated.

27. **Action** (regression check): Complete the full onboarding flow from step 1 to completion without selecting any entity in step 3.
    **Expected**: Onboarding completes successfully. The fallback text from `step3_no_entities` does NOT appear (since Football/Basketball both have entities). `favoriteTeam` field in the created user is undefined or empty if no entity was selected.

---

## Appendix C: Re-validation after /t-review #2

The following steps verify the fixes applied by `/t-reduce-tech-debt` after the second code review round (prd2.md).

28. **Action** (review Warning #1): Enable VoiceOver/TalkBack and focus an entity chip in onboarding step 3 on the **web app**.
    **Expected**: Screen reader announces the entity name using the `a11y.onboarding.select_entity` i18n key — e.g. "Real Madrid" (ES) or "Real Madrid" (EN). The label is NOT announced as "team: Real Madrid" (the hardcoded template string that was present before the fix).

29. **Action** (review Warning #1 — source inspection): Verify `apps/web/src/components/OnboardingWizard.tsx` uses `t('a11y.onboarding.select_entity', ...)` for entity chip aria-label, not a template literal.
    **Expected**: The file contains `t('a11y.onboarding.select_entity', locale` and does NOT contain `` `${entity.type}: ${entity.name}` ``.

30. **Action** (review Warning #2): Open the mobile app onboarding. Select a sport that has NO entries in `SPORT_ENTITIES` (or temporarily add an entry-less sport to test). Advance to step 3.
    **Expected**: Step 3 shows the fallback text from `onboarding.step3_no_entities` (e.g. "No hay entidades disponibles para tus deportes seleccionados") instead of an empty grid. Behaviour matches the web app.

31. **Action** (review Warning #2 — source inspection): Verify `apps/mobile/src/screens/Onboarding.tsx` has the `step3_no_entities` fallback guard.
    **Expected**: The file contains `visibleEntities.length === 0` check and `step3_no_entities` i18n key in the step 3 render block.

32. **Action** (review Warning #3): Open `apps/web/src/components/__tests__/OnboardingWizard.test.tsx` and `apps/mobile/src/screens/__tests__/Onboarding.test.tsx`.
    **Expected**: Both files contain a block comment before the `describe` block explaining why source-inspection (`.toString()`) is used and what would be needed for behavioral rendering tests.

33. **Action** (regression check): Re-run all original validation steps 1–27 above.
    **Expected**: All original steps still pass. No regressions introduced by the review fixes.

---
# Human Validation — prd3.md

## Prerequisites

Ensure the API is running with a valid AI provider and PostgreSQL is up:

```bash
cd apps/api && DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids" AI_PROVIDER=groq GROQ_API_KEY=gsk_your_key npm run dev:api
```

---

## Validation Steps

### 1. Per-User Deduplication

34. **Action**: Create a user, answer question Q via `POST /api/quiz/answer` with `{userId, questionId: Q.id, answer: 0}`.
    **Expected**: Response returns `{correct, correctAnswer, pointsEarned}`. A `UserQuizHistory` row is created in the DB.

35. **Action**: Call `GET /api/quiz/questions?age=9-11&userId={userId}&count=5`.
    **Expected**: Question Q does NOT appear in the response (deduplication applied).

36. **Action**: Manually update the `UserQuizHistory` row's `answeredAt` to `now() - 61 days` in the DB, then repeat step 35.
    **Expected**: Question Q MAY now appear (outside the 60-day window).

37. **Action**: Call `GET /api/quiz/questions?age=9-11&count=5` (no userId).
    **Expected**: All non-expired questions are eligible. No dedup applied. `UserQuizHistory` is NOT queried.

### 2. Answer Persistence & Idempotency

38. **Action**: `POST /api/quiz/answer` twice with the same `{userId, questionId, answer}`.
    **Expected**: Only 1 `UserQuizHistory` row exists for `(userId, questionId)`. Second call returns the same response as the first.

### 3. Topic Deduplication (generation time)

39. **Action**: Run the timeless quiz job manually:
    ```bash
    node -e "require('./dist/jobs/generate-timeless-quiz').generateTimelessQuiz()"
    ```
    (or trigger via API in development mode)
    **Expected**: Log shows `Generated timeless question` entries. Questions are created in the DB with `isTimeless=true`, `expiresAt=null`, `topic` is non-null, lowercase.

40. **Action**: In the DB, find a question with `topic = 'X'` and `generatedAt` within the last 30 days. Run the daily quiz job. If the AI returns `topic = 'X'`, verify the log shows `Skipping question: topic already covered in last 30 days` and no new question is created with that topic.
    **Expected**: Topic dedup prevents exact-match duplicate topics within 30 days.

### 4. 70/30 Mix Verification

41. **Action**: Ensure the DB has both timeless (`isTimeless=true`) and recent questions for age `9-11`. Call `GET /api/quiz/questions?count=10&age=9-11&userId={userId-with-empty-history}`.
    **Expected**: Response contains 10 questions. Approximately 3 have `isTimeless=true` (30% ±1). Approximately 7 have `isTimeless=false` (70% ±1).

### 5. Sport Balance

42. **Action**: Insert 10 football + 1 of each other sport for age `9-11` into `QuizQuestion`. Call `GET /api/quiz/questions?count=5&age=9-11`.
    **Expected**: No single sport appears more than `floor(5/4)+1 = 2` times in the 5 returned questions.

### 6. Seed Fallback

43. **Action**: In a fresh test environment (no daily or timeless questions generated yet), call `GET /api/quiz/questions?count=5&age=9-11`.
    **Expected**: Response contains questions from the seed (15 static questions in the DB with `generatedAt IS NULL`).

### 7. Weekly Timeless Job

44. **Action**: Run `generateTimelessQuiz()` manually (see step 39).
    **Expected**:
    - Log shows `Weekly timeless quiz generation finished` with `generated > 0`
    - DB contains new questions with `isTimeless=true`, `expiresAt=null`, `generatedAt` set to now
    - Questions span multiple sports and age ranges

### 8. Per-Sport Gap Fill

45. **Action**: Ensure a specific sport (e.g. `padel`) has 0 questions for age `9-11` in the DB. Run `generateDailyQuiz()` manually.
    **Expected**: Log shows `Gap fill: generating timeless question` for padel/9-11. A new timeless question for padel is created in the DB.

46. **Action**: Ensure a sport has ≥ 3 questions for all age ranges. Run `generateDailyQuiz()`.
    **Expected**: Log does NOT show gap fill for that sport. `generateTimelessQuestion` is NOT called for it.

### 9. GDPR Cascade Delete

47. **Action**: Answer several questions with userId=X. Verify `UserQuizHistory` rows exist for X. Then call `DELETE /api/users/X/data`.
    **Expected**: All `UserQuizHistory` rows for user X are deleted (Prisma cascade).

### 10. Regression Check

48. **Action**: Run the full test suite: `npm run test:all`
    **Expected**: All 944 tests pass (API: 611, Web: 126, Mobile: 178, Shared: 29).

49. **Action**: Run lint: `npm run lint`
    **Expected**: 0 errors.

50. **Action**: Call `GET /api/quiz/questions?age=9-11&count=5` (no age-related filter change), `POST /api/quiz/answer`, `GET /api/quiz/score/:userId`, `POST /api/quiz/generate` — verify all existing quiz endpoints still work as before (backward compatibility).
    **Expected**: No regressions in existing quiz functionality.

---
## Appendix D: Re-validation after /t-review #3 (prd3.md)

The following steps verify the fixes applied by `/t-reduce-tech-debt` after the prd3.md code review round.

51. **Action** (review Critical #1 — source inspection): Open `apps/api/src/routes/quiz.ts` and verify the sport balance logic in `GET /api/quiz/questions`.
    **Expected**: `applySportBalance` is called ONCE on the combined (pre-shuffled) merged array, NOT called separately on shuffledA and shuffledB. The code should look like: `const preCombined = fisherYatesShuffle([...fromA, ...fromB]); const balancedCombined = sport ? preCombined : applySportBalance(preCombined, maxPerSport, count);`

52. **Action** (review Critical #1 — unit test): Run the quiz route tests: `cd apps/api && npx vitest run src/routes/__tests__/quiz.test.ts`
    **Expected**: All quiz route tests pass. Specifically, the new `caps football across combined pool A + pool B (cross-pool scenario)` test passes — it seeds both pool A and pool B with 4 football questions and asserts football count ≤ 2 in the 5-question response.

53. **Action** (review Warning #1 — source inspection): Verify `apps/api/src/services/quiz-dedup.ts` exists and `isTopicDuplicate` is NOT defined locally in either job file.
    **Expected**: `quiz-dedup.ts` exports `isTopicDuplicate`. Neither `generate-timeless-quiz.ts` nor `generate-daily-quiz.ts` contains a local `isTopicDuplicate` function definition. Both import it from `'../services/quiz-dedup'`.

54. **Action** (review Warning #2 — source inspection): Verify no double-normalisation in job callers.
    **Expected**: In `generate-timeless-quiz.ts`, the `normalizedTopic` line reads `const normalizedTopic = question.topic;` (no `.toLowerCase().trim().slice(0, 80)`). Same in `generate-daily-quiz.ts` inside `runGapFillPass`.

55. **Action** (review Suggestion #1 — source inspection): Open `apps/api/src/services/quiz-generator.ts` and find `generateTimelessQuestion`.
    **Expected**: A comment above the `isProviderAvailable()` call clarifies that this function checks availability internally and callers don't need to check separately.

56. **Action** (regression check): Re-run all original validation steps 1–50 above.
    **Expected**: All original steps still pass. No regressions introduced by the /t-review #3 fixes.
