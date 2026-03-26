# Product Owner Proposals — prd2.md Implementation Notes

## Requirements

Summary of all 9 items implemented:

| ID | Item | Status |
|----|------|--------|
| B-PT1 | Weekly Digest for Parents | Implemented — digest-generator service, PDF/email, cron job, preview/download endpoints |
| B-PT2 | "See What My Kid Sees" Mode | Implemented — FeedPreviewModal, /parents/preview/:userId endpoint |
| B-PT3 | Granular Time Limits | Implemented — maxNewsMinutes, maxReelsMinutes, maxQuizMinutes in ParentalProfile, parental-guard middleware |
| B-PT5 | Content Report Button | Implemented — ReportButton component, /api/reports endpoints, ContentReportList for parents |
| B-EN1 | Daily Missions | Implemented — mission-generator service, MissionCard component, /api/missions endpoints |
| B-UX4 | Dark Mode | Implemented — theme in UserContext, CSS dark tokens, system/light/dark toggle, flash prevention |
| B-TF3 | Authentication (JWT) | Implemented — JWT access/refresh tokens, email/password auth, Login/Register screens, auth middleware |
| B-MP1 | Mobile Feature Parity | Implemented — RssCatalog screen, StreakCounter, enhanced check-in with alerts |
| B-MP5 | Push Notifications | Implemented — PushToken model, expo-server-sdk, 5 triggers, mobile registration, deep linking |

## Design Decisions

- **B-TF3**: Simplified to JWT + email/password instead of full OAuth with 4 providers. OAuth requires real provider credentials and is not viable for MVP. Code is structured to add OAuth later (authProvider field).
- **B-MP5**: Push delivery requires real Expo push tokens (physical devices only). All server-side logic is complete and tested.
- **B-MP1**: RSS Catalog reuses existing `fetchSourceCatalog()` API. StreakCounter is a presentational component pulling from user context.

## New files created

### B-TF3 (Auth)
- `apps/api/src/services/auth-service.ts` — JWT generation/verification, password hashing, refresh token rotation
- `apps/api/src/routes/auth.ts` — /api/auth/* endpoints (register, login, refresh, logout, me, upgrade, link-child)
- `apps/api/src/middleware/auth.ts` — Non-blocking JWT middleware + requireAuth + requireRole
- `apps/mobile/src/lib/auth.ts` — Mobile auth client (register, login, refreshToken, authFetch)
- `apps/mobile/src/screens/Login.tsx` — Login screen with email/password + anonymous option
- `apps/mobile/src/screens/Register.tsx` — Registration screen with role selector
- `apps/web/src/lib/auth.ts` — Web auth client (register, login, refreshToken)

### B-MP1 (Mobile Parity)
- `apps/mobile/src/components/StreakCounter.tsx` — Streak display component
- `apps/mobile/src/screens/RssCatalog.tsx` — RSS source browser with sport sections and toggles

### B-MP5 (Push Notifications)
- `apps/api/src/services/push-sender.ts` — Expo push notification delivery with batching and receipt handling
- `apps/api/src/jobs/streak-reminder.ts` — Cron job at 20:00 UTC for streak-at-risk users
- `apps/mobile/src/lib/push-notifications.ts` — Expo notification registration and tap handling

## Key files modified
- `apps/api/prisma/schema.prisma` — PushToken model, RefreshToken model, User auth fields, locale
- `apps/api/src/index.ts` — Auth middleware global, auth routes, streak-reminder job
- `apps/api/src/routes/users.ts` — pushToken/platform in subscribe endpoint
- `apps/api/src/services/gamification.ts` — Push notification on sticker award
- `apps/api/src/jobs/sync-feeds.ts` — Push for team news
- `apps/api/src/jobs/generate-daily-quiz.ts` — Push after quiz generation
- `apps/api/src/jobs/generate-daily-missions.ts` — Push after mission generation
- `apps/mobile/src/lib/user-context.tsx` — StreakInfo, check-in alerts, push registration
- `apps/mobile/src/navigation/index.tsx` — RssCatalog, Login, Register screens, navigationRef
- `apps/mobile/src/App.tsx` — Notification tap handler setup
- `apps/mobile/src/screens/HomeFeed.tsx` — StreakCounter, settings gear icon
- `packages/shared/src/types/index.ts` — User auth fields, AuthResponse, LoginRequest, RegisterRequest
- `packages/shared/src/i18n/es.json` and `en.json` — auth.* and push.* keys

## Tests

- 11 test files, 91 tests total, all passing
- New: push-sender.test.ts (8 tests), auth-service.test.ts (10 tests)
- Existing tests unaffected (non-blocking auth middleware, push sender mocked)

## Database migrations
1. `20260326205411_add_push_tokens_and_locale` — PushToken model + User.locale field
2. `20260326210007_add_auth_fields` — User auth fields + RefreshToken model

## Dependencies added
- `expo-server-sdk` (apps/api) — Expo push notification delivery
- `jsonwebtoken` + `@types/jsonwebtoken` (apps/api) — JWT sign/verify
- `expo-notifications` + `expo-device` (apps/mobile) — Push registration
