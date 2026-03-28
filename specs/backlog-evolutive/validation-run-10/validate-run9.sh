#!/bin/bash
set -euo pipefail

# Run 9 — Re-validation: original prd4.md checks + Appendix A (review fixes)

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ASSETS_DIR="$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/run-9"
API="http://localhost:3001/api"

PASS=0 FAIL=0 SKIP=0
RESULTS=""

record() {
  local status="$1" name="$2" detail="$3"
  case "$status" in
    PASS) PASS=$((PASS+1)); RESULTS="$RESULTS\n- ✅ **$name** — $detail" ;;
    FAIL) FAIL=$((FAIL+1)); RESULTS="$RESULTS\n- ❌ **$name** — $detail" ;;
    *)    SKIP=$((SKIP+1)); RESULTS="$RESULTS\n- ⏭️ **$name** — $detail" ;;
  esac
}
section() { RESULTS="$RESULTS\n\n### $1\n"; }

do_curl() {
  local method="$1" url="$2" data="${3:-}"
  local tmpfile=$(mktemp)
  if [ -n "$data" ]; then
    CURL_CODE=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$data")
  else
    CURL_CODE=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" "$url")
  fi
  CURL_BODY=$(cat "$tmpfile"); rm -f "$tmpfile"
}
json_field() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$2',''))" 2>/dev/null || echo ""; }

echo "=== Run 9 — Re-validation (prd4 + Appendix A) ==="

# ============================================================
# PART 1: Re-run original prd4 checks
# ============================================================

section "Re-run: PIN Lockout — Data Model"
SCHEMA=$(sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" ".schema ParentalProfile" 2>/dev/null || echo "")
echo "$SCHEMA" > "$ASSETS_DIR/output/01-schema.txt"
if echo "$SCHEMA" | grep -q "failedAttempts" && echo "$SCHEMA" | grep -q "lockedUntil"; then
  record "PASS" "[1] Schema migration" "failedAttempts + lockedUntil present"
else record "FAIL" "[1] Schema migration" "Missing fields"; fi

section "Re-run: PIN Lockout — Behavior"
do_curl POST "$API/users" '{"name":"Run9Test","age":10,"favoriteSports":["football"]}'
TU=$(json_field "$CURL_BODY" "id")
if [ -z "$TU" ]; then
  record "FAIL" "[2-6] PIN lockout" "Could not create test user"
else
  do_curl POST "$API/parents/setup" "{\"userId\":\"$TU\",\"pin\":\"1234\"}"
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" "UPDATE ParentalProfile SET failedAttempts=0, lockedUntil=NULL WHERE userId='$TU'" 2>/dev/null

  # [2] Wrong PIN
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TU\",\"pin\":\"9999\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/02-wrong-pin.json"
  R=$(json_field "$CURL_BODY" "attemptsRemaining")
  [ "$CURL_CODE" = "401" ] && [ "$R" = "4" ] && record "PASS" "[2] Wrong PIN 401" "attemptsRemaining=$R" || record "FAIL" "[2] Wrong PIN" "HTTP $CURL_CODE, remaining=$R"

  # [3] Decreasing
  OK=true; EXP=(3 2 1)
  for i in 0 1 2; do
    do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TU\",\"pin\":\"9999\"}"
    R=$(json_field "$CURL_BODY" "attemptsRemaining")
    [ "$CURL_CODE" = "401" ] && [ "$R" = "${EXP[$i]}" ] || OK=false
  done
  $OK && record "PASS" "[3] Decreasing attempts" "3,2,1" || record "FAIL" "[3] Decreasing" "Mismatch"

  # [4] 5th failure lockout
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TU\",\"pin\":\"9999\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/04-lockout.json"
  LU=$(json_field "$CURL_BODY" "lockedUntil")
  [ "$CURL_CODE" = "423" ] && [ -n "$LU" ] && record "PASS" "[4] Lockout triggered" "HTTP 423" || record "FAIL" "[4] Lockout" "HTTP $CURL_CODE"

  # [5] Correct PIN during lockout
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TU\",\"pin\":\"1234\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/05-locked-correct.json"
  [ "$CURL_CODE" = "423" ] && record "PASS" "[5] Locked rejects correct PIN" "HTTP 423" || record "FAIL" "[5] Locked" "HTTP $CURL_CODE"

  # [6] After expiry
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" "UPDATE ParentalProfile SET lockedUntil=datetime('now','-1 minute') WHERE userId='$TU'" 2>/dev/null
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TU\",\"pin\":\"1234\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/06-after-expiry.json"
  V=$(json_field "$CURL_BODY" "verified")
  [ "$CURL_CODE" = "200" ] && [ "$V" = "True" ] && record "PASS" "[6] Unlock after expiry" "verified=True" || record "FAIL" "[6] Unlock" "HTTP $CURL_CODE, verified=$V"

  # Cleanup
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" "DELETE FROM ParentalProfile WHERE userId='$TU'; DELETE FROM User WHERE id='$TU'" 2>/dev/null || true
fi

section "Re-run: PIN Lockout — UI"
record "SKIP" "[7-8] Web lockout UI" "Requires browser"
record "SKIP" "[9] Mobile lockout UI" "Requires device"

section "Re-run: Rate Limiting"
AUTH_CODES=""
for i in $(seq 1 6); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"wrong"}')
  AUTH_CODES="$AUTH_CODES $CODE"
