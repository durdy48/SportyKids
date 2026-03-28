# PRD2: Infrastructure Hardening — PostgreSQL Migration, Error Handling & Code Cleanup

## Overview

This PRD covers three high-priority infrastructure improvements that harden SportyKids for beta readiness: completing the PostgreSQL migration with full schema optimization, replacing the 10-line error handler with a typed error system, and cleaning up deprecated code with version alignment. These changes are purely backend/tooling — no UI changes.

## Problem Statement

1. **SQLite limitations**: The database stores arrays as JSON strings requiring manual parsing everywhere, the trending endpoint loads all activity logs into memory for aggregation (news.ts line 219-244), and critical queries lack indexes. This will not scale past a handful of beta families.

2. **Error handling is a black box**: The current error handler (`apps/api/src/middleware/error-handler.ts`) is 10 lines — it logs `console.error` and returns a generic `500` for every error. Validation errors, auth failures, and not-found responses all look the same to clients. Sentry integration cannot distinguish 4xx from 5xx.

3. **Accumulated code rot**: Two deprecated functions remain exported and tested (`sportBoost`, `recencyBoost`), React versions are mismatched between web (19.2.4) and mobile (19.1.0), `skipLibCheck: true` masks type errors in the web app, three cron jobs hardcode `'es'` locale for push notifications instead of using `user.locale`, and CI runs `prisma generate` four times across jobs.

## Goals

| # | Goal | Success Metric |
|---|------|---------------|
| G1 | Run production database on PostgreSQL with native types | All 274+ tests pass against PostgreSQL; JSON string parsing removed from array fields |
| G2 | Every API error returns a structured, typed response | Zero generic `500` responses for known error conditions; Sentry receives only 5xx errors |
| G3 | Remove all deprecated code and align dependency versions | Zero `@deprecated` exports; React version identical across web and mobile; CI runs prisma generate exactly once |

## Target Users

- **Backend developers** maintaining the API codebase
- **Frontend developers** consuming API error responses
- **DevOps/CI** pipeline configuration
- Indirectly: **beta families** via improved reliability and error messages

## Core Features

### Feature 6: Complete PostgreSQL Migration

#### 6.1 Execute Migration

Run the existing migration infrastructure to switch from SQLite to PostgreSQL as the primary development and production database.

**Steps:**
1. Start PostgreSQL via `docker compose -f apps/api/docker-compose.yml up -d postgres`
2. Update `apps/api/.env`: `DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids"`
3. Change `provider = "sqlite"` to `provider = "postgresql"` in `apps/api/prisma/schema.prisma` (line 41)
4. Run `npx prisma migrate dev --name postgres_migration` from `apps/api/`
5. Run `npx tsx prisma/seed.ts` from `apps/api/`
6. Verify `npm run dev:api` starts and `/api/health` returns 200

#### 6.2 Schema Optimization — Native Types

Convert JSON-string fields to native PostgreSQL types. Each change requires a Prisma migration step.

| Model | Field | Current Type | Target Type | Notes |
|-------|-------|-------------|-------------|-------|
| `User` | `favoriteSports` | `String @default("[]")` | `String[]` | Remove all `JSON.parse()` / `JSON.stringify()` calls for this field |
| `User` | `selectedFeeds` | `String @default("[]")` | `String[]` | Same as above |
| `QuizQuestion` | `options` | `String` (JSON string) | `String[]` | Update quiz routes and seed to use native arrays |
| `User` | `pushPreferences` | `String?` | `Json?` | Native JSON type; update push-sender.ts |
| `ParentalProfile` | `allowedSports` | `String @default("[]")` | `String[]` | Update parental routes |
| `ParentalProfile` | `allowedFeeds` | `String @default("[]")` | `String[]` | Update parental routes |
| `ParentalProfile` | `allowedFormats` | `String @default("[\"news\",\"reels\",\"quiz\"]")` | `String[] @default(["news", "reels", "quiz"])` | Update parental-guard.ts |
| `TeamStats` | `recentResults` | `String` (JSON string) | `Json` | Update team-stats.ts |
| `TeamStats` | `nextMatch` | `String?` (JSON string) | `Json?` | Update team-stats.ts |

