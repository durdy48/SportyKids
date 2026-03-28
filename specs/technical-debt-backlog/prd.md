# PRD-1: Critical Foundation — Testing, Linting, Logging & Session Persistence

**Status**: Draft
**Author**: Product Engineering
**Created**: 2026-03-28
**Priority**: P0 — Must ship before any new feature work

---

## Overview

SportyKids has completed Phases 0-4 of its MVP, but critical infrastructure gaps block the move to Phase 5 (beta with real families). The API has 274 tests across 25 files, but the Web app (56 files) and Mobile app (32 files) have **zero tests**. There is no ESLint configuration. CI only typechecks API and Web (not Mobile). The API uses 88 unstructured `console.*` calls with no log correlation. Parental session tokens live in an in-memory `Map` and are lost on every server restart — unacceptable for a child-safety feature relied upon by parents.

This PRD addresses five foundational features that must be resolved before beta.

---

## Problem Statement

1. **No frontend tests**: A regression in `OnboardingWizard`, `QuizGame`, or `ParentalPanel` would ship undetected. Background jobs (7 cron jobs) also lack test coverage.
2. **No linting**: Inconsistent code style, uncaught `any` types, stale imports, and no guardrails against `console.*` leaking into production.
3. **Mobile not typechecked in CI**: Type errors in `apps/mobile/` are invisible until a developer runs `tsc` locally. Prisma generate runs 4 times redundantly in CI.
4. **Unstructured logging**: 88 `console.*` calls across 24 files make it impossible to correlate a request through the system, filter by severity, or integrate meaningfully with Sentry/PostHog.
5. **Volatile parental sessions**: The `parentSessions` Map in `apps/api/src/routes/parents.ts` (lines 20-39) is wiped on every deploy or crash. Parents must re-enter their PIN after any server restart, breaking trust in the safety controls.

---

## Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Catch regressions in Web and Mobile before merge | CI runs Web + Mobile tests on every PR; green required to merge |
| G2 | Enforce consistent code quality across the monorepo | ESLint 9 flat config with zero errors on `main`; `no-console` as warning |
| G3 | Typecheck all three apps in CI | Mobile typecheck step passes; Prisma generate runs once |
| G4 | Enable request-level log tracing and Sentry/PostHog integration | All API logs are structured JSON with `requestId`; errors auto-report to Sentry |
| G5 | Parental sessions survive restarts | Session tokens stored in DB; parents stay authenticated across deploys |

---

## Target Users

- **Development team**: Benefits from testing infra, linting, and structured logs.
- **Parents (beta testers)**: Directly impacted by session persistence — their parental lock must not reset on deploys.
- **Children (end users)**: Indirectly benefit from fewer regressions and faster incident diagnosis.

---

## Core Features

### Feature 1: Web & Mobile Testing Infrastructure

#### 1A. Web Testing Setup (`apps/web/`)

**Install dependencies**:
- `vitest` (same version as API: `^4.1.1`)
- `@vitest/coverage-v8`
- `@testing-library/react` (latest compatible with React 19)
- `@testing-library/jest-dom`
- `jsdom`

**Configuration file**: `apps/web/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'; // if needed for JSX

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/components/**', 'src/lib/**'],
    },
  },
});
```

**Setup file**: `apps/web/vitest.setup.ts`
- Import `@testing-library/jest-dom`
- Mock `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`)
- Mock `next/image`
- Mock `@sportykids/shared` i18n functions (`t` returns the key, `getSportLabel`/`getAgeRangeLabel` return sport/range directly)

**Package.json scripts** (add to `apps/web/package.json`):
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Root package.json** (add):
```json
"test:web": "npm run test --workspace=apps/web",
"test:all": "npm run test --workspace=apps/api && npm run test --workspace=apps/web && npm run test --workspace=apps/mobile"
```

**Critical components to test** (~30-40 tests total):

| Component | File | Tests |
|-----------|------|-------|
| `OnboardingWizard` | `src/components/OnboardingWizard.tsx` | Renders step 1; advances through 5 steps; calls submit on final step; validates required fields |
| `QuizGame` | `src/components/QuizGame.tsx` | Renders question; highlights correct/wrong answer on click; increments score; shows completion state |
| `ParentalPanel` | `src/components/ParentalPanel.tsx` | Renders tabs; shows activity summary; toggles restrictions |
| `PinInput` | `src/components/PinInput.tsx` | Renders 4 digit inputs; auto-advances focus; calls onComplete with full PIN; handles backspace |
| `ReelPlayer` | `src/components/ReelPlayer.tsx` | Renders video element; shows fallback for unsupported types |
| `NewsCard` | `src/components/NewsCard.tsx` | Renders title, sport badge, image; truncates long text; links to detail |
| `FeedModeToggle` | `src/components/FeedModeToggle.tsx` | Renders 3 mode buttons; calls onChange with selected mode |
| `ErrorState` | `src/components/ErrorState.tsx` | Renders error message; shows retry button; calls onRetry |
| `useUser` (context) | `src/lib/user-context.tsx` | Provides default user; updates on setUser; persists to localStorage |
| `useFavorites` | `src/lib/favorites.ts` | Adds/removes favorites; persists to localStorage; returns correct boolean for isFavorite |
| `useOfflineCache` | `src/lib/offline-cache.ts` | Caches items; retrieves from cache; respects max items limit |
| `api.ts` | `src/lib/api.ts` | Constructs correct URLs; includes auth headers; handles error responses |

