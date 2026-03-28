# PRD3: Completing Pending Features — Parental Trust, Daily Missions & Dark Mode

## Overview

This PRD covers three partially-implemented feature groups from Product Owner Sprints 3 and 4 that need to be completed for beta readiness. Most backend work already exists; the primary gaps are frontend UI, integration hooks, and cross-platform dark mode support. The goal is to close these gaps with minimal backend changes and deliver a polished experience across web and mobile.

**Feature 10**: Complete Sprint 3 — Parental Trust (B-PT1 Digest UI, B-PT2 Preview Mode, B-PT3 Granular Time Limits)
**Feature 11**: Complete Sprint 4 — Retention Engine (B-EN1 Daily Missions integration)
**Feature 12**: Dark Mode — Web & Mobile (B-UX4)

---

## Problem Statement

1. **Parental Trust**: Backend services for weekly digest, feed preview, and granular time limits are functional, but parents have no UI to configure digest delivery, preview their child's feed, or adjust per-content-type limits on mobile. Without these, parental trust features are invisible to users.

2. **Daily Missions**: The mission system (generation, progress tracking, claiming) is fully wired in the backend and the `MissionCard` component exists on web. However, mission progress is not updated in real-time on the client when the user performs activities, there is no push notification for new daily missions, the expired-mission message is missing, and mobile has no MissionCard at all.

3. **Dark Mode**: CSS custom properties with light/dark values are defined in `globals.css`, and `UserContext` has a `theme` field with `setTheme` and `resolvedTheme`. The `NavBar` has a working theme toggle. However, zero components use `dark:` variants (only 5 occurrences in 2 files), making the dark theme visually broken. Mobile has no theme support at all — all colors are hardcoded to light values using `COLORS.darkText`, `COLORS.lightBackground`, etc.

---

## Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Parents can configure and preview weekly digest from both web and mobile | Digest tab on web fully functional; mobile parental screen includes digest configuration |
| G2 | Parents can preview their child's exact feed | FeedPreviewModal accessible from ParentalPanel (web) and ParentalControl (mobile) |
| G3 | Per-content-type time sliders visible on mobile | Mobile restrictions tab shows 3 sliders matching web |
| G4 | Mission progress updates in real-time on the client | MissionCard on web re-fetches after activity; mobile has MissionCard |
| G5 | Push notifications for daily missions | "Mission ready" at 07:00 local; "Almost there" at 18:00 if progress > 50% |
| G6 | Dark mode works correctly across all web components | All components render correctly in dark theme with appropriate contrast |
| G7 | Dark mode works on mobile | Theme toggle in mobile settings; all screens respect dark/light tokens |

---

## Target Users

- **Children (6-14)**: Experience dark mode; see daily mission card; receive push notifications
- **Parents**: Configure digest, preview child's feed, set per-content-type time limits

---

## Core Features

### Feature 10: Parental Trust Completion

#### B-PT1: Weekly Digest UI

**Current state**: Backend fully implemented.
- `apps/api/src/services/digest-generator.ts`: `generateDigestData()`, `renderDigestHtml()`, `renderDigestPdf()`
- `apps/api/src/routes/parents.ts`: PUT/GET `/api/parents/digest/:userId`, GET `.../preview`, GET `.../download`
- `apps/api/src/jobs/send-weekly-digests.ts`: Cron job
- Web `ParentalPanel.tsx`: Digest tab exists with state management, toggle, email input, day selector, preview, and PDF download — **already fully implemented** (lines 88-168, tab 'digest' in TABS)
- i18n keys exist: `digest.*` in both `es.json` and `en.json`

**What is missing**:
1. Mobile ParentalControl screen does NOT have a digest tab (tabs are: `'profile' | 'content' | 'restrictions' | 'activity' | 'pin'` — no `'digest'`)
2. Email delivery verification — no test/verify email button
3. No confirmation feedback when digest preferences are saved on web

**Implementation tasks**:

