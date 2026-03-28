#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "============================================"
echo "Validation Run 14 — post /t-review #2"
echo "============================================"

# Pre-flight: check Node
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found"
  exit 1
fi

# Create evidence directories
mkdir -p "$SCRIPT_DIR/../validation-assets/run-14/api"
mkdir -p "$SCRIPT_DIR/../validation-assets/run-14/output"

# Run validation
cd "$ROOT_DIR"
node "$SCRIPT_DIR/validate.mjs"
