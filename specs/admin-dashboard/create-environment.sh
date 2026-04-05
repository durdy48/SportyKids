#!/bin/bash
# create-environment.sh
# Sets up the test environment for admin dashboard validation.
# Run from the repo root: bash specs/admin-dashboard/create-environment.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== SportyKids Admin Dashboard — Test Environment Setup ==="
echo ""

# ─── 1. Install dependencies ────────────────────────────────────────────────
echo "[1/5] Installing dependencies..."
npm install --registry=https://registry.npmjs.org/ 2>&1 | tail -5

# ─── 2. Start PostgreSQL via Docker Compose ──────────────────────────────────
echo "[2/5] Starting PostgreSQL..."
docker compose -f apps/api/docker-compose.yml up -d postgres
echo "Waiting for PostgreSQL to be ready..."
sleep 3

# ─── 3. Run Prisma migrations + seed ─────────────────────────────────────────
echo "[3/5] Running database migrations..."
cd apps/api
DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids" \
  npx prisma migrate deploy

echo "Seeding database..."
DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids" \
  npx tsx prisma/seed.ts

cd "$REPO_ROOT"

# ─── 4. Create admin user ────────────────────────────────────────────────────
echo "[4/5] Creating admin user (admin@sportykids.com)..."
DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids" \
  npx tsx apps/api/scripts/create-admin.ts admin@sportykids.com

# ─── 5. Print start commands ─────────────────────────────────────────────────
echo ""
echo "[5/5] Environment ready. Start the servers:"
echo ""
echo "  Terminal 1 — API:"
echo "    DATABASE_URL='postgresql://sportykids:sportykids@localhost:5432/sportykids' \\"
echo "    JWT_SECRET='dev-secret' JWT_REFRESH_SECRET='dev-refresh-secret' \\"
echo "    npm run dev:api"
echo ""
echo "  Terminal 2 — Web:"
echo "    NEXT_PUBLIC_API_URL='http://localhost:3001/api' npm run dev:web"
echo ""
echo "  Then open: http://localhost:3000"
echo "  Admin URL: http://localhost:3000/admin"
echo "  Login:     admin@sportykids.com (see password above)"
echo ""
echo "  Validation checklist: specs/admin-dashboard/validation.md"
