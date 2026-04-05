#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "=== Admin Dashboard — Validation Run 2 (post /t-review #1) ==="
echo ""

# Check Node.js available
if ! command -v node &> /dev/null; then
  echo "ERROR: node not found"
  exit 1
fi

# Check API health
echo "Checking if API is running at http://localhost:3001..."
if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "✅ API is running"
else
  echo "⚠️  API is not running. API tests will be SKIPPED."
  echo "   Start with:"
  echo "   DATABASE_URL='postgresql://sportykids:sportykids@localhost:5432/sportykids' JWT_SECRET='dev-secret' JWT_REFRESH_SECRET='dev-refresh-secret' npm run dev:api"
  echo ""
  echo "   Source/code checks (A4-A9) will still run."
fi

echo ""
echo "Running validation script (Run 2)..."
node specs/admin-dashboard/validation/validate.mjs

EXIT_CODE=$?
echo ""
echo "Validation complete. Report: specs/admin-dashboard/validation-assets/validation-report-run-2.md"
exit $EXIT_CODE
