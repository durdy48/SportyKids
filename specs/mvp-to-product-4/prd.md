# Phase 4: Accessibility & Production Quality

| Field | Value |
|-------|-------|
| **Phase** | 4 — Accessibility & Production Quality |
| **Priority** | P0 (blocking store submission) |
| **Target** | Pre-beta (before Phase 5: family testing) |
| **Dependencies** | Phases 0-4.5 complete, Store Assets & Deployment complete |
| **Estimated effort** | 5-7 days |

---

## 1. Overview / Problem Statement

SportyKids targets the Kids category on Apple App Store and Google Play. Apple **requires** VoiceOver support for Kids category apps and can reject submissions without it. Currently, the mobile app has **1 single `accessibilityLabel`** across its entire codebase (in `Shimmer.tsx`), and approximately **229 `TouchableOpacity`/`Pressable` elements across 20 files** lack any accessibility props. The web app has 14 `aria-label` attributes spread across 10 files but is missing labels on many interactive elements.

Additionally, the mobile app lacks global crash reporting. The existing `ErrorBoundary` component dynamically imports `@sentry/react-native` but the package is not installed, so crashes in production are invisible.

Finally, there are no end-to-end tests. The project has 652+ unit tests but no integration tests that verify complete user flows through the UI, leaving critical paths (onboarding, parental PIN, quiz) untested at the system level.

This phase addresses these three gaps to bring the app to production quality before beta testing with families.

---

## 2. Goals and Non-Goals

### Goals

1. **Mobile accessibility**: Every interactive element in all 26 mobile files (15 components + 11 screens) has proper `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`, and `accessibilityState` where applicable. All labels are localized via `t()`.
2. **Web accessibility**: All icon buttons, toggles, and context-dependent interactive elements in web components have `aria-label` and `role` attributes.
3. **Accessibility tests**: Existing test files include assertions verifying accessibility props are present on key interactive elements.
4. **Sentry mobile**: `@sentry/react-native` installed and initialized globally, wrapping the entire app. PII-free crash reporting active in production/preview builds.
5. **E2E tests**: Playwright configured for the web app with 5 critical flow tests running in CI on main/release branches.

### Non-Goals

- WCAG 2.1 AA full compliance certification (requires external audit)
- Keyboard navigation and focus management (web)
- Color contrast audit and fixes
- `reduceMotion` / `largerText` system accessibility preferences
- E2E mobile tests (Maestro/Detox)
- Sentry web integration (`@sentry/nextjs`)
- Sentry session replay
- Performance/Lighthouse tests
- Semantic HTML audit

---

## 3. Scope

### 3.1 Accessibility — Mobile (Systematic audit of 26 files)

**15 Components** in `apps/mobile/src/components/`:

| File | Interactive Elements | Key a11y Needs |
|------|---------------------|----------------|
| `NewsCard.tsx` | Heart/favorite button, card press, share, related articles | `accessibilityRole="button"`, labels for heart (save/unsave state), card (article title) |
| `FiltersBar.tsx` | 9+ sport filter chips with selected state | `accessibilityRole="tab"`, `accessibilityState={{ selected }}`, sport name labels |
| `MissionCard.tsx` | Claim button, progress indicator | `accessibilityRole="button"`, progress as `accessibilityLabel` |
| `ParentalTour.tsx` | Next, Done, Skip buttons | `accessibilityRole="button"`, step indicator labels |
| `ErrorBoundary.tsx` | Restart button (line 80) | `accessibilityRole="button"`, `accessibilityLabel` |
| `VideoPlayer.tsx` | Play/pause, media controls | `accessibilityRole="button"`, play state labels |
| `ErrorState.tsx` | Retry button | `accessibilityRole="button"`, error context in label |
| `Shimmer.tsx` | None (already has label) | Verify existing label is localized |
| `StreakCounter.tsx` | Streak display | `accessibilityLabel` with streak count |
| `BrandedRefreshControl.tsx` | Pull-to-refresh indicator | `accessibilityLabel` for loading state |
| `OfflineBanner.tsx` | Banner display | `accessibilityRole="alert"`, offline message |
| `LimitReached.tsx` | Go home button | `accessibilityRole="button"` |
| `ScheduleLockGuard.tsx` | Lock screen display | `accessibilityRole="alert"` |
| `NewsCardSkeleton.tsx` | Loading placeholder | `accessibilityLabel` for loading state |
| `SkeletonPlaceholder.tsx` | Loading placeholder | `accessibilityLabel` for loading state |

**11 Screens** in `apps/mobile/src/screens/`:

