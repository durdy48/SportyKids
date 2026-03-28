# PRD: Production Readiness — PostgreSQL, Redis Cache & OAuth Preparation

**Feature**: Configurable production infrastructure (database, cache, auth providers)
**Priority**: HIGH
**Estimated effort**: 3-4 days
**Date**: 2026-03-27

---

## 1. Overview

SportyKids currently runs on SQLite with an in-memory cache and email/password auth. This works perfectly for development and the beta test with 5-10 families. However, production deployment requires PostgreSQL for durability, Redis for multi-instance caching, and OAuth for frictionless sign-up.

This PRD adds **configurable** production support. Every change is opt-in via environment variables. Zero-config defaults remain identical to today: SQLite database, in-memory cache, no OAuth. A developer cloning the repo and running `npm run dev:api` sees no difference.

---

## 2. Problem Statement

- **SQLite is single-writer**: Under concurrent load from multiple families, SQLite's write lock causes `SQLITE_BUSY` errors. PostgreSQL handles concurrent writes natively.
- **InMemoryCache is single-process**: If the API scales to multiple instances (PM2 cluster, Kubernetes pods), each instance has its own cache — leading to stale data and duplicated memory usage. Redis provides a shared cache layer.
- **Email/password only**: Parents must create yet another account. Google and Apple sign-in reduce onboarding friction, especially on mobile devices where these providers offer one-tap authentication.
- **No `.env.example` completeness**: The current `.env.example` documents AI variables but omits cache, auth, and monitoring configuration, making setup error-prone for new contributors.

---

## 3. Goals

| ID | Goal | Metric |
|----|------|--------|
| G1 | PostgreSQL works as a drop-in replacement via `DATABASE_URL` | API starts and passes all existing tests with PostgreSQL |
| G2 | Redis cache is selectable via `CACHE_PROVIDER=redis` | Cache hit/miss stats work identically; fallback to memory on connection failure |
| G3 | OAuth routes exist as documented placeholders | `GET /api/auth/google` and `GET /api/auth/apple` return 501 with clear message |
| G4 | `.env.example` documents every environment variable | New contributor can configure any feature by reading `.env.example` alone |
| G5 | Zero breaking changes | `npm run dev:api` with no env changes works exactly as before |
| G6 | Test coverage for all new code | New services and routes have unit tests |

---

## 4. Target Users

| User | Impact |
|------|--------|
| Developer (self-hosting) | Can choose SQLite or PostgreSQL via one env var; cache via another |
| DevOps / deployment | Redis + PostgreSQL config documented for Docker, Kubernetes, fly.io |
| Parents | (Future) Google/Apple sign-in reduces account creation friction |
| Kids | No visible change — same app experience regardless of backend |

---

## 5. Core Features

### 5.1 PostgreSQL Support (Configurable)

#### 5.1.1 Strategy

Prisma 6 does not support multi-provider in a single schema file. The approach is:

1. **Keep `provider = "sqlite"` as the default** in `apps/api/prisma/schema.prisma`.
2. **Switching to PostgreSQL** requires exactly two changes: update `provider` to `"postgresql"` in schema.prisma and set `DATABASE_URL` to a PostgreSQL connection string.
3. **Automate the switch** via an improved migration script (`apps/api/scripts/migrate-to-postgres.sh`).
4. **Document clearly** in `.env.example` and a comment block in `schema.prisma`.

This is the safest approach given the Prisma v6 constraint (v7 is incompatible with this project).

#### 5.1.2 Migration Script Improvements

Update `apps/api/scripts/migrate-to-postgres.sh` to:

- Verify Docker is running and PostgreSQL container is healthy before proceeding.
- Back up `schema.prisma` before modification.
- Run `prisma migrate dev` with a named migration (`init_postgresql`).
- Run `prisma generate` to rebuild the client.
- Run seed (`npx tsx prisma/seed.ts`) after migration.
- Provide a rollback command in the output.

#### 5.1.3 Docker Compose

The existing `apps/api/docker-compose.yml` already provides PostgreSQL 16 with health checks. Add a Redis service to the same file:

