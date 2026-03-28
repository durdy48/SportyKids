# SportyKids ⚽🏀🎾

Personalized sports news app for kids (6-14) with AI content moderation, age-adapted summaries, gamification, and robust parental controls.

## What is SportyKids?

SportyKids aggregates real sports news from 182+ trusted sources across 8 sports, moderates content with AI for child safety, adapts it to the child's age, and presents it in a kid-friendly interface. Parents control what their children see, and kids earn stickers and achievements for engagement.

### Features

**Content & Feed**
- **Smart News Feed** — 182+ RSS sources, personalized by preferences, 3 display modes (Headlines, Cards, Explain)
- **AI Content Moderation** — Every article classified as safe/unsafe before reaching kids (M1)
- **"Explain it Easy"** — AI-generated summaries adapted to 3 age profiles: 6-8, 9-11, 12-14 (M2)
- **Reels** — Sports video grid with YouTube thumbnails, like/share (M6)
- **Custom RSS Sources** — Add your own feeds via URL with RSS validation
- **Reading History** — Recently read articles section on home
- **Related Articles** — "You might also like" recommendations

**Quiz & Gamification**
- **Dynamic Quiz** — AI-generated daily questions from real news + 15 seed questions in Spanish (M3)
- **Sticker Collection** — 36 digital stickers across 4 rarities: common, rare, epic, legendary (M4)
- **Daily Streaks** — Login streaks with milestone rewards (3/7/14/30 days) (M4)
- **20 Achievements** — Unlockable badges for reading, watching, quizzing, and collecting (M4)
- **Points System** — +5 news, +3 reels, +10 quiz, +50 perfect quiz, +2 daily login
- **Daily Missions** — Daily challenges with progress tracking and rewards

**Team & Personalization**
- **Team Hub** — Stats (league position, W/D/L results, top scorer, next match) for 15 teams (M6)
- **Feed Ranking** — Content scored by favorite team (+5) and sport (+3) preferences (M6)
- **5-Step Onboarding** — Name/age, sports, team, RSS sources, parental PIN setup

**Parental Controls**
- **Backend Enforcement** — Server-side format/sport/time restrictions via middleware (M5)
- **bcrypt PIN** — Secure 4-digit PIN with transparent SHA-256 migration (M5)
- **Activity Tracking** — Duration tracking with sendBeacon, detailed reports, digest emails, schedule lock (bedtime hours) (M5)
- **Schedule Lock** — Configurable allowed hours with timezone support
- **Weekly Digest** — PDF/email reports for parents
- **5-Tab Panel** — Profile, Content, Restrictions, Activity (CSS charts), PIN management

**Platform**
- **Web App** — Next.js 16 with all features
- **Mobile App** — React Native + Expo with full feature parity (27 API functions)
- **Dark Mode** — System/light/dark theme on web and mobile
- **i18n** — Spanish and English support throughout

**Authentication**
- **JWT Auth** — Access/refresh token auth with email/password
- **OAuth Social Login** — Google and Apple Sign In (Passport.js)

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Monorepo | npm workspaces | packages/shared, apps/api, apps/web, apps/mobile |
| API | Express 5 + TypeScript | Prisma 6, PostgreSQL 16, Zod 4 |
| Auth | JWT + Passport.js | Email/password + Google/Apple OAuth |
| AI | Multi-provider | Ollama (free, default), OpenRouter, Anthropic Claude |
| Webapp | Next.js 16 | Tailwind CSS 4, App Router |
| Mobile | React Native 0.81 | Expo SDK 54, React Navigation 7 |
| Shared | @sportykids/shared | Types, constants, utils, i18n (es/en) |
| RSS | rss-parser + node-cron | 182+ sources, 30-min sync cycle |
| Logging | Pino 9 | Structured JSON logging |
| Testing | Vitest | 562 tests across 64 files |

## Quick Start

```bash
# Prerequisites: Node.js >= 20, Docker (for PostgreSQL)

# Install dependencies
npm install

# Start PostgreSQL
docker-compose -f apps/api/docker-compose.yml up -d postgres

# Set up the database
cd apps/api
cp .env.example .env
npx prisma migrate dev
npx tsx prisma/seed.ts
cd ../..

# Start development
npm run dev:api    # API at http://localhost:3001
npm run dev:web    # Webapp at http://localhost:3000
```

## Project Structure

