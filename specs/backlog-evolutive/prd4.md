# PRD: Security Hardening — PIN Lockout + Rate Limiting

## 1. Overview

SportyKids is a children's sports news app serving users aged 6-14. The parental PIN system currently has no brute-force protection, and API endpoints lack standardized rate limiting. For a children's app, these are critical security gaps. This feature adds PIN lockout after repeated failed attempts and centralized rate limiting across all API endpoints using `express-rate-limit`.

## 2. Problem Statement

Two security vulnerabilities exist in the current system:

**PIN Brute-Force**: The parental PIN is a 4-digit code (10,000 combinations). The `POST /api/parents/verificar-pin` endpoint has no failed-attempt tracking or lockout mechanism. A determined child (or automated script) could enumerate all PINs in minutes. The `ParentalProfile` model has no `failedAttempts` or `lockedUntil` fields.

**No Rate Limiting**: The API has no standardized rate limiting. The only throttling is a per-user DB-based check on content reports (10/24h) and an internal `SlidingWindowRateLimiter` on AI API calls. All other endpoints -- including auth (login, register), sync triggers, and content feeds -- accept unlimited requests. This exposes the app to denial-of-service, credential stuffing, and resource exhaustion attacks.

## 3. Goals

- **G1**: Prevent PIN brute-force by locking out after 5 consecutive failed attempts for 15 minutes.
- **G2**: Add centralized rate limiting with tiered limits per endpoint category.
- **G3**: Provide kid-friendly error messages for lockout and rate-limit scenarios via i18n.
- **G4**: Make rate-limit thresholds configurable via environment variables.
- **G5**: Zero regressions on existing functionality.

## 4. Target Users

| User | Impact |
|------|--------|
| Kids (6-14) | See friendly error messages when rate-limited or when PIN is locked; cannot brute-force parental PIN |
| Parents | PIN is protected from brute-force; lockout countdown visible in PinInput UI |
| System (API) | Protected from abuse, DoS, and resource exhaustion |

## 5. Core Features

### 5.1 PIN Lockout

#### 5.1.1 Data Model Changes

Add two fields to `ParentalProfile` in `apps/api/prisma/schema.prisma`:

```prisma
model ParentalProfile {
  // ... existing fields ...
  failedAttempts  Int       @default(0)
  lockedUntil     DateTime?
}
```

A Prisma migration is required: `npx prisma migrate dev --name add-pin-lockout-fields`.

#### 5.1.2 PIN Verification Logic

Update `POST /api/parents/verificar-pin` in `apps/api/src/routes/parents.ts`:

```
REQUEST: { userId: string, pin: string }

1. Fetch ParentalProfile by userId
2. If not found → 404

3. CHECK LOCKOUT:
   If profile.lockedUntil !== null AND profile.lockedUntil > now:
     → 423 Locked
     → Body: { error: t('parents.pin_locked', locale), lockedUntil: profile.lockedUntil, remainingSeconds: ceil((lockedUntil - now) / 1000) }
     → RETURN (do not attempt bcrypt compare)

4. COMPARE PIN (bcrypt):
   If PIN is WRONG:
     newFailedAttempts = profile.failedAttempts + 1
     If newFailedAttempts >= 5:
       → UPDATE profile SET failedAttempts = newFailedAttempts, lockedUntil = now + 15 minutes
       → 423 Locked
       → Body: { error: t('parents.pin_locked', locale), lockedUntil: <new lockedUntil>, remainingSeconds: 900 }
     Else:
       → UPDATE profile SET failedAttempts = newFailedAttempts
       → 401 Unauthorized
       → Body: { error: t('parents.pin_incorrect', locale), attemptsRemaining: 5 - newFailedAttempts }
     → RETURN

   If PIN is CORRECT:
     → UPDATE profile SET failedAttempts = 0, lockedUntil = null
     → Generate session token (existing logic)
     → 200 OK with session token
```

Constants (defined at module scope, not env-configurable -- security-sensitive):
- `MAX_PIN_ATTEMPTS = 5`
- `PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000` (15 minutes)

#### 5.1.3 i18n Keys

Add to `packages/shared/src/i18n/es.json`:

```json
{
  "parents.pin_locked": "El PIN esta bloqueado. Intentalo de nuevo en {minutes} minutos.",
  "parents.pin_incorrect": "PIN incorrecto. Te quedan {remaining} intentos.",
  "parents.pin_locked_short": "Bloqueado: {remaining}"
}
```

Add to `packages/shared/src/i18n/en.json`:

