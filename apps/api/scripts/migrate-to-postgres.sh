#!/bin/bash
# ===========================================================================
# Migration script: SQLite -> PostgreSQL
# ===========================================================================
#
# Prerequisites:
#   1. PostgreSQL running (docker compose up -d postgres)
#   2. .env updated with PostgreSQL DATABASE_URL:
#        DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids"
#
# This script:
#   1. Backs up schema.prisma
#   2. Checks PostgreSQL health
#   3. Updates the provider to postgresql
#   4. Runs prisma migrate dev
#   5. Generates the Prisma client
#   6. Optionally seeds the database
#
# Rollback:
#   bash apps/api/scripts/migrate-to-postgres.sh --rollback
#
# ===========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$API_DIR/prisma/schema.prisma"
BACKUP_FILE="$SCHEMA_FILE.bak"
BACKUP_TIMESTAMP="$SCHEMA_FILE.bak.$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------------------------------------------------------------------------
# Rollback mode
# ---------------------------------------------------------------------------

if [[ "${1:-}" == "--rollback" ]]; then
  echo ""
  echo "=== SportyKids: PostgreSQL -> SQLite Rollback ==="
  echo ""

  if [[ ! -f "$BACKUP_FILE" ]]; then
    log_error "No backup found at $BACKUP_FILE"
    log_warn "Looking for timestamped backups..."
    ls -la "$SCHEMA_FILE.bak."* 2>/dev/null || log_error "No backups found"
    exit 1
  fi

  log_info "Restoring schema.prisma from backup..."
  cp "$BACKUP_FILE" "$SCHEMA_FILE"

  log_info "Regenerating Prisma client..."
  cd "$API_DIR"
  npx prisma generate

  echo ""
  log_info "Rollback complete! Schema restored to SQLite."
  log_warn "Remember to update .env: DATABASE_URL=\"file:./dev.db\""
  log_warn "Then run: npx prisma migrate dev"
  echo ""
  exit 0
fi

# ---------------------------------------------------------------------------
# Migration mode
# ---------------------------------------------------------------------------

echo ""
echo "=== SportyKids: SQLite -> PostgreSQL Migration ==="
echo ""

# Step 0: Verify we're in the right directory
if [[ ! -f "$SCHEMA_FILE" ]]; then
  log_error "schema.prisma not found at $SCHEMA_FILE"
  log_error "Run this script from the project root: bash apps/api/scripts/migrate-to-postgres.sh"
  exit 1
fi

# Step 1: Backup schema.prisma
log_info "Step 1: Backing up schema.prisma..."
cp "$SCHEMA_FILE" "$BACKUP_FILE"
cp "$SCHEMA_FILE" "$BACKUP_TIMESTAMP"
log_info "  Backup saved to: $BACKUP_FILE"
log_info "  Timestamped backup: $BACKUP_TIMESTAMP"

# Step 2: Check PostgreSQL health
log_info "Step 2: Checking PostgreSQL connectivity..."

PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
PG_USER="${PGUSER:-sportykids}"

if command -v pg_isready &> /dev/null; then
  if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" > /dev/null 2>&1; then
    log_error "PostgreSQL is not running or not accessible at $PG_HOST:$PG_PORT"
    log_warn "Start PostgreSQL with: docker compose -f apps/api/docker-compose.yml up -d postgres"
    log_warn "Then wait a few seconds and retry."
    # Restore backup
    cp "$BACKUP_FILE" "$SCHEMA_FILE"
    exit 1
  fi
  log_info "  PostgreSQL is ready at $PG_HOST:$PG_PORT"
else
  log_warn "  pg_isready not found — skipping health check"
  log_warn "  Make sure PostgreSQL is running before continuing"
fi

# Step 3: Verify DATABASE_URL points to PostgreSQL
if [[ -f "$API_DIR/.env" ]]; then
  if grep -q "file:.*\.db" "$API_DIR/.env" 2>/dev/null; then
    log_error "DATABASE_URL in .env still points to SQLite!"
    log_error "Update .env first:"
    log_error '  DATABASE_URL="postgresql://sportykids:sportykids@localhost:5432/sportykids"'
    # Restore backup
    cp "$BACKUP_FILE" "$SCHEMA_FILE"
    exit 1
  fi
fi

# Step 4: Update datasource provider
log_info "Step 3: Updating schema.prisma provider to postgresql..."
if grep -q 'provider = "sqlite"' "$SCHEMA_FILE"; then
  sed -i.tmp 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA_FILE"
  rm -f "$SCHEMA_FILE.tmp"
  log_info "  Provider updated to postgresql"
else
  log_warn "  Provider is not sqlite — may already be postgresql"
fi

# Step 5: JSON string fields note
log_info "Step 4: JSON string fields remain as String type."
log_info "  (Future: convert to native Json/String[] types when ready)"

# Step 6: Run migrations
log_info "Step 5: Running prisma migrate dev..."
cd "$API_DIR"
if ! npx prisma migrate dev --name postgres_migration; then
  log_error "Migration failed! Restoring backup..."
  cp "$BACKUP_FILE" "$SCHEMA_FILE"
  npx prisma generate 2>/dev/null || true
  exit 1
fi

# Step 7: Generate client
log_info "Step 6: Regenerating Prisma client..."
npx prisma generate

# Step 8: Optional seed
echo ""
read -p "Seed the PostgreSQL database? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  log_info "Step 7: Seeding database..."
  npx tsx prisma/seed.ts
  log_info "  Seed complete!"
else
  log_info "Step 7: Skipping seed (run manually: npx tsx prisma/seed.ts)"
fi

echo ""
echo "=== Migration complete! ==="
echo ""
log_info "Your database is now PostgreSQL."
log_info "Backup saved at: $BACKUP_FILE"
echo ""
log_warn "To rollback: bash apps/api/scripts/migrate-to-postgres.sh --rollback"
echo ""