done
echo "Auth codes:$AUTH_CODES" > "$ASSETS_DIR/output/10-auth-rate.txt"
SIXTH=$(echo "$AUTH_CODES" | awk '{print $6}')
[ "$SIXTH" = "429" ] && record "PASS" "[10] Auth rate limit" "6th=429" || record "FAIL" "[10] Auth rate" "6th=$SIXTH"

HEADERS=$(curl -s -D - "$API/news?limit=1" 2>&1)
echo "$HEADERS" > "$ASSETS_DIR/output/11-headers.txt"
echo "$HEADERS" | grep -qi "ratelimit-limit" && echo "$HEADERS" | grep -qi "ratelimit-remaining" && \
  record "PASS" "[11] Rate-limit headers" "Present" || record "FAIL" "[11] Headers" "Missing"

SYNC_CODES=""
for i in $(seq 1 3); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/news/sync" -H "Authorization: Bearer fake")
  SYNC_CODES="$SYNC_CODES $CODE"
done
echo "Sync codes:$SYNC_CODES" > "$ASSETS_DIR/output/12-sync-rate.txt"
THIRD=$(echo "$SYNC_CODES" | awk '{print $3}')
[ "$THIRD" = "429" ] && record "PASS" "[12] Sync rate limit" "3rd=429" || record "FAIL" "[12] Sync rate" "3rd=$THIRD"

HC=$(curl -s -o /dev/null -w "%{http_code}" "$API/health")
[ "$HC" = "200" ] && record "PASS" "[13] Health check" "HTTP 200" || record "FAIL" "[13] Health" "HTTP $HC"

record "SKIP" "[14] Env override" "Requires restart"

section "Re-run: i18n + Tests"
ES=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited" "$PROJECT_ROOT/packages/shared/src/i18n/es.json" || echo 0)
EN=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited" "$PROJECT_ROOT/packages/shared/src/i18n/en.json" || echo 0)
[ "$ES" -ge 4 ] && [ "$EN" -ge 4 ] && record "PASS" "[15] i18n keys" "es=$ES en=$EN" || record "FAIL" "[15] i18n" "es=$ES en=$EN"

cd "$PROJECT_ROOT"
TEST_OUT=$(npx vitest run 2>&1) || true
echo "$TEST_OUT" > "$ASSETS_DIR/output/16-tests.txt"
echo "$TEST_OUT" | grep -q "21 passed" && echo "$TEST_OUT" | grep -q "216 passed" && \
  record "PASS" "[16] Full test suite" "21 files, 216 tests" || \
  (echo "$TEST_OUT" | grep -q "passed" && ! echo "$TEST_OUT" | grep -q "failed" && \
    record "PASS" "[16] Full test suite" "All passing" || record "FAIL" "[16] Tests" "Failures detected")

# ============================================================
# PART 2: Appendix A — Review fix checks
# ============================================================

section "Appendix A: Locale in verify-pin"
# Create EN user, test error language
do_curl POST "$API/users" '{"name":"EnUser","age":10,"favoriteSports":["football"],"locale":"en"}'
EN_USER=$(json_field "$CURL_BODY" "id")
if [ -n "$EN_USER" ]; then
  do_curl POST "$API/parents/setup" "{\"userId\":\"$EN_USER\",\"pin\":\"5678\"}"
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" "UPDATE ParentalProfile SET failedAttempts=0, lockedUntil=NULL WHERE userId='$EN_USER'" 2>/dev/null
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$EN_USER\",\"pin\":\"0000\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/17-en-locale-error.json"
  ERR=$(json_field "$CURL_BODY" "error")
  if echo "$ERR" | grep -qi "wrong\|attempt"; then
    record "PASS" "[17] EN locale error msg" "English: $ERR"
  else
    record "FAIL" "[17] EN locale error msg" "Got: $ERR (expected English)"
  fi
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" "DELETE FROM ParentalProfile WHERE userId='$EN_USER'; DELETE FROM User WHERE id='$EN_USER'" 2>/dev/null || true
else
  record "FAIL" "[17] EN locale" "Could not create test user"
fi

