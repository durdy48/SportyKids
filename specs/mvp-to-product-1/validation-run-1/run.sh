#!/usr/bin/env bash
# SportyKids Legal & Compliance — Validation Runner
# Usage: bash specs/mvp-to-product-1/validation/run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

API_URL="http://localhost:3001/api"
WEB_URL="http://localhost:3000"

echo "============================================"
echo "SportyKids — Legal & Compliance Validation"
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
echo "Running validation script..."
echo ""

cd "$PROJECT_ROOT"
node specs/mvp-to-product-1/validation/validate.mjs
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "All automated checks PASSED."
else
  echo "Some checks FAILED. Review the report:"
  echo "  specs/mvp-to-product-1/validation-assets/run-1/validation-report-run-1.md"
fi

exit $EXIT_CODE
