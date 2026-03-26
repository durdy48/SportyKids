# Human Validation — prd.md (M1: AI Infrastructure + Content Safety)

## Prerequisites

1. Ensure the database is migrated: `cd apps/api && npx prisma migrate dev`
2. Run seed to populate 40+ RSS sources: `cd apps/api && npx tsx prisma/seed.ts`
3. Start the API: `npm run dev:api` (runs on :3001)
4. Start the webapp: `npm run dev:web` (runs on :3000)
5. (Optional) For AI moderation: install Ollama (`brew install ollama`), pull a model (`ollama pull llama3.2:3b`), start it (`ollama serve`)

**Note**: If Ollama is not running, content will be auto-approved (fail-open). This is expected for PoC.

## Validation Steps

### 1. Prisma Schema & Migration

1. **Action**: Run `cd apps/api && npx prisma studio` and inspect the `NewsItem` table.
   **Expected**: See columns `safetyStatus` (default "pending"), `safetyReason`, `moderatedAt`.

2. **Action**: Inspect the `RssSource` table.
   **Expected**: See columns `country`, `language`, `logoUrl`, `description`, `category`, `isCustom`, `addedBy`.

### 2. RSS Source Catalog (40+ sources)

3. **Action**: `curl http://localhost:3001/api/news/fuentes/catalogo | jq '.total'`
   **Expected**: Returns a number >= 40.

4. **Action**: `curl http://localhost:3001/api/news/fuentes/catalogo | jq '.bySport'`
   **Expected**: Shows counts for all 8 sports (football, basketball, tennis, swimming, athletics, cycling, formula1, padel).

5. **Action**: `curl http://localhost:3001/api/news/fuentes/catalogo | jq '.sources[0]'`
   **Expected**: Each source has: id, name, url, sport, active, country, language, description, category, isCustom (false for seed sources).

### 3. Content Moderation (with AI running)

6. **Action**: `curl -X POST http://localhost:3001/api/news/sincronizar`
   **Expected**: Response includes `moderation` object with `approved`, `rejected`, `errors` counts. Articles are synced from RSS sources.

7. **Action**: `curl "http://localhost:3001/api/news?limit=5" | jq '.news[0].safetyStatus'`
   **Expected**: Returns `"approved"` — only approved content is returned.

8. **Action**: Check database for any rejected items: `npx prisma studio` → filter NewsItem by safetyStatus = "rejected".
   **Expected**: If AI is running and found inappropriate content, rejected items exist with a `safetyReason`.

### 4. Safety Filtering

9. **Action**: Find a news item ID from the API: `curl "http://localhost:3001/api/news?limit=1" | jq '.news[0].id'`. Then fetch it: `curl http://localhost:3001/api/news/<id>`.
   **Expected**: Returns the news item with safetyStatus = "approved".

10. **Action**: (If any rejected items exist in DB) Try to fetch a rejected item by its ID directly.
    **Expected**: Returns 404 — rejected content is never exposed via API.

### 5. Custom RSS Sources

11. **Action**: Add a custom source:
    ```bash
    curl -X POST http://localhost:3001/api/news/fuentes/custom \
      -H "Content-Type: application/json" \
      -d '{"name":"BBC Sport Tennis","url":"https://feeds.bbci.co.uk/sport/tennis/rss.xml","sport":"tennis"}'
    ```
    **Expected**: If URL already exists (from seed), returns 409. If new valid RSS URL, returns 201 with the created source and syncResult.

12. **Action**: Try adding an invalid RSS URL:
    ```bash
    curl -X POST http://localhost:3001/api/news/fuentes/custom \
      -H "Content-Type: application/json" \
      -d '{"name":"Bad Source","url":"https://example.com/not-rss","sport":"football"}'
    ```
    **Expected**: Returns 422 with error "URL does not appear to be a valid RSS feed".

13. **Action**: Delete the custom source: `curl -X DELETE http://localhost:3001/api/news/fuentes/custom/<id>`.
    **Expected**: Returns 200 with deletion confirmation.

