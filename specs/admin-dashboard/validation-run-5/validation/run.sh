#!/usr/bin/env bash
# Admin Dashboard — Validation Run 5 (prd3.md: Operations & Jobs)
# Usage: bash specs/admin-dashboard/validation/run.sh [--no-exit]
#
# Prerequisites:
#   - API running at http://localhost:3001  (npm run dev:api)
#   - PostgreSQL running                   (docker compose -f apps/api/docker-compose.yml up -d postgres)
#
# Options:
#   --no-exit   Do not exit with error code on failures (useful for CI with continue-on-error)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
VALIDATE_SCRIPT="${SCRIPT_DIR}/validate.mjs"
REPORT_PATH="${SCRIPT_DIR}/../validation-assets/validation-report-run-5.md"

NO_EXIT=false
for arg in "$@"; do
  if [[ "$arg" == "--no-exit" ]]; then
    NO_EXIT=true
  fi
done

echo "=== Admin Dashboard — Validation Run 5 (prd3.md: Operations & Jobs) ==="
echo "Repo root : ${REPO_ROOT}"
echo "Script    : ${VALIDATE_SCRIPT}"
echo "Report    : ${REPORT_PATH}"
echo ""

# Check Node.js is available and version >= 18
if ! command -v node &>/dev/null; then
  echo "ERROR: node not found. Please install Node.js >= 18." >&2
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [[ "${NODE_MAJOR}" -lt 18 ]]; then
  echo "ERROR: Node.js >= 18 is required (found: $(node --version))." >&2
  exit 1
fi

# Ensure output directories exist
mkdir -p "${SCRIPT_DIR}/../validation-assets/run-5/api"
mkdir -p "${SCRIPT_DIR}/../validation-assets/run-5/output"

# Run the validation script from the repo root so relative paths work
cd "${REPO_ROOT}"

EXIT_CODE=0
node "${VALIDATE_SCRIPT}" || EXIT_CODE=$?

echo ""
if [[ -f "${REPORT_PATH}" ]]; then
  echo "Report generated: ${REPORT_PATH}"
else
  echo "WARNING: Report not generated at expected path: ${REPORT_PATH}"
fi

if [[ "${NO_EXIT}" == "true" ]]; then
  echo "Exit code: ${EXIT_CODE} (--no-exit flag set, not propagating)"
  exit 0
fi

exit "${EXIT_CODE}"