#### 1B. Mobile Testing Setup (`apps/mobile/`)

**Install dependencies**:
- `vitest` `^4.1.1`
- `@vitest/coverage-v8`
- `@testing-library/react-native` (latest compatible with RN 0.81)
- `react-test-renderer` (matching React 19)

**Configuration file**: `apps/mobile/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // RNTL uses its own renderer
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/screens/**', 'src/lib/**', 'src/components/**'],
    },
  },
});
```

**Setup file**: `apps/mobile/vitest.setup.ts`
- Mock `react-native` core modules (Alert, Linking, Platform, Dimensions)
- Mock `@react-native-async-storage/async-storage`
- Mock `expo-haptics`, `expo-notifications`, `expo-device`
- Mock `@react-navigation/native` (`useNavigation`, `useRoute`, `useFocusEffect`)
- Mock `@sportykids/shared` i18n (same pattern as web)

**Package.json scripts** (add to `apps/mobile/package.json`):
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Root package.json** (add):
```json
"test:mobile": "npm run test --workspace=apps/mobile"
```

**Critical screens/modules to test** (~20-30 tests total):

| Screen/Module | File | Tests |
|---------------|------|-------|
| `HomeFeed` | `src/screens/HomeFeed.tsx` | Renders news list; calls API with filters; shows offline banner when offline; pulls to refresh |
| `Quiz` | `src/screens/Quiz.tsx` | Renders question; submits answer; shows score; handles empty questions |
| `ParentalControl` | `src/screens/ParentalControl.tsx` | Shows PIN input; navigates to settings after auth; displays activity |
| `Onboarding` | `src/screens/Onboarding.tsx` | Renders steps; collects preferences; creates user on completion |
| `Login` | `src/screens/Login.tsx` | Renders form fields; validates inputs; calls auth API; shows errors |
| `api.ts` | `src/lib/api.ts` | Builds correct request URLs; attaches auth token; handles network errors |
| `auth.ts` | `src/lib/auth.ts` | Stores/retrieves tokens; refreshes expired tokens; clears on logout |
| `push-notifications.ts` | `src/lib/push-notifications.ts` | Requests permissions; registers token; handles denied permissions |
| `favorites.ts` | `src/lib/favorites.ts` | Toggles favorites; persists to AsyncStorage |
| `offline-cache.ts` | `src/lib/offline-cache.ts` | Saves articles; loads from cache; evicts oldest when full |

#### 1C. API Background Job Tests

The 7 cron jobs in `apps/api/src/jobs/` currently have **zero test coverage**. Add test files:

| Job | File | Tests |
|-----|------|-------|
| `sync-feeds` | `src/jobs/sync-feeds.test.ts` | Calls aggregator for each active source; handles aggregator errors gracefully; skips when already running (lock flag); sends push notifications for team news |
| `sync-videos` | `src/jobs/sync-videos.test.ts` | Calls video-aggregator for active video sources; handles errors; skips when already running |
| `generate-daily-quiz` | `src/jobs/generate-daily-quiz.test.ts` | Generates questions for each age range; skips when AI provider unavailable; sends push notification on completion |
| `generate-daily-missions` | `src/jobs/generate-daily-missions.test.ts` | Creates missions for active users; assigns correct reward types; skips users who already have today's mission |
| `streak-reminder` | `src/jobs/streak-reminder.test.ts` | Sends reminders to users with active streaks; skips users who already checked in today |
| `send-weekly-digests` | `src/jobs/send-weekly-digests.test.ts` | Generates digests for users with digest enabled; sends emails; handles email failures gracefully |
| `sync-team-stats` | `src/jobs/sync-team-stats.test.ts` | Calls team-stats-sync for all teams; logs sync/fail counts |

All job tests must mock `prisma`, external services (RSS parser, AI client, push sender, nodemailer), and `node-cron`. Test the exported run function directly, not the cron scheduling.

#### 1D. CI Updates

Update `.github/workflows/ci.yml`:

- **Add Web test job**: New `test-web` job that runs `cd apps/web && npx vitest run`
- **Add Mobile test job**: New `test-mobile` job that runs `cd apps/mobile && npx vitest run`
- **Add coverage reporting**: Each test job uploads coverage via `actions/upload-artifact@v4` as JSON summary
- **Gate builds on all tests**: `build-api` and `build-web` should `needs: [lint, test, test-web, test-mobile]`

---

### Feature 2: ESLint & Consistent Linting

#### Configuration

