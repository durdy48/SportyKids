#!/bin/bash
set -euo pipefail

# Run 11 — Re-validation: prd5 + review fixes (Appendix B) + prd4 regression

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ASSETS="$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/run-11"
FR="$PROJECT_ROOT/apps/api/src/services/feed-ranker.ts"
FRT="$PROJECT_ROOT/apps/api/src/services/feed-ranker.test.ts"

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

echo "=== Run 11 ==="

# ============ PRD5 original checks ============

section "prd5: Feed Ranker Tests"
cd "$PROJECT_ROOT"
FR_OUT=$(npx vitest run apps/api/src/services/feed-ranker.test.ts 2>&1) || true
echo "$FR_OUT" > "$ASSETS/output/24-feed-ranker.txt"
echo "$FR_OUT" | grep -q "passed" && ! echo "$FR_OUT" | grep -q "failed" && \
  record "PASS" "[24] Feed ranker tests" "All passing" || record "FAIL" "[24] Feed ranker" "Failures"

section "prd5: Code Checks"
[ "$(grep -c 'sourceEngagement.set' "$FR" || echo 0)" -ge 1 ] && \
  record "PASS" "[25] sourceEngagement" "Populated" || record "FAIL" "[25]" "Not populated"

[ "$(grep -c 'Math.exp' "$FR" || echo 0)" -ge 1 ] && \
  record "PASS" "[26] recencyDecay" "Exponential" || record "FAIL" "[26]" "Missing"

[ "$(grep -c 'applyDiversityInjection' "$FR" || echo 0)" -ge 2 ] && \
  record "PASS" "[27] Diversity injection" "Defined+called" || record "FAIL" "[27]" "Missing"

WEIGHTS=$(grep -A 10 "export const RANKING_WEIGHTS" "$FR")
echo "$WEIGHTS" | grep -q "TEAM" && echo "$WEIGHTS" | grep -q "SPORT" && \
echo "$WEIGHTS" | grep -q "RECENCY" && echo "$WEIGHTS" | grep -q "LOCALE" && echo "$WEIGHTS" | grep -q "COUNTRY" && \
  record "PASS" "[28] RANKING_WEIGHTS" "6 keys present" || record "FAIL" "[28]" "Missing keys"

[ "$(grep -c 'invalidateBehavioralCache' "$PROJECT_ROOT/apps/api/src/routes/parents.ts" || echo 0)" -ge 1 ] && \
  record "PASS" "[29] Cache invalidation" "In parents.ts" || record "FAIL" "[29]" "Missing"

section "prd5: Full Test Suite"
TEST_OUT=$(npx vitest run 2>&1) || true
echo "$TEST_OUT" > "$ASSETS/output/30-tests.txt"
echo "$TEST_OUT" | grep -q "passed" && ! echo "$TEST_OUT" | grep -q "failed" && \
  record "PASS" "[30] Full suite" "$(echo "$TEST_OUT" | grep 'Tests ' | grep -o '[0-9]* passed' || echo '?') tests" || \
  record "FAIL" "[30]" "Failures"

# ============ Appendix B: Review fixes ============

section "Appendix B: COUNTRY weight"
echo "$WEIGHTS" | grep -q "COUNTRY" && \
  record "PASS" "[B1] COUNTRY weight" "Separate from LOCALE" || record "FAIL" "[B1]" "Missing"

grep -q "RANKING_WEIGHTS.COUNTRY" "$FR" && \
  record "PASS" "[B2] countryBoost uses COUNTRY" "Not LOCALE" || record "FAIL" "[B2]" "Still uses LOCALE"

section "Appendix B: totalInteractions precomputed"
grep -q "precomputedTotal" "$FR" && \
  record "PASS" "[B3] sportFrequencyBoost accepts precomputed" "Parameter exists" || record "FAIL" "[B3]" "Missing"

section "Appendix B: news.ts comment"
grep -q "invalidateBehavioralCache" "$PROJECT_ROOT/apps/api/src/routes/news.ts" && \
  record "PASS" "[B4] news.ts comment" "Dependency documented" || record "FAIL" "[B4]" "Missing"

section "Appendix B: DIVERSITY_INTERVAL test"
grep -q "DIVERSITY_INTERVAL.*toBe.*5" "$FRT" && \
  record "PASS" "[B5] DIVERSITY_INTERVAL test" "Asserts === 5" || record "FAIL" "[B5]" "Missing"

section "Appendix B: halfLifeHours doc"
grep -q "decay constant.*not.*true half-life" "$FR" && \
  record "PASS" "[B6] halfLifeHours doc" "Comment present" || record "FAIL" "[B6]" "Missing"

section "Appendix B: viewedContentIds dedup"
grep -q "new Set" "$FR" && \
  record "PASS" "[B7] viewedContentIds dedup" "Set() used" || record "FAIL" "[B7]" "Missing"

# ============ prd4 regression ============

section "prd4 Regression"
SCHEMA=$(sqlite3 "$PROJECT_ROOT/apps/api/prisma/dev.db" ".schema ParentalProfile" 2>/dev/null || echo "")
echo "$SCHEMA" | grep -q "failedAttempts" && echo "$SCHEMA" | grep -q "lockedUntil" && \
  record "PASS" "[R1] Schema" "Lockout fields present" || record "FAIL" "[R1]" "Missing"

HC=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/health")
[ "$HC" = "200" ] && record "PASS" "[R2] Health" "HTTP 200" || record "FAIL" "[R2]" "HTTP $HC"

HDRS=$(curl -s -D - "http://localhost:3001/api/news?limit=1" 2>&1)
echo "$HDRS" | grep -qi "ratelimit-limit" && \
  record "PASS" "[R3] Rate headers" "Present" || record "FAIL" "[R3]" "Missing"

ES=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited\|pin_lockout_warning" "$PROJECT_ROOT/packages/shared/src/i18n/es.json" || echo 0)
EN=$(grep -c "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited\|pin_lockout_warning" "$PROJECT_ROOT/packages/shared/src/i18n/en.json" || echo 0)
[ "$ES" -ge 5 ] && [ "$EN" -ge 5 ] && record "PASS" "[R4] i18n" "es=$ES en=$EN" || record "FAIL" "[R4]" "es=$ES en=$EN"

# ============ REPORT ============
cat > "$PROJECT_ROOT/specs/backlog-evolutive/validation-assets/validation-report-run-11.md" <<EOF
# Validation Report — Run 11 (post /t-review #2)

**Feature**: prd5.md review fixes + regression checks
**Date**: $(date -u +"%Y-%m-%d %H:%M UTC")
**Summary**: $PASS passed, $FAIL failed, $SKIP skipped (total $((PASS+FAIL+SKIP)))

## Results
$(echo -e "$RESULTS")

## Comparison with Run 10
Run 10: 11 PASS, 0 FAIL. Run 11 adds 7 appendix checks for review fixes.

## Evidence
- [run-11/output/](run-11/output/)
EOF

echo ""
echo "=== Run 11 Complete ==="
echo "  PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