| File | Interactive Elements | Key a11y Needs |
|------|---------------------|----------------|
| `HomeFeed.tsx` | News items, filters, recently read section, search | Card press labels, section headers |
| `Quiz.tsx` | Answer buttons, start, next, feedback | `accessibilityRole="button"`, answer text in labels, correct/incorrect state |
| `Reels.tsx` | Play, like, share buttons | Media control labels, video title context |
| `Collection.tsx` | Sticker/achievement tabs, sticker cards | `accessibilityRole="tab"`, sticker name + rarity labels |
| `FavoriteTeam.tsx` | Team selection buttons, stats display | `accessibilityRole="button"`, team names, stat values |
| `ParentalControl.tsx` | PIN input, toggles, sliders, format/sport selection | `accessibilityRole` per control type, PIN digit labels ("Digit 1 of 4"), slider values |
| `Login.tsx` | Email/password inputs, auth buttons, social sign-in | `accessibilityRole` for inputs/buttons, form field labels |
| `Register.tsx` | Form inputs, submit button | Same as Login |
| `Onboarding.tsx` | Step navigation, sport/team selection, age picker | Step indicators, selectable items with state |
| `AgeGate.tsx` | Age selection buttons, consent checkbox, PIN setup | `accessibilityRole="button"/"checkbox"`, consent state |
| `RssCatalog.tsx` | Feed toggle switches, search, custom source form | `accessibilityRole="switch"`, `accessibilityState={{ checked }}` |

**1 Navigation file** in `apps/mobile/src/navigation/`:

| File | Interactive Elements | Key a11y Needs |
|------|---------------------|----------------|
| `index.tsx` | Bottom tab bar (6 tabs), LanguageToggle button, header buttons | `accessibilityRole="tab"`, `accessibilityLabel` for tabs (uses `t('nav.*')`) and language toggle |

**What to add per interactive element:**

```tsx
<TouchableOpacity
  accessible={true}
  accessibilityLabel={t('a11y.save_article', locale)}
  accessibilityRole="button"
  accessibilityHint={t('a11y.save_article_hint', locale)}
  accessibilityState={{ selected: isSaved }}
  onPress={onSave}
>
```

**Rules:**
- Every `TouchableOpacity` and `Pressable` MUST have at minimum `accessibilityLabel` and `accessibilityRole`
- Use `accessibilityHint` when the label alone does not convey the result of the action
- Use `accessibilityState` for toggles (`selected`), checkboxes (`checked`), and disabled states (`disabled`)
- Emojis used as informational content (not decorative) MUST have textual alternatives via `accessibilityLabel`
- All labels MUST be localized via `t('a11y.*', locale)` from `@sportykids/shared`
- Non-interactive informational elements (streak count, stats) should have `accessibilityLabel` with their content described textually

### 3.2 Accessibility — Web (Labels and roles on interactive elements)

**Current state**: 14 `aria-label` in 10 files. Files that already have some labels:
- `NotificationSettings.tsx`, `NewsCard.tsx`, `NavBar.tsx`, `FeedPreviewModal.tsx`
- `ReelCard.tsx`, `StreakCounter.tsx`, `SearchBar.tsx`, `ReportButton.tsx`
- `ReelPlayer.tsx`, `HeadlineRow.tsx`

**Files to audit and add missing labels** (in `apps/web/src/components/`):

| File | What to Add |
|------|-------------|
| `NavBar.tsx` | Verify all icon buttons (theme toggle, menu) have `aria-label` |
| `FiltersBar.tsx` | `role="tablist"` on container, `role="tab"` + `aria-selected` + `aria-label` on each filter chip |
| `SearchBar.tsx` | Verify input has `aria-label`, clear button labeled |
| `PinInput.tsx` | Each digit input: `aria-label="Digit {n} of 4"` |
| `QuizGame.tsx` | Answer buttons: `aria-label` with answer text, feedback indicators |
| `ParentalPanel.tsx` | All toggles: `role="switch"` + `aria-checked`, sliders: `role="slider"` + `aria-valuenow/min/max`, section headings |
| `OnboardingWizard.tsx` | Step navigation, sport/team selection buttons, age picker |
| `AgeGate.tsx` (in `apps/web/src/app/age-gate/`) | Age option buttons, consent checkbox, PIN input |
| `MissionCard.tsx` | Claim button, progress indicator |
| `StickerCard.tsx` | Sticker card with rarity info |
| `AchievementBadge.tsx` | Achievement status (locked/unlocked) |
| `FeedModeToggle.tsx` | Mode buttons with selected state |
| `LimitReached.tsx` | Action button |
| `ErrorState.tsx` | Retry button |
| `FeedPreviewModal.tsx` | Close button, modal role |
| `VideoPlayer.tsx` | Media controls |
| `ContentReportList.tsx` | Action buttons (review, dismiss) |
| `RewardToast.tsx` | Toast announcement role |
| `NotificationSettings.tsx` | Toggle switches |
| `LegalReviewBanner.tsx` | Action buttons |
| `EmptyState.tsx` | CTA button if present |
| `OfflineBanner.tsx` | `role="alert"` |

**NOT in scope**: Keyboard navigation, focus management, color contrast, semantic HTML restructuring.

### 3.3 i18n Keys for Accessibility