**Implementation notes:**
- Search the entire codebase for `JSON.parse` and `JSON.stringify` calls on each field and remove/replace them.
- The seed file (`apps/api/prisma/seed.ts`) must be updated: stop wrapping arrays in `JSON.stringify()`.
- Routes that receive these fields from clients (e.g., `PUT /api/users/:id`) must accept native arrays in request body validation (Zod schemas).
- Prisma migration: create a single migration `postgres_native_types` that changes all fields at once.

#### 6.3 Migrate Trending Endpoint to Native SQL

Replace the in-memory aggregation in `apps/api/src/routes/news.ts` (lines 218-244) with a PostgreSQL `GROUP BY` + `HAVING` query.

**Current code (to replace):**
```typescript
// lines 218-244: fetches ALL news_viewed logs, counts in JS Map, filters by threshold
const recentLogs = await prisma.activityLog.findMany({...});
const viewCounts = new Map<string, number>();
// ... in-memory counting
```

**Target implementation:**
```typescript
const trending = await prisma.$queryRaw`
  SELECT "contentId", COUNT(*) as view_count
  FROM "ActivityLog"
  WHERE "type" = 'news_viewed'
    AND "createdAt" >= ${since}
    AND "contentId" IS NOT NULL
  GROUP BY "contentId"
  HAVING COUNT(*) > ${TRENDING_THRESHOLD}
  ORDER BY view_count DESC
  LIMIT ${TRENDING_LIMIT}
`;
```

Alternatively, use Prisma's `groupBy` which works correctly on PostgreSQL:
```typescript
const trending = await prisma.activityLog.groupBy({
  by: ['contentId'],
  where: { type: 'news_viewed', createdAt: { gte: since }, contentId: { not: null } },
  _count: { contentId: true },
  having: { contentId: { _count: { gt: TRENDING_THRESHOLD } } },
  orderBy: { _count: { contentId: 'desc' } },
  take: TRENDING_LIMIT,
});
```

#### 6.4 Add Database Indexes

Add indexes to `apps/api/prisma/schema.prisma` for the most common query patterns:

```prisma
model NewsItem {
  // ... existing fields ...
  @@index([sport, safetyStatus, publishedAt])
}

model ActivityLog {
  // ... existing fields ...
  @@index([userId, type, createdAt])
}

model Reel {
  // ... existing fields ...
  @@index([sport, safetyStatus, publishedAt])
}
```

These indexes cover:
- News feed queries: filter by sport + safety status, sort by publishedAt
- Behavioral signals: filter by userId + type + date range
- Reels feed queries: filter by sport + safety status, sort by publishedAt

#### 6.5 Test Suite Against PostgreSQL

- Run all 274+ existing tests against the PostgreSQL instance
- Fix any tests that rely on SQLite-specific behavior (e.g., implicit type coercion, JSON string comparisons)
- Update test setup/teardown to work with PostgreSQL (connection pooling, transaction rollback)

#### 6.6 Documentation

- Update `docs/` migration guide with exact steps executed
- Document rollback procedure (script already exists at `apps/api/scripts/migrate-to-postgres.sh --rollback`)
- Update CLAUDE.md datasource references

---

### Feature 8: Robust Error Handler

#### 8.1 Typed Error Classes

Create `apps/api/src/errors/index.ts` exporting the following error classes:

```typescript
// Base class
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';
}

export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';
}
```

#### 8.2 Centralized Error Handler

Replace the contents of `apps/api/src/middleware/error-handler.ts`:

