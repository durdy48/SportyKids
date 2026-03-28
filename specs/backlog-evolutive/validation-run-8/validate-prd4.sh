#!/bin/bash
set -euo pipefail

# Validation script for prd4.md — Security Hardening: PIN Lockout + Rate Limiting
# Run 8

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ASSETS_DIR="$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/run-8"
API="http://localhost:3001/api"

PASS=0
FAIL=0
SKIP=0
RESULTS=""

record() {
  local status="$1" name="$2" detail="$3"
  if [ "$status" = "PASS" ]; then
    PASS=$((PASS + 1))
    RESULTS="$RESULTS\n- ✅ **$name** — $detail"
  elif [ "$status" = "FAIL" ]; then
    FAIL=$((FAIL + 1))
    RESULTS="$RESULTS\n- ❌ **$name** — $detail"
  else
    SKIP=$((SKIP + 1))
    RESULTS="$RESULTS\n- ⏭️ **$name** — $detail"
  fi
}

section() {
  RESULTS="$RESULTS\n\n### $1\n"
}

# Helper: make a curl call and extract HTTP code + body
# Usage: do_curl METHOD URL [DATA]
# Sets: CURL_CODE, CURL_BODY
do_curl() {
  local method="$1" url="$2" data="${3:-}"
  local tmpfile=$(mktemp)
  if [ -n "$data" ]; then
    CURL_CODE=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    CURL_CODE=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" "$url")
  fi
  CURL_BODY=$(cat "$tmpfile")
  rm -f "$tmpfile"
}

# Helper: extract JSON field
json_field() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$2',''))" 2>/dev/null || echo ""
}

echo "=== prd4.md Validation — Run 8 ==="
echo ""

# --- Step 1: Data Model ---
section "PIN Lockout — Data Model"

