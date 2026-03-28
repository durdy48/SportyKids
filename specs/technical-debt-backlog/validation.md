# Human Validation — prd.md

## Prerequisites

Start the test environment:

```bash
bash specs/technical-debt-backlog/create-environment.sh
```

## Validation Steps

### Feature 4: Structured Logging

1. **Action**: Start the API with `npm run dev:api`
   **Expected**: Logs appear in human-readable format with colors (pino-pretty). Each log line shows timestamp, level, service name.

2. **Action**: Make any API request (e.g., `curl http://localhost:3001/api/health`)
   **Expected**: Response includes `X-Request-ID` header.

3. **Action**: Make a request that triggers an error (e.g., `curl http://localhost:3001/api/news/nonexistent`)
   **Expected**: Error logs include `requestId` field.

### Feature 2: Linting

4. **Action**: Run `npx eslint . --max-warnings 0`
   **Expected**: Exits with 0 errors and 0 warnings.

5. **Action**: Run `npx prettier --check "**/*.{ts,tsx,json,md}"`
   **Expected**: Reports formatting status (may have diffs — format is not enforced yet, only check).

### Feature 3: Mobile Typecheck

6. **Action**: Run `cd apps/mobile && npx tsc --noEmit`
   **Expected**: Exits with 0 errors.

### Feature 5: Persistent Parental Sessions

7. **Action**: Start the API. Create a user and set up parental PIN. Verify the PIN to get a session token.
   **Expected**: Session token returned as UUID.

8. **Action**: Stop the API (Ctrl+C) and restart it.
   **Expected**: The same session token still works (verify by accessing a parental endpoint with X-Parental-Session header).

9. **Action**: Wait 5 minutes after creating a session, then try to use it.
   **Expected**: Session is expired (401 response).

### Feature 1: Testing

10. **Action**: Run `npm run test:all`
    **Expected**: All 418 tests pass (API 301 + Web 57 + Mobile 60).

11. **Action**: Run `npm run test:web`
    **Expected**: 12 test files, 57 tests pass.

12. **Action**: Run `npm run test:mobile`
    **Expected**: 10 test files, 60 tests pass.

### CI Pipeline

13. **Action**: Review `.github/workflows/ci.yml`
    **Expected**: Contains jobs: lint, test, test-web, test-mobile, build-api, build-web. Builds depend on all 4 validation jobs. Prisma cache uses actions/cache@v4.

---

## Appendix A: Re-validation after /t-review #1

### Review Fix: parental-session.test.ts

14. **Action**: Run `cd apps/api && npx vitest run src/services/parental-session.test.ts`
    **Expected**: 9 tests pass covering create, verify valid/expired/nonexistent, cleanup, revoke.

### Review Fix: sticker_earned PostHog event

15. **Action**: Search for `trackEvent('sticker_earned'` in `apps/api/src/services/gamification.ts`
    **Expected**: Call exists with `{ userId, stickerId, rarity }` properties.

### Review Fix: NavBar dead state removed

16. **Action**: Search for `savingLocale` in `apps/web/src/components/NavBar.tsx`
    **Expected**: No matches found — state fully removed.

### Review Fix: ESLint config renamed

17. **Action**: Verify `eslint.config.mjs` exists and `eslint.config.js` does not
    **Expected**: Only `.mjs` version exists. `npx eslint . --max-warnings 0` passes without Node module type warning.

### Review Fix: Express Request userId type

18. **Action**: Check `apps/api/src/middleware/request-id.ts` for `userId?: string` in Request interface
    **Expected**: `userId` is part of the Express Request augmentation.

### Regression Check

19. **Action**: Re-run all original validation steps (1-13)
    **Expected**: All original checks still pass. Total tests: 427 (API 310 + Web 57 + Mobile 60).

---

# Human Validation — prd2.md

## Prerequisites

Start the test environment (now includes PostgreSQL via Docker):

```bash
bash specs/technical-debt-backlog/create-environment.sh
```

## Validation Steps

### Feature 6: PostgreSQL Migration

20. **Action**: Verify PostgreSQL is running: `docker ps | grep sportykids-postgres`
    **Expected**: Container is "Up" and "healthy".

