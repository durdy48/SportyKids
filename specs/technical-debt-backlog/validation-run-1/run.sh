#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../validation-assets"

echo "=== PRD-1 Validation Runner ==="
echo "Project: $PROJECT_ROOT"
echo ""

# Pre-flight: check node
if ! command -v node &>/dev/null; then
  echo "ERROR: node not found"
  exit 1
fi

# Create evidence directory
mkdir -p "$ASSETS_DIR/run-1/api" "$ASSETS_DIR/run-1/output"

# Ensure no leftover API on port 3099
lsof -ti:3099 | xargs kill -9 2>/dev/null || true

# Run validation
cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/validate.mjs"
EXIT_CODE=$?

echo ""
echo "Report: specs/technical-debt-backlog/validation-assets/validation-report-run-1.md"
exit $EXIT_CODE
