# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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
- OAuth placeholder routes for Google and Apple sign-in (501 — planned)
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
