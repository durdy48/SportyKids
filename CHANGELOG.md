# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- JWT authentication with email/password registration, login, token refresh, and account upgrade from anonymous
- Push notifications via Expo SDK with 5 triggers: daily quiz, daily missions, team news, sticker awards, streak reminders
- Schedule lock (bedtime mode) with timezone-aware allowed hours enforced server-side, kid-friendly "time to rest" screen on all pages
- API caching layer (InMemoryCache) with TTL-based expiration and `withCache()` middleware
- "For You" algorithmic feed with behavioral scoring (sport preference, source engagement, recency, read penalty, locale boost)
- Reading history with "Recently Read" section and paginated history endpoint
- Related articles recommendations (team-first, sport-fallback)
- Live team stats via TheSportsDB integration with daily sync cron job
- Weekly digest for parents with PDF generation and email delivery
- "See What My Kid Sees" feed preview mode for parents
- Granular per-content-type time limits (news, reels, quiz minutes)
- Content report button for kids with parental review workflow
- Daily missions system with weighted random generation and reward claiming
- Dark mode with system/light/dark toggle and flash prevention
- Offline reading queue (20 articles, 48h eviction) for web and mobile
- Search functionality with debounced input, suggested searches, and API `?q=` parameter
- Skeleton loading states for all pages (web and mobile)
- Celebration animations (confetti on sticker awards, perfect quiz, achievements)
- Page transition animations (fade-in/slide-up)
- Empty states with SVG illustrations and CTAs
- PIN input visual feedback (pop animation on digit entry, shake on error)
- Client-side favorites/bookmarks with heart icon and saved strip
- Trending news badges (articles with >5 views in 24h)
- Mobile feature parity: RSS catalog screen, streak counter, enhanced check-in alerts
- Native video player (expo-video for mobile, HTML5 for web) with YouTube embed fallback
- Parental onboarding tour (3-step tooltip flow)
- Kid-friendly error messages with sports-themed illustrations
- Haptic feedback on quiz answers (mobile)
- Pull-to-refresh with branded SportyKids colors (mobile)
- PostgreSQL migration preparation (docker-compose.yml + migration script)
- CI/CD pipeline (GitHub Actions: lint, typecheck, test, build)
- Error monitoring (Sentry, opt-in) and analytics (PostHog, opt-in)
- EAS Build configuration for Expo (preview + production profiles)
- 136 automated tests across 14 test files

### Changed
- Parental routes now require session verification (X-Parental-Session header) for data access; existence check remains open
- Sync endpoints (RSS sync, team stats sync) now require authentication
- Custom RSS source deletion now requires authentication and prefers JWT userId
- Auth upgrade endpoint now requires authentication with enforced userId match (IDOR fix)
- Report status update now requires parental session verification
- JWT_SECRET throws in production instead of logging a warning (fail-closed)
- Report update schema now accepts "actioned" status alongside "reviewed" and "dismissed"
- VideoPlayer iframe restricted to known video platforms (YouTube, Vimeo, Dailymotion)
- Digest email HTML-escapes all interpolated values to prevent injection
- PIN hashing migrated from SHA-256 to bcrypt with transparent migration
- Feed ranker limited to 500 items max for performance
- fetchSources route corrected from `/sources/list` to `/fuentes/listado` in web and mobile clients

### Fixed
- SSRF prevention on custom RSS URL validation (blocks private IPs, IPv6 loopback)
- Ownership check on custom RSS source deletion
- Quiz generation endpoint now requires parental session
- Password hash no longer leaked in user API responses (formatUser utility)
- Mobile navigation correctly destructures locale from user context
- Sticker award push notification uses user locale from DB instead of hardcoded 'es'
- Streak reminder filters at database level instead of application code
- Push notification token extraction uses typed ExpoPushMessage instead of any cast
- Dead authFetch function removed from mobile auth library
- Search query correctly uses AND/OR in Prisma query with team field included
- Schedule lock now shows kid-friendly LimitReached component on all pages (Home, Reels, Quiz, Collection, Team)
