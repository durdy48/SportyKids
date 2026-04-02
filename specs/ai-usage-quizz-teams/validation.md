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
