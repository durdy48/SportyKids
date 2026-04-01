# Human Validation — prd.md (Phase 4: Accessibility & Production Quality)

## Prerequisites

Start the API and web app:

```bash
# Terminal 1: Start API
npm run dev:api

# Terminal 2: Start Web
npm run dev:web

# Terminal 3 (optional): Start Mobile
npm run dev:mobile
```

Ensure the database is seeded: `cd apps/api && npx tsx prisma/seed.ts`

---

## Validation Steps

### 1. Mobile Accessibility — VoiceOver (iOS Simulator)

1. **Action**: Open the app in iOS Simulator. Enable VoiceOver (Settings > Accessibility > VoiceOver > On, or Cmd+F5).
   **Expected**: VoiceOver activates and begins reading screen content.

2. **Action**: Navigate to the Home Feed tab using VoiceOver gestures (swipe right to move between elements).
   **Expected**: Each news card announces its title. Filter chips announce sport name + selected state. Heart/save buttons announce "Save article" or "Remove from saved".

3. **Action**: Navigate to the Quiz tab and start a quiz.
   **Expected**: Start button announces "Start the quiz". Each answer option announces its text. Correct/incorrect feedback is announced.

4. **Action**: Navigate to the Parents tab.
   **Expected**: PIN input digits announce "PIN digit 1 of 4", "PIN digit 2 of 4", etc. Format toggles announce their state. Schedule lock controls are labeled.

5. **Action**: Navigate to the Reels tab.
   **Expected**: Play buttons announce "Play video: [title]". Like/share buttons are labeled.

6. **Action**: Navigate to Collection tab.
   **Expected**: Sticker/Achievement tabs announce their names. Sticker cards announce name + rarity.

7. **Action**: Swipe through ALL screens checking for any unlabeled buttons (VoiceOver will say "button" without a description).
   **Expected**: No unlabeled interactive elements anywhere in the app.

### 2. Web Accessibility — Screen Reader

1. **Action**: Open http://localhost:3000 in Chrome. Open DevTools > Accessibility pane.
   **Expected**: Elements tree shows proper roles and labels.

2. **Action**: Navigate to the home page. Inspect filter chips.
   **Expected**: Filter container has `role="tablist"`. Each chip has `role="tab"` and `aria-selected`.

3. **Action**: Navigate to /parents. Inspect PinInput.
   **Expected**: Each digit input has `aria-label="Digit 1 of 4"`, "Digit 2 of 4", etc.

4. **Action**: Navigate to /quiz. Start a quiz. Inspect answer buttons.
   **Expected**: Each answer button has `aria-label` including the answer text.

5. **Action**: Inspect the parental panel toggles (after setting up PIN).
   **Expected**: Toggles have `role="switch"` and `aria-checked`. Sliders have `role="slider"` with `aria-valuenow`.

6. **Action**: Open the feed preview modal (if accessible).
   **Expected**: Modal has `role="dialog"` and `aria-modal="true"`.

### 3. Sentry Mobile

1. **Action**: Check `apps/mobile/src/App.tsx` — verify Sentry.init and Sentry.wrap are present.
   **Expected**: `Sentry.init()` with `beforeSend` that deletes `event.user` and `event.contexts.profile`. Export is `Sentry.wrap(App)`.

2. **Action**: Check `apps/mobile/app.json` — verify Sentry plugin.
   **Expected**: `plugins` array includes `@sentry/react-native/expo`.

3. **Action**: Run `cd apps/mobile && npx vitest run` and check Sentry tests.
   **Expected**: `sentry-before-send.test.ts` passes with 5 tests verifying PII stripping.

4. **Action**: (Production only) Build a preview build with `EXPO_PUBLIC_SENTRY_DSN` set. Trigger a crash.
   **Expected**: Crash appears in Sentry dashboard without any user data.

### 4. Playwright E2E

1. **Action**: Run `cd apps/web && npx playwright install chromium` (first time only).
   **Expected**: Chromium browser downloads successfully.

2. **Action**: Ensure API is running with seed data. Then run `cd apps/web && npx playwright test`.
   **Expected**: All 24 tests across 5 spec files pass.

3. **Action**: Run `cd apps/web && npx playwright test --ui` to open the Playwright UI.
   **Expected**: Interactive test runner opens. You can see each test step and screenshots.

### 5. i18n Keys

1. **Action**: Search for `a11y` in `packages/shared/src/i18n/es.json`.
   **Expected**: Full `a11y` namespace present with ~100+ keys in Spanish.

2. **Action**: Search for `a11y` in `packages/shared/src/i18n/en.json`.
   **Expected**: Same keys present in English.

3. **Action**: Change app language to English in the app, then enable VoiceOver.
   **Expected**: Accessibility labels are announced in English.

### 6. Test Suite Integrity

1. **Action**: Run `npm run test:all` from project root.
   **Expected**: 679 tests pass (434 API + 109 web + 136 mobile). Zero failures.

2. **Action**: Run `npm run lint` from project root.
   **Expected**: No errors, no warnings.

---

## Appendix A: Re-validation after /t-review #1

### 7. Review fixes verification

1. **Action**: Check `apps/mobile/src/lib/sentry-config.ts` exists and exports `beforeSend`.
   **Expected**: File exists with `beforeSend` function that strips `event.user`, `event.contexts.profile`, `event.request`, `event.server_name`, and `event.contexts.culture`.

2. **Action**: Check `apps/mobile/src/App.tsx` imports `beforeSend` from `./lib/sentry-config`.
   **Expected**: Import statement present, no inline `beforeSend` definition.

3. **Action**: Run `npm run test:mobile` and verify sentry tests include 8 tests (was 5).
   **Expected**: 139+ tests pass, including 8 sentry `beforeSend` tests.

4. **Action**: Check `apps/web/src/components/PinInput.tsx` uses `t('a11y.parental.pin_digit', locale, ...)` instead of hardcoded English.
   **Expected**: aria-label uses i18n function.

5. **Action**: Check `apps/web/src/components/ContentReportList.tsx` uses `t('a11y.report.mark_reviewed', locale)` and `t('a11y.report.dismiss', locale)`.
   **Expected**: aria-labels use i18n functions with new keys.

6. **Action**: Check `apps/web/src/components/QuizGame.tsx` has `data-testid="quiz-option"` on answer buttons and `aria-live="polite"` on score display.
   **Expected**: Both attributes present.

7. **Action**: Check `apps/mobile/src/screens/ParentalControl.tsx` digest toggle uses `accessibilityRole="switch"` (not "checkbox").
   **Expected**: Role is "switch" for consistency.

8. **Action**: Run all Playwright E2E tests.
   **Expected**: 24 tests pass. No regressions from review fixes.

9. **Action**: Run `npm run test:all` and `npm run lint`.
   **Expected**: All tests pass, lint clean. No regressions.
