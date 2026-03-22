# Development Guide

## Prerequisites

- Node.js >= 20
- npm >= 10
- Git

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
```

## Database

```bash
# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Load sample data (RSS sources, reels, quiz questions)
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
| `src/services/aggregator.ts` | RSS feed consumption |
| `src/services/classifier.ts` | Content classification by sport/team/age |
| `src/jobs/sync-feeds.ts` | Cron job for periodic RSS sync |

## Structure of a New Web Page

1. Create a folder in `apps/web/src/app/<name>/`
2. Create `page.tsx` (can be Server or Client Component)
3. Use `useUser()` to access the user context (from `user-context`)
4. Import shared components from `@/components/` (e.g., `NewsCard`, `FiltersBar`)
5. Use functions from `@/lib/api.ts` for backend calls

### Key webapp routes

| Route | Page |
|-------|------|
| `/` | Home Feed |
| `/onboarding` | Onboarding wizard |
| `/reels` | Short videos |
| `/quiz` | Sports trivia |
| `/team` | Favorite team section |
| `/parents` | Parental control panel |

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