```yaml
services:
  postgres:
    # ... (existing, unchanged)

  redis:
    image: redis:7-alpine
    container_name: sportykids-redis
    ports:
      - "6379:6379"
    volumes:
      - sportykids-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  sportykids-pgdata:
  sportykids-redis-data:
```

#### 5.1.4 JSON String Fields

SQLite stores arrays as JSON strings (`favoriteSports`, `selectedFeeds`, `allowedSports`, etc.). When running on PostgreSQL, these fields continue to work as `text` columns with `JSON.parse`/`JSON.stringify` — no application code changes needed. A future enhancement (out of scope) would convert them to native `Json` or `String[]` types.

#### 5.1.5 Schema Documentation

Add a comment block at the top of `schema.prisma`:

```prisma
// =============================================================================
// SportyKids Database Schema
// =============================================================================
//
// Default: SQLite (provider = "sqlite", DATABASE_URL = "file:./dev.db")
//
// For PostgreSQL:
//   1. Change provider below to "postgresql"
//   2. Set DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids"
//   3. Run: npx prisma migrate dev
//   4. Run: npx prisma generate
//
// See: scripts/migrate-to-postgres.sh for automated migration.
// IMPORTANT: Do NOT upgrade to Prisma v7 — it breaks datasource url config.
// =============================================================================
```

---

### 5.2 Redis Cache (Optional)

#### 5.2.1 Cache Interface

Extract a formal `CacheProvider` interface from the existing `InMemoryCache` class:

```typescript
// apps/api/src/services/cache.ts

export interface CacheProvider {
  get<T>(key: string): T | undefined | Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): void | Promise<void>;
  has(key: string): boolean | Promise<boolean>;
  invalidate(key: string): boolean | Promise<boolean>;
  invalidatePattern(prefix: string): number | Promise<number>;
  clear(): void | Promise<void>;
  readonly size: number | Promise<number>;
  readonly stats: CacheStats | Promise<CacheStats>;
}

export interface CacheStats {
  size: number;
  maxEntries: number;
  hits: number;
  misses: number;
  hitRate: string;
}
```

The interface methods return `T | Promise<T>` to support both synchronous (memory) and asynchronous (Redis) implementations without forcing `await` on the memory path.

#### 5.2.2 InMemoryCache (Refactored)

The existing `InMemoryCache` class implements `CacheProvider`. No behavioral changes — only add `implements CacheProvider` to the class declaration.

#### 5.2.3 RedisCache Implementation

New file: `apps/api/src/services/redis-cache.ts`

```typescript
import type { CacheProvider, CacheStats } from './cache';
```

- Uses `ioredis` package for Redis connection.
- Constructor accepts `redisUrl: string` and `maxEntries: number`.
- `get`/`set`/`has`/`invalidate` use Redis `GET`/`SETEX`/`EXISTS`/`DEL` commands.
- `invalidatePattern` uses Redis `SCAN` with `MATCH` (not `KEYS` — safe for production).
- `clear` uses `FLUSHDB` (scoped to the configured database).
- Stats tracked via Redis `INCR` on `sportykids:cache:hits` and `sportykids:cache:misses` keys.
- All values serialized/deserialized with `JSON.stringify`/`JSON.parse`.
- Key prefix: `sportykids:` to avoid collisions in shared Redis instances.

#### 5.2.4 Cache Factory

New function in `apps/api/src/services/cache.ts`:

```typescript
export function createCache(): CacheProvider {
  const provider = process.env.CACHE_PROVIDER || 'memory';

  if (provider === 'redis') {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      const { RedisCache } = require('./redis-cache');
      const redis = new RedisCache(redisUrl);
      console.log('[CACHE] Using Redis cache:', redisUrl);
      return redis;
    } catch (err) {
      console.warn('[CACHE] Redis unavailable, falling back to InMemoryCache:', (err as Error).message);
      return new InMemoryCache();
    }
  }

  console.log('[CACHE] Using InMemoryCache');
  return new InMemoryCache();
}
```

