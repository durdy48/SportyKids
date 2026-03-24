# SportyKids ⚽🏀🎾

Personalized sports news app for kids (6-14) with AI content moderation, age-adapted summaries, gamification, and robust parental controls.

## What is SportyKids?

SportyKids aggregates real sports news from 47+ trusted sources across 8 sports, moderates content with AI for child safety, adapts it to the child's age, and presents it in a kid-friendly interface. Parents control what their children see, and kids earn stickers and achievements for engagement.

### Features

**Content & Feed**
- **Smart News Feed** — 47+ RSS sources, personalized by preferences, 3 display modes (Headlines, Cards, Explain)
- **AI Content Moderation** — Every article classified as safe/unsafe before reaching kids (M1)
- **"Explain it Easy"** — AI-generated summaries adapted to 3 age profiles: 6-8, 9-11, 12-14 (M2)
- **Reels** — Sports video grid with YouTube thumbnails, like/share (M6)
- **Custom RSS Sources** — Add your own feeds via URL with RSS validation

**Quiz & Gamification**
- **Dynamic Quiz** — AI-generated daily questions from real news + 15 seed questions in Spanish (M3)
- **Sticker Collection** — 36 digital stickers across 4 rarities: common, rare, epic, legendary (M4)
- **Daily Streaks** — Login streaks with milestone rewards (3/7/14/30 days) (M4)
- **20 Achievements** — Unlockable badges for reading, watching, quizzing, and collecting (M4)
- **Points System** — +5 news, +3 reels, +10 quiz, +50 perfect quiz, +2 daily login

**Team & Personalization**
- **Team Hub** — Stats (league position, W/D/L results, top scorer, next match) for 15 teams (M6)
- **Feed Ranking** — Content scored by favorite team (+5) and sport (+3) preferences (M6)
- **5-Step Onboarding** — Name/age, sports, team, RSS sources, parental PIN setup

**Parental Controls**
- **Backend Enforcement** — Server-side format/sport/time restrictions via middleware (M5)
- **bcrypt PIN** — Secure 4-digit PIN with transparent SHA-256 migration (M5)
- **Activity Tracking** — Duration tracking with sendBeacon, detailed reports with charts (M5)
- **5-Tab Panel** — Profile, Content, Restrictions, Activity (CSS charts), PIN management

**Platform**
- **Web App** — Next.js 16 with all features
- **Mobile App** — React Native + Expo with full feature parity (27 API functions)
- **i18n** — Spanish and English support throughout

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Monorepo | npm workspaces | packages/shared, apps/api, apps/web, apps/mobile |
| API | Express 5 + TypeScript | Prisma 6, SQLite, Zod 4 |
| AI | Multi-provider | Ollama (free, default), OpenRouter, Anthropic Claude |
| Webapp | Next.js 16 | Tailwind CSS 4, App Router |
| Mobile | React Native 0.81 | Expo SDK 54, React Navigation 7 |
| Shared | @sportykids/shared | Types, constants, utils, i18n (es/en) |
| RSS | rss-parser + node-cron | 47+ sources, 30-min sync cycle |

## Quick Start

```bash
# Prerequisites: Node.js >= 20

# Install dependencies
npm install

# Set up the database
cd apps/api
cp .env.example .env  # Configure AI provider (default: Ollama, free)
npx prisma migrate dev
npx tsx prisma/seed.ts  # Seeds: 47 RSS sources, 15 quiz questions, 36 stickers, 20 achievements, 15 team stats
cd ../..

# Start development
npm run dev:api    # API at http://localhost:3001
PORT=3000 npm run dev:web    # Webapp at http://localhost:3000

# Optional: AI moderation (install Ollama for free local AI)
brew install ollama && ollama pull llama3.2:3b && ollama serve
```

## Project Structure

```
sportykids/
├── packages/shared/         # @sportykids/shared — types, constants, utils, i18n
├── apps/
│   ├── api/                 # Express REST API
│   │   ├── prisma/          # Schema (12 models), migrations (6), seed
│   │   ├── src/routes/      # news, reels, quiz, users, parents, gamification, teams
│   │   ├── src/services/    # ai-client, content-moderator, summarizer, quiz-generator,
│   │   │                    # gamification, feed-ranker, team-stats, aggregator, classifier
│   │   ├── src/middleware/  # parental-guard, error-handler
│   │   └── src/jobs/        # sync-feeds (30min), generate-daily-quiz (06:00 UTC)
│   ├── web/                 # Next.js webapp (8 pages, 25+ components)
│   └── mobile/              # React Native + Expo (7 screens, 6 tabs)
└── docs/
    ├── es/                  # Documentation in Spanish (11 docs)
    └── en/                  # Documentation in English (11 docs)
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/news?sport=&userId=&age=` | Smart feed with personalized ranking |
| GET | `/api/news/:id/resumen?age=&locale=` | AI summary adapted by age |
| GET | `/api/news/fuentes/catalogo` | Full RSS source catalog (47+) |
| POST | `/api/news/fuentes/custom` | Add custom RSS source (with validation) |
| GET | `/api/reels` | Video reels feed |
| GET | `/api/quiz/questions?age=&count=` | Quiz (daily AI + seed fallback) |
| POST | `/api/quiz/generate` | Trigger daily quiz generation |
| POST | `/api/quiz/answer` | Submit answer, earn points |
| GET | `/api/gamification/stickers` | Sticker catalog (36) |
| GET | `/api/gamification/achievements` | Achievement definitions (20) |
| POST | `/api/gamification/check-in` | Daily check-in (streak + sticker) |
| GET | `/api/teams/:name/stats` | Team stats (15 teams) |
| POST | `/api/parents/configurar` | Set parental PIN (bcrypt) |
| GET | `/api/parents/actividad/:id/detalle` | Detailed activity breakdown |

