# Roadmap and technical decisions

## Project status

```mermaid
gantt
    title SportyKids Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %d %b

    section Phase 0
    Definition and wireframes       :done, f0, 2026-03-01, 7d

    section Phase 1
    Home Feed + RSS Aggregator      :done, f1, 2026-03-22, 1d

    section Phase 2
    Onboarding + Favorite team      :done, f2, after f1, 1d

    section Phase 3
    Reels + Interactive quiz        :done, f3, after f2, 1d

    section Phase 4
    Parental control + Activity     :done, f4, after f3, 1d

    section Phase 5 Differentiators
    M1 AI + Content Safety          :done, m1, after f4, 1d
    M2 Age-Adapted Content          :done, m2, after m1, 1d
    M3 Dynamic Quiz                 :done, m3, after m2, 1d
    M4 Gamification                 :done, m4, after m3, 1d
    M5 Robust Parental Controls     :done, m5, after m4, 1d
    M6 Smart Feed + Team + Reels    :done, m6, after m5, 1d

    section Next
    Internal test + Closed beta     :active, f6, after m6, 14d
```

## Phase 5 Differentiators -- Milestones

### M1: AI Infrastructure + Content Safety
- Multi-provider AI client (`ai-client.ts`) supporting Ollama (free, default), OpenRouter, and Anthropic Claude
- Content moderator (`content-moderator.ts`) classifies news as safe/unsafe with fail-open policy
- Expanded from 4 to 47 RSS sources across 8 sports
- Custom RSS sources via API (`POST/DELETE /api/news/fuentes/custom`)
- `safetyStatus` field on NewsItem (`pending`/`approved`/`rejected`)
- Health check for AI provider availability

### M2: Age-Adapted Content
- Summarizer service (`summarizer.ts`) generates summaries for 3 age profiles (6-8, 9-11, 12-14)
- NewsSummary model (unique per newsItemId + ageRange + locale)
- `GET /api/news/:id/resumen?age=&locale=` endpoint
- "Explain it Easy" button on NewsCard + AgeAdaptedSummary component

### M3: Dynamic Quiz
- Quiz generator (`quiz-generator.ts`) creates AI-generated questions from news
- Daily quiz job (cron 06:00 UTC) with round-robin by sport
- QuizQuestion extended: `generatedAt`, `ageRange`, `expiresAt`, `isDaily`
- `POST /api/quiz/generate` manual trigger
- Age-based difficulty filtering; seed questions (15) as permanent fallback

### M4: Gamification
- 4 new models: Sticker (36), UserSticker, Achievement (20), UserAchievement
- Gamification service: streaks, sticker awards, achievement evaluation
- Points: +5 news, +3 reels, +10 quiz correct, +50 perfect (5/5), +2 daily login
- 6 endpoints under `/api/gamification/`
- Collection page with sport filters, sticker grid, achievements
- Daily check-in on app start

### M5: Robust Parental Controls
- Parental guard middleware on news/reels/quiz routes (format, sport, time enforcement server-side)
- bcrypt PIN hashing (transparent SHA-256 migration on verification)
- Session tokens (5-min TTL) for authenticated parental access
- 5-step onboarding (step 5: PIN + formats + time limit)
- Activity tracking with duration (`durationSeconds`, `contentId`, `sport`) via `sendBeacon`
- ParentalPanel with 5 tabs (Profile, Content, Restrictions, Activity, PIN)

### M6: Smart Feed + Team + Reels
- Feed ranker (score: +5 team, +3 sport, filter unfollowed sources)
- 3 feed modes: Headlines, Cards, Explain
- TeamStats model (15 teams seeded) + `GET /api/teams/:name/stats`
- Team page with stats card (W/D/L, position, top scorer, next match)
- Reels: grid layout with YouTube thumbnails, like/share actions
- Notification preferences (MVP: stored but not sent)
- Reel model extended: `videoType`, `aspectRatio`, `previewGifUrl`

### Mobile App: Full Parity
- 27 API functions in mobile client
- Daily check-in flow
- Collection screen with sticker grid and achievements
- 5-step onboarding matching web
- All M1-M6 features accessible from mobile

## Technical decisions made

### 1. SQLite instead of PostgreSQL for development
**Context**: The MVP needs to start quickly without infrastructure.
**Decision**: Use SQLite via Prisma during development.
**Consequence**: No Docker or external database needed. Migration to PostgreSQL is trivial (change provider in schema.prisma).