```typescript
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // 1. If err is an instance of AppError, use its statusCode and code
  // 2. If err is a Prisma known error (P2002 unique constraint → 409, P2025 not found → 404), map accordingly
  // 3. If err is a Zod validation error, map to 400
  // 4. Otherwise, treat as 500 Internal Server Error

  // Response format:
  // {
  //   error: {
  //     code: string,          // Machine-readable: 'VALIDATION_ERROR', 'NOT_FOUND', etc.
  //     message: string,       // Human-readable description
  //     details?: unknown,     // Only in development: validation details, field errors
  //     stack?: string,        // Only in development (NODE_ENV !== 'production')
  //     requestId?: string,    // If request ID middleware exists
  //   }
  // }

  // Sentry: only report 5xx errors
  // Include context: userId (from req.user), route (req.path), method (req.method)
}
```

**Prisma error mapping:**
- `P2002` (unique constraint violation) -> `ConflictError`
- `P2025` (record not found) -> `NotFoundError`
- `P2003` (foreign key constraint failure) -> `ValidationError`

**Zod error mapping:**
- Any `ZodError` -> `ValidationError` with `details` containing the flattened field errors

#### 8.3 Error Codes in Shared Package

Add error code constants to `packages/shared/src/constants/errors.ts`:

```typescript
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SCHEDULE_LOCKED: 'SCHEDULE_LOCKED',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  FORMAT_RESTRICTED: 'FORMAT_RESTRICTED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

#### 8.4 Kid-Friendly Error Mapping

Extend the existing `KID_FRIENDLY_ERRORS` in `packages/shared/src/constants/errors.ts` to map new error codes:

| Error Code | KID_FRIENDLY_ERRORS key | Notes |
|-----------|------------------------|-------|
| `VALIDATION_ERROR` | `generic` | Reuse existing |
| `AUTHENTICATION_ERROR` | New: `auth_required` | Add i18n keys |
| `AUTHORIZATION_ERROR` | `schedule_locked` or new `forbidden` | Context-dependent |
| `NOT_FOUND` | `not_found` | Already exists |
| `RATE_LIMIT_EXCEEDED` | New: `too_fast` | Add i18n keys |
| `INTERNAL_ERROR` | `server` | Already exists |

Add corresponding i18n keys to `packages/shared/src/i18n/es.json` and `en.json`.

#### 8.5 Migrate Existing Routes

Audit all route files in `apps/api/src/routes/` and replace inline error responses with thrown error classes:

**Before (typical pattern found across routes):**
```typescript
if (!user) {
  res.status(404).json({ error: 'User not found' });
  return;
}
```

**After:**
```typescript
if (!user) {
  throw new NotFoundError('User not found');
}
```

The centralized error handler catches thrown errors. This eliminates inconsistent error response formats across routes.

**Files to audit and migrate:**
- `apps/api/src/routes/news.ts`
- `apps/api/src/routes/reels.ts`
- `apps/api/src/routes/quiz.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/parents.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/missions.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/parental-guard.ts`
- `apps/api/src/middleware/rate-limiter.ts`

#### 8.6 Sentry Integration Enhancement

In the error handler, after determining the status code:
- If `statusCode >= 500`: call `Sentry.captureException(err)` with scope containing `userId`, `route`, `method`
- If `statusCode < 500`: do NOT send to Sentry (these are expected client errors)
- The existing `apps/api/src/services/monitoring.ts` already initializes Sentry — the error handler should import and use it conditionally

---

### Feature 9: Deprecated Code Cleanup & Version Alignment

#### 9.1 Remove Deprecated Feed Ranker Functions

**File:** `apps/api/src/services/feed-ranker.ts`

Delete the following functions (lines 94-145):
- `sportBoost()` (lines 95-106) — replaced by `sportFrequencyBoost()`
- `recencyBoost()` (lines 134-145) — replaced by `recencyDecay()`

Remove their exports. They are not called anywhere in production code (only in tests and their own file).

**File:** `apps/api/src/services/feed-ranker.test.ts`

Delete the test blocks:
- `describe('sportBoost (deprecated)')` (line 166-180)
- `describe('recencyBoost (deprecated)')` (line 196-211)

Verify no other file imports these functions:
```bash
grep -r "sportBoost\|recencyBoost" apps/ packages/ --include="*.ts" --include="*.tsx"
```

#### 9.2 Align React Versions

**Current state:**
- `apps/web/package.json`: `"react": "^19.2.4"`, `"react-dom": "^19.2.4"`
- `apps/mobile/package.json`: `"react": "^19.1.0"`, `"react-dom": "^19.1.0"`

**Action:**
1. Check Expo SDK 54 compatibility with React 19.2.x by reviewing `expo` peer dependencies
2. If compatible: update `apps/mobile/package.json` to `"react": "^19.2.4"`, `"react-dom": "^19.2.4"`
3. If NOT compatible: document the constraint in CLAUDE.md under "App movil (Expo) — notas criticas" with the specific Expo SDK 54 React version requirement. Pin web to the same version mobile uses.
4. Run `npm install` from root to update lockfile
5. Verify `npm run dev:mobile` starts without errors

#### 9.3 Remove skipLibCheck from Web tsconfig

**File:** `apps/web/tsconfig.json` (line 10)

1. Remove `"skipLibCheck": true` from `compilerOptions`
2. Run `cd apps/web && npx tsc --noEmit` to surface hidden type errors
3. Fix all resulting type errors (likely from Tailwind CSS v4, Next.js 16, or `@types/react` mismatches)
4. If certain errors come from `node_modules` types that are genuinely broken upstream, add targeted `// @ts-expect-error` comments with explanations OR add specific packages to `exclude` in tsconfig — do NOT re-add blanket `skipLibCheck`

