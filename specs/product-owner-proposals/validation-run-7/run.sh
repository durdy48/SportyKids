#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RUN=7

echo "=== SportyKids Validation Run $RUN ==="
echo ""

# Create evidence directory
mkdir -p "$ROOT/specs/product-owner-proposals/validation-assets/run-$RUN/output"

# Run validation
export VALIDATION_RUN=$RUN
node "$SCRIPT_DIR/validate.mjs"