echo "[1/16] Checking schema migration..."
SCHEMA_CHECK=$(sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" ".schema ParentalProfile" 2>/dev/null || echo "")
echo "$SCHEMA_CHECK" > "$ASSETS_DIR/output/01-schema.txt"

if echo "$SCHEMA_CHECK" | grep -q "failedAttempts" && echo "$SCHEMA_CHECK" | grep -q "lockedUntil"; then
  record "PASS" "Schema migration" "Both failedAttempts and lockedUntil fields present in ParentalProfile"
else
  record "FAIL" "Schema migration" "Missing lockout fields in ParentalProfile schema"
fi

# --- Steps 2-6: PIN Lockout Behavior ---
section "PIN Lockout — Wrong PIN Behavior"

echo "[2/16] Setting up test user for PIN lockout..."
do_curl POST "$API/users" '{"name":"LockoutTest","age":10,"favoriteSports":["football"]}'
TEST_USER_ID=$(json_field "$CURL_BODY" "id")

if [ -z "$TEST_USER_ID" ]; then
  record "FAIL" "Test user creation" "Could not create test user"
  echo "Cannot proceed with PIN lockout tests"
else
  # Setup parental PIN (1234)
  do_curl POST "$API/parents/setup" "{\"userId\":\"$TEST_USER_ID\",\"pin\":\"1234\"}"

  # Reset lockout state
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" \
    "UPDATE ParentalProfile SET failedAttempts = 0, lockedUntil = NULL WHERE userId = '$TEST_USER_ID'" 2>/dev/null

  # Step 2: Submit wrong PIN
  echo "[2/16] Testing wrong PIN response..."
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TEST_USER_ID\",\"pin\":\"9999\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/02-wrong-pin.json"

  REMAINING2=$(json_field "$CURL_BODY" "attemptsRemaining")
  if [ "$CURL_CODE" = "401" ] && [ "$REMAINING2" = "4" ]; then
    record "PASS" "Wrong PIN returns 401" "HTTP $CURL_CODE with attemptsRemaining=$REMAINING2"
  else
    record "FAIL" "Wrong PIN returns 401" "Got HTTP $CURL_CODE, attemptsRemaining=$REMAINING2 (expected 401, 4)"
  fi

  # Step 3: Submit 3 more wrong PINs
  echo "[3/16] Testing decreasing attempts..."
  ALL_DECREASING=true
  EXPECTED_REMAINING=(3 2 1)
  for i in 0 1 2; do
    do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TEST_USER_ID\",\"pin\":\"9999\"}"
    echo "$CURL_BODY" > "$ASSETS_DIR/api/03-wrong-pin-$((i+2)).json"
    REMAINING=$(json_field "$CURL_BODY" "attemptsRemaining")
    if [ "$CURL_CODE" != "401" ] || [ "$REMAINING" != "${EXPECTED_REMAINING[$i]}" ]; then
      ALL_DECREASING=false
    fi
  done
  if $ALL_DECREASING; then
    record "PASS" "Decreasing attemptsRemaining" "401 with attemptsRemaining 3, 2, 1 on consecutive failures"
  else
    record "FAIL" "Decreasing attemptsRemaining" "Not all responses matched expected pattern"
  fi

  # Step 4: 5th wrong PIN triggers lockout
  echo "[4/16] Testing lockout on 5th failure..."
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TEST_USER_ID\",\"pin\":\"9999\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/04-lockout-triggered.json"

  LOCKED_UNTIL=$(json_field "$CURL_BODY" "lockedUntil")
  REMAINING_SECS=$(json_field "$CURL_BODY" "remainingSeconds")
  if [ "$CURL_CODE" = "423" ] && [ -n "$LOCKED_UNTIL" ] && [ -n "$REMAINING_SECS" ]; then
    record "PASS" "5th failure triggers lockout" "HTTP 423 with lockedUntil=$LOCKED_UNTIL, remainingSeconds=$REMAINING_SECS"
  else
    record "FAIL" "5th failure triggers lockout" "Got HTTP $CURL_CODE (expected 423 with lockedUntil)"
  fi

  # Step 5: Correct PIN during lockout
  echo "[5/16] Testing correct PIN during lockout..."
  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TEST_USER_ID\",\"pin\":\"1234\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/05-correct-pin-during-lockout.json"

  if [ "$CURL_CODE" = "423" ]; then
    record "PASS" "Correct PIN rejected during lockout" "HTTP 423 returned (lockout enforced)"
  else
    record "FAIL" "Correct PIN rejected during lockout" "Got HTTP $CURL_CODE (expected 423)"
  fi

  # Step 6: Reset lockout and verify correct PIN works
  echo "[6/16] Testing PIN after lockout expires..."
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" \
    "UPDATE ParentalProfile SET lockedUntil = datetime('now', '-1 minute') WHERE userId = '$TEST_USER_ID'" 2>/dev/null

  do_curl POST "$API/parents/verify-pin" "{\"userId\":\"$TEST_USER_ID\",\"pin\":\"1234\"}"
  echo "$CURL_BODY" > "$ASSETS_DIR/api/06-correct-pin-after-lockout.json"

  VERIFIED=$(json_field "$CURL_BODY" "verified")
  if [ "$CURL_CODE" = "200" ] && [ "$VERIFIED" = "True" ]; then
    record "PASS" "PIN works after lockout expires" "HTTP 200, verified=True, counter reset"
  else
    record "FAIL" "PIN works after lockout expires" "Got HTTP $CURL_CODE, verified=$VERIFIED (expected 200, True)"
  fi

  # Cleanup test user
  sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" \
    "DELETE FROM ParentalProfile WHERE userId = '$TEST_USER_ID'; DELETE FROM User WHERE id = '$TEST_USER_ID'" 2>/dev/null || true
fi

# --- Steps 7-9: UI (SKIP) ---
section "PIN Lockout — Web UI"
record "SKIP" "Web PinInput lockout UI" "Requires browser interaction — manual validation needed"
record "SKIP" "Web PinInput countdown timer" "Requires browser interaction — manual validation needed"

section "PIN Lockout — Mobile UI"
record "SKIP" "Mobile lockout UI + haptics" "Requires device — manual validation needed"

# --- Steps 10-14: Rate Limiting ---
section "Rate Limiting — Auth Tier"

echo "[10/16] Testing auth rate limit..."
AUTH_CODES=""
for i in $(seq 1 6); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}')
  AUTH_CODES="$AUTH_CODES $CODE"
done
echo "Auth rate limit responses:$AUTH_CODES" > "$ASSETS_DIR/output/10-auth-rate-limit.txt"

SIXTH_CODE=$(echo "$AUTH_CODES" | awk '{print $6}')
if [ "$SIXTH_CODE" = "429" ]; then
  record "PASS" "Auth rate limit (5/min)" "6th request returned 429. Codes:$AUTH_CODES"
else
  record "FAIL" "Auth rate limit (5/min)" "6th request returned $SIXTH_CODE (expected 429). Codes:$AUTH_CODES"
fi

echo "[11/16] Checking rate-limit headers..."
HEADER_RES=$(curl -s -D - "$API/news?limit=1" 2>&1)
echo "$HEADER_RES" > "$ASSETS_DIR/output/11-rate-limit-headers.txt"