```
sportykids/
├── packages/shared/         # @sportykids/shared — types, constants, utils, i18n
├── apps/
│   ├── api/                 # Express REST API
│   │   ├── prisma/          # Schema (20+ models), migrations, seed
│   │   ├── src/routes/      # news, reels, quiz, users, parents, gamification, teams, auth, missions, reports
│   │   ├── src/services/    # ai-client, content-moderator, summarizer, quiz-generator,
│   │   │                    # gamification, feed-ranker, team-stats, aggregator, classifier,
│   │   │                    # passport, auth-service, logger, parental-session, push-sender,
│   │   │                    # digest-generator, mission-generator, video-aggregator
│   │   ├── src/middleware/  # auth, parental-guard, error-handler, rate-limiter, request-id
│   │   ├── src/errors/      # AppError, ValidationError, AuthenticationError, NotFoundError, etc.
│   │   └── src/jobs/        # sync-feeds (30min), sync-videos (6h), generate-daily-quiz (06:00),
│   │                        # generate-daily-missions (05:00), send-weekly-digests (08:00),
│   │                        # streak-reminder (20:00), sync-team-stats (04:00), mission-reminder (18:00)
│   ├── web/                 # Next.js webapp (8 pages, 25+ components)
│   └── mobile/              # React Native + Expo (10 screens, 6 tabs)
└── docs/
    ├── es/                  # Documentation in Spanish
    └── en/                  # Documentation in English
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/news?sport=&userId=&age=` | Smart feed with personalized ranking |
| GET | `/api/news/:id/summary?age=&locale=` | AI summary adapted by age |
| GET | `/api/news/sources/catalog` | Full RSS source catalog (182+) |
| POST | `/api/news/sources/custom` | Add custom RSS source (with validation) |
| GET | `/api/news/history?userId=` | Reading history (paginated) |
| GET | `/api/news/:id/related` | Related articles by team/sport |
| GET | `/api/reels` | Video reels feed |
| GET | `/api/reels/sources/catalog` | Video source catalog |
| GET | `/api/quiz/questions?age=&count=` | Quiz (daily AI + seed fallback) |
| POST | `/api/quiz/answer` | Submit answer, earn points |
| GET | `/api/gamification/stickers` | Sticker catalog (36) |
| GET | `/api/gamification/achievements` | Achievement definitions (20) |
| POST | `/api/gamification/check-in` | Daily check-in (streak + sticker) |
| GET | `/api/missions/today/:userId` | Daily mission with progress |
| GET | `/api/teams/:name/stats` | Team stats (15 teams) |
| POST | `/api/parents/setup` | Set parental PIN (bcrypt) |
| GET | `/api/parents/profile/:userId` | Parental profile and restrictions |
| GET | `/api/parents/activity/:userId` | Weekly activity summary |
| PUT | `/api/parents/digest/:userId` | Configure weekly digest preferences |
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/providers` | Available auth providers |
| GET | `/api/auth/google` | Google OAuth 2.0 |
| GET | `/api/auth/apple` | Apple Sign In |
| POST | `/api/reports` | Submit content report |

See [full API reference](docs/en/03-api-reference.md) for all 40+ endpoints.

## Documentation

Comprehensive documentation available in two languages:

- [English docs](docs/en/README.md) — Architecture, API reference, deployment guide, and more
- [Documentacion en espanol](docs/es/README.md) — Arquitectura, referencia API, guia de despliegue, y mas

## Project Status

| Phase | Status | Focus |
|-------|--------|-------|
| 0-4 | ✅ Done | MVP: Feed, Onboarding, Reels, Quiz, Parental Controls |
| 5 | ✅ Done | Differentiators: AI, Quiz, Gamification, Parental, Smart Feed |
| Tech Debt | ✅ Done | PostgreSQL, OAuth, structured logging, error handling, testing |
| Next | 🔲 | Beta testing with families |

## Backlog & Upcoming Features

### Medium Priority

| Feature | Description |
|---------|-------------|
| **Scraping Fallback** | Cheerio scraper or Google News RSS workaround for sites without RSS feeds |
| **Redundant Filters Cleanup** | Simplify home filters for logged-in users to only show followed sports |
| **Real Sticker Artwork** | Replace placeholder sticker images with designed artwork for all 36 stickers |
| **Push Notifications (Real)** | Wire actual push delivery (FCM for mobile, service worker for web) |

### Lower Priority / Future

| Feature | Description |
|---------|-------------|
| **Sticker Trading** | Social feature: share/trade stickers with friends (with parental approval) |
| **Quiz Leaderboards** | Weekly rankings among friends or class groups |
| **Sports Education** | Mini-courses explaining rules of each sport |
| **School Integration** | Dashboard for PE teachers |

### Known Technical Debt

- Feed ranker loads all items into memory before pagination (OK for current scale)
- YouTube autoplay may be blocked by browsers without user interaction
- Mobile OAuth requires expo-auth-session for native flows (currently shows alert)
- Google/Apple OAuth requires real credentials for end-to-end testing

## License

Private — All rights reserved.