```json
{
  "parents.pin_locked": "PIN is locked. Try again in {minutes} minutes.",
  "parents.pin_incorrect": "Wrong PIN. {remaining} attempts remaining.",
  "parents.pin_locked_short": "Locked: {remaining}"
}
```

### 5.2 Rate Limiting

#### 5.2.1 New Dependency

Install `express-rate-limit` in `apps/api/`:

```bash
cd apps/api && npm install express-rate-limit
```

#### 5.2.2 Rate Limiter Middleware

Create `apps/api/src/middleware/rate-limiter.ts`:

```typescript
import rateLimit from 'express-rate-limit';

// Tier definitions
// Key: IP address (req.ip) -- default behavior of express-rate-limit

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute
  max: Number(process.env.RATE_LIMIT_AUTH ?? 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
});

export const pinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PIN ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
});

export const contentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CONTENT ?? 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
});

export const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_SYNC ?? 2),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
});

export const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_DEFAULT ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
});
```

#### 5.2.3 Rate Limit Tiers

| Tier | Endpoints | Max req/min per IP | Env Override |
|------|-----------|-------------------|--------------|
| Auth | `/api/auth/login`, `/api/auth/register` | 5 | `RATE_LIMIT_AUTH` |
| PIN | `/api/parents/verificar-pin` | 10 | `RATE_LIMIT_PIN` |
| Content | `/api/news/*`, `/api/reels/*`, `/api/quiz/*` | 60 | `RATE_LIMIT_CONTENT` |
| Sync | `/api/news/sincronizar`, `/api/teams/sync` | 2 | `RATE_LIMIT_SYNC` |
| Default | All other endpoints | 100 | `RATE_LIMIT_DEFAULT` |

#### 5.2.4 Applying Limiters

In `apps/api/src/index.ts`, apply rate limiters before route registration:

```typescript
import { authLimiter, pinLimiter, contentLimiter, syncLimiter, defaultLimiter } from './middleware/rate-limiter';

// Specific limiters (applied before route handlers)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/parents/verificar-pin', pinLimiter);
app.use('/api/news/sincronizar', syncLimiter);
app.use('/api/teams/sync', syncLimiter);
app.use('/api/news', contentLimiter);
app.use('/api/reels', contentLimiter);
app.use('/api/quiz', contentLimiter);

// Default limiter for everything else
app.use('/api', defaultLimiter);

// Existing route registration
app.use('/api/auth', authRouter);
// ...
```

**Order matters**: Specific limiters are registered before the default limiter. Express matches middleware top-to-bottom, and `express-rate-limit` counts requests per limiter instance. A request to `/api/auth/login` is counted by `authLimiter` (5/min) independently from `defaultLimiter`.

#### 5.2.5 429 Response Format

All rate limit responses return HTTP 429 with:

```json
{
  "error": "Too many requests. Please wait a moment."
}
```

Standard rate-limit headers are included (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) via `standardHeaders: true`.

The error message is static in English from the middleware level. Frontends can detect the 429 status code and show a localized kid-friendly message using `t('errors.rate_limited', locale)`.

#### 5.2.6 i18n Keys for Rate Limiting

Add to `packages/shared/src/i18n/es.json`:

```json
{
  "errors.rate_limited": "Demasiadas peticiones. Espera un momento e intentalo de nuevo."
}
```

Add to `packages/shared/src/i18n/en.json`:

```json
{
  "errors.rate_limited": "Too many requests. Wait a moment and try again."
}
```

### 5.3 PinInput UI Updates

#### 5.3.1 Web (apps/web)

Update the `PinInput` component (or parent component that handles PIN submission) to handle the new response shapes:

- **401 with `attemptsRemaining`**: Show warning message with remaining attempts count.
- **423 with `lockedUntil`**: Show lockout countdown timer. Disable PIN input. Auto-re-enable when lockout expires.
- **429**: Show generic rate-limit message.

#### 5.3.2 Mobile (apps/mobile)

Mirror the same behavior in the mobile `PinInput` / `ParentalControl` screen. Use `expo-haptics` for error feedback on lockout.

## 6. UI Mockups (ASCII)

### 6.1 PIN Input -- Normal State

```
+------------------------------------------+
|           Control Parental                |
|                                           |
|       Introduce el PIN de 4 digitos       |
|                                           |
|          [ _ ] [ _ ] [ _ ] [ _ ]          |
|                                           |
|                                           |
+------------------------------------------+
```

### 6.2 PIN Input -- Wrong PIN (3 attempts remaining)

