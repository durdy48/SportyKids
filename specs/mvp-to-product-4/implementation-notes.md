# Implementation Notes — Phase 4: Accessibility & Production Quality

**PRD**: `prd.md`
**Branch**: `mvp-to-product-4/accessibility-quality`
**Date**: 2026-04-01

---

## Summary

Implemented all 5 areas from the PRD:

1. **Mobile Accessibility** — Systematic audit of 27 files (15 components + 11 screens + navigation). Added accessibilityLabel, accessibilityRole, accessibilityHint, accessibilityState to all interactive elements. All labels localized via `t('a11y.*', locale)`.

2. **Web Accessibility** — Audited 25 component/page files. Added 66+ ARIA attributes (aria-label, role, aria-selected, aria-checked, aria-pressed, aria-modal, aria-live, role="dialog", role="alert", role="switch", role="tablist", role="progressbar").

3. **i18n a11y Keys** — Added `a11y` namespace with ~100+ keys in 21 sub-categories to both `es.json` and `en.json`.

4. **Sentry Mobile** — Installed `@sentry/react-native`, global init with `Sentry.wrap(App)`, PII-free `beforeSend`, Expo plugin for source maps. Always active (not consent-gated). 5 unit tests for PII stripping.

5. **Playwright E2E** — 5 spec files with 24 tests (onboarding, parental PIN, feed+filters, quiz, schedule lock). Shared helpers. CI job on main/release branches.

## Files Modified

### i18n (2 files)
- `packages/shared/src/i18n/es.json` — Added `a11y` namespace (~100+ Spanish keys)
- `packages/shared/src/i18n/en.json` — Added `a11y` namespace (~100+ English keys)

### Mobile Components (15 files)
- `apps/mobile/src/components/NewsCard.tsx`
- `apps/mobile/src/components/FiltersBar.tsx`
- `apps/mobile/src/components/MissionCard.tsx`
- `apps/mobile/src/components/ParentalTour.tsx`
- `apps/mobile/src/components/ErrorBoundary.tsx`
- `apps/mobile/src/components/VideoPlayer.tsx`
- `apps/mobile/src/components/ErrorState.tsx`
- `apps/mobile/src/components/Shimmer.tsx`
- `apps/mobile/src/components/StreakCounter.tsx`
- `apps/mobile/src/components/OfflineBanner.tsx`
- `apps/mobile/src/components/LimitReached.tsx`
- `apps/mobile/src/components/ScheduleLockGuard.tsx`
- `apps/mobile/src/components/NewsCardSkeleton.tsx`
- `apps/mobile/src/components/SkeletonPlaceholder.tsx`
- `apps/mobile/src/components/BrandedRefreshControl.tsx`

### Mobile Screens (11 files)
- `apps/mobile/src/screens/HomeFeed.tsx`
- `apps/mobile/src/screens/Quiz.tsx`
- `apps/mobile/src/screens/Reels.tsx`
- `apps/mobile/src/screens/Collection.tsx`
- `apps/mobile/src/screens/FavoriteTeam.tsx`
- `apps/mobile/src/screens/ParentalControl.tsx`
- `apps/mobile/src/screens/Login.tsx`
- `apps/mobile/src/screens/Register.tsx`
- `apps/mobile/src/screens/Onboarding.tsx`
- `apps/mobile/src/screens/AgeGate.tsx`
- `apps/mobile/src/screens/RssCatalog.tsx`

### Mobile Navigation (1 file)
- `apps/mobile/src/navigation/index.tsx`

### Mobile Sentry (5 files)
- `apps/mobile/src/App.tsx` — Sentry.init + Sentry.wrap
- `apps/mobile/package.json` — Added @sentry/react-native
- `apps/mobile/app.json` — Sentry Expo plugin
- `apps/mobile/vitest.setup.ts` — Sentry mock
- `apps/mobile/vitest.config.ts` — Added __DEV__ define
- `apps/mobile/.env.example` — EXPO_PUBLIC_SENTRY_DSN