Add new `a11y` namespace to both `packages/shared/src/i18n/es.json` and `en.json`. Estimated ~80-120 new keys.

**Key naming convention**: `a11y.<component>.<element>` and `a11y.<component>.<element>_hint`

```json
{
  "a11y": {
    "news_card": {
      "save": "Save article",
      "unsave": "Remove from saved",
      "save_hint": "Double tap to save this article for later",
      "read": "Read article: {title}",
      "share": "Share article",
      "trending": "Trending article"
    },
    "filters": {
      "sport_filter": "{sport} filter",
      "sport_filter_selected": "{sport} filter, selected",
      "age_filter": "Age range: {range}",
      "all_filter": "Show all sports"
    },
    "quiz": {
      "answer_option": "Answer {index}: {text}",
      "answer_correct": "Correct answer: {text}",
      "answer_incorrect": "Incorrect answer: {text}",
      "start_quiz": "Start the quiz",
      "next_question": "Go to next question",
      "score": "Your score: {score} points"
    },
    "reels": {
      "play_video": "Play video: {title}",
      "pause_video": "Pause video",
      "like_video": "Like this video",
      "unlike_video": "Unlike this video",
      "share_video": "Share this video"
    },
    "parental": {
      "pin_digit": "PIN digit {n} of {total}",
      "toggle_format": "Toggle {format}: currently {state}",
      "time_slider": "Daily time limit: {value} minutes",
      "schedule_start": "Start hour: {hour}",
      "schedule_end": "End hour: {hour}"
    },
    "navigation": {
      "tab_news": "News tab",
      "tab_reels": "Reels tab",
      "tab_quiz": "Quiz tab",
      "tab_collection": "Collection tab",
      "tab_team": "My Team tab",
      "tab_parents": "Parents tab",
      "language_toggle": "Change language to {language}",
      "theme_toggle": "Change theme"
    },
    "onboarding": {
      "select_sport": "Select {sport}",
      "deselect_sport": "Deselect {sport}",
      "select_team": "Select {team} as favorite",
      "age_option": "I am {age} years old",
      "step_indicator": "Step {current} of {total}"
    },
    "age_gate": {
      "adult_option": "I am a parent or adult, 18 or older",
      "teen_option": "I am a teenager, 13 to 17",
      "child_option": "I am under 13 years old",
      "consent_checkbox": "Parental consent checkbox, currently {state}"
    },
    "collection": {
      "sticker": "{name} sticker, {rarity} rarity",
      "sticker_locked": "{name} sticker, locked",
      "achievement": "{name} achievement, {state}",
      "tab_stickers": "Stickers tab",
      "tab_achievements": "Achievements tab"
    },
    "mission": {
      "claim_reward": "Claim mission reward",
      "progress": "Mission progress: {progress} of {target}"
    },
    "common": {
      "loading": "Loading content",
      "retry": "Try again",
      "back": "Go back",
      "next": "Next",
      "close": "Close",
      "search": "Search",
      "clear_search": "Clear search",
      "offline_banner": "You are offline. Showing saved articles.",
      "error_restart": "Restart the app",
      "go_home": "Go to home screen",
      "refresh": "Pull down to refresh"
    },
    "catalog": {
      "toggle_source": "Toggle {source}: currently {state}",
      "source_enabled": "enabled",
      "source_disabled": "disabled"
    },
    "auth": {
      "email_input": "Email address",
      "password_input": "Password",
      "name_input": "Your name",
      "login_button": "Log in",
      "register_button": "Create account",
      "google_signin": "Sign in with Google",
      "apple_signin": "Sign in with Apple",
      "anonymous_continue": "Continue without an account"
    }
  }
}
```

The exact keys will be determined during implementation based on actual element context. The above is the target structure — implementations MUST follow this pattern.

### 3.4 Sentry Mobile — Global Crash Reporting

**Package**: `@sentry/react-native` (latest stable compatible with Expo SDK 54)

**Installation**:
```bash
cd apps/mobile && npx expo install @sentry/react-native
```

**Initialization in `apps/mobile/src/App.tsx`**:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN && !__DEV__,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Strip ALL user data — mandatory for kids app
    delete event.user;
    if (event.contexts) {
      delete event.contexts.profile;
    }
    return event;
  },
});
```

**Wrap the root component**:

```typescript
// In apps/mobile/src/App.tsx, change the export:
function App() {
  // ... existing App component code ...
}