```
+------------------------------------------+
|           Control Parental                |
|                                           |
|       Introduce el PIN de 4 digitos       |
|                                           |
|          [ _ ] [ _ ] [ _ ] [ _ ]          |
|                                           |
|   !! PIN incorrecto. Te quedan 3          |
|      intentos.                            |
|                                           |
+------------------------------------------+
```

### 6.3 PIN Input -- Wrong PIN (1 attempt remaining)

```
+------------------------------------------+
|           Control Parental                |
|                                           |
|       Introduce el PIN de 4 digitos       |
|                                           |
|          [ _ ] [ _ ] [ _ ] [ _ ]          |
|                                           |
|   !! PIN incorrecto. Te quedan 1          |
|      intentos.                            |
|                                           |
|   (!) Cuidado: el PIN se bloqueara        |
|       tras otro intento fallido.          |
|                                           |
+------------------------------------------+
```

### 6.4 PIN Input -- Locked Out

```
+------------------------------------------+
|           Control Parental                |
|                                           |
|       Introduce el PIN de 4 digitos       |
|                                           |
|          [ - ] [ - ] [ - ] [ - ]          |
|               (disabled)                  |
|                                           |
|   [!] PIN bloqueado                       |
|       Intentalo de nuevo en 14:32         |
|                                           |
|       =====[==========---------]          |
|              progress bar                 |
|                                           |
+------------------------------------------+
```

The countdown timer updates every second. The progress bar fills as time passes. When the timer reaches 0, the input re-enables automatically and the warning disappears.

### 6.5 Rate Limited (429) -- Any Screen

```
+------------------------------------------+
|                                           |
|   [!] Demasiadas peticiones.              |
|       Espera un momento e intentalo       |
|       de nuevo.                           |
|                                           |
|              [ Reintentar ]               |
|                                           |
+------------------------------------------+
```

This is a generic error state that can appear on any screen when a 429 is received.

## 7. Acceptance Criteria

### AC1: PIN Lockout -- Data Model
- [ ] `ParentalProfile` has `failedAttempts Int @default(0)` field
- [ ] `ParentalProfile` has `lockedUntil DateTime?` field
- [ ] Migration runs successfully on existing databases with data
- [ ] Existing ParentalProfile rows get `failedAttempts = 0` and `lockedUntil = null`

### AC2: PIN Lockout -- Behavior
- [ ] Correct PIN returns 200 and resets `failedAttempts` to 0 and `lockedUntil` to null
- [ ] Wrong PIN increments `failedAttempts` and returns 401 with `attemptsRemaining`
- [ ] 5th wrong PIN sets `lockedUntil` to now + 15 minutes and returns 423
- [ ] Requests during lockout return 423 without attempting bcrypt compare
- [ ] After lockout expires, PIN verification works again normally
- [ ] Correct PIN after partial failed attempts (e.g., 3 wrong then 1 correct) resets counter to 0

### AC3: Rate Limiting -- Middleware
- [ ] `express-rate-limit` is installed in `apps/api/package.json`
- [ ] `apps/api/src/middleware/rate-limiter.ts` exports 5 limiter instances
- [ ] Auth endpoints limited to 5 req/min per IP
- [ ] PIN endpoint limited to 10 req/min per IP
- [ ] Content endpoints limited to 60 req/min per IP
- [ ] Sync endpoints limited to 2 req/min per IP
- [ ] Default endpoints limited to 100 req/min per IP
- [ ] All limiters return 429 with error message body
- [ ] Standard rate-limit headers are included in responses

### AC4: Rate Limiting -- Configuration
- [ ] Each tier is configurable via environment variable
- [ ] Default values work when env vars are not set

### AC5: UI -- Lockout Feedback
- [ ] Web PinInput shows remaining attempts on wrong PIN
- [ ] Web PinInput shows lockout countdown on 423 response
- [ ] Web PinInput disables input during lockout
- [ ] Web PinInput re-enables automatically when lockout expires
- [ ] Mobile PinInput mirrors web behavior
- [ ] Mobile PinInput triggers haptic feedback on lockout

### AC6: UI -- Rate Limit Feedback
- [ ] Web shows localized error message on 429 response
- [ ] Mobile shows localized error message on 429 response

### AC7: i18n
- [ ] `parents.pin_locked` key exists in es.json and en.json
- [ ] `parents.pin_incorrect` key exists in es.json and en.json
- [ ] `parents.pin_locked_short` key exists in es.json and en.json
- [ ] `errors.rate_limited` key exists in es.json and en.json