### Web Components (25 files)
- `apps/web/src/components/NavBar.tsx`
- `apps/web/src/components/FiltersBar.tsx`
- `apps/web/src/components/SearchBar.tsx`
- `apps/web/src/components/PinInput.tsx`
- `apps/web/src/components/QuizGame.tsx`
- `apps/web/src/components/ParentalPanel.tsx`
- `apps/web/src/components/OnboardingWizard.tsx`
- `apps/web/src/components/MissionCard.tsx`
- `apps/web/src/components/StickerCard.tsx`
- `apps/web/src/components/AchievementBadge.tsx`
- `apps/web/src/components/FeedModeToggle.tsx`
- `apps/web/src/components/LimitReached.tsx`
- `apps/web/src/components/ErrorState.tsx`
- `apps/web/src/components/FeedPreviewModal.tsx`
- `apps/web/src/components/VideoPlayer.tsx`
- `apps/web/src/components/ContentReportList.tsx`
- `apps/web/src/components/RewardToast.tsx`
- `apps/web/src/components/NotificationSettings.tsx`
- `apps/web/src/components/OfflineBanner.tsx`
- `apps/web/src/components/NewsCard.tsx`
- `apps/web/src/components/ReelCard.tsx`
- `apps/web/src/components/HeadlineRow.tsx`
- `apps/web/src/components/ReelPlayer.tsx`
- `apps/web/src/components/StreakCounter.tsx`
- `apps/web/src/app/age-gate/page.tsx`

### E2E (8 files created)
- `apps/web/playwright.config.ts`
- `apps/web/e2e/helpers.ts`
- `apps/web/e2e/onboarding.spec.ts`
- `apps/web/e2e/parental-pin.spec.ts`
- `apps/web/e2e/feed-filters.spec.ts`
- `apps/web/e2e/quiz.spec.ts`
- `apps/web/e2e/schedule-lock.spec.ts`
- `apps/web/package.json` — Added @playwright/test + test:e2e script

### CI (1 file)
- `.github/workflows/ci.yml` — Added e2e job

### Tests Added/Modified
- `apps/mobile/src/__tests__/sentry-before-send.test.ts` — 5 new tests
- `apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx` — 3 new a11y tests
- `apps/mobile/src/screens/__tests__/HomeFeed.test.tsx` — 2 new a11y tests
- `apps/mobile/src/screens/__tests__/Quiz.test.tsx` — 2 new a11y tests
- `apps/mobile/src/screens/__tests__/AgeGate.test.tsx` — 2 new a11y tests
- `apps/mobile/src/screens/__tests__/Login.test.tsx` — 2 new a11y tests
- `apps/mobile/src/screens/__tests__/Onboarding.test.tsx` — 3 new a11y tests
- `apps/mobile/src/screens/__tests__/ParentalControl.test.tsx` — 3 new a11y tests
- 11 web test files augmented with a11y describe blocks (+24 new assertions)

### Documentation
- `CLAUDE.md` — Updated test counts, MVP status, env vars, debt items
- `docs/en/08-design-and-ux.md` — Added accessibility sections
- `docs/es/08-diseno-y-ux.md` — Added accessibility sections
- `docs/en/10-roadmap-and-decisions.md` — Updated test counts
- `docs/es/10-roadmap-y-decisiones.md` — Updated test counts

## Test Results

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| API | 39 | 434 | ✅ All pass |
| Web | 16 | 109 | ✅ All pass |
| Mobile | 16 | 136 | ✅ All pass |
| **Total** | **71** | **679** | ✅ **All pass** |
| E2E (Playwright) | 5 | 24 | ✅ Parse OK (need running app for execution) |
| Lint | — | — | ✅ Clean |
| Typecheck (web) | — | — | ✅ Clean |
| Typecheck (shared) | — | — | ✅ Clean |

## Decisions Made During Implementation

1. **Sentry version**: Used `~6.14.0` for compatibility with Expo SDK 54
2. **`__DEV__` in tests**: Added `define: { __DEV__: true }` to mobile vitest.config.ts so Sentry init resolves correctly in test environment
3. **Web aria-labels in English**: Web ARIA labels use plain English strings (not i18n) since they're for screen reader context. Mobile uses i18n because users switch languages.
4. **Playwright version**: `^1.52.0` — latest stable
5. **E2E resilience**: Tests use flexible selectors (regex matching both ES/EN), generous timeouts, and graceful skips when API is unavailable

## Fix: Mobile a11y coverage gaps (2026-04-01)

**Problem**: 66 interactive elements across 3 screens lacked `accessibilityLabel`, making them invisible to VoiceOver.

**Root cause**: Initial a11y audit covered main interactive components but missed legal links, back buttons, format/time chips, schedule controls, digest controls, and theme toggles in AgeGate, Onboarding, and ParentalControl screens.

