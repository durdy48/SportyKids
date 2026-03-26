# Human Validation — prd.md (Sprint 1-2)

## Prerequisites

1. Start the API: `npm run dev:api` (port 3001)
2. Start the web app: `npm run dev:web` (port 3000)
3. Have at least one user created (run through onboarding if needed)
4. Ensure some news exist (API auto-syncs RSS on startup)

## Validation Steps

### B-TF2: Critical fixes

1. **Action**: Try `POST /api/quiz/generate` without `X-Parental-Session` header (e.g., via curl)
   **Expected**: Returns 401 Unauthorized

2. **Action**: Try `POST /api/news/fuentes/custom` with a localhost URL
   **Expected**: Returns 400 with SSRF validation error

3. **Action**: Try `DELETE /api/news/fuentes/custom/:id` with a different userId
   **Expected**: Returns 403 Forbidden

### B-MP2: Centralized API_BASE

4. **Action**: Open `apps/mobile/src/config.ts`
   **Expected**: Single file with dev/preview/production URLs. No hardcoded IPs in screen files.

### B-UX1: Skeleton loading

5. **Action**: Open http://localhost:3000 and observe initial load
   **Expected**: Skeleton cards with shimmer animation appear immediately, then replaced by real content

6. **Action**: Navigate to Collection, Quiz, Team, Reels pages
   **Expected**: Each shows appropriate skeleton (not spinner) during loading

### B-CP1: Search

7. **Action**: Type "Madrid" in the search bar on Home
   **Expected**: News filtered to those containing "Madrid" in title/summary (after 300ms debounce)

8. **Action**: Click a suggested search pill (e.g., "Real Madrid")
   **Expected**: Search input fills and results filter

9. **Action**: Clear the search
   **Expected**: Normal feed returns

### B-TF1: Tests

10. **Action**: Run `cd apps/api && npx vitest run`
    **Expected**: 36 tests pass across 4 files

### B-UX2: Celebrations

11. **Action**: Trigger a daily check-in that awards a sticker (may need to advance date)
    **Expected**: Confetti animation fires + toast slides in with glow

12. **Action**: Get a perfect quiz score (all questions correct)
    **Expected**: Star burst confetti animation

### B-UX3: Page transitions

13. **Action**: Navigate between pages (Home -> Reels -> Quiz -> Collection)
    **Expected**: Subtle fade-in/slide-up animation on each page mount

### B-UX5: Empty states

14. **Action**: Search for a nonsense term (e.g., "xyzabc123")
    **Expected**: SVG illustration + "No results" message (not emoji)

15. **Action**: Navigate to Collection with a new user (no stickers)
    **Expected**: Empty album illustration + CTA "Play the quiz to earn stickers" with link to /quiz

### B-UX6: PIN feedback

16. **Action**: Go to Parents -> enter digits in PIN
    **Expected**: Each digit box pops with a subtle scale animation

17. **Action**: Enter an incorrect PIN
    **Expected**: Inputs shake horizontally then clear

### B-EN2: Favorites

18. **Action**: Click the heart on a news card
    **Expected**: Heart fills red, "Saved" strip appears above feed

19. **Action**: Refresh the page
    **Expected**: Heart is still filled (persisted in localStorage)

20. **Action**: Click the heart again to unfavorite
    **Expected**: Heart returns to outline, card removed from Saved strip

### B-EN3: Trending

21. **Action**: Check the Home feed
    **Expected**: News with >5 views in 24h show an orange "Trending" pill badge

## Appendix A: Re-validation after /t-review #1

### Security fixes

22. **Action**: Check `formatUser` in `apps/api/src/utils/format-user.ts`
    **Expected**: Uses destructuring to strip `passwordHash` from response. Both `users.ts` and `auth.ts` import from this shared utility.

23. **Action**: Check `/api/auth/upgrade` endpoint for IDOR protection
    **Expected**: If caller is authenticated (has JWT), they can only upgrade their own account (userId must match req.auth.userId). Returns 403 otherwise.

24. **Action**: Check `apps/mobile/src/navigation/index.tsx` AppNavigator
    **Expected**: `locale` is destructured from `useUser()` — no ReferenceError at runtime.

### Push locale improvements

25. **Action**: Check `gamification.ts` awardSticker push notification
    **Expected**: Queries user locale from DB before sending push (not hardcoded 'es').

26. **Action**: Check batch push triggers (quiz, missions, sync-feeds)
    **Expected**: Have TODO comments for per-locale grouping in production.

### Type and code quality fixes

27. **Action**: Check `PushPreferences.sports` type in `packages/shared/src/types/index.ts`
    **Expected**: `sports: boolean` (not `string[]`), matching Zod schema and runtime usage.

28. **Action**: Check JWT_SECRET handling in `auth-service.ts`
    **Expected**: Logs a prominent warning if JWT_SECRET is not set in production.

29. **Action**: Check `Register.tsx` form
    **Expected**: Shows age input when role is 'child'.

