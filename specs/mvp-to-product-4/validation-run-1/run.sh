#!/usr/bin/env bash
#
# Phase 4 Validation Runner
# Usage: bash specs/mvp-to-product-4/validation/run.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "============================================"
echo "  Phase 4: Accessibility & Production Quality"
echo "  Validation Runner"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is required but not found in PATH."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "Node.js: $NODE_VERSION"
echo "Project: $PROJECT_ROOT"
echo ""

# Create evidence directories
EVIDENCE_DIR="$PROJECT_ROOT/specs/mvp-to-product-4/validation-assets/run-1/output"
mkdir -p "$EVIDENCE_DIR"
echo "Evidence dir: $EVIDENCE_DIR"
echo ""

# Run validation
echo "Starting validation..."
echo ""

cd "$PROJECT_ROOT"
node specs/mvp-to-product-4/validation/validate.mjs
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed. See report for details."
fi

exit $EXIT_CODE
