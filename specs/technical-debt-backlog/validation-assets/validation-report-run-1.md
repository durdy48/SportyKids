# Validation Report — Run 1

**Date**: 2026-03-28T12:18:55.292Z
**Summary**: 13 PASS / 0 FAIL / 0 SKIP

## Feature 4: Structured Logging

- ✅ **Pino-pretty dev logging**: Logs contain service context
- ✅ **X-Request-ID header**: requestId: c8417ed1-4ffd-4939-975c-61eaa84f4b4f
- ✅ **Error response has X-Request-ID**: X-Request-ID: 8aa72858-7c79-417b-a22b-cac133a71d86

## Feature 2: Linting

- ✅ **ESLint --max-warnings 0**: Zero errors and warnings
- ✅ **Prettier check**: Prettier ran (formatting not enforced)

## Feature 3: Mobile Typecheck & CI

- ✅ **Mobile typecheck**: Zero type errors
- ✅ **CI pipeline structure**: All jobs, dependencies, and caching present

## Feature 5: Persistent Parental Sessions

- ✅ **Session token is UUID**: Token: e0ff3d31-8503-4946-ac46-a707a94c898a
- ✅ **Session token works for parental endpoint**: Profile endpoint returned 200
- ✅ **Session TTL is 5 minutes**: SESSION_TTL_MS = 5 * 60 * 1000

## Feature 1: Testing Infrastructure

- ✅ **All tests pass**: Total: 418 tests (API 301 + Web 57 + Mobile 60)
- ✅ **Web tests**: 12 files, 57 tests
- ✅ **Mobile tests**: 10 files, 60 tests

## Evidence

- [API startup logs](run-1/output/01-api-startup-logs.txt)
- [Health response](run-1/api/02-health-response.json)
- [Error response](run-1/api/03-error-response.json)
- [ESLint output](run-1/output/04-eslint-output.txt)
- [Mobile typecheck](run-1/output/06-mobile-typecheck.txt)
- [Test results](run-1/output/10-test-all.txt)
- [CI analysis](run-1/output/13-ci-analysis.txt)