export default Sentry.wrap(App);
```

**Update `apps/mobile/App.tsx`** (entry point) accordingly — it imports from `src/App.tsx`.

**EAS Sentry source maps**: Add to `apps/mobile/app.json`:

```json
{
  "expo": {
    "plugins": [
      ["@sentry/react-native/expo", {
        "organization": "sportykids",
        "project": "mobile"
      }]
    ]
  }
}
```

**ErrorBoundary compatibility**: The existing `ErrorBoundary` in `apps/mobile/src/components/ErrorBoundary.tsx` already dynamically imports `@sentry/react-native` in `reportToSentry()`. Once the package is installed, this will work automatically. No changes needed to `ErrorBoundary.tsx` (it already calls `Sentry.captureException`). The global `Sentry.wrap(App)` provides broader crash capture including native crashes.

**Key decisions**:
- **Always active** (NOT gated on `consentGiven`): Only technical crash data with PII stripped. Not personal data under GDPR.
- `beforeSend` strips all user data before transmission
- `enabled: false` in development (`__DEV__`)
- Only works in production/preview EAS builds (not Expo Go — Sentry native layer not available)
- New env var: `EXPO_PUBLIC_SENTRY_DSN`

### 3.5 E2E Tests — Playwright (Web)

**Installation**:
```bash
cd apps/web && npm install -D @playwright/test
npx playwright install chromium
```

**Config file**: `apps/web/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

**Test directory structure**:
```
apps/web/
├── e2e/
│   ├── onboarding.spec.ts
│   ├── parental-pin.spec.ts
│   ├── feed-filters.spec.ts
│   ├── quiz.spec.ts
│   └── schedule-lock.spec.ts
├── playwright.config.ts
```

**5 Flow specifications**:

#### Flow 1: Onboarding (`e2e/onboarding.spec.ts`)
1. Navigate to `/onboarding`
2. Complete age gate: select adult path
3. Enter child name
4. Select age range
5. Select at least one sport
6. Optionally select a team
7. Verify the home feed loads with news cards visible

#### Flow 2: Parental PIN (`e2e/parental-pin.spec.ts`)
1. First complete onboarding (setup helper)
2. Navigate to `/parents`
3. Enter and confirm a 4-digit PIN
4. Verify PIN is accepted
5. Access the parental panel
6. Verify panel tabs are visible (Profile, Content, Restrictions, Activity, PIN, Digest)

#### Flow 3: Feed + Filters (`e2e/feed-filters.spec.ts`)
1. Complete onboarding (setup helper)
2. Verify home page shows news cards
3. Click a sport filter chip (e.g., football)
4. Verify displayed news changes (or shows filtered state)
5. Use the search input to search for a term
6. Verify search results are displayed

#### Flow 4: Quiz (`e2e/quiz.spec.ts`)
1. Complete onboarding (setup helper)
2. Navigate to `/quiz`
3. Start a quiz
4. Click an answer option
5. Verify feedback is shown (correct/incorrect indicator)
6. Navigate to next question or view results

#### Flow 5: Schedule Lock (`e2e/schedule-lock.spec.ts`)
1. Complete onboarding + set up parental PIN (setup helper)
2. Navigate to parental panel restrictions tab
3. Enable schedule lock
4. Set start/end hours
5. Verify the schedule lock configuration is saved
6. Verify UI reflects the configured schedule

**Shared test helper** (`e2e/helpers.ts`):
- `completeOnboarding(page)` — Runs through age gate + onboarding wizard
- `setupParentalPin(page, pin)` — Sets up a parental PIN
- `getUserId(page)` — Extracts userId from localStorage

**CI integration**: Add `e2e` job to `.github/workflows/ci.yml`:

```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: [setup]
  if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/heads/release/')
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - name: Restore dependencies
      uses: actions/cache/restore@v4
      with:
        path: |
          node_modules
          apps/api/node_modules
          apps/web/node_modules
          apps/mobile/node_modules
          packages/shared/node_modules
        key: deps-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-prisma-${{ hashFiles('apps/api/prisma/schema.prisma') }}
    - name: Install Playwright browsers
      run: cd apps/web && npx playwright install chromium --with-deps
    - name: Build shared
      run: cd packages/shared && npx tsc
    - name: Run E2E tests
      run: cd apps/web && npx playwright test
    - name: Upload Playwright report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: apps/web/playwright-report/
        retention-days: 7
```

**Note on API dependency**: E2E tests run against the Next.js dev server which calls the API. For CI, the web app's API client should work against a mock or the tests should be structured to work with what the dev server provides. If the API is needed, add a `globalSetup` that starts the API process and runs seed. This is an implementation decision to be made during development based on how the web app handles API unavailability.

---

## 4. Technical Requirements

### 4.1 Files to Modify — Mobile Accessibility

**All paths relative to `apps/mobile/src/`**:

| # | File Path | Changes |
|---|-----------|---------|
| 1 | `components/NewsCard.tsx` | Add labels to heart button, card press, share button, related article links |
| 2 | `components/FiltersBar.tsx` | Add `accessibilityRole="tab"`, `accessibilityState={{ selected }}` to each chip |
| 3 | `components/MissionCard.tsx` | Add labels to claim button, progress text |
| 4 | `components/ParentalTour.tsx` | Add labels to Next, Done, Skip buttons and step indicator |
| 5 | `components/ErrorBoundary.tsx` | Add `accessibilityRole="button"` and label to restart button |
| 6 | `components/VideoPlayer.tsx` | Add labels to play/pause and media controls |
| 7 | `components/ErrorState.tsx` | Add label and role to retry button |
| 8 | `components/Shimmer.tsx` | Localize existing label via `t()` |
| 9 | `components/StreakCounter.tsx` | Add `accessibilityLabel` with streak count text |
| 10 | `components/BrandedRefreshControl.tsx` | Add `accessibilityLabel` for refresh state |
| 11 | `components/OfflineBanner.tsx` | Add `accessibilityRole="alert"` and label |
| 12 | `components/LimitReached.tsx` | Add label to go-home button |
| 13 | `components/ScheduleLockGuard.tsx` | Add `accessibilityRole="alert"` and label |
| 14 | `components/NewsCardSkeleton.tsx` | Add `accessibilityLabel` for loading state |
| 15 | `components/SkeletonPlaceholder.tsx` | Add `accessibilityLabel` for loading state |
| 16 | `screens/HomeFeed.tsx` | Add labels to news items, filters, recently read links |
| 17 | `screens/Quiz.tsx` | Add labels to answer buttons (include answer text), start/next buttons, score display |
| 18 | `screens/Reels.tsx` | Add labels to play, like, share buttons with video title context |
| 19 | `screens/Collection.tsx` | Add `accessibilityRole="tab"` to sticker/achievement tabs, labels to sticker cards |
| 20 | `screens/FavoriteTeam.tsx` | Add labels to team selection buttons, stat displays |
| 21 | `screens/ParentalControl.tsx` | Add PIN digit labels, toggle roles/states, slider values |
| 22 | `screens/Login.tsx` | Add input labels, button roles |
| 23 | `screens/Register.tsx` | Add input labels, button roles |
| 24 | `screens/Onboarding.tsx` | Add step indicators, selection states, sport/team labels |
| 25 | `screens/AgeGate.tsx` | Add age option labels, consent checkbox role/state |
| 26 | `screens/RssCatalog.tsx` | Add `accessibilityRole="switch"`, `accessibilityState={{ checked }}` to toggles |
| 27 | `navigation/index.tsx` | Add labels to LanguageToggle, verify tab bar labels |

### 4.2 Files to Modify — Web Accessibility

**All paths relative to `apps/web/src/`**:

| # | File Path | Changes |
|---|-----------|---------|
| 1 | `components/NavBar.tsx` | Verify/add `aria-label` on theme toggle, nav links |
| 2 | `components/FiltersBar.tsx` | `role="tablist"`, `role="tab"` + `aria-selected` on chips |
| 3 | `components/SearchBar.tsx` | Verify input `aria-label`, add to clear button |
| 4 | `components/PinInput.tsx` | Each input: `aria-label="Digit {n} of 4"` |
| 5 | `components/QuizGame.tsx` | Answer buttons: `aria-label` with text, feedback |
| 6 | `components/ParentalPanel.tsx` | Toggles: `role="switch"` + `aria-checked`, sliders: `role="slider"` + `aria-valuenow` |
| 7 | `components/OnboardingWizard.tsx` | Step nav, sport/team selection labels |
| 8 | `components/MissionCard.tsx` | Claim button label, progress |
| 9 | `components/StickerCard.tsx` | Sticker name + rarity in label |
| 10 | `components/AchievementBadge.tsx` | Achievement status label |
| 11 | `components/FeedModeToggle.tsx` | Mode buttons with `aria-pressed` |
| 12 | `components/LimitReached.tsx` | Action button label |
| 13 | `components/ErrorState.tsx` | Retry button label |
| 14 | `components/FeedPreviewModal.tsx` | `role="dialog"`, `aria-modal="true"`, close button |
| 15 | `components/VideoPlayer.tsx` | Media control labels |
| 16 | `components/ContentReportList.tsx` | Action button labels |
| 17 | `components/RewardToast.tsx` | `role="alert"` for announcement |
| 18 | `components/NotificationSettings.tsx` | Toggle labels with state |
| 19 | `components/LegalReviewBanner.tsx` | Action button labels |
| 20 | `components/EmptyState.tsx` | CTA button label if present |
| 21 | `components/OfflineBanner.tsx` | `role="alert"` |
| 22 | `app/age-gate/page.tsx` | Age option labels, consent checkbox |

### 4.3 Files to Modify — i18n

| File | Changes |
|------|---------|
| `packages/shared/src/i18n/es.json` | Add `a11y` namespace (~80-120 keys in Spanish) |
| `packages/shared/src/i18n/en.json` | Add `a11y` namespace (~80-120 keys in English) |

### 4.4 Files to Modify — Sentry

| File | Changes |
|------|---------|
| `apps/mobile/package.json` | Add `@sentry/react-native` dependency |
| `apps/mobile/src/App.tsx` | Import and init Sentry, wrap export with `Sentry.wrap()` |
| `apps/mobile/app.json` | Add Sentry Expo plugin for source maps |
| `apps/mobile/eas.json` | Add `EXPO_PUBLIC_SENTRY_DSN` env vars for preview/production if desired |