30. **Action**: Check `apps/mobile/src/lib/auth.ts`
    **Expected**: No dead `authFetch` function (removed).

31. **Action**: Check `apps/api/src/services/push-sender.ts` token extraction
    **Expected**: Uses typed `ExpoPushMessage` instead of `(chunk[i] as any).to`.

32. **Action**: Check `streak-reminder.ts` DB query
    **Expected**: Filters `lastActiveDate < todayStart` at the database level (not in application code).

33. **Action**: Re-run all original validation steps (1-21) to confirm no regressions.

---

# Human Validation — prd3.md (PRD 3/3)

## Prerequisites

Start the test environment:

```bash
bash specs/product-owner-proposals/create-environment.sh
```

## Validation Steps

### B-TF5: API Caching Layer

1. **Action**: Open http://localhost:3000 and load the news feed. Check network tab — note response time.
   **Expected**: News feed loads normally.

2. **Action**: Reload the page within 5 minutes. Check network tab response time.
   **Expected**: Response should be faster (served from cache). API response header may include cache info.

3. **Action**: Go to the API directly: http://localhost:3001/api/gamification/stickers
   **Expected**: Returns sticker catalog. Second request within 24h should be cached.

### B-CP2: "For You" Algorithmic Feed

4. **Action**: Create/use a user and read several football articles. Then switch to "For You" feed mode.
   **Expected**: Football articles should be ranked higher. Recently read articles should appear lower in the feed.

5. **Action**: Check a new user's feed (no activity history).
   **Expected**: Feed uses static weights only (same behavior as before this feature).

### B-CP5: Content Filtering by Language

6. **Action**: Set user locale to 'es' and load the news feed.
   **Expected**: Articles from Spanish-language sources (AS, Marca, etc.) should appear higher in "For You" mode.

### B-EN4: Reading History

7. **Action**: Open the home page after having viewed some articles. Look for "Recently Read" section.
   **Expected**: A horizontal strip shows up to 5 recently read articles with timestamps.

8. **Action**: Visit http://localhost:3001/api/news/historial?userId=USER_ID
   **Expected**: Returns paginated list of viewed articles with viewedAt timestamps.

### B-CP4: Content Recommendations

9. **Action**: Click on a news article, scroll to the bottom.
   **Expected**: "Related Articles" section shows 2-3 articles from the same team/sport.

10. **Action**: Visit http://localhost:3001/api/news/ARTICLE_ID/relacionados
    **Expected**: Returns related articles array.

### B-PT4: Bedtime/Schedule Lock

11. **Action**: Go to Parents panel > Restrictions tab. Look for Schedule section.
    **Expected**: Start time, end time, and timezone dropdowns are visible with defaults (7:00-21:00, Europe/Madrid).

