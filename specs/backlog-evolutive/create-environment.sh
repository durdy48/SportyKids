#!/bin/bash
set -e

# SportyKids — Test Environment Setup
# Starts API server with seeded database for human validation

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"

cleanup() {
  echo ""
  echo "Stopping services..."
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  echo "Done."
}
trap cleanup EXIT

echo "=== SportyKids Test Environment Setup ==="
echo ""

# 1. Generate Prisma client
echo "[1/4] Generating Prisma client..."
cd "$API_DIR"
npx prisma generate --schema=prisma/schema.prisma 2>/dev/null

# 2. Run migrations
echo "[2/4] Running database migrations..."
npx prisma migrate dev --skip-generate 2>/dev/null || true

# 3. Seed database
echo "[3/4] Seeding database..."
npx tsx prisma/seed.ts 2>/dev/null || echo "  (seed may already exist)"

# 4. Start API server
echo "[4/4] Starting API server..."
cd "$PROJECT_ROOT"
npx tsx apps/api/src/index.ts &
API_PID=$!

# Wait for API to be ready
echo ""
echo "Waiting for API to start..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "API is ready!"
    break
  fi
  sleep 1
done

echo ""
echo "=== Environment Ready ==="
echo "  API:  http://localhost:3001"
echo "  Web:  Run 'npm run dev:web' in another terminal for http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop."
echo ""

# Keep running until interrupted
wait "$API_PID"