### 4.5 Files to Create — E2E

| File | Description |
|------|-------------|
| `apps/web/playwright.config.ts` | Playwright configuration |
| `apps/web/e2e/helpers.ts` | Shared test helpers (onboarding, PIN setup) |
| `apps/web/e2e/onboarding.spec.ts` | Onboarding flow test |
| `apps/web/e2e/parental-pin.spec.ts` | Parental PIN flow test |
| `apps/web/e2e/feed-filters.spec.ts` | Feed and filters flow test |
| `apps/web/e2e/quiz.spec.ts` | Quiz flow test |
| `apps/web/e2e/schedule-lock.spec.ts` | Schedule lock flow test |

### 4.6 Files to Modify — CI

| File | Changes |
|------|---------|
| `.github/workflows/ci.yml` | Add `e2e` job (Playwright, Chromium, on main/release only) |

### 4.7 Files to Modify — Tests (Accessibility Assertions)

Add `describe('accessibility', ...)` blocks to existing test files:

**Mobile** (in `apps/mobile/src/`):
| Existing Test File | Assertions to Add |
|-------------------|-------------------|
| `screens/__tests__/HomeFeed.test.tsx` | Verify news cards have `accessibilityLabel`, filter chips have `accessibilityRole` |
| `screens/__tests__/Quiz.test.tsx` | Verify answer buttons have `accessibilityLabel` containing answer text |
| `screens/__tests__/Login.test.tsx` | Verify inputs have `accessibilityLabel`, buttons have `accessibilityRole` |
| `screens/__tests__/Onboarding.test.tsx` | Verify sport selection has `accessibilityState` |
| `screens/__tests__/AgeGate.test.tsx` | Verify age options have `accessibilityLabel` |
| `screens/__tests__/ParentalControl.test.tsx` | Verify PIN inputs have digit labels |
| `components/__tests__/ErrorBoundary.test.tsx` | Verify restart button has `accessibilityRole="button"` |

**Web** (in `apps/web/src/`):
| Existing Test File | Assertions to Add |
|-------------------|-------------------|
| `components/QuizGame.test.tsx` | Verify answer buttons have `aria-label` |
| `components/PinInput.test.tsx` | Verify each digit input has `aria-label` |
| `components/ParentalPanel.test.tsx` | Verify toggles have `role="switch"` |
| `components/NewsCard.test.tsx` | Verify favorite button has `aria-label` |
| `components/OnboardingWizard.test.tsx` | Verify sport buttons have labels |
| `components/FeedModeToggle.test.tsx` | Verify mode buttons have `aria-label` |
| `components/LimitReached.test.tsx` | Verify action button has `aria-label` |
| `components/MissionCard.test.tsx` | Verify claim button has `aria-label` |
| `components/ErrorState.test.tsx` | Verify retry button has `aria-label` |
| `components/ReelPlayer.test.tsx` | Verify play controls have `aria-label` |
| `__tests__/age-gate.test.tsx` | Verify age option buttons have `aria-label` |

**Test pattern for mobile**:
```typescript
describe('accessibility', () => {
  it('should have accessibility labels on interactive elements', () => {
    const { getByRole, getAllByRole } = render(<Component />);
    expect(getByRole('button', { name: /some label/i })).toBeTruthy();
  });

  it('should have correct accessibility state on toggles', () => {
    const { getByLabelText } = render(<Component />);
    const toggle = getByLabelText(/toggle/i);
    expect(toggle.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false })
    );
  });
});
```

**Test pattern for web**:
```typescript
describe('accessibility', () => {
  it('should have aria-labels on interactive elements', () => {
    render(<Component />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should have correct ARIA attributes on toggles', () => {
    render(<Component />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
```

### 4.8 Documentation Updates

After implementation, update the following docs files:

| File | What to Update |
|------|---------------|
| `docs/en/08-design-and-ux.md` | Add accessibility section (a11y labels, VoiceOver support) |
| `docs/es/08-diseno-y-ux.md` | Same in Spanish |
| `docs/en/04-development-guide.md` | Add accessibility guidelines for new components, Sentry setup, E2E instructions |
| `docs/es/04-guia-desarrollo.md` | Same in Spanish |
| `docs/en/09-security-and-privacy.md` | Document Sentry PII stripping, no-consent rationale |
| `docs/es/09-seguridad-y-privacidad.md` | Same in Spanish |
| `docs/en/07-deployment-guide.md` | Add `EXPO_PUBLIC_SENTRY_DSN` env var, Playwright CI job |
| `docs/es/07-guia-de-despliegue.md` | Same in Spanish |
| `docs/en/10-roadmap-and-decisions.md` | Update phase status, document accessibility decisions |
| `docs/es/10-roadmap-y-decisiones.md` | Same in Spanish |

---

## 5. Implementation Decisions