### AC8: No Regressions
- [ ] Existing PIN verification flow works for correct PINs
- [ ] Existing parental session token mechanism unchanged
- [ ] All existing tests pass
- [ ] API health check endpoint is not rate-limited (or uses generous default)

## 8. Technical Requirements

### 8.1 Files Modified

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `failedAttempts` and `lockedUntil` to `ParentalProfile` |
| `apps/api/prisma/migrations/<timestamp>_add_pin_lockout_fields/` | New migration |
| `apps/api/src/routes/parents.ts` | Update `verificar-pin` handler with lockout logic |
| `apps/api/src/middleware/rate-limiter.ts` | **New file** -- rate limiter middleware exports |
| `apps/api/src/index.ts` | Import and apply rate limiters before route registration |
| `apps/api/package.json` | Add `express-rate-limit` dependency |
| `packages/shared/src/i18n/es.json` | Add lockout and rate-limit i18n keys |
| `packages/shared/src/i18n/en.json` | Add lockout and rate-limit i18n keys |
| `apps/web/src/components/PinInput.tsx` | Handle 401/423/429 responses with lockout UI |
| `apps/mobile/src/components/PinInput.tsx` (or equivalent) | Handle 401/423/429 responses with lockout UI |

### 8.2 Files NOT Modified

| File | Reason |
|------|--------|
| `apps/api/src/middleware/auth.ts` | JWT middleware is separate from rate limiting |
| `apps/api/src/middleware/parental-guard.ts` | Enforces restrictions post-auth; not related to PIN lockout |
| `apps/api/src/services/ai-client.ts` | Internal `SlidingWindowRateLimiter` is for AI API calls, not HTTP requests |
| `apps/api/src/routes/reports.ts` | Existing DB-based rate limiting can coexist; no change needed |

### 8.3 New Dependency

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `express-rate-limit` | ^7 | ~15KB | IP-based rate limiting middleware for Express |

No native dependencies. Pure JavaScript. Compatible with Express 5.

### 8.4 Environment Variables (New, Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_AUTH` | `5` | Max auth requests per minute per IP |
| `RATE_LIMIT_PIN` | `10` | Max PIN verification requests per minute per IP |
| `RATE_LIMIT_CONTENT` | `60` | Max content requests per minute per IP |
| `RATE_LIMIT_SYNC` | `2` | Max sync trigger requests per minute per IP |
| `RATE_LIMIT_DEFAULT` | `100` | Max requests per minute per IP for unlisted endpoints |

### 8.5 Security Considerations

- PIN lockout constants (`MAX_PIN_ATTEMPTS = 5`, `PIN_LOCKOUT_DURATION_MS = 15 min`) are hardcoded, not env-configurable. Making lockout duration configurable would allow weakening the protection.
- Rate limiting is IP-based. Behind a reverse proxy, `trust proxy` must be configured in Express for `req.ip` to reflect the real client IP. Add `app.set('trust proxy', 1)` if deploying behind a single proxy.
- The lockout state is stored in the database, not in memory. This means lockout survives server restarts and works across multiple instances.
- Rate-limit state is in-memory per process (default `express-rate-limit` store). For multi-instance deployments, use `rate-limit-redis` as a store adapter (out of scope for this PRD).

## 9. Implementation Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lockout storage | Database (ParentalProfile fields) | Survives restarts; works multi-instance; PIN is already DB-backed |
| Lockout duration | 15 minutes, hardcoded | Standard security practice for PIN/OTP; not configurable to prevent weakening |
| Max attempts | 5, hardcoded | Balances security (10K PIN space) with usability (parent may mistype) |
| Rate limit library | `express-rate-limit` | De-facto standard for Express; lightweight; maintained; supports Express 5 |
| Rate limit storage | In-memory (default) | Sufficient for single-instance MVP; Redis adapter available for scale |
| Rate limit key | IP address (default) | Simplest; userId-based would require auth on all routes |
| Limiter application | Per-path in index.ts | Cleaner than per-router; centralized visibility of all rate limits |
| 423 status code | For PIN lockout | HTTP 423 (Locked) semantically matches "resource is locked"; distinguishable from 401 and 429 |
| Lockout check before bcrypt | Yes | Avoids unnecessary bcrypt computation during lockout; reduces CPU usage under attack |
| Rate limit env vars | Optional, with sensible defaults | Allows tuning in production without code changes; safe defaults work out of the box |

## 10. Testing Decisions

