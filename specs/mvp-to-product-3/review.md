# Code Review: Store Assets & Deployment

## Summary

Solid implementation that delivers all 10 PRD features (F1-F10) with clean, additive changes. The dynamic `API_BASE` resolution is well-designed and thoroughly tested. The Dockerfile, Fly.io config, and CI/CD deploy job follow best practices. A few minor deviations from the PRD in ASO metadata keywords and Dockerfile COPY commands, plus one suggestion for the splash screen approach.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| F1: Asset generation script | prd.md | OK | All 5 assets at correct dimensions, sharp SVG overlay, self-validation, idempotent |
| F1: app.json icon/splash/adaptive-icon/favicon | prd.md | OK | All fields correctly reference `./src/assets/` paths |
| F1: generate-assets npm script | prd.md | OK | `"generate-assets": "node scripts/generate-assets.mjs"` |
| F2: Dynamic API_BASE fallback chain | prd.md | OK | Env var > EAS channel > debugger host > localhost |
| F2: resolveApiBase exported for testing | prd.md | OK | Exported, 9 tests covering all paths |
| F2: .env.example | prd.md | OK | Matches PRD spec |
| F2: .gitignore mobile .env entries | prd.md | OK | `apps/mobile/.env` and `.env.local` added |
| F3: Multi-stage Dockerfile | prd.md | Issue | COPY uses `2>/dev/null || true` (differs from PRD), noted in impl-notes as known issue |
| F3: .dockerignore | prd.md | OK | Matches PRD exactly |
| F3: Non-root user, OpenSSL, PORT 8080 | prd.md | OK | All present |
| F4: fly.toml configuration | prd.md | OK | Exact match to PRD spec |
| F5: CI/CD deploy job | prd.md | OK | Gated on main + push, concurrency protection, flyctl setup |
| F5: deploy depends on build jobs | prd.md | Issue | PRD says `needs: [build-api]`, implementation uses `needs: [build-api, build-web]` — stricter, acceptable |
| F6: EAS build & submit config | prd.md | OK | Channels, env vars, autoIncrement, submit placeholders all match |
| F7: Store account setup docs (EN+ES) | prd.md | OK | Both languages, comprehensive step-by-step guides |
| F8: ASO metadata EN | prd.md | Issue | Keywords shortened vs PRD (7 vs 8 terms, missing "children sports app", "safe news for kids") |
| F8: ASO metadata ES | prd.md | Issue | Keywords shortened vs PRD (7 vs 8 terms, missing "app deportes ninos", "noticias seguras ninos") |
| F9: Screenshot specifications | prd.md | OK | Documented in F7 docs with all required dimensions and capture list |
| F10: Splash screen integration | prd.md | OK | `preventAutoHideAsync` + `hideAsync` on root layout |

## TODO: Critical Issues (must fix)

_None found._

## TODO: Warnings (should fix)

- [x] **apps/mobile/store-metadata/en.json:5** — Keywords are shorter than PRD spec. Missing `"children sports app"`, `"safe news for kids"`, `"football news kids"` (shortened to `"football kids"`), `"sports reels"` (shortened to `"reels"`). ASO keywords affect discoverability; use the full set from the PRD for maximum coverage.
- [x] **apps/mobile/store-metadata/es.json:5** — Same issue in Spanish. Missing `"app deportes ninos"`, `"noticias seguras ninos"`, `"reels deportivos"` (shortened). Should match PRD for ASO coverage.
- [x] **apps/api/Dockerfile:24-25** — `COPY --from=deps ... 2>/dev/null || true` suppresses errors for workspace node_modules that may not exist. This is acceptable for hoisted deps but could mask real copy failures (e.g., permissions). The PRD Dockerfile does not use this pattern. Consider adding a comment explaining why this differs from the PRD version, or validating the copy result.
- [x] **apps/api/Dockerfile:36-39** — Build commands use `cd && npx tsc` instead of PRD's `npm run build --workspace=packages/shared` and `npm run build:api`. Both work, but using npm scripts is more maintainable if build steps change. Low risk since the Dockerfile is self-contained.

## TODO: Suggestions (nice to have)