### 5.1 Playwright over Maestro for E2E

**Decision**: Use Playwright for web E2E tests instead of Maestro for mobile E2E.

**Rationale**:
- Maestro requires native builds and macOS CI runners (expensive, slow)
- Playwright runs on standard Linux CI with headless Chromium (free, fast)
- The web app is the primary deployment target (accessible immediately via URL)
- Mobile E2E with Maestro/Detox is deferred to a future phase

### 5.2 Sentry always active (no consent gate)

**Decision**: Sentry crash reporting is NOT gated on `consentGiven`.

**Rationale**:
- `beforeSend` strips ALL user data — only technical crash data (stack traces, device info) is sent
- Technical crash data without PII is not personal data under GDPR
- Having visibility into ALL crashes (not just consented users) is critical for production stability
- The existing API Sentry integration follows the same pattern (opt-in via env var, no consent gate)
- If `EXPO_PUBLIC_SENTRY_DSN` is not set, Sentry is completely disabled

### 5.3 Systematic a11y audit (all 26+ files)

**Decision**: Audit every file with interactive elements, not just the most-used screens.

**Rationale**:
- Apple can reject Kids category apps without VoiceOver support
- Partial coverage could still result in rejection if a reviewer navigates to an unlabeled screen
- The effort difference between partial and full coverage is incremental (most patterns repeat)
- Doing it systematically now prevents re-work later

### 5.4 A11y labels use i18n

**Decision**: All accessibility labels use `t('a11y.*', locale)` instead of hardcoded strings.

**Rationale**:
- The app supports ES/EN locales — screen readers should read in the user's language
- Follows the existing pattern where all visible text uses `t()`
- Adding a dedicated `a11y` namespace keeps translation keys organized
- Spanish-speaking VoiceOver users would get English labels without localization

### 5.5 Tests integrated into existing files

**Decision**: Add accessibility assertions to existing test files, not separate `.a11y.test.tsx` files.

**Rationale**:
- Co-located with component logic — easier to maintain
- Runs in every CI pass automatically (no separate test command)
- Prevents drift between component changes and accessibility assertions
- Follows the project's existing test organization pattern

---

## 6. Testing Strategy

### 6.1 Accessibility Tests (Unit)

- **Where**: Added as `describe('accessibility', ...)` blocks inside existing test files
- **What**: Assert that key interactive elements have `accessibilityLabel`/`aria-label` and `accessibilityRole`/`role` props
- **Coverage target**: At minimum, 1 accessibility assertion per screen/component that has interactive elements
- **Runner**: Vitest (existing, runs in CI)
- **Mobile library**: `@testing-library/react-native` (already installed)
- **Web library**: `@testing-library/react` (already installed)

### 6.2 Sentry Tests (Unit)

- **Where**: Add to `apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx` or create `apps/mobile/src/__tests__/sentry.test.ts`
- **What**: Verify `beforeSend` strips user data, verify `Sentry.init` is called with correct config
- **Mock**: Mock `@sentry/react-native` module in test setup

### 6.3 E2E Tests (Playwright)

- **Where**: `apps/web/e2e/` directory
- **What**: 5 complete user flows
- **Runner**: Playwright Test
- **Browser**: Chromium only (for speed)
- **CI**: Runs only on `main` and `release/*` branches
- **Artifacts**: HTML report + screenshots on failure uploaded as CI artifacts

### 6.4 Existing Tests

- All existing 652+ tests MUST continue passing after changes
- Run full test suite: `npm run test:all` before declaring completion
- Verify CI pipeline passes: lint + typecheck + all test jobs

---

## 7. Acceptance Criteria

### Accessibility Mobile
- [ ] All `TouchableOpacity`/`Pressable` elements in all 26 audited files have `accessibilityLabel` and `accessibilityRole`
- [ ] Navigation tabs (6) have `accessibilityRole="tab"` and descriptive localized labels
- [ ] PinInput digits labeled with pattern "PIN digit {n} of {total}" (localized)
- [ ] Quiz answer options include the answer text in their `accessibilityLabel`
- [ ] Filter chips have `accessibilityState={{ selected: boolean }}`
- [ ] Emojis used as informational content have textual alternatives via `accessibilityLabel`
- [ ] All accessibility labels are localized via `t('a11y.*', locale)`
- [ ] LanguageToggle button in navigation has descriptive label
- [ ] Alert-type components (`OfflineBanner`, `ScheduleLockGuard`, `LimitReached`) have `accessibilityRole="alert"`
- [ ] Loading states (`Shimmer`, `NewsCardSkeleton`, `SkeletonPlaceholder`) have localized loading labels
- [ ] VoiceOver can navigate all screens without encountering unlabeled buttons (manual verification)

