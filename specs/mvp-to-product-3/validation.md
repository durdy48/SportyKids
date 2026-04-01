# Human Validation — prd.md

## Prerequisites

Start the test environment:

```bash
bash specs/mvp-to-product-3/create-environment.sh
```

## Validation Steps

### F1: Asset Generation

1. **Action**: Run `cd apps/mobile && npm run generate-assets`
   **Expected**: 5 PNG files created in `apps/mobile/src/assets/` with "All assets generated and validated." output.

2. **Action**: Run the script a second time
   **Expected**: Same output — idempotent, no errors from overwriting.

3. **Action**: Open `apps/mobile/src/assets/icon.png` in an image viewer
   **Expected**: 1024×1024 blue square with rounded corners and white "SK" text centered.

4. **Action**: Open `apps/mobile/src/assets/adaptive-icon.png`
   **Expected**: 512×512 transparent background with blue circle containing white "SK".

5. **Action**: Open `apps/mobile/src/assets/feature-graphic.png`
   **Expected**: 1024×500 blue rectangle with "SportyKids" title and "Sports news for kids" subtitle in white.

### F2: Dynamic API_BASE

6. **Action**: Run mobile tests: `cd apps/mobile && npx vitest run src/__tests__/config.test.ts`
   **Expected**: 9/9 tests pass covering all fallback chain scenarios.

7. **Action**: Read `apps/mobile/src/config.ts`
   **Expected**: `resolveApiBase()` function with 4-level fallback chain exported alongside `API_BASE` constant.

8. **Action**: Verify `apps/mobile/.env.example` exists
   **Expected**: File present with documented `EXPO_PUBLIC_API_BASE` variable.

### F3: Dockerfile

9. **Action**: Read `apps/api/Dockerfile`
   **Expected**: Three-stage build (deps → builder → runner), `node:20-slim`, OpenSSL installed, non-root `sportykids` user, PORT 8080.

10. **Action**: (Optional, requires Docker) Run `docker build -f apps/api/Dockerfile -t sportykids-api .`
    **Expected**: Build succeeds, image under 500MB.

### F4: Fly.io Config

11. **Action**: Read `fly.toml` at project root
    **Expected**: `app = "sportykids-api"`, `primary_region = "mad"`, health check at `/api/health`, release command runs Prisma migrations.

### F5: CI/CD Deploy

12. **Action**: Read `.github/workflows/ci.yml`
    **Expected**: `deploy` job exists, runs only on push to main (`github.ref == 'refs/heads/main'`), depends on `build-api` and `build-web`, uses `superfly/flyctl-actions`, `cancel-in-progress: false`.

### F6: EAS Config

13. **Action**: Read `apps/mobile/eas.json`
    **Expected**: `cli.appVersionSource: "remote"`, channels on all profiles, `EXPO_PUBLIC_API_BASE` env vars on preview/production, `autoIncrement: true` for production, submit section with placeholders.

### F7: Documentation

14. **Action**: Verify `docs/en/11-store-deployment.md` exists and has content
    **Expected**: Covers Fly.io setup, Docker, Apple/Google account setup, EAS workflow, screenshot specs.

15. **Action**: Verify `docs/es/11-despliegue-tiendas.md` exists and has content
    **Expected**: Spanish translation of deployment guide, same sections as English.

### F8: ASO Metadata

16. **Action**: Read `apps/mobile/store-metadata/en.json`
    **Expected**: Contains name, subtitle, description, keywords (under 100 chars), promotionalText, category, secondaryCategory.

17. **Action**: Read `apps/mobile/store-metadata/es.json`
    **Expected**: Spanish translation of all metadata fields.

### F10: Splash Screen

18. **Action**: Read `apps/mobile/src/App.tsx`
    **Expected**: `SplashScreen.preventAutoHideAsync()` called at module level, `hideAsync()` called in `onLayoutRootView` callback.

19. **Action**: Read `apps/mobile/app.json`
    **Expected**: `splash.image` points to `./src/assets/splash-icon.png`, `splash.backgroundColor` is `#F8FAFC`.

### Full Test Suite

20. **Action**: Run `npm run test:all` from project root
    **Expected**: Mobile (114 tests), Web (85 tests) all pass. API unit tests (440) pass. Only pre-existing integration test failures (DATABASE_URL required).

21. **Action**: Run `npx eslint . --max-warnings 0`
    **Expected**: No errors, no warnings.

---

## Appendix A: Re-validation after /t-review #1

These steps verify fixes from the code review round.

### Review fix: ASO keywords restored

22. **Action**: Read `apps/mobile/store-metadata/en.json` keywords field
    **Expected**: Keywords include "safe news for kids" and "sports reels", length under 100 chars.

23. **Action**: Read `apps/mobile/store-metadata/es.json` keywords field
    **Expected**: Keywords include "noticias seguras niños" and "reels", length under 100 chars.

### Review fix: Dockerfile improvements

24. **Action**: Read `apps/api/Dockerfile` COPY commands (lines 23-25)
    **Expected**: Comment above `2>/dev/null || true` lines explaining the monorepo hoisting fallback.

25. **Action**: Read `apps/api/Dockerfile` build commands (lines 35-38)
    **Expected**: Uses `npm run build --workspace=packages/shared` and `npm run build:api` (with tsc fallback).

26. **Action**: Read `apps/api/Dockerfile` runner stage shared copy (lines 52-53)
    **Expected**: Copies only `packages/shared/dist` and `packages/shared/package.json`, not the full source.

### Review fix: config.ts type cast comment

27. **Action**: Read `apps/mobile/src/config.ts` line 14-15
    **Expected**: Inline comment explaining why the `updates` field is cast to `Record<string, unknown>`.

### Review fix: fly.toml REDIS_URL comment

28. **Action**: Read `fly.toml` CACHE_PROVIDER line
    **Expected**: Comment mentioning REDIS_URL must be set via `fly secrets set`.

### Regression check

29. **Action**: Re-run all original validation steps (1-21)
    **Expected**: All previously passing steps still pass.