14. **Action**: Try deleting a catalog (non-custom) source:
    ```bash
    curl -X DELETE http://localhost:3001/api/news/fuentes/custom/<catalog-source-id>
    ```
    **Expected**: Returns 403 "Cannot delete catalog sources".

### 6. Onboarding — Source Catalog UI

15. **Action**: Navigate to `http://localhost:3000/onboarding`. Complete steps 1-3 (name, sports, team).
    **Expected**: Step 4 shows the source catalog grouped by the sports you selected in step 2.

16. **Action**: In step 4, check that sources have: name, country flag emoji, description.
    **Expected**: Sources display with correct metadata. Spanish sources show 🇪🇸, British show 🇬🇧, etc.

17. **Action**: Click "Select all" on a sport group, then "Deselect all".
    **Expected**: All sources in that group toggle on/off. Counter at bottom updates.

18. **Action**: Click "Add custom source" button. Fill in a valid RSS URL, name, and select a sport.
    **Expected**: After adding, the source appears in the list with a "Custom" badge and is auto-selected.

19. **Action**: Complete onboarding (Finish).
    **Expected**: User is created with selectedFeeds containing the IDs of selected sources.

### 7. AI Client Multi-Provider

20. **Action**: With `AI_PROVIDER=ollama` (default) and Ollama running, trigger sync and check logs.
    **Expected**: Console shows `[Moderator]` logs with approval/rejection counts.

21. **Action**: Stop Ollama (`brew services stop ollama`). Trigger sync again.
    **Expected**: All content is auto-approved with log warnings `[Moderator] AI moderation failed, approving by default`.

### 8. Shared Types & i18n

22. **Action**: In the browser, switch language to English (if locale toggle exists).
    **Expected**: Source catalog labels change to English ("News sources", "Select all", etc.).

23. **Action**: Check `packages/shared/src/types/index.ts` for new exports.
    **Expected**: SafetyStatus, SafetyResult, RssSource, RssSourceCatalogResponse are exported.

---

# Human Validation — prd2.md (M2: Age-Adapted Content)

## Prerequisites

1. API running: `npm run dev:api` (port 3001)
2. Webapp running: `PORT=3000 npm run dev:web`
3. Database has news items (run sync if needed: `curl -X POST localhost:3001/api/news/sincronizar`)
4. (Optional) Ollama running for real AI summaries. Without it, summaries return empty.

## Validation Steps

### 1. NewsSummary Schema

1. **Action**: `curl http://localhost:3001/api/news?limit=1` — get a news item ID.
   **Expected**: Returns news with `id` field.

### 2. Summary API Endpoint

2. **Action**: `curl "http://localhost:3001/api/news/<id>/resumen?age=7&locale=es"`
   **Expected**: Returns `{summary, ageRange: "6-8", generatedAt}`. Summary may be empty without Ollama.

3. **Action**: `curl "http://localhost:3001/api/news/<id>/resumen?age=10&locale=en"`
   **Expected**: Returns `{summary, ageRange: "9-11", generatedAt}` in English.

4. **Action**: `curl "http://localhost:3001/api/news/nonexistent/resumen"`
   **Expected**: Returns 404.

5. **Action**: `curl "http://localhost:3001/api/news/<id>/resumen?age=0"`
   **Expected**: Returns 400 (Zod validation error).

### 3. "Explain it Easy" Button (UI)

6. **Action**: Navigate to `http://localhost:3000`. Find a news card.
   **Expected**: Each card has a lightbulb button with text "Explica fácil".

7. **Action**: Click the "Explica fácil" button on any card.
   **Expected**: A panel slides down below the card. Shows loading skeleton initially, then the summary (or error if AI unavailable).

8. **Action**: Click the button again.
   **Expected**: Panel collapses. Click again — panel opens instantly (cached, no re-fetch).