if echo "$HEADER_RES" | grep -qi "ratelimit-limit" && \
   echo "$HEADER_RES" | grep -qi "ratelimit-remaining" && \
   echo "$HEADER_RES" | grep -qi "ratelimit-reset"; then
  record "PASS" "Rate-limit headers present" "ratelimit-limit, ratelimit-remaining, ratelimit-reset found"
else
  record "FAIL" "Rate-limit headers present" "Missing one or more rate-limit headers"
fi

section "Rate Limiting — Sync Tier"

echo "[12/16] Testing sync rate limit..."
SYNC_CODES=""
for i in $(seq 1 3); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/news/sync" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fake-token")
  SYNC_CODES="$SYNC_CODES $CODE"
done
echo "Sync rate limit responses:$SYNC_CODES" > "$ASSETS_DIR/output/12-sync-rate-limit.txt"

THIRD_CODE=$(echo "$SYNC_CODES" | awk '{print $3}')
if [ "$THIRD_CODE" = "429" ]; then
  record "PASS" "Sync rate limit (2/min)" "3rd request returned 429. Codes:$SYNC_CODES"
else
  record "FAIL" "Sync rate limit (2/min)" "3rd request returned $THIRD_CODE (expected 429). Codes:$SYNC_CODES"
fi

section "Rate Limiting — Health Endpoint"

echo "[13/16] Testing health endpoint..."
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/health")
if [ "$HEALTH_CODE" = "200" ]; then
  record "PASS" "Health endpoint accessible" "GET /api/health returned $HEALTH_CODE"
else
  record "FAIL" "Health endpoint accessible" "GET /api/health returned $HEALTH_CODE (expected 200)"
fi

section "Rate Limiting — Environment Configuration"
record "SKIP" "Env var override" "Requires server restart with RATE_LIMIT_AUTH=2 — manual validation needed"

# --- Step 15: i18n Keys ---
section "i18n Keys"

echo "[15/16] Checking i18n keys..."
ES_KEYS=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited" "$PROJECT_ROOT/packages/shared/src/i18n/es.json" 2>/dev/null || echo "0")
EN_KEYS=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited" "$PROJECT_ROOT/packages/shared/src/i18n/en.json" 2>/dev/null || echo "0")
echo "es.json keys: $ES_KEYS, en.json keys: $EN_KEYS" > "$ASSETS_DIR/output/15-i18n-keys.txt"

if [ "$ES_KEYS" -ge 4 ] && [ "$EN_KEYS" -ge 4 ]; then
  record "PASS" "i18n keys present" "$ES_KEYS keys in es.json, $EN_KEYS keys in en.json"
else
  record "FAIL" "i18n keys present" "es.json=$ES_KEYS, en.json=$EN_KEYS (expected 4+ each)"
fi

# --- Step 16: Full Test Suite ---
section "Full Test Suite"

echo "[16/16] Running full test suite..."
cd "$PROJECT_ROOT"
TEST_OUTPUT=$(npx vitest run 2>&1) || true
echo "$TEST_OUTPUT" > "$ASSETS_DIR/output/16-test-suite.txt"

if echo "$TEST_OUTPUT" | grep -q "21 passed" && echo "$TEST_OUTPUT" | grep -q "216 passed"; then
  record "PASS" "Full test suite" "21 test files, 216 tests passing"
else
  # Check if tests passed but counts differ
  if echo "$TEST_OUTPUT" | grep -q "passed" && ! echo "$TEST_OUTPUT" | grep -q "failed"; then
    COUNTS=$(echo "$TEST_OUTPUT" | grep -E "Test Files|Tests " | tr '\n' ' ')
    record "PASS" "Full test suite" "All tests passing (counts: $COUNTS)"
  else
    record "FAIL" "Full test suite" "Tests failed — see output/16-test-suite.txt"
  fi
fi

# --- Generate Report ---
REPORT_FILE="$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/validation-report-run-8.md"

cat > "$REPORT_FILE" <<EOF
# Validation Report — Run 8

**Feature**: prd4.md — Security Hardening: PIN Lockout + Rate Limiting
**Date**: $(date -u +"%Y-%m-%d %H:%M UTC")
**Summary**: $PASS passed, $FAIL failed, $SKIP skipped (total $((PASS + FAIL + SKIP)))

## Results
$(echo -e "$RESULTS")

## Evidence

- API payloads: [run-8/api/](run-8/api/)
- Command output: [run-8/output/](run-8/output/)
EOF

echo ""
echo "=== Validation Complete ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"
echo "  Report: specs/backlog-evolutive/validation-assets/validation-report-run-8.md"

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