21. **Action**: Check the schema provider: `grep 'provider' apps/api/prisma/schema.prisma | head -2`
    **Expected**: `provider = "postgresql"` (not sqlite).

22. **Action**: Start API with `npm run dev:api` and hit `curl http://localhost:3001/api/health`
    **Expected**: Returns 200 OK.

23. **Action**: Check native array types: `curl http://localhost:3001/api/users/<userId>` (create a user first via POST /api/users if needed)
    **Expected**: `favoriteSports` and `selectedFeeds` are JSON arrays (not JSON-encoded strings like `"[\"football\"]"`).

24. **Action**: Search for `JSON.parse` in route/service files: `grep -r "JSON\.parse" apps/api/src/routes/ apps/api/src/services/ apps/api/src/middleware/ apps/api/src/utils/`
    **Expected**: No results for the migrated fields (favoriteSports, selectedFeeds, options, allowedSports, allowedFeeds, allowedFormats, pushPreferences, recentResults, nextMatch). Some JSON.parse may remain for other fields.

25. **Action**: Verify indexes in schema: `grep "@@index" apps/api/prisma/schema.prisma`
    **Expected**: At least 3 composite indexes: NewsItem(sport, safetyStatus, publishedAt), ActivityLog(userId, type, createdAt), Reel(sport, safetyStatus, publishedAt).

26. **Action**: Check trending endpoint: `curl http://localhost:3001/api/news/trending`
    **Expected**: Returns JSON array of trending news IDs (may be empty if no activity data). No errors.

### Feature 8: Error Handler

27. **Action**: Request a non-existent resource: `curl -s http://localhost:3001/api/users/nonexistent | jq`
    **Expected**: Response format is `{ "error": { "code": "NOT_FOUND", "message": "...", "requestId": "..." } }` (structured, not plain string).

28. **Action**: Send invalid data: `curl -s -X POST http://localhost:3001/api/users -H "Content-Type: application/json" -d '{}' | jq`
    **Expected**: Response has `"code": "VALIDATION_ERROR"` with field-level details.

29. **Action**: Check error class file exists: `ls apps/api/src/errors/index.ts`
    **Expected**: File exists with AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, RateLimitError exports.

30. **Action**: Check ERROR_CODES in shared: `grep "ERROR_CODES" packages/shared/src/constants/errors.ts`
    **Expected**: ERROR_CODES object exported with all error code constants.

31. **Action**: Check kid-friendly errors: `grep "auth_required\|too_fast\|forbidden" packages/shared/src/constants/errors.ts`
    **Expected**: Three new entries in KID_FRIENDLY_ERRORS mapping.

32. **Action**: Check i18n keys: `grep "auth_required\|too_fast\|forbidden" packages/shared/src/i18n/es.json packages/shared/src/i18n/en.json`
    **Expected**: Keys exist in both language files.

### Feature 9: Code Cleanup

33. **Action**: Verify deprecated functions removed: `grep -r "sportBoost\|recencyBoost" apps/api/src/`
    **Expected**: No matches (these functions have been deleted).

34. **Action**: Check React version alignment: `grep '"react"' apps/web/package.json apps/mobile/package.json`
    **Expected**: Both show `"^19.2.4"`.

35. **Action**: Verify skipLibCheck removed: `grep "skipLibCheck" apps/web/tsconfig.json`
    **Expected**: No matches.

36. **Action**: Run web typecheck: `cd apps/web && npx tsc --noEmit`
    **Expected**: 0 errors (without skipLibCheck).

37. **Action**: Check locale-aware push notifications in missions job: `grep "user.locale" apps/api/src/jobs/generate-daily-missions.ts`
    **Expected**: Uses `user.locale || 'es'` instead of hardcoded `'es'`.

38. **Action**: Check locale grouping in quiz job: `grep "byLocale\|user.locale" apps/api/src/jobs/generate-daily-quiz.ts`
    **Expected**: Groups users by locale for per-locale push batches.

39. **Action**: Check locale grouping in sync-feeds job: `grep "byLocale\|user.locale" apps/api/src/jobs/sync-feeds.ts`
    **Expected**: Groups users by locale for per-locale push batches.

