# Validation Report — Run 8

**Feature**: prd4.md — Security Hardening: PIN Lockout + Rate Limiting
**Date**: 2026-03-27 22:27 UTC
**Summary**: 12 passed, 0 failed, 4 skipped (total 16)

## Results


### PIN Lockout — Data Model

- ✅ **Schema migration** — Both failedAttempts and lockedUntil fields present in ParentalProfile

### PIN Lockout — Wrong PIN Behavior

- ✅ **Wrong PIN returns 401** — HTTP 401 with attemptsRemaining=4
- ✅ **Decreasing attemptsRemaining** — 401 with attemptsRemaining 3, 2, 1 on consecutive failures
- ✅ **5th failure triggers lockout** — HTTP 423 with lockedUntil=2026-03-27T22:42:23.296Z, remainingSeconds=900
- ✅ **Correct PIN rejected during lockout** — HTTP 423 returned (lockout enforced)
- ✅ **PIN works after lockout expires** — HTTP 200, verified=True, counter reset

### PIN Lockout — Web UI

- ⏭️ **Web PinInput lockout UI** — Requires browser interaction — manual validation needed
- ⏭️ **Web PinInput countdown timer** — Requires browser interaction — manual validation needed

### PIN Lockout — Mobile UI

- ⏭️ **Mobile lockout UI + haptics** — Requires device — manual validation needed

### Rate Limiting — Auth Tier

- ✅ **Auth rate limit (5/min)** — 6th request returned 429. Codes: 401 401 401 401 401 429
- ✅ **Rate-limit headers present** — ratelimit-limit, ratelimit-remaining, ratelimit-reset found

### Rate Limiting — Sync Tier

- ✅ **Sync rate limit (2/min)** — 3rd request returned 429. Codes: 401 401 429

### Rate Limiting — Health Endpoint

- ✅ **Health endpoint accessible** — GET /api/health returned 200

### Rate Limiting — Environment Configuration

- ⏭️ **Env var override** — Requires server restart with RATE_LIMIT_AUTH=2 — manual validation needed

### i18n Keys

- ✅ **i18n keys present** — 4 keys in es.json, 4 keys in en.json

### Full Test Suite

- ✅ **Full test suite** — 21 test files, 216 tests passing

## Evidence

- API payloads: [run-8/api/](run-8/api/)
- Command output: [run-8/output/](run-8/output/)
