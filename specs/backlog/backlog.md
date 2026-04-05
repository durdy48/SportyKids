# SportyKids — Backlog

Centralized backlog of items deferred from each phase. Prioritized by necessity for production/store launch. Updated as new phases leave items out of scope — never delete entries, mark them as done when addressed.

**Last updated**: 2026-04-02 (Phase 6.4 — entity onboarding)

---

## P0 — Mandatory before public launch

### WCAG 2.1 AA Full Compliance + External Audit
- **What**: Professional accessibility audit and certification. Covers all WCAG 2.1 AA success criteria beyond labels/roles.
- **Why**: Legal requirement in many jurisdictions. Apple and Google increasingly enforce accessibility standards for Kids category apps.
- **Includes**: Programmatic accessibility, meaningful sequence, sensory characteristics, color-dependent information, timing adjustable, three flashes threshold, consistent navigation, error identification.

### Keyboard Navigation and Focus Management (Web)
- **What**: Full keyboard accessibility — tab order, focus trapping in modals, skip-to-content link, visible focus indicators, focus restoration.
- **Why**: WCAG 2.1 AA requires all functionality to be operable via keyboard. Screen reader users rely on keyboard navigation.
- **Blocked by**: Phase 4 a11y labels (need labels first, then navigation).

### Color Contrast Audit and Fixes
- **What**: Verify all text meets minimum contrast ratios (4.5:1 for normal text, 3:1 for large text). Special attention to dark mode tokens (`--color-muted`, `--color-border`).
- **Why**: WCAG 2.1 AA mandatory. Current color tokens have not been verified against contrast requirements.
- **Tool**: Colour Contrast Analyser or axe DevTools.

### Accessibility CI Linting (eslint-plugin-jsx-a11y)
- **What**: Add `eslint-plugin-jsx-a11y` to ESLint config to prevent accessibility regressions in new code.
- **Why**: Without automated linting, new components will lack accessibility props. Prevents regression after Phase 4 audit.

---

## P1 — Necessary before store release

### E2E Mobile Tests (Maestro/Detox)
- **What**: Native mobile E2E tests covering onboarding, PIN, quiz, schedule lock flows on iOS and Android.
- **Why**: Web E2E (Playwright) doesn't cover mobile-specific interactions (gestures, native navigation, push notifications, secure storage).
- **Framework**: Maestro (YAML-based, simpler setup) or Detox (JS-based, more control).
- **Blocker**: Requires EAS development builds (not Expo Go). Needs macOS CI runner for iOS.

### Sentry Web Integration (@sentry/nextjs)
- **What**: Full Sentry integration for the Next.js web app — server-side and client-side error tracking, source maps.
- **Why**: Web app errors are currently invisible. No crash reporting for web users.
- **Package**: `@sentry/nextjs` (wraps both server and client).

### Screen Reader Announcements for Dynamic Content
- **What**: `aria-live` regions for toasts (RewardToast), feed refresh notifications.
- **Why**: Screen reader users miss dynamic content changes without live regions.
- **Partially done (Phase 4)**: Quiz feedback has `role="status"` + `aria-live="polite"`, quiz score display has `aria-live="polite"`. Remaining: RewardToast, feed refresh, sticker/achievement celebrations.

---

## P2 — Nice to have

### `reduceMotion` System Accessibility Preference
- **What**: Respect OS-level "reduce motion" setting. Disable confetti animations, transitions, auto-playing videos.
- **Why**: Users with vestibular disorders or motion sensitivity. Improves accessibility beyond minimum requirements.

### Dynamic Type / `largerText` Support
- **What**: Scale fonts based on system accessibility text size settings (iOS Dynamic Type, Android font scale).
- **Why**: Users with low vision. React Native supports `allowFontScaling` by default but layouts may break.

### Performance / Lighthouse CI Tests
- **What**: Automated Lighthouse performance audits in CI. Track Core Web Vitals regressions.
- **Why**: Performance impacts user experience, especially on low-end devices common with younger users.

### Age Gate Before Onboarding (Web)
- **What**: Show `/age-gate` as first screen before onboarding for new users (currently goes direct to `/onboarding`).
- **Why**: COPPA/GDPR-K requires age verification before collecting any data. The onboarding wizard collects name and preferences. Mobile app has the age gate before onboarding; web should match.
- **Current state**: Web redirects new users (no localStorage) to `/onboarding`. Users with existing account but `ageGateCompleted=false` correctly see `/age-gate`. The onboarding already sets `ageGateCompleted=true` + `consentGiven=true` at user creation, but the gate should happen first.