40. **Action**: Review CI config: `grep "setup:" .github/workflows/ci.yml` and `grep "cache/save\|cache/restore" .github/workflows/ci.yml`
    **Expected**: Setup job exists. Uses cache/save in setup and cache/restore in downstream jobs.

41. **Action**: Count prisma generate in CI: `grep -c "prisma generate" .github/workflows/ci.yml`
    **Expected**: Exactly 1 (in the setup job only).

### All Tests

42. **Action**: Run all test suites: API (`cd apps/api && npx vitest run`), Web (`cd apps/web && npx vitest run`), Mobile (`cd apps/mobile && npx vitest run`)
    **Expected**: API: 379 tests (35 files), Web: 57 tests (12 files), Mobile: 60 tests (10 files). Total: 496 tests, all passing.

43. **Action**: Run linting: `npx eslint . --max-warnings 0`
    **Expected**: 0 errors, 0 warnings.

---

## Appendix B: Re-validation after /t-review #2

### Review Fix: Error handler details for non-5xx errors

44. **Action**: `curl -s http://localhost:3001/api/news?sport=football` with an expired parental session header, or check `apps/api/src/middleware/error-handler.ts` for the details inclusion logic.
    **Expected**: Non-5xx errors (400, 401, 403, 404, 409, 429) always include `details` in the response body, even in production mode.

45. **Action**: Search for `parseParentalBlockError` in `apps/web/src/lib/api.ts`
    **Expected**: A shared helper function extracts 403 parental block info from `body.error.details` (not `body.allowedHoursStart` at top level). Used in fetchNews, fetchReels, fetchQuestions.

### Review Fix: VideoPlayer hooks violation

46. **Action**: Check `apps/mobile/src/components/VideoPlayer.tsx` for conditional hook calls
    **Expected**: `useVideoPlayer` is called unconditionally. The `require('expo-video')` is at module scope with a try/catch fallback. No `?.useVideoPlayer?.(` pattern.

### Review Fix: gamification.ts and teams.ts typed errors

47. **Action**: `grep -n "res.status(4" apps/api/src/routes/gamification.ts apps/api/src/routes/teams.ts`
    **Expected**: No matches — all error responses use thrown typed error classes (NotFoundError, ValidationError).

### Review Fix: Unused _changingPin state

48. **Action**: `grep "changingPin" apps/mobile/src/screens/ParentalControl.tsx`
    **Expected**: No matches — dead state removed.

### Review Fix: Typed formatProfile

49. **Action**: `grep "formatProfile" apps/api/src/routes/parents.ts`
    **Expected**: Function uses `ParentalProfile` type from Prisma (not `Record<string, unknown>`).

### Regression Check

50. **Action**: Re-run all original validation steps (1-43) and Appendix A (14-19)
    **Expected**: All checks still pass. Total tests: 496 (API 379 + Web 57 + Mobile 60).

---

# Human Validation — prd3.md

## Prerequisites

Start the test environment:

```bash
bash specs/technical-debt-backlog/create-environment.sh
```

## Validation Steps

### Feature 10: Parental Trust — Digest UI

51. **Action**: Start API (`npm run dev:api`) and web (`npm run dev:web`). Navigate to Parents section, Digest tab.
    **Expected**: Digest tab shows: enable toggle, email input, day picker, preview button, download button, and a "Send test email" button.

52. **Action**: Toggle digest on, enter an email, select a day, then observe the UI.
    **Expected**: A brief "Preferences saved" toast appears after each change.

53. **Action**: Click "Send test email" button.
    **Expected**: Button shows loading state. If SMTP is configured, success toast appears. If not configured, error toast appears. Button is disabled for 5 minutes after success.

54. **Action**: Start mobile app (`npm run dev:mobile`). Navigate to Parental Control. Verify tabs.
    **Expected**: Tabs include: Profile, Content, Restrictions, Activity, PIN, and **Digest**. Digest tab shows enable toggle, email input, day picker, preview and download buttons.

55. **Action**: On mobile digest tab, tap "Download PDF".
    **Expected**: Opens PDF in device browser via Linking.openURL().

