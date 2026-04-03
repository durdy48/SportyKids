#!/usr/bin/env bash
# Run 3 validation script for ai-usage-quizz-teams feature
# Covers checks 1-17 (regression: prd.md + Appendix A) and checks 18-27 (Appendix B: prd2.md)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEATURE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$(dirname "$FEATURE_DIR")")"

echo ""
echo "=== SportyKids — Validation Run 3 ==="
echo "  Feature  : Groq AI Provider + Explicar Fácil + Entity Onboarding"
echo "  Repo root: ${REPO_ROOT}"
echo ""

# Check node is available
if ! command -v node &>/dev/null; then
  echo "ERROR: node is not installed or not in PATH. Please install Node.js >= 20."
  exit 1
fi

NODE_VERSION=$(node --version)
echo "  Node version: ${NODE_VERSION}"

# Create evidence directories for Run 3
echo "  Creating evidence directories..."
mkdir -p "${FEATURE_DIR}/validation-assets/run-3/api"
mkdir -p "${FEATURE_DIR}/validation-assets/run-3/output"
mkdir -p "${FEATURE_DIR}/validation-assets"

echo "  Directories ready."
echo ""

# Run the validation script from the feature folder
echo "  Running validate.mjs..."
echo ""
node "${SCRIPT_DIR}/validate.mjs"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "=== All checks passed (or skipped). Validation complete. ==="
else
  echo "=== One or more checks FAILED. See report for details. ==="
fi

echo ""
echo "  Full report: ${FEATURE_DIR}/validation-assets/validation-report-run-3.md"
echo ""

exit $EXIT_CODE
