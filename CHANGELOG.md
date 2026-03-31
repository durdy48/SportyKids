# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- React Native Error Boundary — class component wrapping entire app, kid-friendly crash screen with restart button, Sentry reporting via dynamic import
- JWT tokens in `expo-secure-store` — encrypted storage (Keychain/Keystore) with AsyncStorage fallback and transparent migration on startup
- Centralized child-safe YouTube embed utilities in shared package (`buildYouTubeEmbedUrl`, `extractYouTubeVideoId`, `getYouTubePlayerVars`) with `sandbox` attribute on web iframes
- Fail-closed content moderation in production — AI failure leaves content as `pending` instead of auto-approving; override via `MODERATION_FAIL_OPEN` env var
- `GET /api/admin/moderation/pending` endpoint (requireAuth + requireRole admin) returning flat pending array with summary, pendingMinutes, oldestPendingMinutes
- Stale pending content detection in sync-feeds cron — warns when articles are pending > 30 minutes
- `authFetch()` wrapper in mobile API client — attaches JWT Authorization header to all requests with automatic token refresh on 401
- Interactive sport filter chips in mobile Parental Control "Contenido" section — toggles `allowedSports` on the parental profile
- i18n keys for crash screen (crash_title, crash_message, restart) in ES and EN
- `crash` entry in `KID_FRIENDLY_ERRORS` constants

### Changed
- Mobile API client uses `authFetch()` instead of bare `fetch()` for all API calls
- Web VideoPlayer sets `allowFullScreen={false}` on all iframes (not just YouTube)
- Mobile VideoPlayer uses centralized `getYouTubePlayerVars()` from shared package
- Content moderator returns `'pending'` status type in `ModerationResult`
- `requireRole()` middleware accepts `'admin'` role
- ErrorBoundary uses `COLORS` constants from shared package instead of hardcoded hex values

### Fixed
- Mobile app 401 errors after registration — JWT tokens were stored but never sent in API requests
- Parental Control sport chips were read-only `<View>` elements reading `user.favoriteSports` instead of interactive `<TouchableOpacity>` toggling `profile.allowedSports`
- Admin moderation endpoint used non-existent `content` field in Prisma select — changed to `summary`
- YouTube embed `disablekb` parameter was set to `0` (enabled) instead of `1` (disabled)

- Age gate screen (web + mobile) with three paths: adult (18+), teen (13-17), child (<13 with parental consent + mandatory PIN)
- Privacy Policy page (`/privacy`) with full COPPA/GDPR-K compliant draft in Spanish and English
- Terms of Service page (`/terms`) with i18n support (ES/EN)
- `DELETE /api/users/:id/data` endpoint for GDPR Art. 17 right to erasure — hard deletes all user data in a single transaction
- Account deletion UI in Parental Controls (web + mobile) with confirmation dialog
- Parental consent fields on User model: `ageGateCompleted`, `consentGiven`, `consentDate`, `consentBy`
- Analytics consent gating: PostHog and Sentry disabled until parental consent is given
- Schedule lock guard on mobile — all content tabs show a friendly bedtime screen when outside allowed hours
- Legal links (Privacy Policy / Terms of Service) in login, register, onboarding, and parental control screens (web + mobile)
- `WEB_BASE` configurable constant in mobile config for legal page URLs
- `LegalReviewBanner` shared component for highlighting sections needing legal review
- i18n keys for age gate, legal pages, and account deletion in ES and EN

### Changed
- Onboarding wizard now creates users with consent fields set (web + mobile)
- `initAnalytics()` on web requires explicit consent to initialize PostHog
- API `trackEvent()` checks user consent before sending PostHog events
- Delete endpoint accepts parental session as alternative to JWT for anonymous users
- Delete transaction nullifies `parentUserId` on children before deleting a parent account
- Legal links use Next.js `<Link>` components instead of `<a>` tags
- Mobile legal page links use configurable `WEB_BASE` instead of hardcoded localhost