See [full API reference](docs/en/03-api-reference.md) for all 30+ endpoints.

## Documentation

Comprehensive documentation available in two languages:

- [English docs](docs/en/README.md) — Architecture, API reference, deployment guide, and more
- [Documentacion en espanol](docs/es/README.md) — Arquitectura, referencia API, guia de despliegue, y mas

## Project Status

| Phase | Status | Focus |
|-------|--------|-------|
| 0-4 | ✅ Done | MVP: Feed, Onboarding, Reels, Quiz, Parental Controls |
| 5 - M1 | ✅ Done | AI Infrastructure + Content Safety (47 sources, moderation) |
| 5 - M2 | ✅ Done | Age-Adapted Content ("Explain it Easy") |
| 5 - M3 | ✅ Done | Dynamic Quiz from Real News (AI daily generation) |
| 5 - M4 | ✅ Done | Gamification (36 stickers, 20 achievements, streaks) |
| 5 - M5 | ✅ Done | Robust Parental Controls (backend enforcement, bcrypt) |
| 5 - M6 | ✅ Done | Smart Feed + Team Hub + Improved Reels |
| Mobile | ✅ Done | Full feature parity with web app |
| Next | 🔲 | Video aggregator (YouTube RSS), user locale config, scraping fallback |

## Backlog & Upcoming Features

### High Priority

| Feature | Description | Spec |
|---------|-------------|------|
| **Video Aggregator (YouTube RSS)** | Automatic daily video ingestion from YouTube channels via RSS. Same pattern as news aggregator — cron job, moderation, configurable sources. Replaces static seed reels with fresh content. | [backlog-video-aggregator.md](specs/phase-5-differentiators/backlog-video-aggregator.md) |
| **User Locale/Country Config** | Add language and country selection to onboarding. Content filtered by user's language, quiz/summaries generated in preferred language. | [backlog-user-locale.md](specs/phase-5-differentiators/backlog-user-locale.md) |
| **Scraping Fallback for Sources without RSS** | Cheerio scraper or Google News RSS workaround for sites that don't have RSS feeds (Estadio Deportivo, ElDesmarque, Mucho Deporte, El Correo). | [backlog-scraping.md](specs/phase-5-differentiators/backlog-scraping.md) |

### Medium Priority

| Feature | Description | Spec |
|---------|-------------|------|
| **Multi-Source Reels** | Support Instagram Reels, TikTok embeds, and native MP4 in addition to YouTube. Platform detection in ReelCard component. | [backlog-multi-source-reels.md](specs/phase-5-differentiators/backlog-multi-source-reels.md) |
| **Redundant Filters Cleanup** | After onboarding, the home page should not re-ask sport/age selection. Simplify filters for logged-in users to only show followed sports. | Noted in prd6.md |
| **Real Sticker Artwork** | Replace placeholder sticker images (`/stickers/*.png`) with designed artwork for all 36 stickers. | — |
| **Push Notifications (Real)** | Wire actual push delivery (FCM for mobile, service worker for web) using the notification preferences already stored in DB. | — |

### Lower Priority / Future

| Feature | Description |
|---------|-------------|
| **Live Team Stats API** | Replace seed TeamStats with live data from a sports API (football-data.org, NBA API, etc.) |
| **Sticker Trading** | Social feature: share/trade stickers with friends (with parental approval) |
| **Quiz Leaderboards** | Weekly rankings among friends or class groups |
| **Sports Education** | Mini-courses explaining rules of each sport |
| **School Integration** | Dashboard for PE teachers |
| **PostgreSQL Migration** | Move from SQLite to PostgreSQL for production |
| **JWT Authentication** | Replace ID-based user identification with proper auth |
| **Automated Tests** | Unit and integration test suites for API and frontend |
| **Weekly Parent Report** | AI-generated weekly summary sent to parents ("Your child explored football and basketball this week...") |

### Known Technical Debt

- Pre-existing TypeScript build errors in API (Express query param types)
- Feed ranker loads all items into memory before pagination (OK for current scale)
- Session tokens in-memory only (lost on API restart)
- YouTube autoplay may be blocked by browsers without user interaction
- Reels are YouTube embeds only (no native video support yet)

## License

Private — All rights reserved.
