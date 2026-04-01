# Validation Report — Run 1

**Date**: 2026-03-31T20:22:07.988Z
**Feature**: mvp-to-product-3 / Store Assets & Deployment
**Summary**: 20 PASS | 0 FAIL | 1 SKIP

---

## F1: Asset Generation

✅ **Generate assets** — 5 PNGs generated and validated ([evidence](run-1/output/01-asset-gen.txt))

✅ **Idempotent re-run** — Second run produces same output ([evidence](run-1/output/02-asset-gen-idempotent.txt))

✅ **icon.png dimensions** — 1024×1024 (expected 1024×1024)

✅ **adaptive-icon.png dimensions** — 512×512 (expected 512×512)

✅ **feature-graphic.png dimensions** — 1024×500 (expected 1024×500)

## F2: Dynamic API_BASE

✅ **Config tests** — 9/9 tests pass ([evidence](run-1/output/06-config-tests.txt))

✅ **config.ts structure** — resolveApiBase: true, API_BASE: true, fallback chain: true

✅ **.env.example** — EXPO_PUBLIC_API_BASE documented

## F3: Dockerfile

✅ **Dockerfile structure** — node:20-slim: true, openssl: true, non-root: true, port 8080: true, 3 stages: true

⏭️ **Docker build** — Docker available but build skipped (requires full build context + network)

## F4: Fly.io Config

✅ **fly.toml** — app: true, region: true, health: true, migrate: true

## F5: CI/CD Deploy

✅ **CI deploy job** — deploy: true, main-only: true, needs: true, flyctl: true, no-cancel: true

## F6: EAS Config

✅ **eas.json config** — versionSource: true, channels: true, envVars: https://sportykids-api.fly.dev/api, autoIncrement: true, submit: [object Object]

## F7: Documentation

✅ **EN deployment doc** — Fly.io: true, Docker: true, Apple: true, Google: true, EAS: true, Screenshots: true

✅ **ES deployment doc** — Spanish translation with Fly.io: true, Docker: true, Apple: true, Google: true

## F8: ASO Metadata

✅ **EN ASO metadata** — All fields: true, keywords ≤100: true (92), desc ≤4000: true (835)

✅ **ES ASO metadata** — All fields: true, keywords ≤100: true (96)

## F10: Splash Screen

✅ **App.tsx splash screen** — preventAutoHide: true, hideAsync: true, onLayout: true

✅ **app.json splash config** — image: ./src/assets/splash-icon.png, backgroundColor: #F8FAFC

## Full Test Suite

✅ **Full test suite** — Mobile: 15 passed, Web: 16 passed ([evidence](run-1/output/20-test-suite.txt))

✅ **ESLint** — No errors, no warnings ([evidence](run-1/output/21-lint.txt))

