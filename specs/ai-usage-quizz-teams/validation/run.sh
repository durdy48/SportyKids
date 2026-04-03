#!/usr/bin/env bash
# Validation script runner — Run 6
# Feature: prd3.md Quiz Variety + /t-review #3 fixes (Appendix D checks 51-56)
#          + regression checks 1-50
#
# Usage:
#   bash specs/ai-usage-quizz-teams/validation/run.sh
#
# Options:
#   API_RUNNING=1  bash ...run.sh   — skip API start attempt (API already running on :3001)
#
# Prerequisites:
#   - Node >= 20 installed
#   - npm workspaces installed (npm install at repo root)
#   - PostgreSQL running (docker compose -f apps/api/docker-compose.yml up -d postgres)
#   - apps/api/.env configured (DATABASE_URL, optional GROQ_API_KEY)
#
# Evidence is written to:
#   specs/ai-usage-quizz-teams/validation-assets/run-6/
#
# Report is written to:
#   specs/ai-usage-quizz-teams/validation-assets/validation-report-run-6.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

echo ""
echo "=== SportyKids — Validation Run 6 (post /t-review #3: Appendix D) ==="
echo "    Repo root : ${REPO_ROOT}"
echo "    Script    : ${SCRIPT_DIR}/validate.mjs"
echo ""

# Ensure evidence directories exist
mkdir -p "${REPO_ROOT}/specs/ai-usage-quizz-teams/validation-assets/run-6/api"
mkdir -p "${REPO_ROOT}/specs/ai-usage-quizz-teams/validation-assets/run-6/output"

# Run the validation script
node "${SCRIPT_DIR}/validate.mjs"