section "Appendix A: Profile no lockout internals"
do_curl POST "$API/users" '{"name":"ProfileTest","age":10,"favoriteSports":["football"]}'
PT=$(json_field "$CURL_BODY" "id")
if [ -n "$PT" ]; then
  do_curl POST "$API/parents/setup" "{\"userId\":\"$PT\",\"pin\":\"1234\"}"
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$PT\",\"pin\":\"1234\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/18-profile-no-leak.json"
  PROFILE_STR="$CURL_BODY"
  if echo "$PROFILE_STR" | python3 -c "import sys,json; p=json.load(sys.stdin).get('profile',{}); assert 'failedAttempts' not in p and 'lockedUntil' not in p" 2>/dev/null; then
    record "PASS" "[18] Profile no lockout leak" "failedAttempts/lockedUntil excluded"
  else
    record "FAIL" "[18] Profile leak" "lockout internals found in profile response"
  fi
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" "DELETE FROM ParentalProfile WHERE userId='$PT'; DELETE FROM User WHERE id='$PT'" 2>/dev/null || true
else
  record "FAIL" "[18] Profile test" "Could not create user"
fi

section "Appendix A: i18n in UI code"
WEB_LOCKED=$(grep -c "t('parental.pin_locked_short'" "$PROJECT_ROOT/apps/web/src/components/PinInput.tsx" || echo 0)
WEB_WARN=$(grep -c "t('parental.pin_lockout_warning'" "$PROJECT_ROOT/apps/web/src/components/PinInput.tsx" || echo 0)
[ "$WEB_LOCKED" -ge 1 ] && [ "$WEB_WARN" -ge 1 ] && \
  record "PASS" "[19] Web PinInput i18n" "pin_locked_short=$WEB_LOCKED, pin_lockout_warning=$WEB_WARN" || \
  record "FAIL" "[19] Web PinInput i18n" "locked=$WEB_LOCKED, warn=$WEB_WARN"

MOB_LOCKED=$(grep -c "t('parental.pin_locked_short'" "$PROJECT_ROOT/apps/mobile/src/screens/ParentalControl.tsx" || echo 0)
[ "$MOB_LOCKED" -ge 1 ] && \
  record "PASS" "[20] Mobile i18n" "pin_locked_short=$MOB_LOCKED" || \
  record "FAIL" "[20] Mobile i18n" "count=$MOB_LOCKED"

section "Appendix A: Health before rate limiters"
HEALTH_LINE=$(grep -n "app.get.*health" "$PROJECT_ROOT/apps/api/src/index.ts" | head -1 | cut -d: -f1)
LIMITER_LINE=$(grep -n "app.use.*defaultLimiter" "$PROJECT_ROOT/apps/api/src/index.ts" | head -1 | cut -d: -f1)
echo "health=$HEALTH_LINE, limiter=$LIMITER_LINE" > "$ASSETS_DIR/output/21-health-order.txt"
[ "$HEALTH_LINE" -lt "$LIMITER_LINE" ] && \
  record "PASS" "[21] Health before limiters" "line $HEALTH_LINE < $LIMITER_LINE" || \
  record "FAIL" "[21] Health order" "health=$HEALTH_LINE, limiter=$LIMITER_LINE"

section "Appendix A: New i18n key"
ES_WARN=$(grep -c "pin_lockout_warning" "$PROJECT_ROOT/packages/shared/src/i18n/es.json" || echo 0)
EN_WARN=$(grep -c "pin_lockout_warning" "$PROJECT_ROOT/packages/shared/src/i18n/en.json" || echo 0)
[ "$ES_WARN" -ge 1 ] && [ "$EN_WARN" -ge 1 ] && \
  record "PASS" "[22] pin_lockout_warning key" "es=$ES_WARN en=$EN_WARN" || \
  record "FAIL" "[22] pin_lockout_warning" "es=$ES_WARN en=$EN_WARN"

# ============================================================
# REPORT
# ============================================================
REPORT="$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/validation-report-run-9.md"
cat > "$REPORT" <<EOF
# Validation Report — Run 9 (post /t-review #1)

**Feature**: prd4.md — Security Hardening: PIN Lockout + Rate Limiting
**Date**: $(date -u +"%Y-%m-%d %H:%M UTC")
**Summary**: $PASS passed, $FAIL failed, $SKIP skipped (total $((PASS+FAIL+SKIP)))

## Results
$(echo -e "$RESULTS")

## Comparison with Run 8

Run 8 had 12 PASS, 0 FAIL, 4 SKIP on original checks.
Run 9 re-runs those same checks plus 6 appendix checks for review fixes.

## Evidence

- API payloads: [run-9/api/](run-9/api/)
- Command output: [run-9/output/](run-9/output/)
EOF

echo ""
echo "=== Run 9 Complete ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