- Default: `memory` (InMemoryCache).
- `redis`: attempts connection; falls back to InMemoryCache with a warning if Redis is unreachable.
- Dynamic `require` for `redis-cache` so that `ioredis` is not loaded when not needed (keeps dev dependency optional).

#### 5.2.5 Singleton Update

Replace the current singleton:

```typescript
// Before
export const apiCache = new InMemoryCache(10_000);

// After
export const apiCache: CacheProvider = createCache();
```

The `withCache` middleware and all `CACHE_TTL`/`CACHE_KEYS` constants remain unchanged.

#### 5.2.6 withCache Middleware Update

Since `CacheProvider.get` may return a `Promise`, update `withCache` to handle async:

```typescript
export function withCache(keyPrefix: string, ttlMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = keyPrefix + req.originalUrl;
    const cached = await apiCache.get<{ body: unknown; status: number }>(cacheKey);

    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 300) {
        apiCache.set(cacheKey, { body, status: statusCode }, ttlMs);
      }
      return originalJson(body);
    };

    next();
  };
}
```

#### 5.2.7 ioredis Dependency

Add `ioredis` as an **optional** dependency in `apps/api/package.json`:

```json
"optionalDependencies": {
  "ioredis": "^5.6.0"
}
```

This means `npm install` succeeds even if ioredis cannot be installed (e.g., environments without native build tools). The cache factory handles the missing module gracefully.

---

### 5.3 OAuth Preparation

#### 5.3.1 AuthProvider Type Extension

In `packages/shared/src/types/`, extend the `authProvider` union to include `'google'` and `'apple'`:

```typescript
export type AuthProvider = 'anonymous' | 'email' | 'google' | 'apple';
```

The Prisma schema uses `String` for `authProvider`, so no migration is needed — the new values are valid strings.

#### 5.3.2 Placeholder Routes

Add to `apps/api/src/routes/auth.ts`:

```typescript
// GET /api/auth/google — OAuth placeholder (not implemented)
router.get('/google', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Google OAuth is not yet available. Use POST /api/auth/register for email/password auth.',
    provider: 'google',
  });
});

// GET /api/auth/google/callback — OAuth callback placeholder
router.get('/google/callback', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Google OAuth callback is not yet available.',
    provider: 'google',
  });
});

// GET /api/auth/apple — OAuth placeholder (not implemented)
router.get('/apple', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Apple Sign-In is not yet available. Use POST /api/auth/register for email/password auth.',
    provider: 'apple',
  });
});

// GET /api/auth/apple/callback — OAuth callback placeholder
router.get('/apple/callback', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Apple Sign-In callback is not yet available.',
    provider: 'apple',
  });
});
```

#### 5.3.3 OAuth Implementation Plan (Documentation Only)

Add a code comment in `auth.ts` documenting the planned OAuth flow:

```
// OAuth Implementation Plan (future PRD):
//
// Web (Next.js):
//   - NextAuth.js v5 with Google and Apple providers
//   - Callback redirects to /api/auth/{provider}/callback
//   - Server creates/links User with authProvider='google'|'apple'
//
// Mobile (Expo):
//   - expo-auth-session for Google (WebBrowser redirect)
//   - expo-apple-authentication for Apple (native iOS flow)
//   - Both send id_token to /api/auth/{provider}/callback
//   - Server validates token, creates/links User
//
// Required env vars:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
```

---

### 5.4 Environment Configuration

#### 5.4.1 Updated .env.example

Replace `apps/api/.env.example` with a comprehensive file documenting all variables:

