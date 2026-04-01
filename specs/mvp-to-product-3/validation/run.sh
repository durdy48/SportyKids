#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FEATURE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$FEATURE_DIR/../.." && pwd)"

echo "=== SportyKids Validation — mvp-to-product-3 ==="
echo "Project root: $PROJECT_ROOT"
echo ""

# Pre-flight: check node
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Please install Node >= 20."
  exit 1
fi

# Pre-flight: check node_modules
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo "Installing dependencies..."
  cd "$PROJECT_ROOT" && npm ci
fi

# Create evidence directory
RUN_DIR="$FEATURE_DIR/validation-assets/run-2"
mkdir -p "$RUN_DIR/output"

# Run validation
echo "Running validation script..."
echo ""

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/validate.mjs"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "🎉 All checks passed!"
else
  echo "⚠️  Some checks failed. See report for details."
fi

echo "Report: $FEATURE_DIR/validation-assets/validation-report-run-2.md"
exit $EXIT_CODE