### Feature 10: Parental Trust — Feed Preview

56. **Action**: On web ParentalPanel, click "See what they see" / "Preview" button.
    **Expected**: FeedPreviewModal opens showing child's filtered feed. An **active restrictions banner** at the top shows blocked formats, blocked sports, time limit status, and schedule lock status.

57. **Action**: On mobile ParentalControl content tab, tap "See what they see" button.
    **Expected**: Full-screen modal opens showing news items (using NewsCard), reel thumbnails, quiz availability, and an active restrictions info banner.

### Feature 10: Parental Trust — Per-Type Time Limits

58. **Action**: On mobile ParentalControl restrictions tab, scroll below global time limit presets.
    **Expected**: A "Per content type" section with 3 sliders: News limit, Reels limit, Quiz limit. Each slider range: 0-120 min, step 5.

59. **Action**: Move a slider to 30 minutes.
    **Expected**: Label updates to show "30 min". Value saves immediately to backend.

60. **Action**: Move a slider to 0.
    **Expected**: Label shows "No specific limit" or equivalent. Value saved as null (follows global limit).

### Feature 10: LimitReached Enhancement

61. **Action**: Check `apps/web/src/components/LimitReached.tsx` for per-type variants.
    **Expected**: Component handles `news_limit_reached`, `reels_limit_reached`, `quiz_limit_reached` with content-type-specific messages suggesting alternative content types.

62. **Action**: Check `apps/mobile/src/components/LimitReached.tsx` exists.
    **Expected**: Mobile LimitReached component with all 7 limit types (limit_reached, format_blocked, sport_blocked, schedule_locked, news_limit_reached, reels_limit_reached, quiz_limit_reached).

### Feature 11: Daily Missions — Real-time Refresh

63. **Action**: On web, open HomeFeed. Verify MissionCard is visible with a mission.
    **Expected**: MissionCard shows today's mission with progress bar and target.

64. **Action**: Read a news article (or perform any tracked activity).
    **Expected**: MissionCard **automatically refreshes** without page reload. Progress updates if the activity matches the mission type.

65. **Action**: Check `apps/web/src/lib/api.ts` for event dispatch.
    **Expected**: `recordActivity()` function dispatches `window.dispatchEvent(new CustomEvent('sportykids:activity-logged'))` after successful activity logging.

### Feature 11: Daily Missions — Expired State

66. **Action**: Check `GET /api/missions/today/:userId` when no mission exists for today but one existed yesterday.
    **Expected**: Response returns `{ mission: null, expired: true }`.

67. **Action**: On web, when mission is expired.
    **Expected**: MissionCard shows "Tomorrow you'll have another chance!" message in a soft style.

### Feature 11: Daily Missions — Confetti

68. **Action**: On web, complete a mission (reach 100% progress) and observe.
    **Expected**: Confetti animation plays when mission transitions to completed state.

69. **Action**: Check `apps/web/src/lib/celebrations.ts`.
    **Expected**: `celebrateMissionComplete()` function exists with gold/blue confetti configuration.

### Feature 11: Daily Missions — Mobile MissionCard

70. **Action**: On mobile HomeFeed, check for MissionCard.
    **Expected**: MissionCard appears as FlatList header above news items. Shows mission title, description, progress bar, and reward info.

71. **Action**: On mobile, complete and claim a mission.
    **Expected**: Claim button triggers haptic feedback (`Haptics.notificationAsync`). Card transitions to claimed (green) state.

72. **Action**: On mobile, when mission is expired.
    **Expected**: Gray card with expired message is shown.

### Feature 11: Daily Missions — Push & Reminder

73. **Action**: Check `apps/api/src/jobs/mission-reminder.ts` exists.
    **Expected**: Cron job scheduled at 18:00 UTC. Queries users with active missions where progress/target > 0.5. Sends "Almost there!" push notification.

74. **Action**: Check `apps/api/src/index.ts` for mission-reminder registration.
    **Expected**: `startMissionReminder()` is called alongside other cron jobs.