**Root config**: `eslint.config.js` (ESLint 9+ flat config format)

Install at root:
- `eslint` `^9.x`
- `@eslint/js`
- `typescript-eslint` (v8+ for flat config support)
- `eslint-plugin-react` (for web/mobile)
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-native` (for mobile)
- `eslint-config-next` (for web — Next.js specific rules)
- `eslint-config-prettier` (disable conflicting formatting rules)
- `prettier`

**Flat config structure** (`eslint.config.js` at root):

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Global ignores
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**'] },

  // Base TypeScript rules for all workspaces
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // API-specific (Node environment)
  {
    files: ['apps/api/src/**/*.ts'],
    languageOptions: { globals: { /* node globals */ } },
  },

  // Web-specific (Next.js / React / browser)
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooksPlugin },
    rules: {
      'react/react-in-jsx-scope': 'off', // Next.js auto-imports React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Mobile-specific (React Native / Expo)
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooksPlugin },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Test files — relaxed rules
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Prettier must be last
  prettierConfig,
];
```

**Prettier config**: `.prettierrc` at root:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Update root `package.json` scripts**:
```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
"format:check": "prettier --check \"**/*.{ts,tsx,json,md}\""
```

**Update CI** (`lint` job): Replace the current typecheck-only lint job with:
```yaml
- name: Lint
  run: npx eslint . --max-warnings 0
```

Note: `no-console` is set to `warn`, and CI uses `--max-warnings 0`, so all 88 existing `console.*` calls must be replaced with the logger (Feature 4) **before** lint can pass. Implementation order: Feature 4 first, then Feature 2 lint CI enforcement.

#### Cleanup

- Remove the stale `"lint": "eslint . --ext .ts,.tsx"` from root `package.json` (old CLI syntax, incompatible with flat config).
- Remove `"lint": "next lint"` from `apps/web/package.json` (will use root config).
- Remove `"lint": "eslint . --ext .ts,.tsx"` from `apps/mobile/package.json` (will use root config).

---

### Feature 3: Mobile Typecheck in CI

#### 3A. Add Mobile Typecheck Step

In `.github/workflows/ci.yml`, add to the `lint` job:

```yaml
- name: Typecheck Mobile
  run: cd apps/mobile && npx tsc --noEmit
```

This runs after Prisma generate (Mobile imports `@sportykids/shared` which may reference Prisma types transitively).

**Pre-requisite**: Fix any existing type errors in `apps/mobile/`. Run `cd apps/mobile && npx tsc --noEmit` locally and fix all errors before merging.

#### 3B. Consolidate Prisma Generate

Currently `cd apps/api && npx prisma generate` runs in **every CI job** (lint, test, build-api, build-web). This wastes ~15s per job.

**Solution**: Cache the Prisma client artifact.

Add a shared setup step using `actions/cache@v4`:

```yaml
- name: Cache Prisma Client
  id: prisma-cache
  uses: actions/cache@v4
  with:
    path: apps/api/node_modules/.prisma
    key: prisma-${{ hashFiles('apps/api/prisma/schema.prisma') }}

- name: Generate Prisma Client
  if: steps.prisma-cache.outputs.cache-hit != 'true'
  run: cd apps/api && npx prisma generate
```

Apply this pattern to **all jobs** that need Prisma (lint, test, test-web, build-api, build-web). The cache key is based on `schema.prisma` hash — regenerates only when the schema changes.

---

### Feature 4: Structured Logging with Pino

#### 4A. Logger Module

**Install** in `apps/api/`:
- `pino` `^9.x`
- `pino-pretty` (devDependency, for local development)

**New file**: `apps/api/src/services/logger.ts`

```typescript
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  base: { service: 'sportykids-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive fields
  redact: ['req.headers.authorization', 'req.headers["x-parental-session"]'],
});

export type Logger = pino.Logger;
```

**Child logger factory** (for request-scoped logging):
```typescript
export function createRequestLogger(requestId: string): pino.Logger {
  return logger.child({ requestId });
}
```

#### 4B. Request ID Middleware

**New file**: `apps/api/src/middleware/request-id.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createRequestLogger } from '../services/logger';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: import('pino').Logger;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = requestId;
  req.log = createRequestLogger(requestId);
  res.setHeader('X-Request-ID', requestId);
  next();
}
```

**Register in `apps/api/src/index.ts`** — add **before** all other middleware:
```typescript
import { requestIdMiddleware } from './middleware/request-id';
app.use(requestIdMiddleware);
```

#### 4C. Replace All 88 console.* Calls

Every `console.*` call across 24 files must be replaced. The mapping:

| `console.*` | `logger.*` / `req.log.*` |
|-------------|--------------------------|
| `console.log(msg)` | `logger.info(msg)` or `req.log.info(msg)` |
| `console.error(msg, err)` | `logger.error({ err }, msg)` or `req.log.error({ err }, msg)` |
| `console.warn(msg)` | `logger.warn(msg)` |