### 2. Express instead of Fastify
**Context**: An HTTP server is needed for the REST API.
**Decision**: Express 5 for its ecosystem and familiarity.
**Trade-off**: Fastify would be faster in benchmarks, but Express has better documentation and more available middleware.

### 3. Next.js for the webapp
**Context**: The webapp needs to be fast and SEO-friendly.
**Decision**: Next.js 16 with App Router.
**Advantage**: SSR available when needed, same React ecosystem as the mobile app.

### 4. Expo for the mobile app
**Context**: We need to compile for iOS and Android.
**Decision**: React Native with Expo (managed workflow, SDK 54).
**Advantage**: Shares logic with the webapp (hooks, types, API client).

### 5. Monorepo with npm workspaces
**Context**: Three projects that share types and constants.
**Decision**: Native npm workspaces (without Turborepo/Nx).
**Trade-off**: Fewer features than Turborepo, but no additional dependency.

### 6. No real authentication in MVP
**Context**: The MVP prioritizes development speed.
**Decision**: User is identified by ID, without login/password/JWT.
**Consequence**: Anyone with the ID can access the profile. Acceptable for a closed beta with 5-10 families.

### 7. RSS feeds as content source
**Context**: We need real sports news.
**Decision**: Consume public RSS feeds from verified sports press (47 sources across 8 sports).
**Risk**: RSS URLs may change without notice. Some feeds are intermittent.

### 8. English identifiers with i18n support
**Context**: The codebase initially used Spanish identifiers, limiting contributions from non-Spanish-speaking developers and complicating internationalization.
**Decision**: Refactor all code identifiers to English. Add an i18n system for user-facing strings.
**Implementation**: `packages/shared/src/i18n/` with locale files and `t(key, locale)` function.

### 9. Ollama as default AI provider (M1)
**Context**: AI features need to work during development without API costs.
**Decision**: Default to Ollama (free, local) with cloud providers (OpenRouter, Anthropic) as alternatives.
**Trade-off**: Local inference is slower and lower quality than cloud, but free and private.

### 10. Fail-open content moderation (M1)
**Context**: Content moderation should not block the entire app if AI is down.
**Decision**: If the AI provider is unavailable, content defaults to `approved`.
**Risk**: Some inappropriate content may slip through if AI is down. Mitigated by only ingesting from verified sports press sources.

### 11. bcrypt with transparent SHA-256 migration (M5)
**Context**: MVP used SHA-256 for PIN hashing; bcrypt is more secure.
**Decision**: New PINs use bcrypt. On verification, if a legacy SHA-256 hash is detected and the PIN is correct, it is transparently re-hashed with bcrypt.
**Advantage**: Zero-downtime migration, no data migration script needed.

### 13. JWT authentication with non-blocking middleware (B-TF3)
**Context**: The MVP had no real authentication; users were identified by ID only.
**Decision**: Implement JWT access tokens (15-min TTL) + refresh tokens (7 days, rotated). Auth middleware is non-blocking to maintain backward compatibility with anonymous users.
**Advantage**: Secures user accounts while keeping the anonymous onboarding flow intact. Refresh token rotation prevents token reuse attacks.

### 14. Expo push notifications with expo-server-sdk (B-MP5)
**Context**: Notification preferences were stored but never delivered.
**Decision**: Use `expo-server-sdk` to deliver push notifications to Expo-managed mobile apps. Five trigger types cover the main engagement use cases.
**Trade-off**: Only works with Expo-managed apps (not bare React Native). Acceptable for the current Expo SDK 54 setup.

### 12. Server-side parental enforcement (M5)
**Context**: MVP enforced parental restrictions only on the frontend (hiding tabs).
**Decision**: Add parental guard middleware that enforces restrictions at the API level.
**Advantage**: Cannot be bypassed by direct API calls or modified frontends.

## Product Owner Proposals — Sprint 1-2 (completed)

| ID | Item | Status |
|----|------|--------|
| B-TF2 | Fix critical code review issues | Done — 7 critical fixes, 8 warning fixes |
| B-MP2 | Centralize API_BASE in mobile | Done — `apps/mobile/src/config.ts` with 3 environments |
| B-UX1 | Skeleton loading | Done — 5 web + 3 mobile skeleton components |
| B-CP1 | Search functionality | Done — `?q=` param on API, SearchBar web + mobile |
| B-TF1 | Test infrastructure | Done — Vitest + 4 test files + 36 tests |
| B-UX2 | Celebration animations | Done — canvas-confetti, 4 celebration types |
| B-UX3 | Page transitions | Done — CSS fade-in/slide-up on 6 pages |
| B-UX5 | Empty states | Done — EmptyState with 6 SVG illustrations |
| B-UX6 | PIN visual feedback | Done — pin-pop and pin-shake CSS animations |
| B-EN2 | Favorites/bookmarks | Done — localStorage/AsyncStorage, heart on NewsCard |
| B-EN3 | Trending badge | Done — API endpoint, trending pill on NewsCard |

