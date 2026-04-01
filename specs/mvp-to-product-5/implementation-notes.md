# Phase 5 Implementation Notes

## Files Created

| File | Description |
|------|-------------|
| `fly.staging.toml` | Fly.io config for staging environment. Key differences from production: app name `sportykids-api-staging`, `CACHE_PROVIDER=memory` (no Redis), `min_machines_running=0` (cost saving), lower concurrency limits (50/25 vs 250/200). |
| `scripts/setup-staging.sh` | Executable shell script to provision staging on Fly.io. Creates app, provisions PostgreSQL, prompts for secrets (JWT_SECRET, JWT_REFRESH_SECRET, optional SENTRY_DSN), deploys, and seeds. |
| `scripts/generate-screenshots.mjs` | Playwright script that captures 5 screens (home, quiz, reels, collection, parents) at iOS (393x852 @3x = 1179x2556) and Android (412x915 @2.625x = 1080x2400) viewports. Seeds localStorage user to skip onboarding. |
| `specs/mvp-to-product-5/beta-guide.md` | 3-week beta testing guide for 2 families. Week 1: setup and first impressions. Week 2: daily use and engagement. Week 3: feedback collection with parent and child questionnaires. Includes go/no-go criteria and monitoring plan. |
| `specs/mvp-to-product-5/review-notes.md` | Prepared review notes for Apple and Google store reviewers. Covers Kids Category requirements, parental controls, Sign In with Apple, privacy, test account instructions. Includes privacy nutrition labels, data safety form answers, IARC questionnaire answers, and common rejection response strategies. |
| `specs/mvp-to-product-5/validation.md` | Validation checklist with 7 sections: Infrastructure, Build Configuration, Store Metadata, Beta Distribution, Beta Testing, Store Submission, Post-Submission, and Documentation. |
| `apps/mobile/.gitignore` | Created with `google-service-account.json` entry to prevent committing secrets. |

## Files Modified

| File | Changes |
|------|---------|
| `apps/mobile/app.json` | Version bumped from `0.1.0` to `1.0.0`. Added `ios.buildNumber: "1"`, `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`, `android.versionCode: 1`. |
| `apps/mobile/eas.json` | Preview `EXPO_PUBLIC_API_BASE` changed from `sportykids-api-preview.fly.dev` to `sportykids-api-staging.fly.dev`. Added `_docs_*` fields to submit section documenting how to fill Apple/Google placeholders (JSON does not support comments). |
| `apps/mobile/store-metadata/es.json` | Added: `supportUrl`, `privacyPolicyUrl`, `marketingUrl`, `ageRating`, `copyright`, `whatsNew`, `shortDescription` (52 chars, under 80 limit). |
| `apps/mobile/store-metadata/en.json` | Added: same fields as es.json but in English. `shortDescription` is 37 chars, under 80 limit. |
| `.gitignore` (root) | Added `apps/mobile/store-metadata/screenshots/` to ignore generated screenshots. |
| `eslint.config.mjs` | Added `scripts/**` to global ignores (CLI scripts use console.log legitimately). |
| `docs/en/10-roadmap-and-decisions.md` | Updated gantt chart section name from "Next" to "Phase 5". Added Phase 5 summary section. Updated short-term next steps. |
| `docs/es/10-roadmap-y-decisiones.md` | Same updates as English version, in Spanish. |
| `CLAUDE.md` | Updated project status to reflect Phase 5 in progress. Changed Phase 5 row from "Pendiente" to "En progreso". Added staging environment, screenshots, beta guide, and review notes to Infrastructure section. |

## Decisions Made

1. **eas.json documentation via `_docs_*` fields**: Since JSON does not support comments, used underscore-prefixed fields (`_docs_appleId`, `_docs_setup`) to document how to fill the placeholder values. EAS CLI ignores unknown fields.

2. **scripts/ added to ESLint ignores**: The `generate-screenshots.mjs` script legitimately uses `console.log` for CLI output. Rather than adding per-line disable comments, added the entire `scripts/` directory to ESLint ignores since these are CLI tools, not application code.

3. **Store metadata `supportUrl`**: Used `https://sportykids-api.fly.dev/api/health` as a placeholder per the PRD. This should be replaced with a real support page before store submission.

4. **Store metadata `privacyPolicyUrl`**: Set to `https://sportykids.app/privacy` per the PRD. Note that this domain is aspirational -- the current deployment uses `sportykids-api.fly.dev`. Update when custom domain is configured.

## Test Results

- **Web tests**: 16 files, 109 tests -- all passing
- **Mobile tests**: 16 files, 139 tests -- all passing
- **Lint**: Pre-existing 539 errors / 14 warnings (unchanged from before Phase 5 changes). The scripts/ directory is now excluded from linting.