```bash
# =============================================================================
# SportyKids API — Environment Variables
# =============================================================================
# Copy this file to .env and adjust values for your environment.
# Lines starting with # are comments. Uncomment to activate.

# =============================================================================
# Database
# =============================================================================
# Default: SQLite (zero setup, perfect for development)
DATABASE_URL="file:./dev.db"

# PostgreSQL (production):
# 1. Start PostgreSQL: docker compose up -d postgres
# 2. Change schema.prisma provider to "postgresql"
# 3. Uncomment the line below and comment out the SQLite line above
# 4. Run: npx prisma migrate dev && npx prisma generate
# DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids"

# =============================================================================
# Cache
# =============================================================================
# Provider: "memory" (default, single-process) or "redis" (multi-instance)
CACHE_PROVIDER=memory

# Redis URL (only used when CACHE_PROVIDER=redis):
# Start Redis: docker compose up -d redis
# REDIS_URL=redis://localhost:6379

# =============================================================================
# Authentication
# =============================================================================
# REQUIRED in production. In development, defaults are used automatically.
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=dev-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production

# =============================================================================
# OAuth (future — not yet implemented, placeholders only)
# =============================================================================
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# APPLE_CLIENT_ID=
# APPLE_TEAM_ID=
# APPLE_KEY_ID=
# APPLE_PRIVATE_KEY=

# =============================================================================
# AI Provider Configuration
# =============================================================================
# Provider: "ollama" (free, local), "openrouter" (free tier, cloud), "anthropic" (paid)
AI_PROVIDER=ollama

# --- Ollama (default — free, local, no API key needed) ---
# Install: brew install ollama
# Pull models: ollama pull llama3.2:3b && ollama pull gemma2:9b
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL_MODERATION=llama3.2:3b
OLLAMA_MODEL_GENERATION=gemma2:9b

# --- OpenRouter (free tier — cloud alternative) ---
# Sign up at https://openrouter.ai for a free API key
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL_MODERATION=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_MODEL_GENERATION=google/gemma-2-9b-it:free

# --- Anthropic (production — paid) ---
# Add @anthropic-ai/sdk to dependencies: npm install @anthropic-ai/sdk
ANTHROPIC_API_KEY=
AI_MODEL_MODERATION=claude-haiku-4-5-20251001
AI_MODEL_GENERATION=claude-sonnet-4-6

# --- Shared AI config ---
AI_MAX_RETRIES=3
AI_RETRY_DELAY_MS=1000
AI_RATE_LIMIT_RPM=30

# =============================================================================
# Monitoring (optional — disabled by default)
# =============================================================================
# Sentry error tracking
# SENTRY_DSN=https://your-key@sentry.io/project-id

# PostHog analytics (privacy-first)
# POSTHOG_API_KEY=phc_your_key
# POSTHOG_HOST=https://eu.i.posthog.com

# =============================================================================
# Push Notifications (optional)
# =============================================================================
# Expo push notifications are handled via expo-server-sdk.
# No additional env var needed — tokens are stored per-user in PushToken model.
```

---

## 6. Acceptance Criteria

### 6.1 PostgreSQL

- [ ] **AC-PG1**: Running `bash apps/api/scripts/migrate-to-postgres.sh` with PostgreSQL running switches the project to PostgreSQL and creates all tables.
- [ ] **AC-PG2**: All existing API tests pass against PostgreSQL (when configured).
- [ ] **AC-PG3**: `schema.prisma` contains clear documentation on how to switch providers.
- [ ] **AC-PG4**: Docker compose includes both PostgreSQL and Redis services with health checks.
- [ ] **AC-PG5**: Migration script backs up `schema.prisma` before modification and provides rollback instructions.

### 6.2 Redis Cache

- [ ] **AC-RD1**: Setting `CACHE_PROVIDER=memory` (or omitting it) uses `InMemoryCache` — identical to current behavior.
- [ ] **AC-RD2**: Setting `CACHE_PROVIDER=redis` with a valid `REDIS_URL` uses `RedisCache`.
- [ ] **AC-RD3**: Setting `CACHE_PROVIDER=redis` with no Redis running falls back to `InMemoryCache` with a console warning.
- [ ] **AC-RD4**: `RedisCache` implements the same `CacheProvider` interface as `InMemoryCache`.
- [ ] **AC-RD5**: `withCache` middleware works with both sync (memory) and async (Redis) cache providers.
- [ ] **AC-RD6**: `apiCache.stats` returns hit/miss data for both providers.
- [ ] **AC-RD7**: `ioredis` is an optional dependency — `npm install` succeeds without it.

### 6.3 OAuth