**Context rule**: Use `req.log` inside Express route handlers/middleware (has `requestId`). Use `logger` in services, jobs, and startup code (no request context).

**Files to modify** (complete list, 24 files):

| File | Approximate console.* count |
|------|---------------------------|
| `src/index.ts` | 3 |
| `src/middleware/error-handler.ts` | 1 |
| `src/jobs/sync-feeds.ts` | ~8 |
| `src/jobs/sync-videos.ts` | ~6 |
| `src/jobs/generate-daily-quiz.ts` | ~10 |
| `src/jobs/generate-daily-missions.ts` | ~5 |
| `src/jobs/streak-reminder.ts` | ~4 |
| `src/jobs/send-weekly-digests.ts` | ~5 |
| `src/jobs/sync-team-stats.ts` | ~4 |
| `src/routes/news.ts` | ~3 |
| `src/routes/quiz.ts` | ~2 |
| `src/routes/reels.ts` | ~3 |
| `src/routes/teams.ts` | ~2 |
| `src/services/aggregator.ts` | ~5 |
| `src/services/ai-client.ts` | ~4 |
| `src/services/cache.ts` | ~2 |
| `src/services/content-moderator.ts` | ~3 |
| `src/services/monitoring.ts` | ~3 |
| `src/services/push-sender.ts` | ~2 |
| `src/services/quiz-generator.ts` | ~3 |
| `src/services/redis-cache.ts` | ~2 |
| `src/services/summarizer.ts` | ~2 |
| `src/services/team-stats-sync.ts` | ~3 |
| `src/services/video-aggregator.ts` | ~4 |

#### 4D. Enhanced Error Handler

Update `apps/api/src/middleware/error-handler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { captureException } from '../services/monitoring';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  req.log.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  // Report to Sentry with request context
  captureException(err, {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    userId: (req as any).userId,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 500,
    requestId: req.requestId,
  });
}
```

#### 4E. Sentry Integration Enhancement

Update `apps/api/src/services/monitoring.ts`:

- `captureException` should include `requestId` in Sentry `extra` context when available.
- Add `addBreadcrumb(message, category, level)` function for Sentry breadcrumbs on critical flows (onboarding, quiz, parental PIN verification).
- No changes to the existing `initSentry()` flow — it already works correctly.

#### 4F. PostHog Structured Events

Add the following structured events to the `trackEvent` calls at the appropriate places in the codebase:

| Event Name | Trigger Location | Properties |
|-----------|-----------------|------------|
| `onboarding_completed` | `POST /api/users` (users.ts) | `{ userId, sports, ageRange, country }` |
| `quiz_played` | `POST /api/quiz/answer` (quiz.ts) | `{ userId, questionId, correct, sport }` |
| `sticker_earned` | gamification check-in (gamification.ts) | `{ userId, stickerId, rarity }` |
| `parental_pin_verified` | `POST /api/parents/verify-pin` (parents.ts) | `{ userId, success }` |
| `daily_mission_claimed` | `POST /api/missions/claim` (missions.ts) | `{ userId, missionType, rewardType }` |
| `digest_downloaded` | `GET /api/parents/digest/:userId/download` (parents.ts) | `{ userId }` |

These calls use the existing `trackEvent` function from `monitoring.ts` — no new infrastructure needed.

#### 4G. Environment Variable

| Variable | Required | Description |
|----------|----------|-------------|
| `LOG_LEVEL` | No | Pino log level: `debug`, `info`, `warn`, `error`. Default: `debug` (dev), `info` (production) |

---

### Feature 5: Persistent Parental Session Tokens

#### 5A. Prisma Model

Add to `apps/api/prisma/schema.prisma`:

```prisma
model ParentalSession {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([expiresAt])
}
```

Add the reverse relation to the `User` model:
```prisma
model User {
  // ... existing fields ...
  parentalSessions ParentalSession[]
}
```

**Migration**: `npx prisma migrate dev --name add_parental_session`

#### 5B. Session Service

**New file**: `apps/api/src/services/parental-session.ts`

```typescript
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from './logger';

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function createParentalSession(userId: string): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.parentalSession.create({
    data: { userId, token: sessionToken, expiresAt },
  });

  logger.info({ userId }, 'Parental session created');
  return { sessionToken, expiresAt };
}

export async function verifyParentalSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  const session = await prisma.parentalSession.findUnique({ where: { token } });
  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    // Lazy cleanup of this expired session
    await prisma.parentalSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.userId;
}

export async function revokeParentalSessions(userId: string): Promise<void> {
  await prisma.parentalSession.deleteMany({ where: { userId } });
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.parentalSession.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  if (result.count > 0) {
    logger.info({ cleaned: result.count }, 'Expired parental sessions cleaned');
  }
  return result.count;
}
```

#### 5C. Migration of parents.ts

In `apps/api/src/routes/parents.ts`:

