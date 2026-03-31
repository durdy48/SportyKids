#!/usr/bin/env bash
set -euo pipefail

# SportyKids — Mobile Security & Moderation test environment
# Usage: bash specs/mvp-to-product-2/create-environment.sh

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

cleanup() {
  echo ""
  echo "🛑 Shutting down services..."
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT

# 1. Ensure dependencies are installed
echo "📦 Installing dependencies..."
npm install --silent 2>/dev/null

# 2. Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=apps/api/prisma/schema.prisma 2>/dev/null

# 3. Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma 2>/dev/null

# 4. Seed database
echo "🌱 Seeding database..."
(cd apps/api && npx tsx prisma/seed.ts 2>/dev/null) || echo "⚠️  Seed skipped (may already exist)"

# 5. Start API server
echo "🚀 Starting API server on port 3001..."
npm run dev:api > /tmp/sportykids-api.log 2>&1 &
API_PID=$!

# 6. Start Web server
echo "🌐 Starting Web server on port 3000..."
npm run dev:web > /tmp/sportykids-web.log 2>&1 &
WEB_PID=$!

# 7. Wait for services to be healthy
echo "⏳ Waiting for API to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ API is ready at http://localhost:3001"
    break
  fi
  [ "$i" -eq 30 ] && echo "❌ API failed to start. Check /tmp/sportykids-api.log"
  sleep 2
done

echo "⏳ Waiting for Web to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Web is ready at http://localhost:3000"
    break
  fi
  [ "$i" -eq 30 ] && echo "❌ Web failed to start. Check /tmp/sportykids-web.log"
  sleep 2
done

echo ""
echo "========================================="
echo "  SportyKids Test Environment Ready"
echo "========================================="
echo "  API:  http://localhost:3001"
echo "  Web:  http://localhost:3000"
echo "  Logs: /tmp/sportykids-api.log"
echo "        /tmp/sportykids-web.log"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all services."
wait
