# Phase 5 Code Review

**Reviewer:** Claude Opus 4.6
**Date:** 2026-04-01
**Scope:** Configuration, scripts, metadata, documentation (no app code changes)
**Verdict:** Approve with minor notes

---

## Summary

Phase 5 implementation faithfully follows the PRD. All specified files are created or modified as described. No secrets are committed, shell scripts are safe, JSON files are valid, and documentation is consistent between EN/ES. This is a clean, low-risk changeset.

---

## File-by-File Review

### `fly.staging.toml` -- OK

Matches the PRD exactly: app name, region, env vars, concurrency limits, health check, deploy release command. No issues.

### `scripts/setup-staging.sh` -- OK (1 minor note)

- Executable bit is set correctly.
- Uses `set -euo pipefail` (good).
- Idempotent: checks for existing app/db before creating.
- Secrets are prompted interactively, never hardcoded.

**Note:** Line 57 uses unquoted `$SECRETS` in `fly secrets set $SECRETS`. This is intentional -- Fly CLI expects multiple `KEY=VALUE` arguments as separate words, so word splitting is needed here. However, if a user enters a secret containing spaces, it would break. Low risk for JWT secrets (typically alphanumeric or base64), but worth a comment in the script. Not a blocker.

### `scripts/generate-screenshots.mjs` -- OK

- Clean Playwright script, 5 screens, 2 device profiles.
- Seeds localStorage user to skip onboarding -- correct approach.
- Graceful fallback when `waitFor` selectors are not found.
- `BASE_URL` configurable via env var.
- No-op `addCookies([])` on line 84 is harmless but unnecessary. Cosmetic.

### `apps/mobile/app.json` -- OK

- Version bumped `0.1.0` -> `1.0.0`.
- `ios.buildNumber: "1"` and `android.versionCode: 1` added.
- `ITSAppUsesNonExemptEncryption: false` -- correct for apps that only use HTTPS (no custom encryption).
- All changes match PRD spec exactly.

### `apps/mobile/eas.json` -- OK

- Preview channel updated to staging URL.
- Submit section uses `_docs_*` fields for documentation instead of JSONC comments. Good pragmatic decision since JSON doesn't support comments and EAS CLI ignores unknown fields.
- PRD shows JSONC comments in the eas.json snippet, but the implementation correctly adapts this to valid JSON via `_docs_*` fields. This is better than what the PRD specified.
- Placeholder values (`APPLE_ID_HERE`, `ASC_APP_ID_HERE`, `APPLE_TEAM_ID_HERE`) are clearly marked.

### `apps/mobile/.gitignore` -- OK

Contains `google-service-account.json`. Prevents committing secrets. Matches PRD requirement.

### `apps/mobile/store-metadata/en.json` -- OK

- All required fields present: `supportUrl`, `privacyPolicyUrl`, `marketingUrl`, `ageRating`, `copyright`, `whatsNew`, `shortDescription`.
- `shortDescription` is 37 chars (under 80 limit).
- `supportUrl` points to `/api/health` (acknowledged placeholder in implementation-notes).
- `privacyPolicyUrl` uses aspirational domain `sportykids.app` (noted in implementation-notes).

### `apps/mobile/store-metadata/es.json` -- OK

- Same fields as EN version, properly translated.
- `shortDescription` is 52 chars (under 80 limit).
- Missing accents in `whatsNew` and `shortDescription`: "version" should be "version" (no accent needed in this context actually -- "version" is acceptable in informal Spanish), "ninos" should be "ninos" (same). These match the PRD verbatim, so this is a PRD-level issue, not an implementation deviation.

### `.gitignore` (root) -- OK

Added `apps/mobile/store-metadata/screenshots/` to ignore generated screenshots. Correct.

### `eslint.config.mjs` -- OK

Added `scripts/**` to global ignores. Also added `**/playwright-report/**` and `**/test-results/**`. All reasonable -- CLI scripts use `console.log` legitimately, and Playwright artifacts should not be linted.

### `docs/en/10-roadmap-and-decisions.md` -- OK