1. **Remove** lines 20-53 entirely (the `parentSessions` Map, `SESSION_TTL_MS`, `setInterval` cleanup, `createSession` function, and `verifyParentalSession` function).
2. **Import** `{ createParentalSession, verifyParentalSession, cleanupExpiredSessions }` from `../services/parental-session`.
3. **Replace** all calls to the local `createSession(userId)` with `await createParentalSession(userId)`. Note the return type changes from `{ sessionToken, expiresAt: number }` to `{ sessionToken, expiresAt: Date }`. Adjust the response serialization: `expiresAt.getTime()` or `expiresAt.toISOString()` to match existing frontend expectations.
4. **Keep** the `setInterval` cleanup but change it to call `cleanupExpiredSessions()` (async, fire-and-forget).
5. **Export** `verifyParentalSession` from the new service module instead of from `parents.ts`.

#### 5D. Migration of parental-guard.ts

`apps/api/src/middleware/parental-guard.ts` imports `verifyParentalSession` from `../routes/parents`. Update this import to point to `../services/parental-session`.

The `verifyParentalSession` function becomes **async** (returns `Promise<string | null>` instead of `string | null`). Update the middleware to `await` the call. The middleware is already an async function pattern in Express 5, so this is safe.

#### 5E. Frontend Impact

**Zero changes required**. The `X-Parental-Session` header contract remains identical. The session token format (UUID) and TTL (5 minutes) are unchanged. Frontends will not notice any difference except that sessions survive server restarts.

---

## Acceptance Criteria

### Feature 1: Web & Mobile Testing Infrastructure

- [ ] `apps/web/vitest.config.ts` exists and is correctly configured with jsdom environment
- [ ] `apps/web/vitest.setup.ts` exists with Next.js mocks (useRouter, Image, etc.)
- [ ] At least 30 tests exist in `apps/web/src/` covering OnboardingWizard, QuizGame, ParentalPanel, PinInput, ReelPlayer, NewsCard, useUser, useFavorites, useOfflineCache, and api.ts
- [ ] All web tests pass: `cd apps/web && npx vitest run` exits 0
- [ ] `apps/mobile/vitest.config.ts` exists and is correctly configured
- [ ] `apps/mobile/vitest.setup.ts` exists with React Native / Expo mocks
- [ ] At least 20 tests exist in `apps/mobile/src/` covering HomeFeed, Quiz, ParentalControl, Onboarding, Login, api.ts, auth.ts, push-notifications.ts, favorites.ts, offline-cache.ts
- [ ] All mobile tests pass: `cd apps/mobile && npx vitest run` exits 0
- [ ] At least 7 new test files exist in `apps/api/src/jobs/` (one per background job)
- [ ] All API tests still pass: `cd apps/api && npx vitest run` exits 0
- [ ] CI workflow has `test-web` and `test-mobile` jobs
- [ ] CI build jobs depend on `[lint, test, test-web, test-mobile]`
- [ ] Coverage artifacts are uploaded in each test job

### Feature 2: ESLint & Consistent Linting

- [ ] `eslint.config.js` exists at repo root using ESLint 9 flat config format
- [ ] `.prettierrc` exists at repo root
- [ ] `npx eslint .` runs without errors (warnings allowed for existing `no-console` violations during transition)
- [ ] After Feature 4 is applied, `npx eslint . --max-warnings 0` passes with zero warnings
- [ ] Test files have relaxed rules (no-console off, no-explicit-any off)
- [ ] Stale lint scripts removed from `apps/web/package.json` and `apps/mobile/package.json`
- [ ] CI `lint` job runs `npx eslint . --max-warnings 0`

### Feature 3: Mobile Typecheck in CI

- [ ] `cd apps/mobile && npx tsc --noEmit` passes locally with zero errors
- [ ] CI `lint` job includes "Typecheck Mobile" step
- [ ] Prisma generate uses `actions/cache@v4` keyed on `schema.prisma` hash
- [ ] Prisma generate runs **at most once** per CI run (on cache miss)
- [ ] All existing CI jobs (lint, test, build-api, build-web) still pass

### Feature 4: Structured Logging with Pino

- [ ] `pino` and `pino-pretty` installed in `apps/api/`
- [ ] `apps/api/src/services/logger.ts` exports `logger` and `createRequestLogger`
- [ ] `apps/api/src/middleware/request-id.ts` exports `requestIdMiddleware`
- [ ] `requestIdMiddleware` is registered in `apps/api/src/index.ts` before all other middleware
- [ ] Every response includes `X-Request-ID` header
- [ ] All 88 `console.*` calls across 24 files are replaced with `logger.*` or `req.log.*`
- [ ] Zero `console.*` calls remain in non-test API source files (verified by ESLint `no-console` rule)
- [ ] Error handler sends `requestId` to Sentry via `captureException`
- [ ] Error handler includes `requestId` in the 500 JSON response
- [ ] PostHog `trackEvent` calls added for the 6 structured events listed
- [ ] `LOG_LEVEL` environment variable is documented and respected
- [ ] Dev mode uses `pino-pretty` for human-readable output
- [ ] Production mode outputs JSON (no pretty printing)

