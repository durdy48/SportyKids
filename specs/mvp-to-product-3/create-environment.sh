#!/usr/bin/env bash
set -euo pipefail

# Environment setup for mvp-to-product-3 validation
# This feature is infrastructure/config focused — no services to start.
# The validation is done by inspecting files, running tests, and optionally building Docker.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "=== SportyKids — Store Assets & Deployment Validation Environment ==="
echo ""
echo "Project root: $PROJECT_ROOT"
echo ""

# 1. Verify dependencies are installed
echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm ci
else
  echo "  node_modules present."
fi

# 2. Generate assets if missing
if [ ! -f "apps/mobile/src/assets/icon.png" ]; then
  echo "  Generating placeholder assets..."
  cd apps/mobile && node scripts/generate-assets.mjs
  cd "$PROJECT_ROOT"
else
  echo "  Assets already generated."
fi

# 3. Run tests
echo ""
echo "Running tests..."
echo ""

echo "--- Mobile tests ---"
cd apps/mobile && npx vitest run 2>&1 || true
cd "$PROJECT_ROOT"

echo ""
echo "--- Web tests ---"
cd apps/web && npx vitest run 2>&1 || true
cd "$PROJECT_ROOT"

echo ""
echo "--- Lint ---"
npx eslint . --max-warnings 0 2>&1 || true

echo ""
echo "=== Environment ready ==="
echo ""
echo "Validation steps:"
echo "  1. Review generated assets: apps/mobile/src/assets/"
echo "  2. Review config.ts: apps/mobile/src/config.ts"
echo "  3. Review Dockerfile: apps/api/Dockerfile"
echo "  4. Review fly.toml: fly.toml"
echo "  5. Review CI: .github/workflows/ci.yml"
echo "  6. Review EAS: apps/mobile/eas.json"
echo "  7. Review docs: docs/{en,es}/11-store-deployment.md"
echo "  8. Review metadata: apps/mobile/store-metadata/{en,es}.json"
echo "  9. (Optional) Build Docker: docker build -f apps/api/Dockerfile -t sportykids-api ."
echo ""
