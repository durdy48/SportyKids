# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- OAuth Social Login: Google (Passport.js) + Apple Sign In with JWKS verification
- GET /api/auth/providers endpoint for conditional social button rendering
- POST /api/auth/google/token and POST /api/auth/apple/token for mobile flows
- Web OAuth callback page at /auth/callback with Suspense boundary
- Social login buttons on web OnboardingWizard and mobile Login/Register screens
- Kid-friendly error types: rate_limited, format_blocked, limit_reached, unauthorized
- Haptic feedback on mobile: Quiz, Collection, Reels, NavBar tabs, MissionCard
- Pull-to-refresh with BrandedRefreshControl on 4 mobile screens
- Schedule Lock UI in ParentalPanel (web) and ParentalControl (mobile)
- Related Articles section ("You Might Also Like") in NewsCard (web + mobile)
- Reading History section ("Recently Read") on HomeFeed (web + mobile)
- Parental Tour verified and fixed on mobile
- Video Player Strategy documentation
- socialId field on User model with composite index
- findOrCreateSocialUser with account linking by email
- Apple JWKS token verification with cached keys
- Google OAuth CSRF state validation via apiCache
- 562 tests across 64 files (API 424, Web 69, Mobile 69)

### Changed
- Locale parameter passed from both web and mobile to news API for content language ranking
- getErrorType uses specific matching to avoid false positives
- languageBoost function simplified to accept string only
- express.urlencoded scoped to Apple callback route only
- findOrCreateSocialUser returns typed Prisma User instead of Record<string, unknown>
- Mobile social login shows informational Alert (expo-auth-session needed for native flow)
- BrandedRefreshControl title uses i18n instead of hardcoded English
- Mobile Login/Register screens use theme colors instead of hardcoded hex

### Removed
- passport-apple unused dependency
- OAuth 501 placeholder stubs replaced with real implementations

### Fixed
- console.error in Quiz.tsx guarded with __DEV__
- OAuth tokens cleaned from URL after reading in callback page
- Mobile ParentalTour now renders after first PIN creation

## [0.6.0] — 2026-03-28

### Added
- Video Aggregator: automatic YouTube RSS video ingestion from 22+ channels across all 8 sports, with content moderation and team classification
- Video source management API: catalog, custom sources (YouTube/Instagram/TikTok), manual sync endpoint
- Multi-platform video rendering: YouTube embeds, Instagram/TikTok oEmbed (web), WebView (mobile), native MP4
- User locale and country preferences: language selector in onboarding (web + mobile), NavBar settings (web), mobile header toggle
- Country-aware feed ranking with countryBoost and source language/country enrichment
- Google News RSS ingestion: 10 sources covering 4 Spanish outlets without native RSS feeds
- PIN lockout security: 5 failed attempts triggers 15-minute lockout with countdown UI and haptic feedback
- Rate limiting: 5 tiers via express-rate-limit (auth, PIN, content, sync, default), disabled in development
- Enhanced feed algorithm: frequency-weighted sport scoring, exponential recency decay, source affinity, diversity injection
- Redis cache provider with CacheProvider interface, RedisCache implementation, and automatic fallback to InMemoryCache
- Shared inferCountryFromLocale() utility for consistent country inference
- IPv6-mapped IPv4 SSRF prevention in URL validator
- 274 tests across 25 test files

### Changed
- Parental schedule lock defaults to 0-24 (no restriction) instead of 7-21
- Feed ranker uses smooth exponential decay instead of step-function recency
- withCache middleware supports both sync and async cache providers
- .env.example comprehensively documents all environment variables
- Docker Compose includes Redis 7 service with health checks
- PostgreSQL migration script improved with backup, health checks, and rollback

### Fixed
- PinInput no longer has hardcoded English default for button text
- Removed dead userId fallback in reels DELETE handler (security)
- Removed unnecessary type casts in user-context (web + mobile)
- Added structured error response for reels sync endpoint failures
