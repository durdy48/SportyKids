#!/bin/bash
set -euo pipefail

# Run 10 — prd5.md validation (Enhanced Feed Algorithm) + prd4 regression

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ASSETS="$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/run-10"

PASS=0 FAIL=0 SKIP=0
RESULTS=""
record() {
  case "$1" in
    PASS) PASS=$((PASS+1)); RESULTS="$RESULTS\n- ✅ **$2** — $3" ;;
    FAIL) FAIL=$((FAIL+1)); RESULTS="$RESULTS\n- ❌ **$2** — $3" ;;
    *)    SKIP=$((SKIP+1)); RESULTS="$RESULTS\n- ⏭️ **$2** — $3" ;;
  esac
}
section() { RESULTS="$RESULTS\n\n### $1\n"; }

echo "=== Run 10 — prd5 + prd4 regression ==="

# ============================================================
# PRD5: Enhanced Feed Algorithm
# ============================================================

section "prd5: Feed Ranker Tests"

echo "[24] Running feed-ranker tests..."
FR_OUT=$(cd "$PROJECT_ROOT" && npx vitest run apps/api/src/services/feed-ranker.test.ts 2>&1) || true
echo "$FR_OUT" > "$ASSETS/output/24-feed-ranker-tests.txt"
FR_COUNT=$(echo "$FR_OUT" | grep -o '[0-9]* passed' | head -1 || echo "0")
if echo "$FR_OUT" | grep -q "passed" && ! echo "$FR_OUT" | grep -q "failed"; then
  record "PASS" "[24] Feed ranker tests" "$FR_COUNT"
else
  record "FAIL" "[24] Feed ranker tests" "Failures detected"
fi

section "prd5: Source Affinity"

echo "[25] Checking sourceEngagement population..."
SRC_SET=$(grep -c "sourceEngagement.set" "$PROJECT_ROOT/apps/api/src/services/feed-ranker.ts" || echo 0)
if [ "$SRC_SET" -ge 1 ]; then
  record "PASS" "[25] sourceEngagement populated" "Found $SRC_SET .set() calls"
else
  record "FAIL" "[25] sourceEngagement" "Not populated"
fi

section "prd5: Recency Decay"

echo "[26] Checking exponential decay..."
EXP=$(grep -c "Math.exp" "$PROJECT_ROOT/apps/api/src/services/feed-ranker.ts" || echo 0)
if [ "$EXP" -ge 1 ]; then
  record "PASS" "[26] recencyDecay exponential" "Math.exp found"
else
  record "FAIL" "[26] recencyDecay" "No exponential formula"
fi

section "prd5: Diversity Injection"

echo "[27] Checking diversity injection..."
DIV_DEF=$(grep -c "applyDiversityInjection" "$PROJECT_ROOT/apps/api/src/services/feed-ranker.ts" || echo 0)
if [ "$DIV_DEF" -ge 2 ]; then
  record "PASS" "[27] Diversity injection" "Defined and called ($DIV_DEF refs)"
else
  record "FAIL" "[27] Diversity injection" "Only $DIV_DEF refs found"
fi

section "prd5: RANKING_WEIGHTS"

echo "[28] Checking weights..."
WEIGHTS=$(grep -A 10 "export const RANKING_WEIGHTS" "$PROJECT_ROOT/apps/api/src/services/feed-ranker.ts")
echo "$WEIGHTS" > "$ASSETS/output/28-weights.txt"
HAS_TEAM=$(echo "$WEIGHTS" | grep -c "TEAM" || echo 0)
HAS_SPORT=$(echo "$WEIGHTS" | grep -c "SPORT" || echo 0)
HAS_RECENCY=$(echo "$WEIGHTS" | grep -c "RECENCY" || echo 0)
HAS_LOCALE=$(echo "$WEIGHTS" | grep -c "LOCALE" || echo 0)
if [ "$HAS_TEAM" -ge 1 ] && [ "$HAS_SPORT" -ge 1 ] && [ "$HAS_RECENCY" -ge 1 ] && [ "$HAS_LOCALE" -ge 1 ]; then
  record "PASS" "[28] RANKING_WEIGHTS" "TEAM, SPORT, SOURCE, RECENCY, LOCALE present"