### Feature 5: Persistent Parental Session Tokens

- [ ] `ParentalSession` model exists in `prisma/schema.prisma` with fields: id, userId, token (unique), expiresAt, createdAt
- [ ] Migration `add_parental_session` created and applied
- [ ] `apps/api/src/services/parental-session.ts` exports `createParentalSession`, `verifyParentalSession`, `revokeParentalSessions`, `cleanupExpiredSessions`
- [ ] In-memory `parentSessions` Map removed from `apps/api/src/routes/parents.ts`
- [ ] `parental-guard.ts` imports `verifyParentalSession` from the new service module
- [ ] `verifyParentalSession` is `await`-ed in the parental-guard middleware
- [ ] Existing parental PIN verification flow works identically (manual test: setup PIN, verify PIN, access restricted endpoint with session token)
- [ ] Session survives API restart (manual test: verify PIN, restart API, access restricted endpoint with same token)
- [ ] Expired sessions are lazily cleaned on verification miss
- [ ] Periodic cleanup (setInterval) calls `cleanupExpiredSessions()`
- [ ] Unit tests exist for `parental-session.ts` (create, verify valid, verify expired, cleanup)
- [ ] Frontend parental flows work with zero changes (X-Parental-Session header contract unchanged)

---

## Technical Requirements

### Dependencies to Add

