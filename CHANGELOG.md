# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
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