**Files modified**:
- `apps/mobile/src/screens/AgeGate.tsx` — 12 elements fixed (3 back buttons, 6 legal links, 2 continue buttons, 1 set-pin button)
- `apps/mobile/src/screens/Onboarding.tsx` — 16 elements fixed (3 age range chips, 2 legal links, source feed chips, 3 format chips, 6 time limit chips)
- `apps/mobile/src/screens/ParentalControl.tsx` — 38 elements fixed (8 sport chips, feed preview btn, 6+21 time limit chips, schedule toggle, 4 schedule buttons, 10 timezone chips, digest toggle, 7 digest day chips, download PDF btn, 3 theme toggles, change PIN btn, 2 legal links, close preview btn)
- `packages/shared/src/i18n/es.json` — 33 new a11y keys (legal, age_gate, onboarding, parental sections)
- `packages/shared/src/i18n/en.json` — 33 matching English keys

**i18n keys added**: `a11y.legal.*` (2), `a11y.age_gate.go_back/continue_button/set_pin_button` (3), `a11y.onboarding.select_age/toggle_source/toggle_format/select_time_limit/no_limit` (5), `a11y.parental.toggle_sport/sport_allowed/sport_blocked/preview_feed/select_time_limit/no_time_limit/toggle_schedule/decrease_start/increase_start/decrease_end/increase_end/select_timezone/toggle_digest/select_digest_day/download_pdf/select_theme/change_pin_button/close_preview/news_limit/reels_limit/quiz_limit` (21)

## Fix: E2E helper completeOnboarding() (2026-04-01)

**Problem**: 18 of 24 Playwright E2E tests were skipping because the `completeOnboarding()` helper failed to complete the onboarding flow.

**Root causes** (3 issues):
1. Fresh visit to `/` redirects to `/onboarding` (not `/age-gate`). The helper checked for `/age-gate` first which was never true.
2. Step 5 (PIN): The OnboardingWizard has 2 full password inputs (PIN + confirm), but the helper assumed 4 separate digit inputs like PinInput. It also looked for "create|confirm" button text but the actual text is "Start"/"Empezar".
3. Step 4 (Sources): No wait for the async catalog fetch + pre-selection.
4. Schedule-lock test: ParentalTour overlay blocked tab clicks.

**Files modified**:
- `apps/web/e2e/helpers.ts` — Fixed `completeOnboarding` (wait for redirects), `completeOnboardingWizard` (step 4 wait, step 5 PIN handling, Start button regex). Added `dismissParentalTour` helper.
- `apps/web/e2e/schedule-lock.spec.ts` — Added `dismissParentalTour` before tab clicks.

**Result**: All 24 E2E tests now pass (was 6 pass, 18 skip).

## Tech Debt Reduction (2026-04-01, post /t-review)

12 items fixed from code review:

**Warnings fixed**:
1. Sentry `beforeSend` now strips 5 PII fields (was 2). Extracted to `apps/mobile/src/lib/sentry-config.ts`.
2. `beforeSend` shared module imported in both App.tsx and test file (no more copy-paste).
3. E2E helpers use `waitForURL` instead of `waitForTimeout` where possible.
4. schedule-lock.spec.ts refactored to use shared PIN helpers (removed duplication).
5. PinInput.tsx aria-label now uses i18n (`a11y.parental.pin_digit`).
6. ContentReportList.tsx aria-labels now use i18n (new keys: `a11y.report.mark_reviewed`, `a11y.report.dismiss`).

**Suggestions fixed**:
7. onboarding.spec.ts uses `waitForURL` instead of `waitForTimeout`.
8. QuizGame.tsx: added `data-testid="quiz-option"` for stable E2E selectors.
9. playwright.config.ts: JSDoc documenting API requirement.
10. ParentalControl digest toggle: `accessibilityRole="switch"` (was "checkbox").
11. QuizGame.tsx: `aria-live="polite"` on score display.
12. `assertNoCrash` logs warning instead of silently catching.

**New files**: `apps/mobile/src/lib/sentry-config.ts`
**New tests**: 3 additional sentry tests (8 total, was 5)
**New i18n keys**: `a11y.report.mark_reviewed`, `a11y.report.dismiss` (both locales)

## Known Issues

- E2E tests require a running API with seeded data for full functionality. In CI, the webServer command starts Next.js dev but the API must be available. Tests are designed to not crash if API is down.
- `@sentry/react-native` requires native builds — will not work in Expo Go development. Only active in production/preview EAS builds.
- Mobile BrandedRefreshControl, NewsCardSkeleton, SkeletonPlaceholder had no TouchableOpacity/Pressable to audit (native controls or inheriting from Shimmer).