#### 9.4 Fix Hardcoded Locale in Push Notification Jobs

Three cron jobs hardcode `'es'` as the locale for push notification messages instead of using each user's stored `locale` preference.

**File 1:** `apps/api/src/jobs/generate-daily-missions.ts` (line 36-38)
```typescript
// BEFORE:
title: t('push.mission_ready_title', 'es'),
body: t('push.mission_ready_body', 'es').replace('{rarity}', mission.rewardRarity || 'common'),

// AFTER — load user.locale in the query:
// Update the user query (find the prisma.user.findMany call above) to include `locale` in select
title: t('push.mission_ready_title', user.locale || 'es'),
body: t('push.mission_ready_body', user.locale || 'es').replace('{rarity}', mission.rewardRarity || 'common'),
```

**File 2:** `apps/api/src/jobs/sync-feeds.ts` (line 44-45)
```typescript
// BEFORE:
title: t('push.team_news_title', 'es').replace('{team}', team),

// AFTER — load user locale in the query (add `locale` to select on line 37):
// Group users by locale, send per-locale messages:
// For each locale group: t('push.team_news_title', locale).replace('{team}', team)
```

**File 3:** `apps/api/src/jobs/generate-daily-quiz.ts` (line 201-203)
```typescript
// BEFORE:
title: t('push.quiz_ready_title', 'es'),
body: t('push.quiz_ready_body', 'es'),

// AFTER — group users by locale:
// Update query on line 193 to select `locale`
// Group users by locale, send per-locale batch
```

**Implementation pattern for sync-feeds.ts and generate-daily-quiz.ts:**
These jobs currently send a single push to all users. After the fix, group users by `locale` and call `sendPushToUsers` once per locale group:
```typescript
const users = await prisma.user.findMany({
  where: { pushEnabled: true },
  select: { id: true, locale: true },
});
const byLocale = new Map<string, string[]>();
for (const u of users) {
  const loc = u.locale || 'es';
  if (!byLocale.has(loc)) byLocale.set(loc, []);
  byLocale.get(loc)!.push(u.id);
}
for (const [locale, userIds] of byLocale) {
  await sendPushToUsers(userIds, {
    title: t('push.quiz_ready_title', locale),
    body: t('push.quiz_ready_body', locale),
    data: { screen: 'Quiz' },
  }, 'dailyQuiz');
}
```

