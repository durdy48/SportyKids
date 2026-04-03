#!/usr/bin/env bash
# Validation script runner — Run 5
# Feature: prd3.md Quiz Variety (+ regression checks 1-33)
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
#   specs/ai-usage-quizz-teams/validation-assets/run-5/
#
# Report is written to:
#   specs/ai-usage-quizz-teams/validation-assets/validation-report-run-5.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

echo ""
echo "=== SportyKids — Validation Run 5 (prd3.md: Quiz Variety) ==="
echo "    Repo root : ${REPO_ROOT}"
echo "    Script    : ${SCRIPT_DIR}/validate.mjs"
echo ""

# Ensure evidence directories exist
mkdir -p "${REPO_ROOT}/specs/ai-usage-quizz-teams/validation-assets/run-5/api"
mkdir -p "${REPO_ROOT}/specs/ai-usage-quizz-teams/validation-assets/run-5/output"

# Run the validation script
node "${SCRIPT_DIR}/validate.mjs"
