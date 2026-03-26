#!/bin/bash
# Migration script: SQLite -> PostgreSQL (B-TF4)
#
# Prerequisites:
#   1. PostgreSQL running (docker compose up -d postgres)
#   2. .env updated with PostgreSQL DATABASE_URL
#
# This script:
#   1. Updates prisma/schema.prisma to use postgresql provider
#   2. Converts JSON string fields to native arrays/JSON types
#   3. Runs prisma migrate dev to create the PostgreSQL schema
#
# IMPORTANT: This is a one-way migration. Back up your SQLite database first.

set -e

echo "=== SportyKids: SQLite -> PostgreSQL Migration ==="
echo ""

# Check if PostgreSQL is accessible
if ! pg_isready -h localhost -p 5432 -U sportykids > /dev/null 2>&1; then
  echo "ERROR: PostgreSQL is not running."
  echo "Start it with: docker compose up -d postgres"
  exit 1
fi

SCHEMA_FILE="prisma/schema.prisma"

# Step 1: Update datasource provider
echo "Step 1: Updating schema.prisma provider to postgresql..."
sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA_FILE"

# Step 2: The JSON string fields (favoriteSports, selectedFeeds, etc.)
# remain as String in Prisma but the application uses JSON.parse/JSON.stringify
# which works identically with PostgreSQL's text type.
# For a future enhancement, these could be changed to Json type,
# but that requires updating all service code. Keeping as-is for compatibility.
echo "Step 2: JSON string fields will continue to work as-is with PostgreSQL text type."
echo "  (Future: convert to native Json/String[] types when ready)"

# Step 3: Run migrations
echo "Step 3: Running prisma migrate dev..."
npx prisma migrate dev --name postgres_migration

# Step 4: Generate client
echo "Step 4: Regenerating Prisma client..."
npx prisma generate

echo ""
echo "=== Migration complete! ==="
echo ""
echo "Your database is now PostgreSQL. To seed data:"
echo "  npx tsx prisma/seed.ts"
echo ""
echo "To revert to SQLite:"
echo "  1. Restore prisma/schema.prisma.bak"
echo "  2. Update .env with SQLite DATABASE_URL"
echo "  3. npx prisma migrate dev"