| Package | Workspace | Type | Version |
|---------|-----------|------|---------|
| `vitest` | `apps/web` | devDependency | `^4.1.1` |
| `@vitest/coverage-v8` | `apps/web` | devDependency | `^4.1.1` |
| `@testing-library/react` | `apps/web` | devDependency | latest (React 19 compatible) |
| `@testing-library/jest-dom` | `apps/web` | devDependency | latest |
| `@vitejs/plugin-react` | `apps/web` | devDependency | latest |
| `jsdom` | `apps/web` | devDependency | latest |
| `vitest` | `apps/mobile` | devDependency | `^4.1.1` |
| `@vitest/coverage-v8` | `apps/mobile` | devDependency | `^4.1.1` |
| `@testing-library/react-native` | `apps/mobile` | devDependency | latest (RN 0.81 compatible) |
| `react-test-renderer` | `apps/mobile` | devDependency | `^19.1.0` |
| `eslint` | root | devDependency | `^9.x` |
| `@eslint/js` | root | devDependency | latest |
| `typescript-eslint` | root | devDependency | `^8.x` |
| `eslint-plugin-react` | root | devDependency | latest |
| `eslint-plugin-react-hooks` | root | devDependency | latest |
| `eslint-config-prettier` | root | devDependency | latest |
| `prettier` | root | devDependency | latest |
| `pino` | `apps/api` | dependency | `^9.x` |
| `pino-pretty` | `apps/api` | devDependency | latest |
| `@types/pino` | `apps/api` | devDependency | (included in pino v9) |

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/vitest.config.ts` | Web test configuration |
| `apps/web/vitest.setup.ts` | Web test setup (mocks for Next.js, i18n) |
| `apps/web/src/components/OnboardingWizard.test.tsx` | OnboardingWizard tests |
| `apps/web/src/components/QuizGame.test.tsx` | QuizGame tests |
| `apps/web/src/components/ParentalPanel.test.tsx` | ParentalPanel tests |
| `apps/web/src/components/PinInput.test.tsx` | PinInput tests |
| `apps/web/src/components/ReelPlayer.test.tsx` | ReelPlayer tests |
| `apps/web/src/components/NewsCard.test.tsx` | NewsCard tests |
| `apps/web/src/components/FeedModeToggle.test.tsx` | FeedModeToggle tests |
| `apps/web/src/components/ErrorState.test.tsx` | ErrorState tests |
| `apps/web/src/lib/user-context.test.tsx` | useUser hook tests |
| `apps/web/src/lib/favorites.test.ts` | useFavorites tests |
| `apps/web/src/lib/offline-cache.test.ts` | useOfflineCache tests |
| `apps/web/src/lib/api.test.ts` | API client tests |
| `apps/mobile/vitest.config.ts` | Mobile test configuration |
| `apps/mobile/vitest.setup.ts` | Mobile test setup (mocks for RN, Expo, Navigation) |
| `apps/mobile/src/screens/HomeFeed.test.tsx` | HomeFeed tests |
| `apps/mobile/src/screens/Quiz.test.tsx` | Quiz tests |
| `apps/mobile/src/screens/ParentalControl.test.tsx` | ParentalControl tests |
| `apps/mobile/src/screens/Onboarding.test.tsx` | Onboarding tests |
| `apps/mobile/src/screens/Login.test.tsx` | Login tests |
| `apps/mobile/src/lib/api.test.ts` | Mobile API client tests |
| `apps/mobile/src/lib/auth.test.ts` | Auth module tests |
| `apps/mobile/src/lib/push-notifications.test.ts` | Push notifications tests |
| `apps/mobile/src/lib/favorites.test.ts` | Favorites tests |
| `apps/mobile/src/lib/offline-cache.test.ts` | Offline cache tests |
| `apps/api/src/jobs/sync-feeds.test.ts` | sync-feeds job tests |
| `apps/api/src/jobs/sync-videos.test.ts` | sync-videos job tests |
| `apps/api/src/jobs/generate-daily-quiz.test.ts` | daily quiz job tests |
| `apps/api/src/jobs/generate-daily-missions.test.ts` | daily missions job tests |
| `apps/api/src/jobs/streak-reminder.test.ts` | streak reminder job tests |
| `apps/api/src/jobs/send-weekly-digests.test.ts` | weekly digests job tests |
| `apps/api/src/jobs/sync-team-stats.test.ts` | team stats sync job tests |
| `eslint.config.js` | Root ESLint flat config |
| `.prettierrc` | Prettier configuration |
| `apps/api/src/services/logger.ts` | Pino logger module |
| `apps/api/src/middleware/request-id.ts` | Request ID middleware |
| `apps/api/src/services/parental-session.ts` | Persistent parental session service |
| `apps/api/src/services/parental-session.test.ts` | Parental session tests |

### Files to Modify

| File | Changes |
|------|---------|
| `.github/workflows/ci.yml` | Add test-web, test-mobile jobs; Prisma cache; mobile typecheck; coverage upload |
| `package.json` (root) | Update lint/test scripts; add ESLint/Prettier devDeps |
| `apps/web/package.json` | Add test scripts; add testing devDeps |
| `apps/mobile/package.json` | Add test scripts; add testing devDeps |
| `apps/api/package.json` | Add pino dependency; add pino-pretty devDep |
| `apps/api/prisma/schema.prisma` | Add ParentalSession model; add relation to User |
| `apps/api/src/index.ts` | Register requestIdMiddleware; replace console.* with logger |
| `apps/api/src/middleware/error-handler.ts` | Use req.log; send requestId to Sentry; include requestId in response |
| `apps/api/src/middleware/parental-guard.ts` | Import verifyParentalSession from service; await the call |
| `apps/api/src/routes/parents.ts` | Remove in-memory Map; use parental-session service; add PostHog events |
| 24 API source files (see Feature 4 list) | Replace all console.* calls with logger/req.log |
| `apps/api/src/services/monitoring.ts` | Add addBreadcrumb function; replace console.* with logger |
| `apps/api/src/routes/users.ts` | Add PostHog onboarding_completed event |
| `apps/api/src/routes/quiz.ts` | Add PostHog quiz_played event |
| `apps/api/src/routes/missions.ts` | Add PostHog daily_mission_claimed event |

### Database Changes

- New model: `ParentalSession` (see Feature 5A)
- New relation: `User.parentalSessions` (one-to-many, cascade delete)
- Migration name: `add_parental_session`

---

## Implementation Decisions

### D1: Vitest for all test runners
**Decision**: Use Vitest `^4.1.1` for web and mobile tests (same as API).
**Rationale**: Single test runner across the entire monorepo. Shared configuration patterns. API team already familiar with Vitest. Jest is not necessary since Vitest supports jsdom and can work with RNTL.

### D2: ESLint 9 flat config (not legacy .eslintrc)
**Decision**: Use `eslint.config.js` flat config format.
**Rationale**: ESLint 9 is the current major version. Flat config is the only supported format going forward. Legacy `.eslintrc` is deprecated. Starting fresh avoids migration debt.

### D3: Pino over Winston/Bunyan
**Decision**: Use Pino for structured logging.
**Rationale**: Pino is the fastest JSON logger for Node.js. Native support for child loggers (perfect for request-scoped context). First-class TypeScript types. `pino-pretty` for dev experience. Minimal API surface — less to learn.

### D4: Request ID via middleware (not library)
**Decision**: Generate request IDs in a lightweight Express middleware, attach to `req`, and propagate via `X-Request-ID`.
**Rationale**: Avoids coupling to any specific tracing library. Works with any downstream tool (Sentry, PostHog, log aggregators). Respects incoming `X-Request-ID` from load balancers.

### D5: Prisma for session storage (not Redis)
**Decision**: Store parental sessions in SQLite/PostgreSQL via Prisma, not in Redis.
**Rationale**: Redis is optional in this project (`CACHE_PROVIDER=redis` is opt-in). Requiring Redis for a safety-critical feature would complicate the default dev setup. Prisma is always available. The query volume is negligible (~1 session verification per parental request, <10 concurrent sessions expected in beta). If session verification latency becomes an issue at scale, a Redis-backed implementation can use the same `parental-session.ts` interface.

### D6: Lazy + periodic cleanup for expired sessions
**Decision**: Expired sessions are deleted (a) when encountered during verification and (b) by a periodic cleanup every 5 minutes.
**Rationale**: Matches the existing in-memory cleanup pattern. No need for a separate cron job. The periodic sweep prevents unbounded table growth if sessions are never verified after expiry.

### D7: `no-console` as warn, not error
**Decision**: Set `no-console` to `warn` in ESLint, with CI enforcing `--max-warnings 0`.
**Rationale**: During the transition (Feature 4), developers need to see warnings in their editor for remaining console.* calls. Once all 88 are migrated, the `--max-warnings 0` flag in CI ensures no regressions. Setting it as `error` would break the editor experience during migration.

### D8: PostHog events are fire-and-forget
**Decision**: PostHog event tracking remains fire-and-forget (existing pattern in `monitoring.ts`).
**Rationale**: Analytics must never block or fail user-facing requests. The existing `trackEvent` function already handles this correctly — no architectural change needed.

### D9: verifyParentalSession becomes async
**Decision**: The `verifyParentalSession` function changes from synchronous (Map lookup) to async (Prisma query).
**Rationale**: Database access is inherently async. Express 5 supports async middleware natively. The parental-guard middleware already uses async patterns. The performance impact is negligible (single indexed query on a small table).

### D10: Implementation order
**Decision**: Implement in this order: Feature 4 (logging) -> Feature 2 (linting) -> Feature 5 (sessions) -> Feature 1 (tests) -> Feature 3 (CI).
**Rationale**: Logging must come before linting (to clear `no-console` violations). Linting before sessions (so new code is linted from the start). Sessions before tests (so tests can cover the new service). CI last (to include all new test suites).

---

## Testing Decisions

### T1: Critical flows only — no 100% coverage mandate
Web and mobile test targets are ~30-40 and ~20-30 tests respectively. These cover the flows that, if broken, would block a beta user. Coverage percentage is not a goal — behavior verification is.

### T2: Mock boundaries
- **Web tests**: Mock `fetch` (API calls), `localStorage`, `next/navigation`, `next/image`. Do NOT mock React components — render them fully.
- **Mobile tests**: Mock `fetch`, `AsyncStorage`, React Navigation hooks, Expo modules (haptics, notifications, device). Do NOT mock React Native core components — RNTL renders them.
- **API job tests**: Mock `prisma` (all DB calls), external HTTP (RSS parser, AI client), `node-cron` (don't schedule, test the handler function directly), `push-sender`.

### T3: Test file co-location
Tests live next to the file they test: `Component.tsx` -> `Component.test.tsx`. This matches the existing API pattern (`gamification.ts` -> `gamification.test.ts`).

### T4: Parental session tests
The new `parental-session.ts` module needs its own test file covering: create session, verify valid session, verify expired session (returns null), verify nonexistent token (returns null), cleanup removes only expired, revoke removes all for a user. Mock Prisma client.

### T5: No E2E tests in this PRD
End-to-end tests (Playwright, Detox) are explicitly out of scope. This PRD focuses on unit and integration tests only.

### T6: Existing API tests must not break
All 274 existing tests across 25 files must continue to pass after all changes. Run `cd apps/api && npx vitest run` as a gate before any PR merge.

---

## Out of Scope

- **E2E / integration tests** (Playwright, Cypress, Detox) — future PRD.
- **Log aggregation infrastructure** (ELK, Datadog, CloudWatch) — Pino outputs JSON to stdout; log routing is a deployment concern.
- **Redis-backed session storage** — Prisma is sufficient for beta scale. Redis option can be added later behind the same interface.
- **OAuth flows** (Google, Apple) — already marked as 501 in the API; separate PRD.
- **UI changes** — this PRD is entirely backend/tooling/CI. No frontend visual changes.
- **Performance benchmarks** — structured logging adds ~1ms per log line; session DB lookup adds ~2ms per parental request. Neither warrants benchmarking at beta scale.
- **Log rotation / retention policies** — deployment concern, not application concern.
- **Husky / lint-staged / pre-commit hooks** — desirable but not in scope for this PRD. Can be added as a follow-up.

---

## Future Considerations

1. **Husky + lint-staged**: Add pre-commit hooks to run ESLint and Prettier on staged files only. Prevents unformatted code from reaching CI.
2. **E2E testing**: Playwright for web critical paths (onboarding, quiz, parental lock). Detox for mobile.
3. **Log aggregation**: When deploying to production, pipe Pino JSON output to a log aggregator (ELK, Datadog, or CloudWatch Logs).
4. **Redis sessions**: If parental session verification latency becomes measurable at scale, swap the Prisma implementation for Redis behind the same `parental-session.ts` interface.
5. **Coverage thresholds**: After baseline tests are established, introduce minimum coverage thresholds in CI (e.g., 60% for services, 40% for components).
6. **Snapshot testing**: Consider adding snapshot tests for complex components (OnboardingWizard, ParentalPanel) once the visual design stabilizes.
7. **Test database**: For integration tests, use an in-memory SQLite database via Prisma to test actual DB queries rather than mocking Prisma.
8. **OpenTelemetry**: Replace custom request ID middleware with OpenTelemetry traces for distributed tracing when the architecture grows beyond a single API server.
