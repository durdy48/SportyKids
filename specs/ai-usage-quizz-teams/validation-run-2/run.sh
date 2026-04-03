#!/usr/bin/env bash
# Run 2 validation — Groq AI Provider + Explicar Fácil
# Usage: bash specs/ai-usage-quizz-teams/validation/run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo ""
echo "=== SportyKids — Validation Run 2 ==="
echo "    Groq AI Provider + Explicar Fácil mobile"
echo "    Repo: $REPO_ROOT"
echo ""

# Create evidence directories
mkdir -p "$REPO_ROOT/specs/ai-usage-quizz-teams/validation-assets/run-2/api"
mkdir -p "$REPO_ROOT/specs/ai-usage-quizz-teams/validation-assets/run-2/output"

echo "  [setup] Evidence directories ready"
echo ""

# Run the validation script
node "$SCRIPT_DIR/validate.mjs"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "  All checks passed (or skipped). See report:"
  echo "  $REPO_ROOT/specs/ai-usage-quizz-teams/validation-assets/validation-report-run-2.md"
else
  echo "  One or more checks FAILED. See report:"
  echo "  $REPO_ROOT/specs/ai-usage-quizz-teams/validation-assets/validation-report-run-2.md"
fi
echo ""

exit $EXIT_CODE