75. **Action**: Check i18n keys for mission notifications: `grep "mission_almost" packages/shared/src/i18n/en.json packages/shared/src/i18n/es.json`
    **Expected**: Keys exist in both languages.

### Feature 12: Dark Mode — Web

76. **Action**: On web, click the theme toggle in NavBar.
    **Expected**: Toggle cycles through system → dark → light. Shows appropriate icon: 🔄 (auto), 🌙 (dark), ☀️ (light).

77. **Action**: In dark mode, check MissionCard.
    **Expected**: Uses dark background (blue-950 equivalent), appropriate text contrast, no white-on-white or invisible text.

78. **Action**: In dark mode, check ParentalPanel, QuizGame, OnboardingWizard, HomeFeed.
    **Expected**: All components render with appropriate dark backgrounds, visible text, and proper contrast.

79. **Action**: Reload page in dark mode.
    **Expected**: No flash of light theme (inline script in layout.tsx prevents this). Theme persists.

### Feature 12: Dark Mode — Mobile

80. **Action**: Check `apps/mobile/src/lib/theme.ts` exists.
    **Expected**: Exports `lightColors`, `darkColors`, `resolveColors()`, `resolveTheme()`, `ThemeMode`, `ThemeColors`.

81. **Action**: On mobile ParentalControl profile tab, find theme toggle.
    **Expected**: Three-state toggle: System, Dark, Light. Current mode is highlighted.