- [x] **apps/mobile/src/config.ts:14** — The `as Record<string, unknown>` cast for `updates` works around Expo SDK types not including `channel`. Consider adding a brief inline comment or a type assertion helper to document why this cast is needed, so future maintainers understand it's intentional.
- [ ] **apps/mobile/scripts/generate-assets.mjs:113** — Console output uses emoji (`✓`). This is fine for a dev script, but could show as garbled text on Windows terminals without UTF-8 support. Minor; not user-facing.
- [x] **fly.toml:11-12** — `CACHE_PROVIDER = "redis"` and `MODERATION_FAIL_OPEN = "false"` are good production defaults. Consider documenting that `REDIS_URL` must be set as a Fly secret for Redis to work (it's in the docs but not in the toml comments).
- [ ] **apps/mobile/src/App.tsx:40-42** — The splash screen hides on `onLayout` of the root View, which means it hides as soon as the React tree mounts. If data loading is desired before hiding (e.g., user context from AsyncStorage), the hide could be deferred until after `UserProvider` resolves. Current approach matches PRD and is acceptable for MVP.
- [x] **apps/api/Dockerfile:52-56** — The runner stage copies all of `packages/shared` (including source files) instead of just the built output. For a production image, copying only `packages/shared/dist` + `packages/shared/package.json` would reduce image size. Low priority — the size difference is minimal.

## Technical Debt Assessment

This PR resolves three significant items from the tech debt list: hardcoded `API_BASE`, lack of Dockerfile/deployment, and empty EAS config. It introduces no new technical debt. The implementation is clean, additive, and well-tested. The Dockerfile `2>/dev/null || true` pattern is a pragmatic workaround documented in the implementation notes. The submit placeholders (`APPLE_ID_HERE`, etc.) are intentional and clearly marked — they will be replaced when developer accounts are created.

## Files Reviewed

- **`.gitignore`** — Added mobile .env and google-service-account.json exclusions. Correct.
- **`CLAUDE.md`** — Updated stack, architecture, infra, env vars, tech debt. Not re-read in full (not in scope for code review), but referenced.
- **`apps/mobile/app.json`** — Added icon, splash, adaptiveIcon, favicon fields. Matches PRD.
- **`apps/mobile/eas.json`** — Channels, env vars, autoIncrement, submit placeholders. Matches PRD.
- **`apps/mobile/package.json`** — Added sharp devDep, expo-splash-screen dep, generate-assets script. Correct.
- **`apps/mobile/src/App.tsx`** — Splash screen lifecycle (preventAutoHideAsync + hideAsync on layout). Clean.
- **`apps/mobile/src/config.ts`** — Dynamic resolveApiBase with 4-step fallback chain. Well-structured, exported for testing.
- **`apps/mobile/vitest.setup.ts`** — Added expo-splash-screen mock. Minimal, correct.
- **`apps/api/Dockerfile`** — 3-stage build, non-root user, OpenSSL, PORT 8080. Minor deviation from PRD in COPY commands.
- **`apps/api/.dockerignore`** — Matches PRD exactly.
- **`fly.toml`** — Madrid region, health check, auto-stop/start, release_command for migrations. Matches PRD.
- **`.github/workflows/ci.yml`** — Deploy job added with correct gating and concurrency. Slightly stricter `needs` than PRD.
- **`apps/mobile/.env.example`** — Template with commented EXPO_PUBLIC_API_BASE. Matches PRD.
- **`apps/mobile/scripts/generate-assets.mjs`** — 5 assets via sharp SVG overlay, self-validates dimensions. Clean, idempotent.
- **`apps/mobile/src/__tests__/config.test.ts`** — 9 tests covering all resolveApiBase paths. Thorough, uses dynamic imports with vi.resetModules.
- **`apps/mobile/store-metadata/en.json`** — ASO metadata in English. Keywords shortened vs PRD.
- **`apps/mobile/store-metadata/es.json`** — ASO metadata in Spanish. Keywords shortened vs PRD.
- **`docs/en/11-store-deployment.md`** — Comprehensive deployment guide covering Fly.io, Docker, Apple, Google, EAS, screenshots.
- **`docs/es/11-despliegue-tiendas.md`** — Spanish translation of deployment guide. Complete and accurate.
- **`package-lock.json`** — Updated with new dependencies (sharp, expo-splash-screen). Not reviewed line-by-line.

## Verification

```
Mobile tests:  15 files, 114 tests — ALL PASSED
Web tests:     16 files, 85 tests  — ALL PASSED
ESLint:        0 warnings, 0 errors — CLEAN (exit code 0)
```

All verification checks pass. No regressions introduced.