9. **Action**: Check the button styling when expanded.
   **Expected**: Button has yellow (#FACC15) background when active.

### 4. Summary Panel Design

10. **Action**: Inspect the expanded summary panel.
    **Expected**: Light background (#F8FAFC), blue left border (#2563EB), green age badge pill, Inter font.

---

# Human Validation — prd3.md (M3: Dynamic Quiz from Real News)

## Prerequisites

1. API running on :3001
2. Webapp running on :3000
3. News items in database (run sync if needed)
4. (Optional) Ollama for real quiz generation

## Validation Steps

### 1. Schema

1. **Action**: Check migration exists in `apps/api/prisma/migrations/` for quiz fields.
   **Expected**: Migration `add_quiz_generation_fields` exists.

### 2. Quiz API with age filter

2. **Action**: `curl "http://localhost:3001/api/quiz/questions?count=5"`
   **Expected**: Returns questions with `isDaily` field (false for seed questions).

3. **Action**: `curl "http://localhost:3001/api/quiz/questions?count=5&age=6-8"`
   **Expected**: Returns questions. Without daily questions, falls back to seed.

### 3. Manual quiz generation

4. **Action**: `curl -X POST http://localhost:3001/api/quiz/generate`
   **Expected**: Returns `{generated, errors}`. Without Ollama: `{generated: 0, errors: 0}`.

5. **Action**: (With Ollama) Run generate again, then: `curl "http://localhost:3001/api/quiz/questions?count=5&age=9-11"`
   **Expected**: Some questions have `isDaily: true` and `relatedNewsId` set.

### 4. Quiz UI

6. **Action**: Navigate to `http://localhost:3000/quiz` and start a quiz.
   **Expected**: Quiz loads with questions. If no daily questions, shows "No daily quiz yet" message.

7. **Action**: (With daily questions) Play quiz and answer a daily question.
   **Expected**: Daily question shows blue "Quiz del Dia" badge. After answering, "Lee la noticia relacionada" link appears.

### 5. Backward compatibility

8. **Action**: `curl "http://localhost:3001/api/quiz/questions?count=15"` (no age param)
   **Expected**: Returns up to 15 questions (seed + daily mixed). All have `isDaily` field.

---

# Human Validation — prd4.md (M4: Gamification)

## Prerequisites

1. API running on :3001 (restart after M4 changes)
2. Webapp running on :3000
3. Seed data loaded (stickers + achievements): `cd apps/api && npx tsx prisma/seed.ts`

## Validation Steps

### 1. Stickers Catalog

1. **Action**: `curl http://localhost:3001/api/gamification/stickers | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"stickers\"])} stickers')"`
   **Expected**: 36 stickers returned.

### 2. Achievements Catalog

2. **Action**: `curl http://localhost:3001/api/gamification/achievements | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"achievements\"])} achievements')"`
   **Expected**: 20 achievements returned.

### 3. Daily Check-in

3. **Action**: `curl -X POST http://localhost:3001/api/gamification/check-in -H "Content-Type: application/json" -d '{"userId":"<your-user-id>"}'`
   **Expected**: Returns streak info, daily sticker (or null if all common owned), pointsAwarded >= 2.

### 4. Streak Info

4. **Action**: `curl http://localhost:3001/api/gamification/streaks/<userId>`
   **Expected**: Returns { currentStreak, longestStreak, lastActiveDate }.

### 5. Collection Page (UI)

5. **Action**: Navigate to `http://localhost:3000/collection`.
   **Expected**: Page shows streak counter, points, progress bar, sticker grid, and achievements section.

6. **Action**: Click sport filter tabs.
   **Expected**: Sticker grid filters by sport. "All" shows all stickers.

7. **Action**: Check sticker visuals.
   **Expected**: Owned stickers in color with rarity border. Unowned in grayscale with "?".

### 6. NavBar

8. **Action**: Check the navigation bar.
   **Expected**: Collection tab (🏆) visible between Quiz and My Team.

### 7. Quiz Perfect Bonus

9. **Action**: Play a quiz and answer 5 questions correctly in a row.
   **Expected**: After 5th correct answer, bonus points (+50) awarded. Check score increased.

---

# Human Validation — prd5.md (M5: Robust Parental Controls)

## Prerequisites

1. API restarted with M5 changes
2. Webapp running on :3000
3. Clear localStorage to test onboarding step 5

## Validation Steps

### 1. Onboarding Step 5

1. **Action**: Clear localStorage and go to /onboarding. Complete steps 1-4.
   **Expected**: Step 5 appears with PIN creation, format toggles, and time limit buttons.

2. **Action**: Enter a 4-digit PIN and confirm it. Select formats and time limit. Finish.
   **Expected**: User created + parental profile created. Redirects to home.

### 2. Backend Enforcement

3. **Action**: `curl "http://localhost:3001/api/news?userId=<id>&sport=swimming"` (if swimming not in allowedSports)
   **Expected**: 403 with `error: "sport_blocked"`.

4. **Action**: Set a 1-min time limit, record 60+ seconds of activity, then try to load news.
   **Expected**: 403 with `error: "limit_reached"`.

### 3. bcrypt PIN

5. **Action**: Check the database — the PIN should be a bcrypt hash (starts with `$2a$` or `$2b$`).
   **Expected**: Not a 64-char hex string (old SHA-256).

### 4. Parental Panel

6. **Action**: Navigate to /parents, enter PIN.
   **Expected**: 5-tab panel: Profile, Content, Restrictions, Activity, PIN.

7. **Action**: Go to Activity tab.
   **Expected**: Bar chart showing daily usage, breakdown by format, week navigation.

### 5. API Routes Fixed

8. **Action**: Navigate between pages — no more 404 errors from parental profile fetch.
   **Expected**: Console clean of `/parents/profile/` 404 errors (was using English path before).

### 6. Activity Tracking

9. **Action**: Browse news for 10+ seconds, navigate away, check activity in parental panel.
   **Expected**: Activity registered with duration.

---

# Human Validation — prd6.md (M6: Smart Feed + Team + Reels)

## Prerequisites

1. API restarted with M6 changes
2. Seed run for TeamStats: `cd apps/api && npx tsx prisma/seed.ts`
3. Webapp running on :3000

## Validation Steps

### 1. Feed Display Modes

1. **Action**: Go to home page. Look for mode toggle (Headlines/Cards/Explain).
   **Expected**: Three-button pill toggle visible above news.

2. **Action**: Switch to Headlines mode.
   **Expected**: Compact rows with sport dot, title, source, time. No images.

3. **Action**: Switch to Explain mode.
   **Expected**: Cards with "Explica fácil" button auto-visible.

4. **Action**: Reload page.
   **Expected**: Selected mode persists (localStorage).

### 2. Team Stats Page

5. **Action**: `curl http://localhost:3001/api/teams/Real%20Madrid/stats`
   **Expected**: Returns stats with leaguePosition, recentResults (5), topScorer, nextMatch.

6. **Action**: Navigate to /team and select a team.
   **Expected**: Team hub with stats card (position, W/D/L circles), team news, team reels strip.

### 3. TikTok-Style Reels

7. **Action**: Navigate to /reels.
   **Expected**: Full-screen vertical scroll feed. One reel per viewport height. Snap scrolling.

8. **Action**: Scroll down to next reel.
   **Expected**: Snaps to next reel. Previous reel pauses, new one shows overlay (title, sport, like/share).

9. **Action**: Click heart icon on a reel. Reload page.
   **Expected**: Heart stays filled (persisted in localStorage).

### 4. Notifications (MVP)

10. **Action**: `curl http://localhost:3001/api/users/<userId>/notifications`
    **Expected**: Returns `{ pushEnabled, pushPreferences }`.

### 5. Feed Ranker

11. **Action**: `curl "http://localhost:3001/api/news?userId=<userId>&limit=5"`
    **Expected**: News ordered by relevance (favorite team first, then favorite sports).