#### 9.5 Optimize CI Pipeline — Deduplicate Prisma Generate

**File:** `.github/workflows/ci.yml`

**Current state:** `npx prisma generate` runs in 4 jobs (lint, test, build-api, build-web) — lines 25, 42, 58, 74.

**Target:** Run `prisma generate` once and cache the output.

**Implementation:**

```yaml
jobs:
  setup:
    name: Setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Generate Prisma client
        run: cd apps/api && npx prisma generate
      - name: Cache node_modules with Prisma client
        uses: actions/cache/save@v4
        with:
          path: |
            node_modules
            apps/api/node_modules
            apps/web/node_modules
            packages/shared/node_modules
          key: deps-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-prisma

  lint:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    needs: [setup]
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
            packages/shared/node_modules
          key: deps-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-prisma
      - name: Typecheck API
        run: cd apps/api && npx tsc --noEmit
      - name: Typecheck Web
        run: cd apps/web && npx tsc --noEmit

  # ... test, build-api, build-web follow the same pattern: needs [setup], restore cache, no prisma generate
```

This eliminates 3 redundant `prisma generate` runs and 3 redundant `npm ci` runs (replaced with cache restore).

---

## Acceptance Criteria

### Feature 6: PostgreSQL Migration

- [ ] PostgreSQL 16 container starts via `docker compose up -d postgres` and passes health check
- [ ] `schema.prisma` provider is `postgresql`; `DATABASE_URL` points to PostgreSQL
- [ ] `User.favoriteSports` and `User.selectedFeeds` are `String[]` in schema; no `JSON.parse`/`JSON.stringify` in code for these fields
- [ ] `QuizQuestion.options` is `String[]` in schema; quiz routes and seed updated
- [ ] `User.pushPreferences` is `Json?` in schema
- [ ] `ParentalProfile.allowedSports`, `allowedFeeds`, `allowedFormats` are `String[]`
- [ ] `TeamStats.recentResults` is `Json`, `TeamStats.nextMatch` is `Json?`
- [ ] Trending endpoint (`GET /api/news/trending`) uses PostgreSQL `GROUP BY` + `HAVING` — no in-memory aggregation
- [ ] Composite indexes exist on `NewsItem(sport, safetyStatus, publishedAt)`, `ActivityLog(userId, type, createdAt)`, `Reel(sport, safetyStatus, publishedAt)`
- [ ] All 274+ tests pass against PostgreSQL
- [ ] Seed script completes without errors
- [ ] `npm run dev:api` starts and `/api/health` returns 200
- [ ] Migration documentation updated in `docs/`
- [ ] Rollback via `migrate-to-postgres.sh --rollback` still works

### Feature 8: Error Handler

- [ ] `apps/api/src/errors/index.ts` exports `AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`
- [ ] Each error class has `statusCode`, `code`, `message`, and optional `details`
- [ ] Error handler returns `{ error: { code, message, details?, stack? } }` format
- [ ] Stack trace included only when `NODE_ENV !== 'production'`
- [ ] Prisma errors P2002, P2025, P2003 are mapped to appropriate error classes
- [ ] Zod validation errors are caught and returned as `ValidationError` with field details
- [ ] Sentry receives only 5xx errors with `userId`, `route`, `method` context
- [ ] 4xx errors are NOT sent to Sentry
- [ ] `ERROR_CODES` constant exported from `packages/shared/src/constants/errors.ts`
- [ ] `KID_FRIENDLY_ERRORS` extended with `auth_required`, `too_fast`, `forbidden` entries
- [ ] i18n keys for new kid-friendly errors added to `es.json` and `en.json`
- [ ] All existing route files migrated to throw error classes instead of inline `res.status().json()`
- [ ] At least the following routes are migrated: news, reels, quiz, users, parents, reports, missions, auth
- [ ] Error handler tests cover all error types (400, 401, 403, 404, 409, 429, 500)

