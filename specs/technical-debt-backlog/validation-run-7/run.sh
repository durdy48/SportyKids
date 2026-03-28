#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "=== Validation Run 7 ==="

# Create evidence dirs
mkdir -p "$SCRIPT_DIR/../validation-assets/run-7/api"
mkdir -p "$SCRIPT_DIR/../validation-assets/run-7/output"

# Run validation
cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/validate.mjs"
EXIT=$?

echo ""
echo "Report: specs/technical-debt-backlog/validation-assets/validation-report-run-7.md"
exit $EXIT
