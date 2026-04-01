#!/usr/bin/env bash
set -euo pipefail

# scripts/setup-staging.sh — Create and configure the staging environment on Fly.io
#
# Prerequisites:
#   - flyctl installed and authenticated (`fly auth login`)
#   - Repository root as working directory
#
# Usage:
#   bash scripts/setup-staging.sh

APP_NAME="sportykids-api-staging"
REGION="mad"

echo "=== SportyKids Staging Setup ==="

# 1. Create the Fly.io app (if it doesn't exist)
if fly apps list | grep -q "$APP_NAME"; then
  echo "[skip] App $APP_NAME already exists"
else
  echo "[create] Creating Fly.io app: $APP_NAME"
  fly apps create "$APP_NAME" --org personal
fi

# 2. Provision PostgreSQL (Fly Postgres)
PG_APP="${APP_NAME}-db"
if fly apps list | grep -q "$PG_APP"; then
  echo "[skip] Postgres app $PG_APP already exists"
else
  echo "[create] Provisioning PostgreSQL for staging"
  fly postgres create \
    --name "$PG_APP" \
    --region "$REGION" \
    --vm-size shared-cpu-1x \
    --initial-cluster-size 1 \
    --volume-size 1
  echo "[attach] Attaching PostgreSQL to $APP_NAME"
  fly postgres attach "$PG_APP" --app "$APP_NAME"
fi

# 3. Set required secrets
echo ""
echo "[secrets] Setting secrets for $APP_NAME..."
echo "You will be prompted for values. Press Enter to skip any secret."
echo ""

read -rp "JWT_SECRET (required): " JWT_SECRET
read -rp "JWT_REFRESH_SECRET (required): " JWT_REFRESH_SECRET
read -rp "SENTRY_DSN (optional, Enter to skip): " SENTRY_DSN

SECRETS="JWT_SECRET=$JWT_SECRET JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
if [ -n "$SENTRY_DSN" ]; then
  SECRETS="$SECRETS SENTRY_DSN=$SENTRY_DSN"
fi

fly secrets set $SECRETS --app "$APP_NAME"

# 4. Deploy
echo ""
echo "[deploy] Deploying to staging..."
fly deploy --config fly.staging.toml --app "$APP_NAME"

# 5. Seed the staging database
echo ""
echo "[seed] Seeding staging database with test data..."
fly ssh console --app "$APP_NAME" -C "npx tsx prisma/seed.ts"

echo ""
echo "=== Staging setup complete ==="
echo "API URL: https://$APP_NAME.fly.dev/api"
echo "Health:  https://$APP_NAME.fly.dev/api/health"
echo ""
echo "Next steps:"
echo "  1. Update apps/mobile/eas.json preview channel to point to https://$APP_NAME.fly.dev/api"
echo "  2. Build preview: eas build --profile preview --platform all"