### Feature 9: Code Cleanup

- [ ] `sportBoost()` and `recencyBoost()` deleted from `feed-ranker.ts`
- [ ] Associated test blocks deleted from `feed-ranker.test.ts`
- [ ] No file in the codebase imports `sportBoost` or `recencyBoost`
- [ ] React version is identical in `apps/web/package.json` and `apps/mobile/package.json`
- [ ] If Expo SDK 54 constrains React version, constraint is documented in CLAUDE.md
- [ ] `skipLibCheck: true` removed from `apps/web/tsconfig.json`
- [ ] `npx tsc --noEmit` passes in `apps/web/` without `skipLibCheck`
- [ ] `generate-daily-missions.ts` uses `user.locale` for push notification messages
- [ ] `sync-feeds.ts` groups users by locale for team news push notifications
- [ ] `generate-daily-quiz.ts` groups users by locale for quiz ready push notifications
- [ ] CI workflow runs `prisma generate` exactly once (in a shared setup job)
- [ ] CI jobs restore dependencies from cache instead of running redundant `npm ci` + `prisma generate`
- [ ] All 274+ tests still pass after all cleanup changes

---

## Technical Requirements

### Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 (via Docker) | Production database |
| prisma | ^6.x (existing) | ORM — NO upgrade to v7 |
| @prisma/client | ^6.x (existing) | Generated client |
| Docker + Docker Compose | Any recent | PostgreSQL container |

No new npm dependencies required. All changes use existing packages.

### Database

- PostgreSQL 16 (Alpine) via existing `apps/api/docker-compose.yml`
- Connection string: `postgresql://sportykids:sportykids@localhost:5432/sportykids`
- Volume: `sportykids-pgdata` (persistent across restarts)
- Health check: `pg_isready -U sportykids`

### Environment Variables

No new environment variables. Existing `DATABASE_URL` changes from `file:./dev.db` to the PostgreSQL connection string.

### File Changes Summary

**New files:**
- `apps/api/src/errors/index.ts` — Error class definitions

**Modified files (Feature 6):**
- `apps/api/prisma/schema.prisma` — Provider change + native types + indexes
- `apps/api/prisma/seed.ts` — Remove `JSON.stringify()` wrapping for array fields
- `apps/api/src/routes/news.ts` — Trending endpoint: replace in-memory aggregation with SQL
- `apps/api/src/routes/users.ts` — Remove JSON.parse/stringify for user array fields
- `apps/api/src/routes/parents.ts` — Remove JSON.parse/stringify for parental array fields
- `apps/api/src/routes/quiz.ts` — Remove JSON.parse/stringify for quiz options
- `apps/api/src/services/team-stats.ts` — Remove JSON.parse/stringify for recentResults/nextMatch
- `apps/api/src/middleware/parental-guard.ts` — Remove JSON.parse for allowedFormats/allowedSports
- `apps/api/src/services/push-sender.ts` — Remove JSON.parse for pushPreferences
- Any other files using `JSON.parse` on these specific model fields

**Modified files (Feature 8):**
- `apps/api/src/middleware/error-handler.ts` — Complete rewrite
- `packages/shared/src/constants/errors.ts` — Add `ERROR_CODES`, extend `KID_FRIENDLY_ERRORS`
- `packages/shared/src/constants/index.ts` — Export new constants
- `packages/shared/src/i18n/es.json` — Add kid-friendly error i18n keys
- `packages/shared/src/i18n/en.json` — Add kid-friendly error i18n keys
- `apps/api/src/routes/news.ts` — Throw error classes
- `apps/api/src/routes/reels.ts` — Throw error classes
- `apps/api/src/routes/quiz.ts` — Throw error classes
- `apps/api/src/routes/users.ts` — Throw error classes
- `apps/api/src/routes/parents.ts` — Throw error classes
- `apps/api/src/routes/reports.ts` — Throw error classes
- `apps/api/src/routes/missions.ts` — Throw error classes
- `apps/api/src/routes/auth.ts` — Throw error classes
- `apps/api/src/middleware/auth.ts` — Throw AuthenticationError/AuthorizationError
- `apps/api/src/middleware/parental-guard.ts` — Throw appropriate errors
- `apps/api/src/middleware/rate-limiter.ts` — Throw RateLimitError

