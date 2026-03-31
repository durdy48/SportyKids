#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Validation Run 2 — Mobile Security & Moderation
#
# Re-runs all 30 original checks (regression) plus 7 Appendix-A checks
# that verify code-review fixes.
#
# Usage:
#   bash specs/mvp-to-product-2/validation/run.sh
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EVIDENCE_DIR="$ROOT/specs/mvp-to-product-2/validation-assets/run-2"
REPORT_PATH="$ROOT/specs/mvp-to-product-2/validation-assets/validation-report-run-2.md"

echo ""
echo "========================================"
echo "  SportyKids — Validation Run 2"
echo "  Mobile Security & Moderation"
echo "========================================"
echo ""

# -------------------------------------------------------------------------
# Pre-flight checks
# -------------------------------------------------------------------------

# Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed or not in PATH."
  exit 1
fi
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# npm / npx
if ! command -v npx &>/dev/null; then
  echo "ERROR: npx is not available."
  exit 1
fi

# Check we are in the right repo
if [ ! -f "$ROOT/package.json" ]; then
  echo "ERROR: Could not find package.json at project root ($ROOT)."
  exit 1
fi

# -------------------------------------------------------------------------
# Create evidence directories
# -------------------------------------------------------------------------
echo ""
echo "Creating evidence directory: $EVIDENCE_DIR"
mkdir -p "$EVIDENCE_DIR"

# -------------------------------------------------------------------------
# Run validation script
# -------------------------------------------------------------------------
echo ""
echo "Running validation script..."
echo "---"

cd "$ROOT"

EXIT_CODE=0
node "$SCRIPT_DIR/validate.mjs" || EXIT_CODE=$?

echo ""
echo "---"

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
if [ $EXIT_CODE -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  echo ""
  echo "Report: $REPORT_PATH"
  echo "Evidence: $EVIDENCE_DIR"
elif [ $EXIT_CODE -eq 1 ]; then
  echo "SOME CHECKS FAILED (see report for details)"
  echo ""
  echo "Report: $REPORT_PATH"
  echo "Evidence: $EVIDENCE_DIR"
else
  echo "VALIDATION SCRIPT CRASHED (exit code $EXIT_CODE)"
fi

echo ""
exit $EXIT_CODE
