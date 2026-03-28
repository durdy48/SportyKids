# Validation Report — Run 9 (post /t-review #1)

**Feature**: prd4.md — Security Hardening: PIN Lockout + Rate Limiting
**Date**: 2026-03-27 22:40 UTC
**Summary**: 18 passed, 0 failed, 3 skipped (total 21)

## Results


### Re-run: PIN Lockout — Data Model

- ✅ **[1] Schema migration** — failedAttempts + lockedUntil present

### Re-run: PIN Lockout — Behavior

- ✅ **[2] Wrong PIN 401** — attemptsRemaining=4
- ✅ **[3] Decreasing attempts** — 3,2,1
- ✅ **[4] Lockout triggered** — HTTP 423
- ✅ **[5] Locked rejects correct PIN** — HTTP 423
- ✅ **[6] Unlock after expiry** — verified=True

### Re-run: PIN Lockout — UI

- ⏭️ **[7-8] Web lockout UI** — Requires browser
- ⏭️ **[9] Mobile lockout UI** — Requires device

### Re-run: Rate Limiting

- ✅ **[10] Auth rate limit** — 6th=429
- ✅ **[11] Rate-limit headers** — Present
- ✅ **[12] Sync rate limit** — 3rd=429
- ✅ **[13] Health check** — HTTP 200
- ⏭️ **[14] Env override** — Requires restart

### Re-run: i18n + Tests

- ✅ **[15] i18n keys** — es=4 en=4
- ✅ **[16] Full test suite** — 21 files, 216 tests

### Appendix A: Locale in verify-pin

- ✅ **[17] EN locale error msg** — English: Wrong PIN. 4 attempts remaining.

### Appendix A: Profile no lockout internals

- ✅ **[18] Profile no lockout leak** — failedAttempts/lockedUntil excluded

### Appendix A: i18n in UI code

- ✅ **[19] Web PinInput i18n** — pin_locked_short=1, pin_lockout_warning=1
- ✅ **[20] Mobile i18n** — pin_locked_short=1

### Appendix A: Health before rate limiters

- ✅ **[21] Health before limiters** — line 38 < 54

### Appendix A: New i18n key

- ✅ **[22] pin_lockout_warning key** — es=1 en=1

## Comparison with Run 8

Run 8 had 12 PASS, 0 FAIL, 4 SKIP on original checks.
Run 9 re-runs those same checks plus 6 appendix checks for review fixes.

## Evidence

- API payloads: [run-9/api/](run-9/api/)
- Command output: [run-9/output/](run-9/output/)