**Modified files (Feature 9):**
- `apps/api/src/services/feed-ranker.ts` — Delete deprecated functions
- `apps/api/src/services/feed-ranker.test.ts` — Delete deprecated test blocks
- `apps/mobile/package.json` — Align React version (or document constraint)
- `apps/web/tsconfig.json` — Remove `skipLibCheck: true`
- `apps/api/src/jobs/generate-daily-missions.ts` — Use user.locale
- `apps/api/src/jobs/sync-feeds.ts` — Group by user.locale
- `apps/api/src/jobs/generate-daily-quiz.ts` — Group by user.locale
- `.github/workflows/ci.yml` — Deduplicate prisma generate

**Documentation updates:**
- `docs/es/` and `docs/en/` — Migration guide updates
- `CLAUDE.md` — Update if React version constraint discovered

---

## Implementation Decisions

### ID-1: Error classes live in apps/api only

Error class definitions (`AppError`, `ValidationError`, etc.) are **API-only** code in `apps/api/src/errors/`. The shared package (`packages/shared`) only exports:
- `ERROR_CODES` — string constants for machine-readable error codes
- `KID_FRIENDLY_ERRORS` — mapping from error code to i18n keys for child-friendly UI messages

**Rationale:** Error classes contain HTTP semantics (status codes) that are server concerns. Frontends only need the string codes to look up UI messages.

### ID-2: PostgreSQL as default provider, SQLite support dropped

After migration, `schema.prisma` provider is `postgresql`. The `migrate-to-postgres.sh --rollback` script remains available, but SQLite is no longer the development default.

**Rationale:** Maintaining dual-provider compatibility adds complexity (JSON string parsing, in-memory aggregation workarounds). Clean break simplifies the codebase.

### ID-3: Single Prisma migration for all native type changes

All field type changes (String to String[], String to Json) are combined into one migration named `postgres_native_types`, run after the initial provider switch.

**Rationale:** Avoids a chain of small migrations. All type changes are logically related (leveraging PostgreSQL native types).

### ID-4: Prisma groupBy over raw SQL for trending endpoint

Use Prisma's `groupBy` API instead of `$queryRaw` for the trending endpoint.

**Rationale:** Type safety, no raw SQL injection risk, consistent with the rest of the codebase. Prisma's `groupBy` with `having` works correctly on PostgreSQL.

### ID-5: Push notification locale grouping pattern

For jobs that send bulk push notifications, group users by `locale` and send one `sendPushToUsers` call per locale group rather than one call per user.

**Rationale:** Minimizes the number of push API calls while ensuring each user gets messages in their language.

### ID-6: CI uses cache/save and cache/restore (not the combined cache action)

The setup job uses `actions/cache/save` and downstream jobs use `actions/cache/restore`. This is explicit and avoids the combined `actions/cache` action's auto-save-on-miss behavior which could produce stale caches.

**Rationale:** Deterministic caching: the setup job always produces a fresh cache; downstream jobs always consume it.

### ID-7: skipLibCheck removal strategy

If removing `skipLibCheck` surfaces type errors from third-party packages (not our code), the fix strategy is:
1. First try: update the offending `@types/*` package
2. Second: add the specific declaration file to `exclude` in tsconfig
3. Last resort: add targeted `// @ts-expect-error` with a comment linking to the upstream issue