- [ ] **AC-OA1**: `GET /api/auth/google` returns 501 with a JSON body containing `error`, `message`, and `provider`.
- [ ] **AC-OA2**: `GET /api/auth/apple` returns 501 with a JSON body containing `error`, `message`, and `provider`.
- [ ] **AC-OA3**: `GET /api/auth/google/callback` and `GET /api/auth/apple/callback` return 501.
- [ ] **AC-OA4**: `AuthProvider` type in shared package includes `'google'` and `'apple'`.

### 6.4 Environment

- [ ] **AC-EN1**: `.env.example` documents every environment variable used by the API.
- [ ] **AC-EN2**: A fresh clone with only `cp .env.example .env` starts the API successfully (SQLite + memory cache, no external services).

---

## 7. Technical Requirements

### 7.1 Dependencies

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `ioredis` | `^5.6.0` | optionalDependencies | Redis client for `RedisCache` |

No other new dependencies. The cache interface, factory, and OAuth placeholders use only existing packages.

### 7.2 File Changes

| File | Change |
|------|--------|
| `apps/api/src/services/cache.ts` | Add `CacheProvider` interface, `CacheStats` type, `createCache()` factory. Update `apiCache` singleton. Update `withCache` to support async. `InMemoryCache` implements `CacheProvider`. |
| `apps/api/src/services/redis-cache.ts` | **New file.** `RedisCache` class implementing `CacheProvider` via `ioredis`. |
| `apps/api/src/routes/auth.ts` | Add 4 placeholder routes (google, google/callback, apple, apple/callback). Add OAuth plan comment. |
| `apps/api/prisma/schema.prisma` | Add documentation comment block at top. No schema changes. |
| `apps/api/docker-compose.yml` | Add `redis` service and `sportykids-redis-data` volume. |
| `apps/api/scripts/migrate-to-postgres.sh` | Improve with backup, health check, seed step, rollback instructions. |
| `apps/api/.env.example` | Complete rewrite with all environment variables documented. |
| `apps/api/package.json` | Add `ioredis` to `optionalDependencies`. |
| `packages/shared/src/types/` | Add `AuthProvider` type with `'google' | 'apple'` values. |

### 7.3 No Breaking Changes

- Default `CACHE_PROVIDER` is `memory` — existing `InMemoryCache` behavior unchanged.
- Default `DATABASE_URL` is `file:./dev.db` — SQLite unchanged.
- No Prisma migration generated — schema.prisma content is unchanged (only comments added).
- `withCache` becomes async but Express handles async middleware transparently.
- OAuth routes are additive — no existing routes modified.

---

## 8. Implementation Decisions

| Decision | Rationale |
|----------|-----------|
| Keep `provider = "sqlite"` as default in schema.prisma | Prisma v6 does not support multi-provider. Switching requires a one-line edit + migrate. This is simpler and less error-prone than env-conditional schema generation. |
| `ioredis` as optionalDependency (not dependency) | Developers who don't need Redis shouldn't have to install it. The cache factory handles the missing module with a dynamic `require`. |
| Redis fallback to InMemoryCache | Production resilience: a Redis outage degrades to single-process cache rather than crashing the API. |
| `SCAN` instead of `KEYS` for pattern invalidation | `KEYS` blocks the Redis event loop on large datasets. `SCAN` is cursor-based and non-blocking. |
| OAuth as 501 placeholders, not stubs | Returning 501 (Not Implemented) is semantically correct and signals to mobile/web clients that the feature exists but is pending. |
| `CacheProvider` interface with `T | Promise<T>` returns | Allows InMemoryCache to remain synchronous (no overhead) while RedisCache returns promises. The `withCache` middleware `await`s both transparently. |
| Key prefix `sportykids:` in Redis | Prevents key collisions when Redis is shared across services. |
| JSON string fields unchanged for PostgreSQL | Converting `favoriteSports` etc. to native arrays requires updating all service code. The current `JSON.parse`/`JSON.stringify` pattern works identically on PostgreSQL `text` columns. Conversion is a separate, lower-priority task. |

---

## 9. Testing Decisions

### 9.1 New Test Files

#### `apps/api/src/__tests__/services/cache.test.ts`

