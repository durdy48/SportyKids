#!/usr/bin/env bash
set -euo pipefail

# SportyKids — Test Environment Setup for PRD3 validation
# Usage: bash specs/product-owner-proposals/create-environment.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $API_PID $WEB_PID 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT

cd "$ROOT_DIR"

echo "=== SportyKids Test Environment ==="
echo ""

# 1. Install dependencies
echo "[1/5] Installing dependencies..."
npm install --silent 2>/dev/null || npm install

# 2. Generate Prisma client
echo "[2/5] Generating Prisma client..."
cd apps/api
npx prisma generate 2>/dev/null
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null
cd "$ROOT_DIR"

# 3. Start API server
echo "[3/5] Starting API server on :3001..."
cd apps/api
npx tsx src/index.ts &
API_PID=$!
cd "$ROOT_DIR"

# 4. Start web server
echo "[4/5] Starting web server on :3000..."
cd apps/web
npx next dev -p 3000 &
WEB_PID=$!
cd "$ROOT_DIR"

# 5. Wait for services
echo "[5/5] Waiting for services to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "  ✓ API ready at http://localhost:3001"
    break
  fi
  sleep 1
done

for i in $(seq 1 60); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "  ✓ Web ready at http://localhost:3000"
    break
  fi
  sleep 1
done

echo ""
echo "=== Environment Ready ==="
echo ""
echo "  API:  http://localhost:3001/api"
echo "  Web:  http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

# Keep running
wait