- Gantt chart section renamed from "Next" to "Phase 5" with 28-day duration.
- Phase 5 summary section added with accurate description of deliverables.
- "Next steps" updated to reflect the actual Phase 5 activities (deploy staging, distribute beta, etc.).

### `docs/es/10-roadmap-y-decisiones.md` -- OK

Mirror of English changes. Content is consistent. Spanish is natural and correct.

### `CLAUDE.md` -- OK

- Status updated to reflect Phase 5 in progress.
- Phase 5 row changed from "Pendiente" to "En progreso" with summary.
- Infrastructure section extended with staging, screenshots, beta guide, and review notes entries.

### `specs/mvp-to-product-5/beta-guide.md` -- OK

- Well-structured 3-week protocol.
- Concrete questionnaires for parents and children.
- Clear go/no-go criteria with measurable thresholds.
- Monitoring plan covers Sentry, PostHog, and content reports.
- Distribution instructions are accurate for EAS + TestFlight/Google Play.

### `specs/mvp-to-product-5/review-notes.md` -- OK

- Comprehensive review notes for both Apple and Google.
- Privacy nutrition labels and data safety form answers are accurate relative to the codebase.
- IARC questionnaire answers are consistent.
- Common rejection causes with prepared responses -- good operational planning.
- Apple Kids Category requirements checklist is accurate.

### `specs/mvp-to-product-5/validation.md` -- OK

Thorough checklist covering all phases from infrastructure to post-submission.

### `specs/mvp-to-product-5/implementation-notes.md` -- OK

Accurate record of what was done and decisions made. Test results documented.

---

## PRD Compliance

| PRD Section | Status | Notes |
|-------------|--------|-------|
| 2.1.1 fly.staging.toml | Match | Exact match with PRD spec |
| 2.1.2 Setup script | Match | Exact match with PRD spec |
| 2.1.3 EAS preview channel update | Match | Staging URL updated |
| 2.2.1 app.json changes | Match | All 4 changes applied |
| 2.2.2 eas.json changes | Improved | `_docs_*` fields instead of invalid JSONC comments |
| 2.3.1 Store metadata | Match | All fields added per PRD |
| 2.3.2 Screenshot script | Match | Exact match with PRD spec |
| 3.x Beta guide | Match | 3-week protocol as specified |
| 4.x Review notes | Match | Both platforms covered |
| .gitignore updates | Match | Screenshots + google-service-account.json |
| Documentation updates | Match | Both EN/ES updated |

---

## Security

- No secrets in code or config files.
- `google-service-account.json` properly gitignored.
- Shell script prompts for secrets interactively.
- No command injection risks -- all shell variables are either hardcoded constants or used in safe contexts (`fly secrets set` with `set -euo pipefail`).
- Placeholder submit credentials are obviously fake (`APPLE_ID_HERE`).

---

## Issues Found

**None blocking.**

Minor observations (all informational, no action required):

1. **`setup-staging.sh` line 57**: Unquoted `$SECRETS` relies on word splitting. Works for typical JWT secrets but would break on secrets with spaces. Adding a comment noting this would be helpful.

2. **Store metadata `supportUrl`**: Points to `/api/health` which is a JSON health check, not a support page. This is acknowledged as a placeholder in implementation-notes. Must be replaced before actual store submission.

3. **Store metadata `privacyPolicyUrl`**: Uses `sportykids.app` domain that does not exist yet. The actual privacy page is at `sportykids-api.fly.dev/privacy`. Must be updated before store submission or after custom domain setup.

4. **Spanish diacritics in store metadata**: `whatsNew` and `shortDescription` in `es.json` are missing accents ("version" -> "version", "ninos" -> "ninos"). This matches the PRD text exactly, so it is a PRD-level issue. Recommend fixing before actual store submission since these are user-facing strings on the App Store / Google Play.

---

## Verdict

**Approve.** Clean implementation that matches the PRD faithfully. No security issues, no correctness problems, no convention violations. The minor observations above are all pre-submission tasks that are tracked in the validation checklist.

---

## Verification

| Check | Result |
|-------|--------|
| Web tests (109) | All pass |
| Mobile tests (139) | All pass |
| ESLint | Clean |
| Playwright E2E (24) | All pass (Phase 4) |
