#!/usr/bin/env bash
# Validation Run 4 — post /t-review #2
# Usage: bash specs/ai-usage-quizz-teams/validation/run.sh
# Run from repo root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

echo "=== SportyKids — Validation Run 4 ==="
echo "    Repo root : ${REPO_ROOT}"
echo "    Script    : ${SCRIPT_DIR}/validate.mjs"
echo ""

cd "${REPO_ROOT}"

node "${SCRIPT_DIR}/validate.mjs"