- **InMemoryCache implements CacheProvider**: Verify `get`, `set`, `has`, `invalidate`, `invalidatePattern`, `clear`, `size`, `stats`.
- **createCache() with no env**: Returns `InMemoryCache`.
- **createCache() with CACHE_PROVIDER=memory**: Returns `InMemoryCache`.
- **createCache() with CACHE_PROVIDER=redis (no Redis running)**: Returns `InMemoryCache` with console warning.
- **withCache middleware (memory)**: Caches successful responses, skips error responses, serves from cache on second request.
- **withCache middleware (async mock)**: Works correctly with a mock async `CacheProvider`.

#### `apps/api/src/__tests__/services/redis-cache.test.ts`

- **RedisCache implements CacheProvider interface**: Type-level check (compile-time).
- **get/set round-trip**: Mock ioredis, verify `SETEX` called with correct TTL, `GET` returns deserialized value.
- **has**: Returns `true` for existing keys, `false` for missing.
- **invalidate**: Calls `DEL`, returns `true` if key existed.
- **invalidatePattern**: Uses `SCAN` with `MATCH`, deletes matching keys.
- **clear**: Calls `FLUSHDB`.
- **stats**: Returns hit/miss counts from Redis keys.
- **Connection error handling**: Constructor logs warning and throws (factory catches this).

#### `apps/api/src/__tests__/routes/auth-oauth.test.ts`

- **GET /api/auth/google**: Returns 501 with `{ error: 'Not Implemented', provider: 'google' }`.
- **GET /api/auth/apple**: Returns 501 with `{ error: 'Not Implemented', provider: 'apple' }`.
- **GET /api/auth/google/callback**: Returns 501.
- **GET /api/auth/apple/callback**: Returns 501.

### 9.2 Existing Tests

All existing tests must continue to pass unchanged. The `InMemoryCache` behavior is identical — only the class now declares `implements CacheProvider`.

### 9.3 Test Strategy for PostgreSQL

PostgreSQL integration is tested via the migration script, not via unit tests. The migration script is a manual step (documented in acceptance criteria). CI runs tests against SQLite (the default). A separate CI job could be added to test against PostgreSQL using the docker-compose services, but that is out of scope for this PRD.

---

## 10. Out of Scope

- **Full OAuth implementation**: This PRD only adds placeholder routes and type definitions. The actual Google/Apple OAuth flow (token exchange, user creation, session management) is a separate PRD.
- **JSON to native array migration**: Converting SQLite JSON strings to PostgreSQL native arrays (`String[]`, `Json`) requires updating all service code. Tracked as separate tech debt.
- **Redis Sentinel/Cluster**: Single Redis instance is sufficient for the current scale. High-availability Redis is a future infrastructure concern.
- **Database connection pooling**: Prisma handles connection pooling internally. External poolers (PgBouncer) are not needed at current scale.
- **Multi-schema Prisma generation**: Maintaining separate `schema.sqlite.prisma` and `schema.postgresql.prisma` files adds complexity without proportional benefit given the one-line switch approach.
- **Cache invalidation strategies**: The current TTL-based invalidation is sufficient. Event-driven invalidation (pub/sub) is a future enhancement.
- **Web/mobile OAuth UI**: Frontend changes for Google/Apple sign-in buttons are part of the full OAuth PRD.

---

## 11. Future Considerations

- **Redis pub/sub for cache invalidation**: When running multiple API instances, Redis pub/sub can broadcast cache invalidation events so all instances stay in sync.
- **PostgreSQL-specific features**: Once on PostgreSQL, consider full-text search (`tsvector`), `JSONB` columns for structured queries, and native array fields.
- **OAuth providers expansion**: After Google and Apple, consider adding social login via GitHub (for developer parents) and phone number OTP (for mobile-first markets).
- **Database migration tooling**: A future enhancement could detect `DATABASE_URL` format at startup and warn if schema.prisma provider doesn't match.
- **Redis as session store**: Replace in-memory parental session tokens (5 min TTL) with Redis for multi-instance support.
- **Connection health endpoints**: Extend `/api/health` to report database and cache connectivity status for monitoring dashboards.
