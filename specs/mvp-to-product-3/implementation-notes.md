# mvp-to-product-3 Store Assets & Deployment

# Implementation notes

## Requirements

All 10 PRD features (F1-F10) implemented:

- **F1: Asset Generation Script** — Implemented. `generate-assets.mjs` generates 5 PNG files via sharp with SVG overlays and self-validates dimensions.
- **F2: Dynamic API_BASE** — Implemented. Fallback chain: env var → EAS channel → debugger host → localhost. Exported `resolveApiBase()` for testability.
- **F3: Production Dockerfile** — Implemented. Multi-stage build (deps → builder → runner), non-root user, OpenSSL for Prisma, PORT 8080.
- **F4: Fly.io Configuration** — Implemented. `fly.toml` at project root, Madrid region, health check, auto-stop/start, Prisma migrate as release command.
- **F5: CI/CD Deploy Job** — Implemented. `deploy` job in GitHub Actions, only on push to main, depends on build jobs, concurrency protection.
- **F6: EAS Build & Submit Config** — Implemented. Channels, env vars, autoIncrement, appVersionSource: remote, submit placeholders.
- **F7: Store Account Setup Docs** — Implemented. `docs/en/11-store-deployment.md` and `docs/es/11-despliegue-tiendas.md`.
- **F8: ASO Metadata** — Implemented. `store-metadata/en.json` and `es.json` with name, subtitle, description, keywords, category.
- **F9: Screenshot Specifications** — Documented within F7 docs (not code — manual capture specs).
- **F10: Splash Screen Integration** — Implemented. `preventAutoHideAsync()` before mount, `hideAsync()` on root layout.

## Initial considerations

- sharp was chosen over Canvas/Puppeteer for asset generation — no GUI dependencies, works in CI, fast SVG→PNG.
- `fly.toml` placed at project root per Fly.io monorepo convention (build.dockerfile points to `apps/api/Dockerfile`).
- `updates.channel` type needed casting because Expo SDK types don't include `channel` in the updates config type.
- `expo-splash-screen` needed explicit installation — not auto-included in monorepo despite Expo SDK 54.

## Design

The implementation is additive — no existing application logic was modified. Key architectural decisions:

1. **API_BASE resolution** uses a pure function (`resolveApiBase()`) that reads from Constants and env at call time, enabling easy testing with module mocking.
2. **Docker build** is three-stage to minimize image size: deps-only layer for caching, full source for compilation, production artifacts only in final image.
3. **CI/CD deploy** is gated behind both `github.ref == 'refs/heads/main'` and `github.event_name == 'push'`, with `cancel-in-progress: false` to prevent deploy interruption.

## Implementation details

### New files created
- `apps/mobile/scripts/generate-assets.mjs` — Asset generation script with sharp SVG overlay + self-validation
- `apps/mobile/.env.example` — Mobile environment variable template
- `apps/mobile/store-metadata/en.json` — English ASO metadata
- `apps/mobile/store-metadata/es.json` — Spanish ASO metadata
- `apps/mobile/src/assets/icon.png` — 1024×1024 app icon (generated)
- `apps/mobile/src/assets/adaptive-icon.png` — 512×512 Android adaptive icon (generated)
- `apps/mobile/src/assets/splash-icon.png` — 200×200 splash icon (generated)
- `apps/mobile/src/assets/favicon.png` — 48×48 web favicon (generated)
- `apps/mobile/src/assets/feature-graphic.png` — 1024×500 Play Store graphic (generated)
- `apps/api/Dockerfile` — Multi-stage production Docker image
- `apps/api/.dockerignore` — Docker build exclusions
- `fly.toml` — Fly.io deployment configuration
- `docs/en/11-store-deployment.md` — English deployment documentation
- `docs/es/11-despliegue-tiendas.md` — Spanish deployment documentation
- `apps/mobile/src/__tests__/config.test.ts` — 9 unit tests for resolveApiBase

### Modified files
- `apps/mobile/src/config.ts` — Replaced hardcoded API_BASE with fallback chain
- `apps/mobile/src/App.tsx` — Added expo-splash-screen lifecycle
- `apps/mobile/app.json` — Added icon, splash, adaptiveIcon, favicon references
- `apps/mobile/eas.json` — Channels, env vars, autoIncrement, submit config
- `apps/mobile/package.json` — Added sharp devDep, generate-assets script, expo-splash-screen dep
- `.github/workflows/ci.yml` — Added deploy job to Fly.io
- `.gitignore` — Added mobile .env and google-service-account.json
- `apps/mobile/vitest.setup.ts` — Added expo-splash-screen mock
- `CLAUDE.md` — Updated architecture, stack, infrastructure, env vars, tech debt

## Tests

- **New**: `apps/mobile/src/__tests__/config.test.ts` — 9 tests covering all resolveApiBase fallback paths: env var override, production/preview channels, updates.channel fallback, debugger host IP extraction, localhost fallback, priority ordering, API_BASE export.
- **Existing**: All 114 mobile tests pass (15 files), 85 web tests pass (16 files), 440 API unit tests pass (40 files).
- **Pre-existing failures**: 27 API integration tests fail due to missing DATABASE_URL (require running PostgreSQL). Not related to this change.

## Documentation updates

- `CLAUDE.md` — Updated stack table (sharp, Fly.io, expo-splash-screen), architecture tree (new files/dirs), infrastructure section, env vars, MVP status, tech debt resolved items.
- `docs/en/11-store-deployment.md` — New: production infrastructure, store account setup, EAS workflow, screenshot specs.
- `docs/es/11-despliegue-tiendas.md` — New: Spanish translation of deployment guide.

## Performance

None. All changes are additive config/infra. No runtime performance impact.

## Code review fixes (t-review #1)

Applied after code review — 7 of 9 TODO items fixed, 2 skipped (acceptable as-is):

- **W1+W2**: ASO keywords optimized to fit iOS 100-char limit while restoring key PRD terms (`safe news for kids`, `sports reels`, `noticias seguras niños`)
- **W3**: Added inline comments to Dockerfile COPY commands explaining the `2>/dev/null || true` pattern for monorepo hoisted deps
- **W4**: Changed Dockerfile build commands to use `npm run build --workspace` with tsc fallback
- **S1**: Added inline comment explaining the `updates` type cast in config.ts
- **S2**: Added REDIS_URL comment to fly.toml CACHE_PROVIDER line
- **S5**: Optimized Dockerfile runner stage to copy only `packages/shared/dist` + `package.json` instead of full source
- **Skipped S3**: Generate-assets uses standard Unicode checkmark (`✓`), not emoji — works on all terminals
- **Skipped S4**: Splash screen timing matches PRD spec, acceptable for MVP

## Known issues

- Store submit placeholders (`APPLE_ID_HERE`, `ASC_APP_ID_HERE`, etc.) need real values once developer accounts are created.
- Generated assets are placeholders — will need professional design before public launch.
- `Dockerfile` COPY with `2>/dev/null || true` for workspace node_modules handles hoisted deps — documented with inline comments.
- The `expo-splash-screen` package was explicitly installed — if Expo SDK is upgraded, verify it's still needed or if it's auto-included.