### 10.1 New Tests -- PIN Lockout

**File**: `apps/api/src/__tests__/pin-lockout.test.ts`

| Test | Description |
|------|-------------|
| `returns 401 with attemptsRemaining on wrong PIN` | Verify response shape and that `failedAttempts` increments |
| `returns 200 and resets counter on correct PIN` | Verify `failedAttempts` resets to 0 after correct PIN |
| `locks after 5 failed attempts` | Submit 5 wrong PINs; verify 5th returns 423 with `lockedUntil` |
| `returns 423 during lockout without bcrypt compare` | Set `lockedUntil` in future; verify 423 returned immediately |
| `unlocks after lockout expires` | Set `lockedUntil` in past; verify correct PIN works and resets fields |
| `resets counter on correct PIN after partial failures` | Submit 3 wrong PINs, then correct PIN; verify counter resets to 0 |
| `lockout duration is 15 minutes` | After 5th failure, verify `lockedUntil` is approximately now + 15 min |

### 10.2 New Tests -- Rate Limiting

**File**: `apps/api/src/__tests__/rate-limiter.test.ts`

| Test | Description |
|------|-------------|
| `auth limiter returns 429 after exceeding limit` | Send 6 requests to `/api/auth/login`; verify 6th returns 429 |
| `content limiter allows up to 60 requests` | Send 60 requests to `/api/news`; verify all return 200 (or relevant status) |
| `sync limiter returns 429 after 2 requests` | Send 3 requests to `/api/news/sincronizar`; verify 3rd returns 429 |
| `different tiers count independently` | Exhaust auth limiter; verify content endpoint still works |
| `rate limit response includes standard headers` | Verify `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers |
| `rate limit response body has error message` | Verify 429 body contains `{ error: "..." }` |
| `health endpoint is accessible under default limit` | Verify `/api/health` responds 200 under normal conditions |

### 10.3 Existing Tests

All existing tests must continue to pass. The PIN verification tests (if any) may need minor updates to account for the new response fields (`attemptsRemaining`, `lockedUntil`).

### 10.4 Manual Validation

1. Start API, verify all endpoints respond normally
2. Submit 4 wrong PINs -- verify 401 responses with decreasing `attemptsRemaining`
3. Submit 5th wrong PIN -- verify 423 response with `lockedUntil`
4. Attempt PIN during lockout -- verify 423 without delay (no bcrypt)
5. Wait 15 minutes (or manually set `lockedUntil` to past) -- verify PIN works again
6. Rapidly hit `/api/auth/login` 6+ times -- verify 429 on 6th request
7. Verify rate-limit headers in response

## 11. Out of Scope

- **Redis-backed rate limiting**: In-memory store is sufficient for single-instance MVP. Migrate to `rate-limit-redis` when deploying multi-instance.
- **User-ID-based rate limiting**: Would require auth middleware on all routes. IP-based is simpler and covers the main threat vectors.
- **Gradual lockout escalation**: Progressive lockout durations (5 min -> 15 min -> 1 hour) add complexity without proportional benefit for a 4-digit PIN.
- **PIN lockout notification to parent**: Email/push notification when PIN is locked. Useful but requires push infrastructure integration.
- **CAPTCHA**: Not appropriate for a children's app. Rate limiting and lockout are sufficient.
- **Account lockout (auth)**: Locking user accounts after failed login attempts. Auth rate limiting (5/min per IP) is sufficient for MVP.
- **Admin dashboard for rate-limit monitoring**: Visibility into rate-limit hits. Deferred to observability tooling phase.

## 12. Future Considerations

- **PIN lockout notifications**: Push notification to parent's device when PIN lockout triggers. Useful for detecting if a child is trying to bypass controls.
- **Rate limit analytics**: Track 429 responses in PostHog to identify if limits are too aggressive or if abuse patterns emerge.
- **Distributed rate limiting**: When scaling beyond a single API instance, swap `express-rate-limit`'s default `MemoryStore` for `rate-limit-redis` using the existing Redis-ready cache interface.
- **Per-user rate limiting on authenticated routes**: For routes behind `requireAuth`, rate limit by `userId` in addition to IP. Prevents a single compromised account from abusing the API.
- **Lockout escalation**: If the same user triggers lockout repeatedly (e.g., 3 lockouts in 24h), escalate to 1-hour lockout. Requires tracking lockout history.
- **Trust proxy configuration**: Document `app.set('trust proxy', 1)` requirement for production deployments behind load balancers (nginx, Cloudflare, etc.).
