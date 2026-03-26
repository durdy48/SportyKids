# Development Guide

## Prerequisites

- Node.js >= 20
- npm >= 10
- Git
- (Optional) Ollama -- for local AI features (content moderation, summaries, quiz generation)

Docker and PostgreSQL are not needed for local development (SQLite is used).

## Installation

```bash
git clone <repo-url>
cd sportykids
npm install
```

If npm points to a private registry, create an `.npmrc` in the root:
```
registry=https://registry.npmjs.org/
```

## Configuration

Create the environment file for the API:

```bash
# apps/api/.env
DATABASE_URL="file:./dev.db"
PORT=3001
NODE_ENV=development

# JWT Authentication
JWT_SECRET=your-secret-key-here          # Required for auth endpoints
JWT_REFRESH_SECRET=your-refresh-secret   # Required for refresh tokens

# AI Provider (optional -- defaults to ollama)
AI_PROVIDER=ollama              # ollama | openrouter | anthropic
# OPENROUTER_API_KEY=sk-...    # required if AI_PROVIDER=openrouter
# ANTHROPIC_API_KEY=sk-...     # required if AI_PROVIDER=anthropic
```

## Database

```bash
# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Load sample data (RSS sources, reels, quiz questions, stickers, achievements, team stats)
cd apps/api && npx tsx prisma/seed.ts
```

## Start in Development

You need two terminals:

```bash
# Terminal 1: API
npm run dev:api

# Terminal 2: Webapp
npm run dev:web
```

- API: http://localhost:3001
- Webapp: http://localhost:3000

For the mobile app (requires Expo CLI):
```bash
npm run dev:mobile
```

The API URL configuration for mobile is centralized in `apps/mobile/src/config.ts` with 3 environments (dev, preview, production). Do not hardcode URLs in individual screen files.

### Optional: Start Ollama for AI features

```bash
# Install Ollama from https://ollama.ai
ollama serve
# Pull a model (e.g., llama3.2)
ollama pull llama3.2
```