**Never** re-add blanket `skipLibCheck: true`.

---

## Testing Decisions

### TD-1: Test database strategy

All tests run against a **PostgreSQL test database**. Update the test configuration to use a separate database (e.g., `sportykids_test`) or use Prisma's `--force-reset` to ensure clean state. The existing Vitest setup should be updated in `apps/api/vitest.config.ts` or test setup files.

### TD-2: Error handler unit tests

Create `apps/api/src/middleware/error-handler.test.ts` with tests for:
- Each `AppError` subclass returns correct status code and response format
- Prisma `P2002` error maps to 409 Conflict
- Prisma `P2025` error maps to 404 Not Found
- Prisma `P2003` error maps to 400 Validation Error
- Zod validation error maps to 400 with field details
- Unknown errors return 500 with no stack trace when `NODE_ENV=production`
- Unknown errors return 500 with stack trace when `NODE_ENV=development`
- Sentry is called only for 5xx errors (mock Sentry)

### TD-3: Error class unit tests

Create `apps/api/src/errors/errors.test.ts` with tests for:
- Each error class has correct `statusCode`, `code`, `name`
- `details` parameter is optional and preserved
- Errors are instances of both their class and `AppError`
- Errors are instances of `Error`

### TD-4: Feed ranker test updates

After deleting `sportBoost` and `recencyBoost` tests, verify remaining test count. The `sportFrequencyBoost` and `recencyDecay` tests must still pass and provide equivalent coverage.

### TD-5: Trending endpoint integration test

Add or update the trending endpoint test to verify the `GROUP BY` query returns correct results. Seed activity logs, verify threshold filtering works, verify ordering by count descending.

### TD-6: Locale-aware push notification tests

For each of the three fixed jobs, add test cases verifying:
- Users with `locale: 'en'` receive English push notification text
- Users with `locale: 'es'` receive Spanish push notification text
- Users without a locale default to `'es'`

### TD-7: Test count target

After all changes, the test suite should have **at least 274 passing tests** (current baseline). New tests for error handling should add approximately 15-20 tests, offset by ~15 deleted deprecated function tests, for a net increase.

---

## Out of Scope

- **Data migration from SQLite to PostgreSQL**: This PRD covers a fresh PostgreSQL setup with seed data. Migrating existing SQLite production data (if any) is a separate task.
- **Redis migration**: Redis is already optional and working. No changes needed.
- **OAuth implementation**: Google and Apple Sign In remain as 501 stubs.
- **Frontend error handling changes**: Frontend components (`ErrorState.tsx`) already use `KID_FRIENDLY_ERRORS` and `getErrorType()`. No frontend code changes needed beyond the shared package updates.
- **Rate limiter rewrite**: The existing `express-rate-limit` setup works. We only add `RateLimitError` throw capability; the rate limiter middleware itself is not rewritten.
- **Mobile app build verification**: Expo builds are not tested in CI currently and remain out of scope.
- **Performance benchmarking**: We add indexes but do not run formal benchmarks.

## Future Considerations

- **PostgreSQL connection pooling**: For production, add PgBouncer or Prisma Accelerate for connection pooling. Not needed for beta with 5-10 families.
- **Database-level row security**: PostgreSQL supports row-level security policies that could enforce parental restrictions at the database layer.
- **Error tracking dashboard**: With structured error codes flowing to Sentry, build a dashboard of error frequency by code to identify UX pain points.
- **Request ID middleware**: Add a `requestId` (UUID) to each request, include in error responses and Sentry context, for end-to-end tracing.
- **Prisma Pulse / real-time**: PostgreSQL enables Prisma Pulse for real-time subscriptions — useful for live score updates.
- **CI matrix testing**: Test against both PostgreSQL 15 and 16 to ensure forward compatibility.
- **Automated locale coverage**: Lint rule to ensure every `t()` call uses a variable locale, not a hardcoded string.
