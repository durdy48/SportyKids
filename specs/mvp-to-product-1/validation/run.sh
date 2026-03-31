#!/usr/bin/env bash
# SportyKids Legal & Compliance — Validation Runner
# Usage: bash specs/mvp-to-product-1/validation/run.sh [run-1|run-2]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

RUN="${1:-run-2}"

API_URL="http://localhost:3001/api"
WEB_URL="http://localhost:3000"

echo "============================================"
echo "SportyKids — Legal & Compliance Validation"
echo "Run: $RUN"
echo "============================================"
echo ""

# Check API is running
echo -n "Checking API at $API_URL/health... "
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ]; then
  echo "OK"
else
  echo "FAILED (status: $API_STATUS)"
  echo "ERROR: API is not running. Start it with: npm run dev:api"
  exit 1
fi

# Check Web is running
echo -n "Checking Web at $WEB_URL... "
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL" 2>/dev/null || echo "000")
if [ "$WEB_STATUS" != "000" ]; then
  echo "OK (status: $WEB_STATUS)"
else
  echo "FAILED"
  echo "ERROR: Web app is not running. Start it with: npm run dev:web"
  exit 1
fi

echo ""
echo "Running validation script ($RUN)..."
echo ""

cd "$PROJECT_ROOT"

if [ "$RUN" = "run-1" ]; then
  node specs/mvp-to-product-1/validation/validate.mjs
elif [ "$RUN" = "run-2" ]; then
  node specs/mvp-to-product-1/validation/validate-run2.mjs
else
  echo "Unknown run: $RUN (expected run-1 or run-2)"
  exit 1
fi

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "All automated checks PASSED."
else
  echo "Some checks FAILED. Review the report:"
  echo "  specs/mvp-to-product-1/validation-assets/$RUN/validation-report-$RUN.md"
fi

exit $EXIT_CODE
