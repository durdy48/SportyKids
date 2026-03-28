#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "=== Validation Run 3 ==="

# Pre-flight: Check Docker/PostgreSQL
if ! docker ps 2>/dev/null | grep -q sportykids-postgres; then
  echo "ERROR: PostgreSQL container not running. Start with:"
  echo "  docker-compose -f apps/api/docker-compose.yml up -d postgres"
  exit 1
fi

# Create evidence dirs
mkdir -p "$SCRIPT_DIR/../validation-assets/run-3/api"
mkdir -p "$SCRIPT_DIR/../validation-assets/run-3/output"

# Ensure no leftover API on port 3099
lsof -ti:3099 | xargs kill -9 2>/dev/null || true

# Run validation
cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/validate.mjs"
EXIT=$?

echo ""
echo "Report: specs/technical-debt-backlog/validation-assets/validation-report-run-3.md"
exit $EXIT
