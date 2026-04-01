# SportyKids — Backlog

Centralized backlog of items deferred from each phase. Prioritized by necessity for production/store launch. Updated as new phases leave items out of scope — never delete entries, mark them as done when addressed.

**Last updated**: 2026-04-01 (Phase 4 PRD generation)

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
- **What**: `aria-live` regions for toasts (RewardToast), score updates, feed refresh notifications, quiz feedback.
- **Why**: Screen reader users miss dynamic content changes without live regions.

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

---

## P3 — Not recommended

### Sentry Session Replay
- **What**: Record and replay user sessions for debugging.
- **Why NOT**: Too intrusive for a kids app. Records screen content which may include child interactions. Privacy risk outweighs debugging benefit.