Key new files:
- `apps/api/src/utils/safe-json-parse.ts` — Generic safe JSON parser with fallback
- `apps/api/src/utils/url-validator.ts` — SSRF prevention, validates public URLs
- `apps/web/src/components/SearchBar.tsx` — Debounced search with suggestions
- `apps/web/src/components/EmptyState.tsx` — 6 SVG illustrations with CTAs
- `apps/web/src/lib/celebrations.ts` — Confetti functions
- `apps/web/src/lib/favorites.ts` — localStorage favorites
- `apps/mobile/src/config.ts` — Centralized API config

## Product Owner Proposals — Sprint 3-4 (completed)

| ID | Item | Status |
|----|------|--------|
| B-PT3 | Granular per-type time limits | Done — independent sliders for news/reels/quiz, `maxNewsMinutes`, `maxReelsMinutes`, `maxQuizMinutes` fields on ParentalProfile |
| B-PT2 | Feed preview for parents | Done — `GET /api/parents/preview/:userId`, `FeedPreviewModal` in parental panel |
| B-PT5 | Content reports | Done — `ContentReport` model, 3 endpoints (`POST /api/reports`, `GET /api/reports/parent/:userId`, `PUT /api/reports/:reportId`), `ReportButton` and `ContentReportList` components |

Key new files:
- `apps/api/src/routes/reports.ts` — Content report routes
- `apps/web/src/components/ReportButton.tsx` — Report dropdown on NewsCard/ReelCard
- `apps/web/src/components/ContentReportList.tsx` — Report list in parental panel
- `apps/web/src/components/FeedPreviewModal.tsx` — Feed preview modal for parents

## Product Owner Proposals — Sprint 5-6 (completed)

| ID | Item | Status |
|----|------|--------|
| B-PT1 | Weekly Digest (weekly summary for parents) | Done — digest fields on ParentalProfile, 4 endpoints (`PUT/GET /api/parents/digest/:userId`, preview JSON, download PDF), `digest-generator.ts` service, `send-weekly-digests.ts` cron job (08:00 UTC daily), jspdf + nodemailer |
| B-EN1 | Daily Missions | Done — `DailyMission` model, 2 endpoints (`GET /api/missions/today/:userId`, `POST /api/missions/claim`), `mission-generator.ts` service, `generate-daily-missions.ts` cron job (05:00 UTC), automatic progress via `checkMissionProgress()` |
| B-UX4 | Dark Mode | Done — `.dark` CSS variables, 3 modes (system/light/dark), NavBar toggle, anti-flash script in layout, localStorage persistence, `UserContext` exposes `theme`/`setTheme`/`resolvedTheme` |

Key new files:
- `apps/api/src/services/digest-generator.ts` — Digest generator (data, HTML, PDF)
- `apps/api/src/services/mission-generator.ts` — Daily mission generator and evaluator
- `apps/api/src/routes/missions.ts` — Daily mission routes
- `apps/api/src/jobs/send-weekly-digests.ts` — Weekly digest cron job
- `apps/api/src/jobs/generate-daily-missions.ts` — Daily mission cron job
- `apps/web/src/components/MissionCard.tsx` — Daily mission card (3 states)

## Product Owner Proposals — Sprint 7-8 (completed)

| ID | Item | Status |
|----|------|--------|
| B-TF3 | Authentication (JWT + Email/Password) | Done — `/api/auth/` routes (register, login, refresh, logout, me, upgrade, link-child), JWT access tokens (15min) + refresh tokens (7 days, rotated), bcrypt password hashing, non-blocking auth middleware, new Prisma models (`RefreshToken`, User fields: `email`, `passwordHash`, `authProvider`, `role`, `parentUserId`), mobile Login/Register screens, web auth lib |
| B-MP1 | Mobile Feature Parity (RSS Catalog + Check-in) | Done — `RssCatalog` mobile screen (browse/toggle RSS sources by sport), `StreakCounter` component on HomeFeed header, enhanced check-in (Alert on sticker/achievement, loads streak on init), gear icon on HomeFeed navigates to RssCatalog |
| B-MP5 | Push Notifications (Complete) | Done — `PushToken` Prisma model, `expo-server-sdk` for Expo push delivery, 5 push triggers (quiz ready, team news, streak reminder at 20:00 UTC, sticker earned, mission ready), mobile push registration via `expo-notifications`, deep linking on notification tap, streak reminder cron job, `User.locale` field for per-user localization |