### Admin Metrics Dashboard
- **Status**: ✅ Superseded by full Admin Dashboard implementation (branch `admin-dashboard`, 2026-04-04). Covers all metrics listed here plus moderation, jobs, sources, analytics, users and orgs management.

### "Mi Equipo" Redesign for Athletes and Drivers
- **What**: The "Mi Equipo" page (web `/team` and mobile `FavoriteTeam` screen) uses `favoriteTeam` to show team stats and news. When the user's `favoriteTeam` is an athlete or driver (e.g. "Caeleb Dressel", "Max Verstappen") instead of a club, the page shows a football emoji ⚽, "Noticias y novedades de tu equipo", and "Noticias del equipo" headings — all wrong. The stats section is also irrelevant (W/D/L, next match) for individual athletes.
- **Why**: Phase 6.4 introduced `SPORT_ENTITIES` with `EntityType` (team, athlete, driver, cyclist, swimmer, padel_player). When `favoriteTeam = selectedEntities[0]?.name`, the type information is lost — only the name is stored in the User model. The page needs to detect entity type and adapt: header emoji (🏊 for swimmer, 🏎️ for driver, etc.), heading text ("Noticias de tu atleta favorito"), and hide irrelevant stats sections.
- **Approach**: Extend `User.favoriteTeam` storage to also save `favoriteTeamType` (the `EntityType`), OR look up the entity in `SPORT_ENTITIES` at render time by name match. Adapt headings, emojis, and visible sections based on type.
- **Scope**: Web `/team` page + Mobile `FavoriteTeam` screen. API `GET /api/teams/:teamName/stats` response may return empty/404 for athletes — handle gracefully.
- **Screenshot evidence**: "Caeleb Dressel" shown with ⚽ emoji and "Noticias del equipo" heading (incorrect).

### Playwright E2E Sandbox Compatibility
- **What**: Make Playwright tests run inside sandboxed `execSync` (validation scripts, CI containers).
- **Why**: Chromium headless shell needs `bootstrap_check_in` mach port which fails in sandboxed environments. Tests pass when run directly but fail inside validation automation.
- **Workaround**: Run `npx playwright test` directly, not via `execSync` in Node scripts.

### E2E Step 4 Source Loading Wait
- **What**: Replace `waitForTimeout(2000)` in E2E onboarding step 4 (feed sources) with a condition-based wait.
- **Why**: The 2s timeout works locally but may flake in CI if the catalog API is slow. Ideally wait for the "Next" button to be enabled (indicating sources loaded and pre-selected).
- **Blocked by**: Playwright doesn't easily detect React state changes; may need a `data-testid` on the source list container.

---

## P3 — Not recommended

### Admin Action Audit Log
- **What**: Persist a log of every admin action (who approved/rejected what content, who changed a user's tier/role, who triggered a job). Model: `AdminAuditLog { id, adminUserId, action, targetType, targetId, metadata, createdAt }`.
- **Why**: Left out of scope from admin dashboard PRD (2026-04-04). Useful for compliance and accountability as the team grows but not needed for MVP operation.
- **Blocked by**: Admin dashboard implementation (branch `admin-dashboard`).

### Manual Push to User Segments
- **What**: From the admin dashboard, select a segment of users (by sport, country, tier, org) and send a custom push notification.
- **Why**: Left out of scope from admin dashboard PRD (2026-04-04). Useful for marketing/engagement campaigns but not needed for day-to-day operations.
- **Blocked by**: Admin dashboard implementation + push infrastructure review.

### Granular Admin Roles (Moderator vs Superadmin)
- **What**: Split the single `admin` role into `moderator` (content moderation + source management only) and `superadmin` (full admin access). Moderators cannot change user tiers/roles or trigger destructive operations.
- **Why**: Left out of scope from admin dashboard PRD (2026-04-04). Relevant when the team has dedicated moderators who should not have full system access.
- **Blocked by**: Admin dashboard implementation.

### Sentry Session Replay
- **What**: Record and replay user sessions for debugging.
- **Why NOT**: Too intrusive for a kids app. Records screen content which may include child interactions. Privacy risk outweighs debugging benefit.
