#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FEATURE_DIR="$(dirname "$SCRIPT_DIR")"
ROOT="$(cd "$FEATURE_DIR/../.." && pwd)"
RUN_NUM=1

# Check API is running
if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "API not running on port 3001. Start it first:"
  echo "   npm run dev:api"
  exit 1
fi

# Create evidence directories
mkdir -p "$FEATURE_DIR/validation-assets/run-$RUN_NUM/api"
mkdir -p "$FEATURE_DIR/validation-assets/run-$RUN_NUM/output"

# Run validation
cd "$ROOT"
node "$SCRIPT_DIR/validate.mjs" "$RUN_NUM"

# Print summary
echo ""
echo "Report: specs/mvp-to-product-2/validation-assets/validation-report-run-$RUN_NUM.md"