12. **Action**: Set schedule to a range that excludes the current time (e.g., if it's 15:00, set 7:00-14:00).
    **Expected**: News/reels/quiz should show a sleep-themed "Time to rest, champion!" screen.

13. **Action**: Reset schedule to include current time.
    **Expected**: Content becomes accessible again.

### B-CP3: Live Team Stats

14. **Action**: Go to the Team page and select a team (e.g., Real Madrid).
    **Expected**: Team stats are displayed (may be seed data if TheSportsDB is unreachable).

15. **Action**: Visit http://localhost:3001/api/teams/sync (POST)
    **Expected**: Returns sync results showing attempted/succeeded/failed counts.

### B-UX7: Kid-Friendly Error Messages

16. **Action**: Disconnect from the internet (or use browser DevTools to go offline). Try to load news.
    **Expected**: A sports-themed error message appears (e.g., "Oops! The ball went out of bounds!") with a "Try Again" button.

17. **Action**: Visit a non-existent URL like http://localhost:3000/nonexistent
    **Expected**: A kid-friendly "Playing hide and seek!" error message appears.

### B-MP4: Offline Reading Queue

18. **Action**: Load the news feed while online. Then go offline (browser DevTools > Network > Offline).
    **Expected**: An offline banner appears at the top: "You're offline — Showing saved articles". Cached articles are displayed.

19. **Action**: Go back online.
    **Expected**: Banner disappears, feed refreshes from API.

### B-MP3: Pull-to-Refresh (Mobile)

20. **Action**: On mobile (Expo Go), pull down on the HomeFeed screen.
    **Expected**: A branded refresh control appears with SportyKids blue color and "Loading fresh news..." text.

### B-UX8: Haptic Feedback (Mobile)

21. **Action**: On a physical device, answer a quiz question correctly.
    **Expected**: A success haptic feedback is felt.

22. **Action**: Answer a quiz question incorrectly.
    **Expected**: An error haptic feedback is felt.

### B-MP6: Native Video Player

23. **Action**: Go to the Reels page. View a reel.
    **Expected**: YouTube reels display in an iframe. If any MP4 reels exist, they play in a native video player.

### B-PT6: Parental Onboarding Tour

24. **Action**: Create a new user and go through onboarding. After setting a parental PIN, observe the tour.
    **Expected**: A 3-step tooltip tour appears explaining Restrictions, Activity tracking, and Schedule features.

25. **Action**: Complete the tour. Go back to the Parents panel.
    **Expected**: The tour does not appear again (persisted in localStorage).

### B-TF4: PostgreSQL Migration Prep

26. **Action**: Check that docker-compose.yml exists at apps/api/docker-compose.yml
    **Expected**: File exists with PostgreSQL 16 configuration.

27. **Action**: Check that scripts/migrate-to-postgres.sh exists
    **Expected**: Migration script exists with instructions for switching from SQLite to PostgreSQL.

### B-TF6: Error Monitoring

28. **Action**: Check that monitoring.ts exists at apps/api/src/services/monitoring.ts
    **Expected**: File exists with Sentry initialization gated by SENTRY_DSN env var.

29. **Action**: Check that analytics.ts exists at apps/web/src/lib/analytics.ts
    **Expected**: File exists with PostHog initialization gated by POSTHOG_API_KEY env var.

### B-TF7: CI/CD Pipeline

30. **Action**: Check that .github/workflows/ci.yml exists
    **Expected**: CI config with lint, typecheck, test, build-api, build-web jobs.

31. **Action**: Check that apps/mobile/eas.json exists
    **Expected**: EAS build config with preview and production profiles.

## Appendix E: Re-validation after /t-review #3

### Security: auth/upgrade IDOR fix

32. **Action**: Check `apps/api/src/routes/auth.ts` — the `/upgrade` route
    **Expected**: Route uses `requireAuth` middleware. Inside the handler, enforces `req.auth!.userId === userId` (no conditional `if (req.auth &&` bypass).

### Security: Parental routes protected

33. **Action**: Check `apps/api/src/routes/parents.ts` — all GET/PUT routes for perfil, actividad, preview, digest
    **Expected**: Each route handler starts by calling `verifyParentalSession(req.headers['x-parental-session'])` and returns 401 if invalid. At least 9 route handlers have this check.

34. **Action**: Check that POST `/actividad/registrar`, POST `/configurar`, and POST `/verificar-pin` do NOT require parental session (these are child/setup flows)
    **Expected**: These 3 routes have no `verifyParentalSession` check.

### Security: Report update protected

35. **Action**: Check `apps/api/src/routes/reports.ts` — PUT `/:reportId`
    **Expected**: Handler starts with `verifyParentalSession` check. Returns 401 if no valid session.

### Security: Sync endpoints protected

36. **Action**: Check `apps/api/src/routes/news.ts` — POST `/sincronizar`
    **Expected**: Route uses `requireAuth` middleware.

37. **Action**: Check `apps/api/src/routes/teams.ts` — POST `/sync`
    **Expected**: Route uses `requireAuth` middleware.

### Bug fix: fetchSources route

38. **Action**: Check `apps/web/src/lib/api.ts` — `fetchSources()` function
    **Expected**: URL is `${API_BASE}/news/fuentes/listado` (not `/sources/list`).

39. **Action**: Check `apps/mobile/src/lib/api.ts` — `fetchSources()` function
    **Expected**: URL is `${API_BASE}/news/fuentes/listado` (not `/sources/list`).

### Security: JWT_SECRET fail-closed

40. **Action**: Check `apps/api/src/services/auth-service.ts` — JWT_SECRET handling
    **Expected**: Throws an Error (not just logs) if `NODE_ENV === 'production'` and `JWT_SECRET` is not set.

### Fix: Report 'actioned' status

41. **Action**: Check `apps/api/src/routes/reports.ts` — update report Zod schema
    **Expected**: Enum includes `'actioned'` alongside `'reviewed'` and `'dismissed'`.

### Security: VideoPlayer iframe allowlist

42. **Action**: Check `apps/web/src/components/VideoPlayer.tsx` — iframe rendering
    **Expected**: URL is validated against known video platforms (youtube.com, youtu.be, vimeo.com, dailymotion.com). Non-matching URLs show a fallback message instead of an iframe.

### Security: HTML injection in digest

43. **Action**: Check `apps/api/src/services/digest-generator.ts` — `renderDigestHtml`
    **Expected**: All interpolated values (userName, sport names, titles) are HTML-escaped before insertion into the template.

### Security: Custom source delete auth

44. **Action**: Check `apps/api/src/routes/news.ts` — DELETE `/fuentes/custom/:id`
    **Expected**: Route uses `requireAuth` middleware. Ownership check uses `req.auth?.userId` (preferring JWT over query param).

### Type safety fixes

45. **Action**: Check `apps/web/src/lib/api.ts` — `fetchReports` return type
    **Expected**: Returns a typed array (not `Promise<any[]>`).

46. **Action**: Check `apps/web/src/components/ParentalPanel.tsx` — `digestPreview` state
    **Expected**: Typed with a proper interface (not `any`).

### Regression check

47. **Action**: Re-run all original validation steps (1-31) and all previous appendix checks to confirm no regressions.
    **Expected**: All checks pass.