**Task 10.1**: Add digest tab to mobile `ParentalControl` screen
- File: `apps/mobile/src/screens/ParentalControl.tsx`
- Add `'digest'` to `TabId` union type
- Add digest tab button in tab bar
- Add API functions to `apps/mobile/src/lib/api.ts`: `getDigestPreferences(userId)`, `updateDigestPreferences(userId, data)`, `previewDigest(userId)`, `downloadDigestPdf(userId)` (matching web's `apps/web/src/lib/api.ts`)
- Build digest configuration section: enable toggle (Switch), email TextInput, day picker (7 buttons), preview button, download button
- Use `Linking.openURL()` for PDF download on mobile (open in browser)
- Add i18n keys if any are missing for mobile-specific UI

**Task 10.2**: Add "Send test email" button on web digest tab
- File: `apps/web/src/components/ParentalPanel.tsx`
- Add button below email input that calls a new endpoint
- File: `apps/api/src/routes/parents.ts` — Add `POST /api/parents/digest/:userId/test` endpoint
  - Reuses `generateDigestData()` + `renderDigestHtml()` + nodemailer to send a test digest
  - Rate limited: 1 test email per 5 minutes per user
  - Returns `{ ok: true, sentTo: email }` or error
- Add i18n keys: `digest.send_test` ("Send test email" / "Enviar email de prueba"), `digest.test_sent` ("Test email sent!" / "Email de prueba enviado!"), `digest.test_error` ("Could not send test email" / "No se pudo enviar el email de prueba")

**Task 10.3**: Add save confirmation toast on web digest tab
- File: `apps/web/src/components/ParentalPanel.tsx`
- After successful `handleDigestChange()`, show a brief "Saved" toast (reuse pattern from settings)
- Add i18n key: `digest.saved` ("Preferences saved" / "Preferencias guardadas")

#### B-PT2: "See What My Child Sees" Preview Mode

**Current state**:
- Backend: `GET /api/parents/preview/:userId` exists (line 528 of parents.ts), returns `{ news, reels, quizAvailable }` with all parental restrictions applied
- Web: `FeedPreviewModal.tsx` is **fully implemented** — fetches feed preview, displays NewsCard/ReelCard, shows format/sport restrictions
- Web `ParentalPanel.tsx` already imports and renders `FeedPreviewModal` (line 9, line 86: `showPreview` state)

**What is missing**:
1. Mobile ParentalControl has no "Preview" button or modal
2. FeedPreviewModal needs to display which restrictions are active (informational banner)

**Implementation tasks**:

**Task 10.4**: Add feed preview to mobile ParentalControl
- File: `apps/mobile/src/screens/ParentalControl.tsx`
- Add "See what they see" button in the content tab
- Create new component: `apps/mobile/src/components/FeedPreviewModal.tsx`
  - Full-screen modal (React Navigation modal or `Modal` from RN)
  - Fetch from `GET /api/parents/preview/:userId` with parental session header
  - Display news items using existing `NewsCard` component
  - Show reels as thumbnail grid (not full player)
  - Show info banner with active restrictions
- Add API function: `fetchFeedPreview(userId, sessionToken)` to `apps/mobile/src/lib/api.ts`
- Add i18n keys: `preview.active_restrictions` ("Active restrictions" / "Restricciones activas"), `preview.no_restrictions` ("No restrictions active" / "Sin restricciones activas")

**Task 10.5**: Add active restrictions banner to web FeedPreviewModal
- File: `apps/web/src/components/FeedPreviewModal.tsx`
- Below the header, show a compact info banner listing:
  - Blocked formats (if any)
  - Blocked sports (if any)
  - Time limit status
  - Schedule lock status
- Fetch this info from the existing profile data (pass `ParentalProfile` as prop or fetch inline)

#### B-PT3: Granular Time Limits by Content Type

**Current state**:
- Backend: `maxNewsMinutes`, `maxReelsMinutes`, `maxQuizMinutes` in ParentalProfile, enforced in `parental-guard.ts` (lines 9-23 show `FORMAT_TO_LIMIT_KEY` mapping)
- Web: **Already implemented** — ParentalPanel restrictions tab (lines 509-552) shows 3 range sliders with labels
- `LimitReached` component exists and handles `limit_reached`, `format_blocked`, `sport_blocked`, `schedule_locked`

**What is missing**:
1. Mobile ParentalControl restrictions tab has no per-type sliders
2. `LimitReached` does not differentiate which content type hit its limit (shows generic message)

**Implementation tasks**:

**Task 10.6**: Add per-type time limit sliders to mobile restrictions tab
- File: `apps/mobile/src/screens/ParentalControl.tsx`
- In the restrictions tab, below the global time limit presets, add a section:
  - Section header with `t('restrictions.per_type', locale)`
  - Three `Slider` components (from `@react-native-community/slider` or custom) for news, reels, quiz
  - Each slider: 0-120 minutes, step 5, with label showing current value
  - 0 = no specific limit (follows global limit)
  - On change: call `updateParentalProfile(userId, { [field]: value === 0 ? null : value })`
  - Tip text: `t('restrictions.per_type_tip', locale)`
- Dependency: `@react-native-community/slider` (check if already installed, if not use a simple custom slider with `PanResponder` to avoid adding dependencies)

**Task 10.7**: Enhance LimitReached to show content-type-specific messages
- File: `apps/web/src/components/LimitReached.tsx`
- Add new `LimitType` values: `'news_limit_reached' | 'reels_limit_reached' | 'quiz_limit_reached'`
- Add corresponding i18n keys:
  - `limit.news_reached_message`: "You've used your news time for today! Try reels or the quiz." / "Has usado tu tiempo de noticias hoy! Prueba los reels o el quiz."
  - `limit.reels_reached_message`: "You've watched enough reels for today! Try reading news or the quiz." / "Has visto suficientes reels hoy! Prueba leer noticias o el quiz."
  - `limit.quiz_reached_message`: "You've played enough quizzes for today! Try reading news or watching reels." / "Has jugado suficientes quizzes hoy! Prueba leer noticias o ver reels."
- Create matching mobile component: `apps/mobile/src/components/LimitReached.tsx`

---

### Feature 11: Daily Missions Completion

**Current state**:
- Backend: `DailyMission` model, `mission-generator.ts` (8 mission types, weighted random, age-based targets, `checkMissionProgress()`)
- Cron: `generate-daily-missions.ts` at 05:00 UTC
- Endpoints: `GET /api/missions/today/:userId`, `POST /api/missions/claim`
- Progress hook: `checkMissionProgress()` is already called in `POST /api/parents/activity/log` (line 511 of parents.ts)
- Web: `MissionCard.tsx` exists and is rendered in `HomeFeedClient.tsx` (line 153)
- Web MissionCard: fetches mission on mount, shows progress bar, handles claim with button

**What is missing**:
1. Web MissionCard does NOT re-fetch after the user performs an activity (reads news, watches reel, plays quiz) — progress is stale until page reload
2. No expired mission message ("Tomorrow you'll have another chance!")
3. No celebration animation on mission completion (confetti from `celebrations.ts`)
4. Mobile has no MissionCard component or screen integration
5. Push notifications for daily missions: "Your daily mission is ready!" at 07:00 local, "Almost there!" at 18:00 if progress > 50%

**Implementation tasks**:

**Task 11.1**: Add real-time mission progress refresh on web
- File: `apps/web/src/components/MissionCard.tsx`
- Expose a `refreshMission()` callback via a custom event or context
- Option A (recommended): Use a custom DOM event `sportykids:activity-logged` dispatched after each activity log call in `apps/web/src/lib/api.ts`
  - In `api.ts`, after successful `POST /api/parents/activity/log`, dispatch: `window.dispatchEvent(new CustomEvent('sportykids:activity-logged'))`
  - In `MissionCard`, add `useEffect` listening for `sportykids:activity-logged` event, then re-fetch mission
- Option B: Poll every 30s (less elegant, more battery usage)
- When the API response from `/activity/log` includes `mission.missionUpdated === true`, the event should trigger immediate refresh

**Task 11.2**: Add expired mission message
- File: `apps/web/src/components/MissionCard.tsx`
- When `fetchTodayMission` returns no mission (null) or a mission from a previous date, show:
  ```
  "Tomorrow you'll have another chance!"
  ```
- Modify the API response: `GET /api/missions/today/:userId` should return `{ mission: null, expired: true, message: '...' }` when no mission exists for today but one existed yesterday
- File: `apps/api/src/routes/missions.ts` (check actual route file)
- Add i18n keys: `mission.expired` ("Tomorrow you'll have another chance!" / "Manana tendras otra oportunidad!"), `mission.no_mission` ("No mission today yet. Check back later!" / "Aun no hay mision. Vuelve mas tarde!")

**Task 11.3**: Add celebration animation on mission completion
- File: `apps/web/src/components/MissionCard.tsx`
- When mission transitions from `completed: false` to `completed: true` after a refresh, trigger confetti
- Import `celebrateMissionComplete` from `apps/web/src/lib/celebrations.ts`
- File: `apps/web/src/lib/celebrations.ts` — Add `celebrateMissionComplete()` function:
  - Similar to existing `celebrateSticker()` but with different colors/particle count
  - Use canvas-confetti with gold/blue particles

**Task 11.4**: Create MissionCard for mobile
- New file: `apps/mobile/src/components/MissionCard.tsx`
- Props: `userId: string`, `locale: Locale`
- Fetch from `GET /api/missions/today/:userId`
- Three states matching web: uncompleted (blue), completed-unclaimed (yellow pulsing), claimed (green compact)
- Progress bar with animated width
- Claim button with haptic feedback (`Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`)
- Add to `apps/mobile/src/screens/HomeFeed.tsx` as a header component in the FlatList
- Add API functions to `apps/mobile/src/lib/api.ts`: `fetchTodayMission(userId)`, `claimMission(userId)`
- When claimed, trigger haptic success + celebration (use `Haptics` — no confetti on mobile for simplicity)

**Task 11.5**: Add expired mission state to mobile MissionCard
- Same logic as Task 11.2 but for mobile component
- Show a soft gray card with the expired message

**Task 11.6**: Push notifications for daily missions
- File: `apps/api/src/jobs/generate-daily-missions.ts`
- After generating missions for all users, send push notification to each:
  - Title: `t('notifications.mission_ready_title', userLocale)` (key already exists in es.json line 554)
  - Body: `t('notifications.mission_ready_body', userLocale, { rarity: rewardRarity })`
  - Schedule: already runs at 05:00 UTC — adjust to send push at 07:00 local per user's timezone (or send at generation time with a note; exact local-time scheduling is complex)
  - Simpler approach: send push immediately after mission generation (05:00 UTC ~ 07:00 CET for Spain)
- New cron job: `apps/api/src/jobs/mission-reminder.ts`
  - Runs at 18:00 UTC daily
  - For each user with an active (not completed) mission where `progress / target > 0.5`:
    - Send push: "Almost there! You're {progress}/{target} on your mission" / "Casi lo tienes! Llevas {progress}/{target} en tu mision"
  - Add i18n keys: `notifications.mission_almost_title` ("Almost there!" / "Casi lo tienes!"), `notifications.mission_almost_body` ("You're {progress} of {target} on today's mission!" / "Llevas {progress} de {target} en la mision de hoy!")

---

### Feature 12: Dark Mode — Web & Mobile

#### Web Dark Mode

**Current state**:
- `globals.css` defines `.dark` class overriding all CSS custom properties (lines 17-26)
- `layout.tsx` has inline script preventing flash (lines 28-36)
- `UserContext` has `theme`, `setTheme`, `resolvedTheme` — fully working (lines 9, 16-18, 46-58, 80-102, 166-172)
- `NavBar` has `cycleTheme()` function (line 31-34) — theme toggle exists
- Problem: Only 2 components use `dark:` prefix (5 total occurrences). All other components use `var(--color-*)` which already respond to the `.dark` class. The CSS var approach means most components **already work** in dark mode.

**Audit needed**: Since components use CSS variables like `var(--color-text)`, `var(--color-surface)`, `var(--color-border)`, etc., they should already respond to the `.dark` class. The real issues will be:
1. Hardcoded color values (e.g., `bg-blue-50`, `bg-green-50`, `bg-yellow-50`, `bg-gray-200`, `text-green-700`, etc.) that don't change in dark mode
2. Image/shadow visibility in dark mode
3. Focus rings and input styling

**Implementation tasks**:

**Task 12.1**: Audit and fix hardcoded colors on web
- Scan ALL components in `apps/web/src/components/` and `apps/web/src/app/` for:
  - Tailwind color classes without `dark:` variant (e.g., `bg-blue-50`, `bg-green-50`, `bg-yellow-50`, `bg-gray-200`, `text-green-700`, `text-yellow-900`, `border-blue-200`, etc.)
  - Hardcoded hex values in inline styles
- For each occurrence, add a `dark:` variant or replace with CSS variable
- Key components to audit (by priority):
  1. `MissionCard.tsx` — uses `bg-blue-50`, `bg-green-50`, `bg-yellow-50`, `bg-gray-200`, `text-green-700`, `text-yellow-900`
  2. `NewsCard.tsx` — check for hardcoded colors
  3. `ReelCard.tsx`
  4. `QuizGame.tsx`
  5. `StickerCard.tsx`, `StreakCounter.tsx`, `AchievementBadge.tsx`
  6. `FiltersBar.tsx`, `SearchBar.tsx`
  7. `OnboardingWizard.tsx`
  8. `ParentalPanel.tsx`, `PinInput.tsx`
  9. `FeedPreviewModal.tsx`
  10. `LimitReached.tsx`
  11. `ErrorState.tsx`, `OfflineBanner.tsx`
  12. `RewardToast.tsx`
  13. `FeedModeToggle.tsx`, `HeadlineRow.tsx`

**Replacement patterns**:
```
bg-blue-50      → bg-blue-50 dark:bg-blue-950
bg-green-50     → bg-green-50 dark:bg-green-950
bg-yellow-50    → bg-yellow-50 dark:bg-yellow-950
bg-gray-200     → bg-[var(--color-border)]
text-green-700  → text-green-700 dark:text-green-400
text-yellow-900 → text-yellow-900 dark:text-yellow-200
border-blue-200 → border-blue-200 dark:border-blue-800
border-green-200→ border-green-200 dark:border-green-800
border-yellow-300→border-yellow-300 dark:border-yellow-700
```

**Task 12.2**: Add theme icon to NavBar toggle
- File: `apps/web/src/components/NavBar.tsx`
- The `cycleTheme()` function exists but the button needs a visible icon
- Display: sun icon (light), moon icon (dark), or auto icon (system)
- Add tooltip showing current mode name
- Add i18n keys: `theme.system` ("Auto" / "Auto"), `theme.light` ("Light" / "Claro"), `theme.dark` ("Dark" / "Oscuro")

**Task 12.3**: Verify dark mode skeleton/shimmer animation
- File: `apps/web/src/styles/globals.css`
- The `.skeleton` class uses `var(--color-border)` and `var(--color-surface)` which should adapt
- Verify visually and adjust if needed

#### Mobile Dark Mode

**Current state**:
- No theme support at all
- All screens use hardcoded `COLORS.darkText` (#1E293B), `COLORS.lightBackground` (#F8FAFC), `COLORS.white` (#FFFFFF) from `packages/shared/src/constants/index.ts`
- `apps/mobile/src/lib/user-context.tsx` has no `theme` field
- No `useColorScheme()` usage

**Implementation tasks**:

**Task 12.4**: Create theme system for mobile
- New file: `apps/mobile/src/lib/theme.ts`
  ```typescript
  import { useColorScheme } from 'react-native';
  import { COLORS } from '@sportykids/shared';

  export type ThemeMode = 'system' | 'light' | 'dark';

  export interface ThemeColors {
    background: string;
    text: string;
    surface: string;
    border: string;
    muted: string;
    blue: string;
    green: string;
    yellow: string;
  }

  export const lightColors: ThemeColors = {
    background: '#F8FAFC',
    text: '#1E293B',
    surface: '#FFFFFF',
    border: '#E5E7EB',
    muted: '#6B7280',
    blue: '#2563EB',
    green: '#22C55E',
    yellow: '#FACC15',
  };

  export const darkColors: ThemeColors = {
    background: '#0F172A',
    text: '#F1F5F9',
    surface: '#1E293B',
    border: '#334155',
    muted: '#94A3B8',
    blue: '#3B82F6',
    green: '#34D399',
    yellow: '#FCD34D',
  };

  export function resolveColors(mode: ThemeMode, systemScheme: 'light' | 'dark' | null): ThemeColors {
    if (mode === 'system') {
      return systemScheme === 'dark' ? darkColors : lightColors;
    }
    return mode === 'dark' ? darkColors : lightColors;
  }
  ```

**Task 12.5**: Add theme to mobile UserContext
- File: `apps/mobile/src/lib/user-context.tsx`
- Add fields: `theme: ThemeMode`, `setTheme: (theme: ThemeMode) => void`, `colors: ThemeColors`
- Persist theme in AsyncStorage key `sportykids-theme`
- Use `useColorScheme()` from React Native for system detection
- Expose `colors` object that all screens use instead of `COLORS.darkText` etc.

**Task 12.6**: Migrate all mobile screens to use theme colors
- Replace every `COLORS.darkText` with `colors.text`
- Replace every `COLORS.lightBackground` with `colors.background`
- Replace every `COLORS.white` or `'#FFFFFF'` with `colors.surface`
- Replace every `'#E5E7EB'` or similar border colors with `colors.border`
- Files to update (all in `apps/mobile/src/`):
  1. `screens/HomeFeed.tsx`
  2. `screens/Reels.tsx`
  3. `screens/Quiz.tsx`
  4. `screens/Collection.tsx`
  5. `screens/FavoriteTeam.tsx`
  6. `screens/Onboarding.tsx`
  7. `screens/ParentalControl.tsx`
  8. `screens/Login.tsx`
  9. `screens/Register.tsx`
  10. `screens/RssCatalog.tsx`
  11. `components/NewsCard.tsx`
  12. `components/FiltersBar.tsx`
  13. `components/StreakCounter.tsx`
  14. `components/ErrorState.tsx`
  15. `components/OfflineBanner.tsx`
  16. `components/VideoPlayer.tsx`
  17. `components/ParentalTour.tsx`
  18. `components/BrandedRefreshControl.tsx`
  19. `App.tsx` (StatusBar style)
  20. `navigation/` — tab bar colors

**Task 12.7**: Add theme toggle to mobile
- Location: ParentalControl screen (settings/profile tab) OR a new settings gear in the tab bar
- Recommended: Add to the profile tab of ParentalControl
- Three-state toggle: System > Dark > Light (matching web behavior)
- Show current mode with icon (sun/moon/auto)
- Persist immediately to AsyncStorage

**Task 12.8**: Update StatusBar for dark mode
- File: `apps/mobile/src/App.tsx`
- Change `<StatusBar style="dark" />` to `<StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />`
- This ensures the status bar text is visible against the background

---

## UI Mockups

### B-PT1: Mobile Digest Tab

```
+------------------------------------------+
|  [Profile][Content][Restrict][Activity]   |
|  [PIN][*Digest*]                          |
+------------------------------------------+
|                                           |
|  Weekly Digest                            |
|                                           |
|  [====== Toggle ON ======]                |
|                                           |
|  Email (optional)                         |
|  +--------------------------------------+ |
|  | parent@email.com                     | |
|  +--------------------------------------+ |
|  Without email, digest available as PDF.  |
|                                           |
|  Send on:                                 |
|  [Sun][*Mon*][Tue][Wed][Thu][Fri][Sat]    |
|                                           |
|  +--------------------------------------+ |
|  |  Preview Digest                      | |
|  +--------------------------------------+ |
|  +--------------------------------------+ |
|  |  Download PDF                        | |
|  +--------------------------------------+ |
|  +--------------------------------------+ |
|  |  Send Test Email                     | |
|  +--------------------------------------+ |
|                                           |
+------------------------------------------+
```

### B-PT2: Mobile Feed Preview

```
+------------------------------------------+
|  < Back       Child's Feed Preview        |
+------------------------------------------+
|  +--------------------------------------+ |
|  | Active restrictions:                 | |
|  | - Reels blocked                      | |
|  | - Max 30 min/day                     | |
|  | - Schedule: 8:00-20:00              | |
|  +--------------------------------------+ |
|                                           |
|  News (3)                                 |
|  +--------------------------------------+ |
|  | [img] Messi scores hat-trick...     | |
|  | football - 2h ago                   | |
|  +--------------------------------------+ |
|  +--------------------------------------+ |
|  | [img] Nadal returns to training...  | |
|  | tennis - 5h ago                     | |
|  +--------------------------------------+ |
|                                           |
|  Quiz: Available                          |
|                                           |
+------------------------------------------+
```

### B-PT3: Mobile Per-Type Sliders

```
+------------------------------------------+
|  Restrictions                             |
|                                           |
|  Daily time limit:                        |
|  [15][30][60][90][120][No limit]          |
|                                           |
|  ─────────────────────────────────────    |
|  Per content type:                        |
|                                           |
|  📰 News limit                           |
|  ○─────────────●──────── 30 min          |
|                                           |
|  🎬 Reels limit                          |
|  ○──────●──────────────── 15 min         |
|                                           |
|  🧠 Quiz limit                           |
|  ○─────────────────────● No limit        |
|                                           |
|  Tip: 0 = follows global limit            |
+------------------------------------------+
```

### Feature 11: MissionCard on Mobile HomeFeed

```
+------------------------------------------+
|  Latest News              🔥 5-day streak |
+------------------------------------------+
|  +--------------------------------------+ |
|  | 🎯 TODAY'S MISSION                  | |
|  |                                      | |
|  | Read 3 news articles                 | |
|  | Read 3 sports articles to earn a     | |
|  | reward!                              | |
|  |                                      | |
|  | [████████░░░░░░░░░░░░]  2 of 3      | |
|  |                           +20 pts    | |
|  +--------------------------------------+ |
|                                           |
|  +--------------------------------------+ |
|  | [img] Breaking: Champions League...  | |
|  | football · Real Madrid · 1h          | |
|  +--------------------------------------+ |
```

### Feature 11: Expired Mission State

```
+------------------------------------------+
|  +--------------------------------------+ |
|  | 😴                                   | |
|  | Tomorrow you'll have another chance!  | |
|  +--------------------------------------+ |
```

### Feature 12: Dark Mode Toggle in NavBar (Web)

```
+----------------------------------------------------------+
| 🏟️ SportyKids | News | Reels | Quiz | Collection | Team |
|                                            [🌙] [ES] [👤]|
+----------------------------------------------------------+

Toggle states:
  ☀️  = Light mode
  🌙  = Dark mode
  🔄  = System (auto)
```

### Feature 12: Dark Mode MissionCard (Web)

```
Dark background (#0F172A)
+------------------------------------------+
|  +--------------------------------------+ |
|  | bg: #1e3a5f (dark blue-950 equiv)    | |
|  | border: #1e40af (dark blue-800)      | |
|  | 🎯 TODAY'S MISSION                  | |
|  |                                      | |
|  | Read 3 news articles    (text: #F1F5F9) |
|  |                                      | |
|  | [████████░░░░]  2 of 3  (muted: #94A3B8)|
|  +--------------------------------------+ |
```

### Feature 12: Mobile Theme Toggle

```
+------------------------------------------+
|  Profile                                  |
|  ...                                      |
|  ─────────────────────────────────────    |
|  Theme                                    |
|  [*Auto*] [Dark] [Light]                  |
|  ─────────────────────────────────────    |
|  ...                                      |
+------------------------------------------+
```

---

## Acceptance Criteria

### Feature 10: Parental Trust

- [ ] Mobile ParentalControl screen has a "Digest" tab
- [ ] Mobile digest tab shows: enable toggle, email input, day picker, preview button, download button
- [ ] Toggling digest on/off saves to backend via `PUT /api/parents/digest/:userId`
- [ ] Changing email or day saves immediately
- [ ] Preview button shows digest data in a scrollable view
- [ ] Download button opens PDF in device browser
- [ ] Web digest tab has "Send test email" button
- [ ] Test email sends actual email via nodemailer when SMTP env vars are configured
- [ ] Test email button is rate-limited (1 per 5 minutes)
- [ ] Test email shows success/error toast
- [ ] Web digest tab shows "Saved" confirmation after preference changes
- [ ] Mobile ParentalControl content tab has "See what they see" button
- [ ] Tapping preview opens full-screen modal showing child's filtered feed
- [ ] Preview shows news items with existing NewsCard component
- [ ] Preview shows active restrictions banner at top
- [ ] Web FeedPreviewModal shows active restrictions banner
- [ ] Mobile restrictions tab shows 3 per-type sliders (news, reels, quiz)
- [ ] Each slider range: 0-120 min, step 5
- [ ] Slider at 0 shows "No specific limit" label
- [ ] Slider changes save immediately to backend
- [ ] LimitReached component shows content-type-specific message when per-type limit is hit
- [ ] All new UI text uses `t(key, locale)` with keys in both es.json and en.json

### Feature 11: Daily Missions

- [ ] Web MissionCard refreshes automatically after user logs activity (reads news, watches reel, plays quiz)
- [ ] Activity logging in `api.ts` dispatches `sportykids:activity-logged` custom event
- [ ] MissionCard listens for the event and re-fetches
- [ ] When no mission exists for today, expired message is shown: "Tomorrow you'll have another chance!"
- [ ] When mission transitions to completed, confetti animation plays (web)
- [ ] `celebrations.ts` has `celebrateMissionComplete()` function
- [ ] Mobile has `MissionCard` component with 3 visual states
- [ ] Mobile MissionCard appears as FlatList header in HomeFeed
- [ ] Mobile claim button triggers haptic feedback
- [ ] Mobile expired mission state shows gray card with message
- [ ] Push notification "Mission ready" sent after daily mission generation
- [ ] Push notification "Almost there" sent at 18:00 UTC for users with > 50% progress
- [ ] Mission reminder cron job exists at `apps/api/src/jobs/mission-reminder.ts`
- [ ] All new strings use i18n keys

### Feature 12: Dark Mode

**Web**:
- [ ] All hardcoded Tailwind color classes have `dark:` variants
- [ ] MissionCard renders correctly in dark mode (no white-on-white, no invisible text)
- [ ] NewsCard, ReelCard, QuizGame render correctly in dark mode
- [ ] ParentalPanel and all tabs render correctly in dark mode
- [ ] OnboardingWizard renders correctly in dark mode
- [ ] Collection page (stickers, achievements) renders correctly in dark mode
- [ ] NavBar theme toggle shows appropriate icon (sun/moon/auto)
- [ ] Theme persists across page reloads (localStorage)
- [ ] No flash of wrong theme on page load (inline script in layout.tsx already handles this)
- [ ] Skeleton loading animations visible in dark mode

**Mobile**:
- [ ] `theme.ts` exists with light/dark color palettes
- [ ] UserContext exposes `theme`, `setTheme`, `colors`
- [ ] All 10 screens use `colors` from context instead of hardcoded `COLORS`
- [ ] All components use `colors` from context
- [ ] Theme toggle in ParentalControl profile tab
- [ ] Three states: system > dark > light
- [ ] Theme persists in AsyncStorage
- [ ] StatusBar adapts to current theme
- [ ] Tab bar colors adapt to theme
- [ ] Navigation header colors adapt to theme

---

## Technical Requirements

### Dependencies

No new npm dependencies required for web. For mobile:
- Consider `@react-native-community/slider` for native slider — OR build a simple custom slider to avoid dependency
- All other dependencies are already installed

### API Changes

| Method | Route | Change |
|--------|-------|--------|
| POST | `/api/parents/digest/:userId/test` | **NEW** — Send test digest email |
| GET | `/api/missions/today/:userId` | **MODIFY** — Return `{ expired: true }` when yesterday's mission exists but no today's mission |

### Database Changes

None. All required fields already exist in the schema.

### Environment Variables

Already documented in CLAUDE.md:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — for digest email delivery (nodemailer)

### i18n Keys to Add

**Both es.json and en.json**:
```
digest.send_test          — "Send test email" / "Enviar email de prueba"
digest.test_sent          — "Test email sent!" / "Email de prueba enviado!"
digest.test_error         — "Could not send test email" / "No se pudo enviar el email de prueba"
digest.saved              — "Preferences saved" / "Preferencias guardadas"
preview.active_restrictions — "Active restrictions" / "Restricciones activas"
preview.no_restrictions   — "No restrictions active" / "Sin restricciones activas"
limit.news_reached_message  — "You've used your news time for today! Try reels or the quiz." / "Has usado tu tiempo de noticias hoy! Prueba los reels o el quiz."
limit.reels_reached_message — "You've watched enough reels for today! Try reading news or the quiz." / "Has visto suficientes reels hoy! Prueba leer noticias o ver reels."
limit.quiz_reached_message  — "You've played enough quizzes for today! Try reading news or watching reels." / "Has jugado suficientes quizzes hoy! Prueba leer noticias o ver reels."
mission.expired           — "Tomorrow you'll have another chance!" / "Manana tendras otra oportunidad!"
mission.no_mission        — "No mission today yet. Check back later!" / "Aun no hay mision. Vuelve mas tarde!"
notifications.mission_almost_title — "Almost there!" / "Casi lo tienes!"
notifications.mission_almost_body  — "You're {progress} of {target} on today's mission!" / "Llevas {progress} de {target} en la mision de hoy!"
theme.system              — "Auto" / "Auto"
theme.light               — "Light" / "Claro"
theme.dark                — "Dark" / "Oscuro"
```

---

## Implementation Decisions

### ID-1: Mission progress refresh via custom DOM event (not polling)

**Decision**: Use `window.dispatchEvent(new CustomEvent('sportykids:activity-logged'))` in the web API client after successful activity logging, with `MissionCard` listening via `addEventListener`.

**Rationale**: Polling wastes bandwidth and battery. The activity log call already happens — piggybacking a DOM event is zero-cost and gives instant UI updates. The alternative (React context/state lifting) would require threading mission state through multiple unrelated component trees.

### ID-2: Mobile slider — custom implementation over @react-native-community/slider

**Decision**: Use a simple custom slider built with `View` + `PanResponder` rather than adding `@react-native-community/slider` dependency.

**Rationale**: The project already has 0 community slider dependency. Adding one for 3 sliders is overkill. A simple 50-line custom slider with `PanResponder` is sufficient and avoids native linking complexity. If the custom slider proves too rough, the dependency can be added later.

### ID-3: Dark mode via CSS variables (web) — no component-level dark: variants where avoidable

**Decision**: Rely primarily on the existing CSS custom property system (`.dark` class toggles `--color-*` values). Only add `dark:` Tailwind variants for colors NOT covered by CSS vars (hardcoded Tailwind utility classes like `bg-blue-50`).

**Rationale**: The codebase already uses `var(--color-text)`, `var(--color-surface)`, etc. extensively. These automatically respond to the `.dark` class. Only the ~20-30 hardcoded Tailwind color classes need `dark:` counterparts. This minimizes the diff and avoids a full rewrite.

### ID-4: Mobile dark mode via React Context (not react-native-appearance)

**Decision**: Expose `colors` object from `UserContext` that all screens destructure. Use React Native's built-in `useColorScheme()` for system detection (no additional dependency).

**Rationale**: Passing a `colors` object through context is the simplest pattern. Every screen already imports `useUser()`. Adding `colors` to the context type is a one-line change per screen. The alternative (a separate ThemeContext or styled-components) adds unnecessary complexity.

### ID-5: Push notification timing — send at generation time, not per-timezone

**Decision**: Send "Mission ready" push notification immediately after mission generation at 05:00 UTC (roughly 07:00 CET for Spain). Do not attempt per-user timezone scheduling.

**Rationale**: Per-timezone push scheduling requires a queue system (Bull, Agenda, etc.) that doesn't exist in the current stack. 05:00 UTC is acceptable for the primary user base (Spain). For the "Almost there" reminder at 18:00 UTC, this is also within reasonable evening hours for the target timezone. True per-timezone support can be added in a future iteration with a job queue.

### ID-6: FeedPreviewModal on mobile — full-screen modal, not inline

**Decision**: Use React Navigation's modal presentation (or `<Modal>` from React Native) for the feed preview on mobile, rather than an inline expansion.

**Rationale**: The feed preview needs to show multiple news cards and potentially reels. An inline expansion within the parental control screen would be cramped and confusing. A full-screen modal gives the parent the actual "feel" of their child's experience.

---

## Testing Decisions

### TD-1: Test mission progress refresh (web)

- **Unit test**: `apps/api/src/services/mission-generator.test.ts` — Already has tests for `checkMissionProgress`. Add test case: verify that after logging `news_viewed` activity, the mission's progress is incremented.
- **Integration test**: New test `apps/web/src/components/__tests__/MissionCard.test.tsx` — Mock `fetchTodayMission`, simulate `sportykids:activity-logged` event, verify re-fetch is called.

### TD-2: Test digest email endpoint

- **Unit test**: `apps/api/src/routes/parents.test.ts` (or `parents-digest.test.ts`) — Test `POST /api/parents/digest/:userId/test`:
  - Returns 200 with `{ ok: true }` when SMTP is configured
  - Returns 400 when no email is set
  - Returns 429 when rate limited
  - Verify nodemailer `sendMail` is called with correct HTML

### TD-3: Test per-type limit messages

- **Unit test**: `apps/api/src/middleware/parental-guard.test.ts` — Already exists. Add test cases:
  - When `maxNewsMinutes` is set and exceeded, the guard returns 429 with `type: 'news_limit_reached'`
  - When `maxReelsMinutes` is set and exceeded, returns `type: 'reels_limit_reached'`
  - Verify the response includes the specific limit type

### TD-4: Test dark mode color resolution

- **Unit test**: New test `apps/mobile/src/lib/__tests__/theme.test.ts`:
  - `resolveColors('light', null)` returns lightColors
  - `resolveColors('dark', null)` returns darkColors
  - `resolveColors('system', 'dark')` returns darkColors
  - `resolveColors('system', 'light')` returns lightColors
  - `resolveColors('system', null)` returns lightColors (fallback)

### TD-5: Test mission reminder cron

- **Unit test**: `apps/api/src/jobs/mission-reminder.test.ts`:
  - Mock prisma to return users with > 50% progress missions
  - Verify `sendPushToUser` is called for qualifying users
  - Verify it is NOT called for completed missions or < 50% progress

### TD-6: Test LimitReached content-type variants

- **Unit test**: Verify that `LimitReached` component renders correct message for each `LimitType` variant. Can be a simple snapshot or assertion test.

### TD-7: Test expired mission API response

- **Unit test**: In `mission-generator.test.ts`, test that `GET /api/missions/today/:userId` returns `{ mission: null, expired: true }` when yesterday's mission exists but today's does not.

### Existing tests to maintain

All 25 existing test files (263 tests) must continue passing. Key files that may be affected by changes:
- `apps/api/src/services/mission-generator.test.ts`
- `apps/api/src/middleware/parental-guard.test.ts`
- `apps/api/src/services/digest-generator.test.ts`
- `apps/api/src/routes/parents-preview.test.ts`
- `apps/api/src/services/push-sender.test.ts`

---

## Out of Scope

- **OAuth authentication** (Google/Apple) — Endpoints return 501, remains planned
- **PostgreSQL migration** — SQLite remains the default for development
- **Per-user timezone push scheduling** — Would require a job queue; deferred
- **Animated theme transitions** — Simple class toggle is sufficient
- **Custom theme colors** — Only system light/dark; no user-customizable palettes
- **Digest email template customization** — Use existing HTML template from `renderDigestHtml()`
- **Mobile digest email input validation** — Basic format check only, no MX lookup
- **Web component library migration** — No introduction of shadcn/ui, Radix, etc.
- **Offline support for missions** — Missions require server state; offline display deferred

---

## Future Considerations

1. **Per-timezone push scheduling**: When a job queue (Bull, BullMQ, or Agenda) is added, migrate push notifications to respect each user's timezone for mission notifications.

2. **Digest email analytics**: Track open rates and click-through rates on digest emails to measure parent engagement.

3. **Mission streaks**: Multi-day mission chains where completing missions on consecutive days unlocks bonus rewards.

4. **Theme customization**: Allow kids to pick accent colors or themed skins (e.g., team colors as the primary color).

5. **Dark mode scheduling**: Auto-switch to dark mode during schedule lock hours (bedtime).

6. **Widget for missions**: iOS/Android widget showing today's mission progress without opening the app.

7. **Digest push notification**: Send push notification to parent when weekly digest is generated (in addition to email).