Without Ollama, AI features (content moderation, summaries, quiz generation) degrade gracefully -- the app works but uses fallback behavior (fail-open moderation, no summaries, seed quiz questions only).

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Start API with hot reload (tsx watch) |
| `npm run dev:web` | Start Next.js webapp in development mode |
| `npm run dev:mobile` | Start Expo for the mobile app |
| `npm run build:api` | Compile the API to JavaScript |
| `npm run build:web` | Generate production build of the webapp |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run lint` | Run ESLint across the entire monorepo |
| `npm run test` | Run all tests in the monorepo |
| `npm run test:api` | Run API tests (Vitest) |

## Structure of a New API Route

1. Create a file in `apps/api/src/routes/` (e.g., `my-feature.ts`)
2. Define validation schemas with Zod
3. Implement handlers with Express typing
4. Export the router as default
5. Import and mount in `apps/api/src/index.ts`

### Key API files

| File | Purpose |
|------|---------|
| `src/routes/news.ts` | Article endpoints (`/api/news`) |
| `src/routes/users.ts` | User endpoints (`/api/users`) |
| `src/routes/parents.ts` | Parental control endpoints (`/api/parents`) |
| `src/routes/quiz.ts` | Quiz endpoints (`/api/quiz`) |
| `src/routes/reels.ts` | Reels endpoints (`/api/reels`) |
| `src/routes/gamification.ts` | Gamification endpoints (`/api/gamification`) |
| `src/routes/teams.ts` | Team stats endpoints (`/api/teams`) |
| `src/routes/auth.ts` | Authentication endpoints (`/api/auth`) |
| `src/services/aggregator.ts` | RSS feed consumption |
| `src/services/classifier.ts` | Content classification by sport/team/age |
| `src/services/ai-client.ts` | Multi-provider AI client (Ollama/OpenRouter/Claude) |
| `src/services/content-moderator.ts` | AI content safety classification |
| `src/services/summarizer.ts` | Age-adapted article summaries |
| `src/services/quiz-generator.ts` | AI quiz question generation |
| `src/services/gamification.ts` | Points, stickers, achievements, streaks |
| `src/services/feed-ranker.ts` | Personalized feed scoring and ordering |
| `src/services/team-stats.ts` | Team statistics management |
| `src/middleware/parental-guard.ts` | Server-side parental restriction enforcement |
| `src/middleware/auth.ts` | JWT authentication middleware (non-blocking) |
| `src/services/push-notifications.ts` | Push notification delivery via expo-server-sdk |
| `src/jobs/sync-feeds.ts` | Cron job for periodic RSS sync (every 30 min) |
| `src/jobs/generate-daily-quiz.ts` | Cron job for daily quiz generation (06:00 UTC) |
| `src/jobs/streak-reminder.ts` | Cron job for streak reminder push notifications (20:00 UTC) |

## Structure of a New Web Page

1. Create a folder in `apps/web/src/app/<name>/`
2. Create `page.tsx` (can be Server or Client Component)
3. Use `useUser()` to access the user context (from `user-context`)
4. Import shared components from `@/components/` (e.g., `NewsCard`, `FiltersBar`)
5. Use functions from `@/lib/api.ts` for backend calls

### Key webapp routes

| Route | Page |
|-------|------|
| `/` | Home Feed (with feed mode selector: Headlines/Cards/Explain) |
| `/onboarding` | Onboarding wizard (5 steps) |
| `/reels` | Short videos (grid layout with thumbnails) |
| `/quiz` | Sports trivia (seed + daily AI questions) |
| `/team` | Favorite team section (with team stats card) |
| `/collection` | Sticker collection and achievements |
| `/parents` | Parental control panel (5 tabs) |

## Conventions

- **Language**: all code identifiers (variables, functions, types, file names) are in English
- **User-facing text**: internationalized via the i18n system (see below)
- **Technical terms**: kept in English (deploy, feed, quiz, onboarding)
- **File names**: kebab-case for utilities, PascalCase for React components
- **Shared types**: define in `packages/shared/src/types/`
- **Constants**: define in `packages/shared/src/constants/`

## Internationalization (i18n)

The project supports multiple languages through a shared i18n system:

- **Location**: `packages/shared/src/i18n/`
- **Locale files**: `es.json` (Spanish), `en.json` (English)
- **Usage**: import `{ t }` from `@sportykids/shared` and call `t(key, locale)`
- **Adding a new locale**: create a new JSON file (e.g., `fr.json`) following the existing key structure

### Shared package exports

Constants and utilities in `@sportykids/shared` use English identifiers:

| Export | Description |
|--------|-------------|
| `SPORTS` | Array of sport identifiers (`football`, `basketball`, `tennis`, etc.) |
| `TEAMS` | Array of known team names |
| `COLORS` | Color palette constants |
| `AGE_RANGES` | Supported age range definitions |
| `sportToColor(sport)` | Maps a sport to its badge color |
| `sportToEmoji(sport)` | Maps a sport to its emoji icon |
| `formatDate(date)` | Formats a date for display |
| `truncateText(text, max)` | Truncates text with ellipsis |
| `t(key, locale)` | Returns localized string for the given key and locale |
| `getSportLabel(sport, locale)` | Returns localized sport name |
| `getAgeRangeLabel(range, locale)` | Returns localized age range label |

## Tests

The project uses **Vitest** as the testing framework for the API:

```bash
# Run all API tests
cd apps/api && npx vitest run

# Run tests in watch mode
cd apps/api && npx vitest
```

Existing test files:
- `apps/api/src/utils/safe-json-parse.test.ts` — 6 tests (safe JSON parser)
- `apps/api/src/utils/url-validator.test.ts` — 16 tests (SSRF validation)
- `apps/api/src/services/gamification.test.ts` — 7 tests (streaks, stickers, achievements)
- `apps/api/src/services/feed-ranker.test.ts` — 7 tests (personalized ranking)

Configuration in `apps/api/vitest.config.ts`. Uses `vi.mock` for Prisma and `vi.useFakeTimers` for time-dependent tests.
