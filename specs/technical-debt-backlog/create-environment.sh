#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "=== SportyKids Test Environment Setup ==="

# Install dependencies
echo "Installing dependencies..."
npm ci --prefer-offline 2>/dev/null || npm install

# Start PostgreSQL via Docker
echo "Starting PostgreSQL..."
if command -v docker-compose &>/dev/null; then
  docker-compose -f apps/api/docker-compose.yml up -d postgres
elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  docker compose -f apps/api/docker-compose.yml up -d postgres
else
  echo "WARNING: Docker not found. Ensure PostgreSQL is running at localhost:5432"
fi

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec sportykids-postgres pg_isready -U sportykids > /dev/null 2>&1; then
    echo "PostgreSQL is healthy!"
    break
  fi
  sleep 1
done

# Generate Prisma client
echo "Generating Prisma client..."
cd apps/api && npx prisma generate && cd "$PROJECT_ROOT"

# Run migrations
echo "Running database migrations..."
cd apps/api && DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids" npx prisma migrate deploy 2>/dev/null || true && cd "$PROJECT_ROOT"

# Seed data
echo "Seeding database..."
cd apps/api && npx tsx prisma/seed.ts 2>/dev/null || echo "Seed skipped (may already exist)" && cd "$PROJECT_ROOT"

# Start API in background
echo "Starting API server..."
npm run dev:api &
API_PID=$!

# Cleanup trap
trap "echo 'Stopping services...'; kill $API_PID 2>/dev/null; exit" EXIT INT TERM

# Wait for API to be healthy
echo "Waiting for API..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "API is healthy!"
    break
  fi
  sleep 1
done

echo ""
echo "=== Environment Ready ==="
echo "  API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services."
wait
