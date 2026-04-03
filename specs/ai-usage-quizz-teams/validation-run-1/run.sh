#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SportyKids — Groq AI Provider + Explicar Fácil
# Validation runner — Run 1
#
# Usage (from any directory):
#   bash specs/ai-usage-quizz-teams/validation/run.sh
#
# Or from repo root:
#   ./specs/ai-usage-quizz-teams/validation/run.sh
# ---------------------------------------------------------------------------

set -euo pipefail

# Resolve repo root (directory containing this script's grandparent: specs/../)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

echo "=================================================="
echo " SportyKids — Groq + Explicar Fácil Validation"
echo " Run 1"
echo "=================================================="
echo "Repo root : ${REPO_ROOT}"
echo "Script    : ${SCRIPT_DIR}/validate.mjs"
echo ""

# --- Check node is available ---
if ! command -v node &>/dev/null; then
  echo "[ERROR] node is not available in PATH. Install Node.js >= 20 and try again."
  exit 1
fi

NODE_VERSION=$(node --version)
echo "Node      : ${NODE_VERSION}"
echo ""

# --- Ensure output directories exist (idempotent) ---
API_DIR="${REPO_ROOT}/specs/ai-usage-quizz-teams/validation-assets/run-1/api"
OUTPUT_DIR="${REPO_ROOT}/specs/ai-usage-quizz-teams/validation-assets/run-1/output"

mkdir -p "${API_DIR}"
mkdir -p "${OUTPUT_DIR}"

echo "Directories:"
echo "  API payloads : ${API_DIR}"
echo "  Output       : ${OUTPUT_DIR}"
echo ""

# --- Run the validation script from repo root ---
cd "${REPO_ROOT}"

echo "Running validation..."
echo "--------------------------------------------------"

node specs/ai-usage-quizz-teams/validation/validate.mjs
EXIT_CODE=$?

echo "--------------------------------------------------"
echo ""

if [ ${EXIT_CODE} -eq 0 ]; then
  echo "Result: ALL NON-SKIPPED CHECKS PASSED"
else
  echo "Result: ONE OR MORE CHECKS FAILED (exit code ${EXIT_CODE})"
fi

echo ""
echo "Report : ${REPO_ROOT}/specs/ai-usage-quizz-teams/validation-assets/validation-report-run-1.md"
echo "Summary: ${OUTPUT_DIR}/summary.txt"
echo ""

exit ${EXIT_CODE}
