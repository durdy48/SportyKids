#!/usr/bin/env bash
# Environment setup for human validation of ai-usage-quizz-teams features.
# Run from the repo root: bash specs/ai-usage-quizz-teams/create-environment.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Cleanup trap — stop background processes on exit
API_PID=""
WEB_PID=""
cleanup() {
  echo ""
  echo "Stopping services..."
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "ERROR: node is required"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm is required";  exit 1; }

# Warn if no Groq key (AI features will degrade gracefully)
if [[ -z "${GROQ_API_KEY:-}" ]]; then
  echo "WARNING: GROQ_API_KEY is not set. The 'Explain it Easy' button will show an error state."
  echo "         Get a free key at https://console.groq.com and re-run:"
  echo "         GROQ_API_KEY=gsk_... bash specs/ai-usage-quizz-teams/create-environment.sh"
fi

# ---------------------------------------------------------------------------
# 2. Install dependencies
# ---------------------------------------------------------------------------
echo "Installing dependencies..."
npm install --silent

# ---------------------------------------------------------------------------
# 3. Start PostgreSQL (Docker)
# ---------------------------------------------------------------------------
echo "Starting PostgreSQL..."
docker compose -f apps/api/docker-compose.yml up -d postgres 2>/dev/null || \
  echo "WARNING: Could not start Docker PostgreSQL. Ensure it's running manually."

# Wait for postgres to be ready
echo "Waiting for PostgreSQL..."
for i in $(seq 1 20); do
  if docker compose -f apps/api/docker-compose.yml exec -T postgres pg_isready -U sportykids >/dev/null 2>&1; then
    echo "PostgreSQL ready."
    break
  fi
  sleep 1
done

# Run migrations
echo "Running database migrations..."
cd apps/api
DATABASE_URL="${DATABASE_URL:-postgresql://sportykids:sportykids@localhost:5432/sportykids}" \
  npx prisma migrate deploy --schema prisma/schema.prisma 2>/dev/null || true
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# 4. Seed test data
# ---------------------------------------------------------------------------
echo "Seeding database..."
cd apps/api
DATABASE_URL="${DATABASE_URL:-postgresql://sportykids:sportykids@localhost:5432/sportykids}" \
  npx tsx prisma/seed.ts 2>/dev/null || echo "WARNING: Seed failed or already seeded."
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# 5. Start API server
# ---------------------------------------------------------------------------
echo "Starting API server on :3001..."
AI_PROVIDER="${AI_PROVIDER:-groq}" \
GROQ_API_KEY="${GROQ_API_KEY:-}" \
DATABASE_URL="${DATABASE_URL:-postgresql://sportykids:sportykids@localhost:5432/sportykids}" \
  npm run dev:api &
API_PID=$!

# Wait for API health check
echo "Waiting for API..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "API ready at http://localhost:3001"
    break
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# 6. Start Web app
# ---------------------------------------------------------------------------
echo "Starting web app on :3000..."
npm run dev:web &
WEB_PID=$!

# Wait for Next.js
echo "Waiting for web app..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    echo "Web app ready at http://localhost:3000"
    break
  fi
  sleep 2
done

# ---------------------------------------------------------------------------
# 7. Summary
# ---------------------------------------------------------------------------
echo ""
echo "======================================================================"
echo "  SportyKids — Test environment ready"
echo "======================================================================"
echo "  API:       http://localhost:3001"
echo "  Web app:   http://localhost:3000"
echo "  Groq AI:   ${GROQ_API_KEY:+configured}${GROQ_API_KEY:-NOT SET (AI features will show error)}"
echo "======================================================================"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Keep script alive until Ctrl+C
wait