### Accessibility Web
- [ ] All icon-only buttons have `aria-label`
- [ ] Interactive elements have appropriate `role` attributes (`button`, `tab`, `switch`, `slider`, `dialog`, `alert`)
- [ ] Form inputs have associated labels (via `aria-label` or `<label>`)
- [ ] PinInput digits have `aria-label="Digit {n} of 4"`
- [ ] Filter chips have `role="tab"` and `aria-selected`
- [ ] Toggles have `role="switch"` and `aria-checked`
- [ ] Modal (FeedPreviewModal) has `role="dialog"` and `aria-modal="true"`

### i18n
- [ ] `a11y` namespace added to `packages/shared/src/i18n/es.json`
- [ ] `a11y` namespace added to `packages/shared/src/i18n/en.json`
- [ ] All mobile accessibility labels reference `t('a11y.*')` keys
- [ ] Keys cover all 26 audited mobile files + web components

### Accessibility Tests
- [ ] At least 7 existing mobile test files have `describe('accessibility', ...)` blocks
- [ ] At least 11 existing web test files have `describe('accessibility', ...)` blocks
- [ ] All accessibility tests pass in CI (`npm run test:all`)
- [ ] No existing tests broken by accessibility changes

### Sentry Mobile
- [ ] `@sentry/react-native` installed in `apps/mobile/package.json`
- [ ] `Sentry.init()` called in `apps/mobile/src/App.tsx` with `beforeSend` PII stripping
- [ ] `Sentry.wrap(App)` wraps the root component export
- [ ] `beforeSend` strips `event.user` and `event.contexts.profile` (verified by unit test)
- [ ] `enabled: false` when `EXPO_PUBLIC_SENTRY_DSN` is empty or in dev mode
- [ ] Sentry Expo plugin added to `app.json` for source map upload
- [ ] `EXPO_PUBLIC_SENTRY_DSN` documented in env vars section
- [ ] ErrorBoundary continues to work (dynamic import now resolves)

### E2E Web (Playwright)
- [ ] `@playwright/test` installed in `apps/web/package.json` (devDependency)
- [ ] `playwright.config.ts` created with Chromium, webServer, and test directory config
- [ ] 5 E2E spec files created and passing locally
- [ ] Shared helpers file (`e2e/helpers.ts`) with onboarding + PIN setup utilities
- [ ] CI job `e2e` added to `.github/workflows/ci.yml`
- [ ] CI job only runs on `main` and `release/*` branches
- [ ] Playwright report uploaded as CI artifact on failure

### Documentation
- [ ] All relevant docs files updated (8 docs EN + 8 docs ES = 16 files)
- [ ] `CLAUDE.md` updated with Phase 4 status, new env vars, new test commands

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `@sentry/react-native` incompatible with Expo SDK 54 | High — blocks Sentry integration | Use `npx expo install` which resolves compatible versions. Fallback: keep dynamic import in ErrorBoundary as sole crash reporting. |
| E2E tests flaky due to API dependency | Medium — CI failures | Design E2E tests to work with what the dev server provides. Use retries (1 retry in config). Add timeout buffers. Consider MSW for API mocking if needed. |
| Accessibility labels change component test snapshots | Low — test maintenance | Do not use snapshot testing for accessibility props. Use targeted assertions. |
| i18n key explosion (~100+ new keys) | Low — maintenance burden | Organized under single `a11y` namespace. Clear naming convention. |
| Playwright CI adds significant time | Medium — slower CI | Only run on main/release branches. Single browser (Chromium). Parallel test execution. |
| Some mobile components lack `locale` prop access | Medium — requires prop threading | Use `useUser().locale` hook in functional components. For class components (ErrorBoundary), accept locale as prop with 'es' fallback. |

---

## 9. Out of Scope / Future Work (Backlog)

| Item | Priority | Notes |
|------|----------|-------|
| WCAG 2.1 AA full compliance + external audit | P0 (production) | **Mandatory** before public launch. Requires professional accessibility audit. |
| Keyboard navigation and focus management (web) | P0 (production) | **Mandatory** for WCAG AA. Tab order, focus trapping in modals, skip-to-content. |
| Color contrast audit and fixes | P0 (production) | **Mandatory** for WCAG AA. Current color tokens may not meet 4.5:1 contrast ratio. |
| E2E mobile tests (Maestro/Detox) | P1 | **Necessary** before mobile store release. Native interactions, gesture testing. |
| Sentry web integration (`@sentry/nextjs`) | P1 | **Necessary** for web observability. Server + client error tracking. |
| `reduceMotion` system accessibility preference | P2 | Respect system setting to disable animations (confetti, transitions). |
| `largerText` / Dynamic Type support | P2 | Scale fonts based on system accessibility settings. |
| Sentry session replay | P3 | Too intrusive for a kids app. Not recommended. |
| Performance/Lighthouse CI tests | P2 | Automated performance regression detection. |
| Accessibility CI linting (eslint-plugin-jsx-a11y) | P1 | Prevent accessibility regressions in new code. |
| Screen reader announcement for dynamic content | P2 | `aria-live` regions for toasts, score updates, feed refresh. |
