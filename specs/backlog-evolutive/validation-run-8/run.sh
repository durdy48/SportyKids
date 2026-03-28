#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../validation-assets/run-1"

echo "=== SportyKids Validation Runner — Run 1 ==="
echo ""

# Pre-flight: check API is running
if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "❌ API server not running at http://localhost:3001"
  echo "   Starting API server in background..."
  cd "$ROOT_DIR/apps/api"
  npx tsx src/index.ts &
  API_PID=$!
  echo "   Waiting for API to be ready..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
      echo "   ✅ API ready (PID=$API_PID)"
      break
    fi
    sleep 1
  done
  if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ❌ API failed to start after 30s"
    kill $API_PID 2>/dev/null || true
    exit 1
  fi
  cd "$ROOT_DIR"
fi

# Create evidence directories
mkdir -p "$ASSETS_DIR/api" "$ASSETS_DIR/output"

# Run validation
echo ""
cd "$ROOT_DIR"
node "$SCRIPT_DIR/validate.mjs"