Key new files:
- `apps/api/src/routes/auth.ts` — Authentication routes (register, login, refresh, logout, me, upgrade, link-child)
- `apps/api/src/middleware/auth.ts` — Non-blocking JWT authentication middleware
- `apps/api/src/services/push-notifications.ts` — Push notification service (expo-server-sdk)
- `apps/api/src/jobs/streak-reminder.ts` — Streak reminder cron job (20:00 UTC)
- `apps/web/src/lib/auth.ts` — Web authentication library (token management)
- `apps/mobile/src/screens/Login.tsx` — Mobile login screen
- `apps/mobile/src/screens/Register.tsx` — Mobile register screen
- `apps/mobile/src/screens/RssCatalog.tsx` — Mobile RSS source catalog screen
- `apps/mobile/src/components/StreakCounter.tsx` — Streak counter component for HomeFeed header

## Known technical debt

| Item | Priority | Status | Description |
|------|----------|--------|-------------|
| ~~Authentication~~ | ~~High~~ | Done (Sprint 7-8) | ~~Implement JWT or real sessions~~ — JWT + email/password auth with refresh tokens |
| ~~Tests~~ | ~~High~~ | Started (Sprint 1-2) | ~~No unit or integration tests~~ — Vitest + 36 tests |
| ~~PIN hash~~ | ~~Medium~~ | Done (M5) | ~~Change SHA-256 to bcrypt~~ |
| ~~Server-side validation~~ | ~~Medium~~ | Done (M5) | ~~Parental restrictions enforced only on frontend~~ |
| News images | Low | Pending | Many news items lack images (limited RSS feeds) |
| Reels with real videos | Low | Pending | Reels are placeholders (YouTube embeds) |
| ~~Internationalization~~ | ~~Low~~ | Done | ~~i18n system implemented~~ |
| ~~Gamification~~ | ~~Medium~~ | Done (M4) | ~~Trading cards, badges, streaks~~ |
| ~~Auto-generated quizzes~~ | ~~Medium~~ | Done (M3) | ~~Quizzes generated from news~~ |
| ~~Content moderation~~ | ~~High~~ | Done (M1) | ~~AI safety classification~~ |
| ~~API_BASE mobile~~ | ~~Low~~ | Done (Sprint 1-2) | ~~Hardcoded IPs in each screen~~ — centralized in config.ts |
| ~~Critical code review fixes~~ | ~~High~~ | Done (Sprint 1-2) | ~~SSRF, ownership, session auth~~ |
| PIN lockout | Medium | Pending | No lockout after failed PIN attempts |
| Rate limiting | Medium | Pending | No API rate limiting |
| ~~Push notifications~~ | ~~Low~~ | Done (Sprint 7-8) | ~~Preferences stored but notifications not sent~~ — 5 push triggers via expo-server-sdk |
| API route consistency | Low | Pending | Mix of Spanish and English route paths |

## Next steps (post-Phase 5)

### Short term (1-2 weeks)
- [ ] Internal test with 5-10 families
- [ ] Fix reported bugs
- [x] Automated tests — Vitest infrastructure + 36 initial tests (Sprint 1-2)
- [ ] Expand test coverage (integration tests, API routes)
- [ ] Implement PIN lockout after 5 failed attempts
- [ ] Add rate limiting to API endpoints

### Medium term (1-2 months)
- [x] Real authentication with JWT — B-TF3 (Sprint 7-8)
- [x] Implement push notifications — B-MP5 (Sprint 7-8)
- [ ] Analytics dashboard for the team
- [ ] Add more locales (fr, de, pt)
- [ ] Human review queue for AI-moderated content
- [ ] CI/CD pipeline

### Long term (3-6 months)
- [ ] Integration with sports APIs (live results, real-time team stats)
- [ ] Reels with real videos (scraping or APIs)
- [ ] Premium version with advanced features
- [ ] Expansion to more languages/countries
- [ ] Migrate to PostgreSQL for production
- [ ] COPPA/GDPR full compliance