82. **Action**: Switch to dark mode on mobile.
    **Expected**: All screens use dark backgrounds (#0F172A), light text (#F1F5F9), dark surface colors (#1E293B). StatusBar switches to light content.

83. **Action**: Check that no `COLORS.darkText` or `COLORS.lightBackground` hardcoded values remain in mobile screens.
    **Expected**: All 20 mobile files use `colors.text`, `colors.background`, `colors.surface` from UserContext.

84. **Action**: Check tab bar in dark mode.
    **Expected**: Tab bar uses dark surface color with appropriate active/inactive tint colors.

### All Tests

85. **Action**: Run all test suites: `npm run test:all`
    **Expected**: API: 388 tests (38 files), Web: 69 tests (14 files), Mobile: 69 tests (11 files). Total: 526 tests, all passing.

86. **Action**: Run linting: `npm run lint`
    **Expected**: 0 errors, 0 warnings.

### i18n Keys

87. **Action**: `grep -c "digest.send_test\|digest.test_sent\|digest.test_error\|digest.saved\|preview.active_restrictions\|preview.no_restrictions\|limit.news_reached\|limit.reels_reached\|limit.quiz_reached\|mission.expired\|mission.no_mission\|mission_almost_title\|mission_almost_body\|theme.system\|theme.light\|theme.dark" packages/shared/src/i18n/en.json`
    **Expected**: At least 15 matches (all new i18n keys present in English).

88. **Action**: Same grep on `es.json`
    **Expected**: Same count — all keys present in Spanish.

---

## Appendix C: Re-validation after /t-review #3

### Review Fix C1: Per-type time limit sliders on mobile

89. **Action**: Check `apps/mobile/src/screens/ParentalControl.tsx` restrictions tab for per-type sliders
    **Expected**: Three step-selector grids visible for News, Reels, and Quiz limits (0-120 min). Each grid has buttons for common values (0, 5, 15, 30, 60, 90, 120). Tapping a button saves immediately.

### Review Fix W1: Test email cooldown via CacheProvider

90. **Action**: `grep -n "testEmailCooldowns" apps/api/src/routes/parents.ts`
    **Expected**: No matches — in-memory Map removed. Cooldown uses `apiCache.set/get` with CacheProvider.

91. **Action**: `grep -n "apiCache\|test-email-cooldown" apps/api/src/routes/parents.ts`
    **Expected**: CacheProvider-based cooldown with key `test-email-cooldown:${userId}`.

### Review Fix W2: Expired field in missions API

92. **Action**: `curl -s http://localhost:3001/api/missions/today/nonexistent-user | jq .expired`
    **Expected**: Returns `false` (no yesterday mission for nonexistent user).

93. **Action**: Check `apps/api/src/routes/missions.ts` for expired logic
    **Expected**: Endpoint returns `{ mission, expired: false }` on success. On P2025, checks yesterday's mission to set `expired: true/false`.

### Review Fix W3: Hardcoded colors removed from mobile

94. **Action**: `grep -rn "#F3F4F6\|#4B5563\|#EFF6FF\|#DCFCE7\|#FEF9C3\|#F3E8FF" apps/mobile/src/screens/ apps/mobile/src/components/ apps/mobile/src/navigation/`
    **Expected**: No matches (or very few remaining for semantic reasons with comments).

### Review Fix W4: OnboardingWizard dark mode

95. **Action**: `grep -c "dark:" apps/web/src/components/OnboardingWizard.tsx`
    **Expected**: At least 10 occurrences of `dark:` variants.

### Review Fix W5: Reels tab header theme-aware

96. **Action**: `grep "backgroundColor.*#000" apps/mobile/src/navigation/index.tsx`
    **Expected**: No matches — uses `colors.background` instead.

### Review Fix W7: Test email typed error

97. **Action**: `grep "res.status(500)" apps/api/src/routes/parents.ts`
    **Expected**: No raw 500 responses in test email handler — errors thrown and handled by centralized error handler.

### Review Fix S3: Static imports in mission-reminder

98. **Action**: `grep "await import" apps/api/src/jobs/mission-reminder.ts`
    **Expected**: No dynamic imports — all imports are static at module top.

### Review Fix S5: Test email success boolean state

99. **Action**: `grep "testEmailSuccess" apps/web/src/components/ParentalPanel.tsx`
    **Expected**: Boolean state exists for tracking success/failure, replacing string matching.

### Review Fix S7-S8: Additional test cases

100. **Action**: Run `npm run test:all`
     **Expected**: API: 393+ tests, Web: 69 tests, Mobile: 69 tests. Total: 531+ tests, all passing.

### Regression Check

101. **Action**: Re-run all original validation steps (1-88) and Appendix A-B (14-50)
     **Expected**: All checks still pass. No regressions from review fixes.

---

# Human Validation — prd4.md

## Prerequisites

Start the test environment:

```bash
bash specs/technical-debt-backlog/create-environment.sh
```

## Validation Steps

### Feature 7: OAuth Social Login

102. **Action**: Set `GOOGLE_CLIENT_ID=test` env var and start the API. `curl http://localhost:3001/api/auth/providers`
     **Expected**: Response `{ "google": true, "apple": false }`

103. **Action**: Without Google env vars: `curl http://localhost:3001/api/auth/providers`
     **Expected**: Response `{ "google": false, "apple": false }`

104. **Action**: Without `GOOGLE_CLIENT_ID`: `curl http://localhost:3001/api/auth/google`
     **Expected**: 404 error "Google OAuth not configured"

105. **Action**: Without `APPLE_CLIENT_ID`: `curl http://localhost:3001/api/auth/apple`
     **Expected**: 404 error "Apple Sign In not configured"

106. **Action**: `curl -X POST http://localhost:3001/api/auth/google/token -H "Content-Type: application/json" -d '{"idToken":"invalid"}'` with `GOOGLE_CLIENT_ID` set
     **Expected**: 401 error "Invalid Google ID token"

107. **Action**: `curl -X POST http://localhost:3001/api/auth/apple/token -H "Content-Type: application/json" -d '{"idToken":"not-a-jwt"}'` with `APPLE_CLIENT_ID` set
     **Expected**: 401 error "Invalid Apple identity token"

108. **Action**: Open web app → Onboarding step 1.
     **Expected**: Social login buttons (Google/Apple) visible when providers are enabled. Separator "or continue with" shown.

109. **Action**: Open mobile Login screen.
     **Expected**: Social login buttons below email/password form.

110. **Action**: Check Prisma schema for `socialId` field.
     **Expected**: `socialId String?` and `@@index([authProvider, socialId])` present.

111. **Action**: Navigate to `http://localhost:3000/auth/callback?token=test&refresh=test`
     **Expected**: OAuth callback page exists. Stores tokens and redirects to home.

### Feature 13.1: B-UX7 Kid-Friendly Error Messages

112. **Action**: Check `packages/shared/src/constants/errors.ts` for new error types.
     **Expected**: `rate_limited`, `format_blocked`, `limit_reached`, `unauthorized` in KID_FRIENDLY_ERRORS.

113. **Action**: Verify `getErrorType(429)` returns `'rate_limited'` and `getErrorType(401)` returns `'unauthorized'`.
     **Expected**: Correct mappings.

114. **Action**: Check i18n for kid error keys in both es.json and en.json.
     **Expected**: `kid_errors.rate_limited_title`, `kid_errors.unauthorized_title`, etc. present.

### Feature 13.2: B-UX8 Haptic Feedback

115. **Action**: On physical iOS device, answer quiz correctly.
     **Expected**: Success haptic triggers.

116. **Action**: Answer quiz incorrectly.
     **Expected**: Error haptic triggers.

117. **Action**: Switch navigation tabs.
     **Expected**: Selection haptic on each switch.

118. **Action**: Tap sticker in Collection.
     **Expected**: Light haptic.

### Feature 13.3: B-MP3 Pull-to-Refresh

119. **Action**: Pull down on mobile HomeFeed.
     **Expected**: BrandedRefreshControl appears with SportyKids colors.

120. **Action**: Pull-to-refresh on Reels, Collection, Quiz screens.
     **Expected**: Refresh works on all four screens.

121. **Action**: Check refresh title uses i18n (not hardcoded "Refreshing...").
     **Expected**: Localized text shown.

### Feature 13.4: B-PT4 Schedule Lock UI

122. **Action**: Web → Parental panel → Restrictions tab.
     **Expected**: "Schedule Lock" section with toggle (default: off).

123. **Action**: Enable toggle, set start=7, end=21, Europe/Madrid. Save.
     **Expected**: API receives `allowedHoursStart: 7, allowedHoursEnd: 21, timezone: "Europe/Madrid"`.

124. **Action**: Same on mobile ParentalControl.
     **Expected**: Schedule lock section works.

### Feature 13.5: B-PT6 Parental Tour

125. **Action**: Set up PIN for first time on web.
     **Expected**: Tour appears (3 steps).

126. **Action**: Reload after completing tour.
     **Expected**: Tour does NOT reappear.

127. **Action**: Same on mobile.
     **Expected**: Tour renders after first PIN creation on mobile too.

### Feature 13.6: B-CP4 Related Articles

128. **Action**: Expand a news article on web.
     **Expected**: "You Might Also Like" section shows up to 3 related articles.

129. **Action**: Section hidden if no related articles.
     **Expected**: No empty section shown.

130. **Action**: Same on mobile.
     **Expected**: Related articles appear below expanded content.

### Feature 13.7: B-EN4 Reading History

131. **Action**: Read articles, then check home page (web).
     **Expected**: "Recently Read" section visible.

132. **Action**: New user with no history.
     **Expected**: Section not shown.

133. **Action**: Same on mobile HomeFeed.
     **Expected**: Reading history section visible with horizontal scroll.

### Feature 13.8: B-CP5 Content Language Filtering

134. **Action**: User with locale='es' loads news on web.
     **Expected**: Network request includes `locale=es`.

135. **Action**: User with locale='en' loads news.
     **Expected**: Network request includes `locale=en`.

136. **Action**: Check non-matching sources still appear.
     **Expected**: Present but ranked lower.

### Feature 13.9: B-MP6 Reel Player Audit

137. **Action**: Check `docs/en/06-service-overview.md` for "Video Player Strategy".
     **Expected**: Section documents video types, player strategies, performance notes.

138. **Action**: Check `docs/es/06-service-overview.md` for equivalent.
     **Expected**: Spanish documentation present.

### All Tests

139. **Action**: `npm run test:all`
     **Expected**: API 423 tests (39 files), Web 69 tests (14 files), Mobile 69 tests (11 files). Total: 561 tests, all passing.

140. **Action**: `npm run lint`
     **Expected**: 0 errors, 0 warnings.

---

## Appendix D: Re-validation after /t-review #4

### Review Fix C1: Google OAuth state validation

141. **Action**: `grep -n "oauth:state" apps/api/src/routes/auth.ts`
     **Expected**: State stored in apiCache on GET /google and validated on GET /google/callback. Cache key: `oauth:state:<state>`.

142. **Action**: `grep -n "apiCache" apps/api/src/routes/auth.ts`
     **Expected**: apiCache imported and used for state storage/validation.

### Review Fix C2: Apple JWKS verification

143. **Action**: `grep -n "verifyAppleToken\|jwks-rsa\|jsonwebtoken" apps/api/src/routes/auth.ts`
     **Expected**: `verifyAppleToken` function used in both /apple/callback and /apple/token. Uses jwks-rsa and jsonwebtoken for proper JWT verification.

144. **Action**: `grep -n "appleid.apple.com/auth/keys" apps/api/src/routes/auth.ts`
     **Expected**: JWKS endpoint URL present for Apple public key fetching.

### Review Fix C3: Apple nonce verification

145. **Action**: `grep -n "nonceHash\|nonce" apps/api/src/routes/auth.ts`
     **Expected**: Nonce hashed with SHA-256, stored in cache, and verified on callback.

### Review Fix C4: OAuth tokens cleaned from URL

146. **Action**: `grep -n "replaceState" apps/web/src/app/auth/callback/page.tsx`
     **Expected**: `window.history.replaceState` called after reading tokens.

### Review Fix W1: passport-apple removed

147. **Action**: `grep "passport-apple" apps/api/package.json`
     **Expected**: No matches — dependency removed.

### Review Fix W2: Quiz console.error guarded

148. **Action**: `grep -n "console.error" apps/mobile/src/screens/Quiz.tsx`
     **Expected**: All instances use `__DEV__ && console.error(...)` with eslint-disable comment.

### Review Fix W3: Mobile social login shows alert

149. **Action**: `grep -n "Alert.alert\|expo-auth-session" apps/mobile/src/screens/Login.tsx`
     **Expected**: Alert shown on social button press explaining OAuth needs configuration. TODO comment about expo-auth-session.

### Review Fix W4: urlencoded scoped to Apple callback

150. **Action**: `grep -n "urlencoded" apps/api/src/routes/auth.ts`
     **Expected**: NOT used as `router.use()`. Applied inline only on POST /apple/callback route.

### Review Fix W5: OAuth callback error handling

151. **Action**: `grep -n "res.ok" apps/web/src/app/auth/callback/page.tsx`
     **Expected**: `if (!res.ok)` check before res.json() call.

### Review Fix W6: findOrCreateSocialUser typed

152. **Action**: `grep -n "Record<string, unknown>" apps/api/src/services/auth-service.ts`
     **Expected**: No matches — return type uses Prisma User type.

### Review Fix W7: Login/Register theme colors

153. **Action**: `grep -n "#FFFFFF\|#E5E7EB\|#9CA3AF" apps/mobile/src/screens/Login.tsx apps/mobile/src/screens/Register.tsx`
     **Expected**: No matches or very few — replaced with colors.surface, colors.border, colors.muted.

### Review Fix W8: Apple scope documented

154. **Action**: `grep -n "Apple Developer Console\|Services ID" apps/api/src/routes/auth.ts`
     **Expected**: Comment documenting Apple scope prerequisite.

### Review Fix S5: languageBoost simplified

155. **Action**: `grep -n "null | undefined" apps/api/src/services/feed-ranker.ts`
     **Expected**: No matches for languageBoost — accepts string only.

### Review Fix S6: getErrorType false positive fix

156. **Action**: `grep -n "msg.includes.*404\|msg.includes.*429" packages/shared/src/constants/errors.ts`
     **Expected**: No generic includes for status codes — uses more specific matching.

### Review Fix S7: Suspense in callback page

157. **Action**: `grep -n "Suspense" apps/web/src/app/auth/callback/page.tsx`
     **Expected**: Suspense boundary wrapping the component that uses useSearchParams.

### Regression Check

158. **Action**: `npm run test:all`
     **Expected**: API 424+ tests, Web 69 tests, Mobile 69 tests. All passing.

159. **Action**: `npm run lint`
     **Expected**: 0 errors, 0 warnings.
