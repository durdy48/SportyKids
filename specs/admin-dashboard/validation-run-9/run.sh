#!/usr/bin/env bash
# Admin Dashboard Validation Run 9
# Usage: bash specs/admin-dashboard/validation/run.sh [--no-exit]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "=== Admin Dashboard Validation Run 9 ==="
echo "Repo root: $REPO_ROOT"
echo ""

cd "$REPO_ROOT"

node "$SCRIPT_DIR/validate.mjs" "$@"