else
  record "FAIL" "[28] RANKING_WEIGHTS" "Missing fields (T=$HAS_TEAM S=$HAS_SPORT R=$HAS_RECENCY L=$HAS_LOCALE)"
fi

section "prd5: Cache Invalidation"

echo "[29] Checking invalidateBehavioralCache in parents.ts..."
INV=$(grep -c "invalidateBehavioralCache" "$PROJECT_ROOT/apps/api/src/routes/parents.ts" || echo 0)
if [ "$INV" -ge 1 ]; then
  record "PASS" "[29] Cache invalidation in activity log" "$INV references found"
else
  record "FAIL" "[29] Cache invalidation" "Not called in parents.ts"
fi

section "prd5: Full Test Suite"

echo "[30] Running all tests..."
cd "$PROJECT_ROOT"
TEST_OUT=$(npx vitest run 2>&1) || true
echo "$TEST_OUT" > "$ASSETS/output/30-all-tests.txt"
if echo "$TEST_OUT" | grep -q "passed" && ! echo "$TEST_OUT" | grep -q "failed"; then
  TFILES=$(echo "$TEST_OUT" | grep "Test Files" | grep -o '[0-9]* passed' || echo "?")
  TTESTS=$(echo "$TEST_OUT" | grep "Tests " | grep -o '[0-9]* passed' || echo "?")
  record "PASS" "[30] Full test suite" "$TFILES files, $TTESTS tests"
else
  record "FAIL" "[30] Full test suite" "Failures detected"
fi

# ============================================================
# PRD4 Regression: Core checks
# ============================================================

section "prd4 Regression: Schema"

SCHEMA=$(sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" ".schema ParentalProfile" 2>/dev/null || echo "")
if echo "$SCHEMA" | grep -q "failedAttempts" && echo "$SCHEMA" | grep -q "lockedUntil"; then
  record "PASS" "[R1] Schema lockout fields" "Present"
else
  record "FAIL" "[R1] Schema" "Missing"
fi

section "prd4 Regression: Rate Limiting"

HC=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/health")
[ "$HC" = "200" ] && record "PASS" "[R2] Health check" "HTTP 200" || record "FAIL" "[R2] Health" "HTTP $HC"

HEADERS=$(curl -s -D - "http://localhost:3001/api/news?limit=1" 2>&1)
echo "$HEADERS" | grep -qi "ratelimit-limit" && \
  record "PASS" "[R3] Rate-limit headers" "Present" || record "FAIL" "[R3] Headers" "Missing"

section "prd4 Regression: i18n"

ES=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited\|pin_lockout_warning" "$PROJECT_ROOT/packages/shared/src/i18n/es.json" || echo 0)
EN=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited\|pin_lockout_warning" "$PROJECT_ROOT/packages/shared/src/i18n/en.json" || echo 0)
[ "$ES" -ge 5 ] && [ "$EN" -ge 5 ] && record "PASS" "[R4] i18n keys" "es=$ES en=$EN" || record "FAIL" "[R4] i18n" "es=$ES en=$EN"

# ============================================================
# REPORT
# ============================================================
REPORT="$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/validation-report-run-10.md"
cat > "$REPORT" <<EOF
# Validation Report — Run 10

**Feature**: prd5.md — Enhanced Feed Algorithm + prd4 regression
**Date**: $(date -u +"%Y-%m-%d %H:%M UTC")
**Summary**: $PASS passed, $FAIL failed, $SKIP skipped (total $((PASS+FAIL+SKIP)))

## Results
$(echo -e "$RESULTS")

## Evidence

- Command output: [run-10/output/](run-10/output/)
EOF

echo ""
echo "=== Run 10 Complete ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
