# PRD: Milestone 5 — Robust Parental Controls

> Part of [SportyKids Differentiators](./prd.md). See main PRD for overview and dependency graph.

## Overview

Milestone 5 transforms the parental control system from a frontend-only cosmetic layer into a backend-enforced, secure, and comprehensive parental management system. This includes migrating PIN hashing from SHA-256 to bcrypt, adding server-side middleware that blocks restricted content before it reaches the child, embedding parental setup into the onboarding flow, and building a detailed activity reporting panel with visual charts.

**Dependency**: M1 (RSS Source Catalog) must be completed first — the parent panel references the RSS catalog for source management. Can run in parallel with M3.

## Problem Statement

The current parental controls have critical gaps:

1. **No backend enforcement** — Restrictions are applied only in the NavBar component by hiding tabs. A child can access any content by calling the API directly or modifying localStorage.
2. **Weak PIN security** — SHA-256 is not a password-hashing algorithm; it lacks salting and is vulnerable to rainbow table attacks.
3. **No parental setup in onboarding** — Parents must navigate to a separate page after onboarding to configure controls, which many will skip.
4. **Shallow activity tracking** — ActivityLog records only event type and timestamp, with no duration, content reference, or sport breakdown.
5. **Minimal reporting** — The ParentalPanel shows only aggregate weekly counts with no temporal breakdown or visual charts.

## Goals

| # | Goal | Success Metric |
|---|------|---------------|
| G1 | Every content request is validated server-side against parental restrictions | 100% of news/reels/quiz endpoints return 403 when restrictions apply |
| G2 | PIN storage uses bcrypt with transparent migration from SHA-256 | All existing SHA-256 PINs are re-hashed on next verification |
| G3 | Every new user completes parental setup during onboarding | Onboarding step 5 is mandatory; no user record exists without a ParentalProfile |
| G4 | Activity logs capture duration, content, and sport | All frontend content views send duration on unmount |
| G5 | Parents see daily/weekly breakdowns with bar charts | ParentalPanel renders CSS-only charts with per-day, per-format data |

## Core Features

### 5.1 Onboarding Step 5 — Parental Setup

Add a fifth mandatory step to `apps/web/src/components/OnboardingWizard.tsx`.

**Flow**:
1. Steps 1-4 remain unchanged (Name/Age, Sports, Team, RSS Sources).
2. Step 5: "Parent Setup" screen appears.
3. Parent creates a 4-digit PIN (entered twice for confirmation).
4. Parent selects allowed formats via toggles (news, reels, quiz — all ON by default).
5. Parent sets daily time limit via preset buttons (15 / 30 / 60 / 90 / 120 min, or "No limit").
6. On submit: POST `/api/parents/configurar` with `{userId, pin, allowedFormats, maxDailyTimeMinutes}`. `allowedSports` defaults to the child's selected sports from step 2.
7. Step cannot be skipped. The "Finish" button is disabled until PIN is set.

**i18n keys to add** (both `es.json` and `en.json`):
- `onboarding.step5_title` — "Configuración parental" / "Parental Setup"
- `onboarding.step5_subtitle` — "Configura un PIN para gestionar la experiencia de tu hijo" / "Set a PIN to manage your child's experience"
- `onboarding.pin_create` — "Crea un PIN de 4 dígitos" / "Create a 4-digit PIN"
- `onboarding.pin_confirm` — "Confirma tu PIN" / "Confirm your PIN"
- `onboarding.pin_mismatch` — "Los PINs no coinciden" / "PINs don't match"
- `onboarding.formats_label` — "Formatos de contenido permitidos" / "Allowed content formats"
- `onboarding.time_limit_label` — "Límite de tiempo diario" / "Daily screen time limit"
- `onboarding.no_limit` — "Sin límite" / "No limit"

**Implementation notes**:
- Update the step indicator from 4 to 5 dots.
- The `OnboardingWizard` currently calls `POST /api/users` on step 4 completion. Move user creation to remain on step 4, then call `POST /api/parents/configurar` on step 5 completion.
- The allowed sports for the parental profile should default to whichever sports the child selected in step 2.

### 5.2 Backend Enforcement Middleware

**New file**: `apps/api/src/middleware/parental-guard.ts`

**Middleware logic** (executed in order):

```
1. Extract userId from query param (?userId=) or X-User-Id header
2. If no userId → pass through (anonymous browsing, no restrictions)
3. Fetch ParentalProfile for userId (cache in memory Map with 60s TTL)
4. If no profile → pass through
5. Check FORMAT restriction:
   - Determine format from route: /api/news → "news", /api/reels → "reels", /api/quiz → "quiz"
   - If format not in allowedFormats → 403
6. Check SPORT restriction:
   - Extract sport from query param (?sport=)
   - If sport param present AND sport not in allowedSports → 403
7. Check TIME restriction:
   - If maxDailyTimeMinutes is null → pass through
   - Query ActivityLog: SUM(durationSeconds) WHERE userId AND createdAt >= today 00:00
   - If total >= maxDailyTimeMinutes * 60 → 403
8. Pass through
```

**403 response shape**:
```json
{
  "error": "format_blocked" | "sport_blocked" | "limit_reached",
  "message": "...",
  "limit": 60,
  "used": 62
}
```

**Apply middleware to these route files**:
- `apps/api/src/routes/news.ts` — all GET routes
- `apps/api/src/routes/reels.ts` — all GET routes
- `apps/api/src/routes/quiz.ts` — GET `/questions` and POST `/answer`

**Registration**: Import the middleware and apply it as the first handler in each route definition, e.g., `router.get('/', parentalGuard, async (req, res) => { ... })`.

**In-memory cache**: Use a simple `Map<string, {profile: ParentalProfile, fetchedAt: number}>` with 60-second TTL. No external cache library needed. Invalidate on PUT to parental profile.

### 5.3 PIN Migration to bcrypt

**New dependency**: `bcryptjs` (pure JS, no native compilation needed).

**Changes to `apps/api/src/routes/parents.ts`**:

**POST `/api/parents/configurar`** (create/update):
- Replace `crypto.createHash('sha256').update(pin).digest('hex')` with `await bcrypt.hash(pin, 10)`.
- Salt rounds: 10 (sufficient for a 4-digit PIN; the real security is rate-limiting, not hash strength).

**POST `/api/parents/verificar-pin`** (verify):
- First, try `await bcrypt.compare(pin, storedHash)`.
- If bcrypt compare returns false AND the stored hash is exactly 64 hex characters (SHA-256 format): compute SHA-256 of the input PIN and compare.
- If SHA-256 matches: re-hash with bcrypt and update the database row (transparent migration). Return verified: true.
- If neither matches: return verified: false.

**PIN verification session** (see 5.6): On successful verification, return a `sessionToken` (random UUID) and `expiresAt` (now + 5 minutes). Store in a server-side `Map<token, {userId, expiresAt}>`.

### 5.4 Enhanced Activity Tracking

**Prisma schema migration** — add fields to `ActivityLog`:

```prisma
model ActivityLog {
  id              String   @id @default(cuid())
  userId          String
  type            String   // 'news_viewed' | 'reels_viewed' | 'quizzes_played'
  durationSeconds Int?     // NEW — time spent on content in seconds
  contentId       String?  // NEW — ID of NewsItem, Reel, or QuizQuestion
  sport           String?  // NEW — sport tag of the viewed content
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
}
```

**Migration**: Run `npx prisma migrate dev --name add-activity-detail-fields`.

**Existing route update** — `POST /api/parents/actividad/registrar`:
- Accept additional optional fields: `durationSeconds`, `contentId`, `sport`.
- Validate with Zod: `durationSeconds` is `z.number().int().min(0).max(86400).optional()`, `contentId` is `z.string().optional()`, `sport` is `z.enum([...SPORTS]).optional()`.

**New route** — `GET /api/parents/actividad/:userId/detalle`:
- Query params: `from` (ISO date string, required), `to` (ISO date string, required).
- Returns:

```json
{
  "period": { "from": "2026-03-17", "to": "2026-03-24" },
  "dailyBreakdown": [
    {
      "date": "2026-03-17",
      "totalSeconds": 1200,
      "byFormat": { "news": 600, "reels": 400, "quiz": 200 },
      "bySport": { "football": 800, "basketball": 400 },
      "itemCount": 12
    }
  ],
  "topContent": [
    { "contentId": "abc123", "type": "news", "title": "...", "viewCount": 3, "totalSeconds": 180 }
  ],
  "totals": {
    "totalSeconds": 8400,
    "totalItems": 84,
    "avgDailyMinutes": 20,
    "limitAlerts": 2
  }
}
```

- `limitAlerts`: count of days where `totalSeconds >= maxDailyTimeMinutes * 60`.
- `topContent`: join with NewsItem/Reel/QuizQuestion to get title. Limit to top 5.

**Frontend duration tracking**:

Create a shared hook: `apps/web/src/lib/use-activity-tracker.ts`

```typescript
useActivityTracker(userId: string, type: string, contentId?: string, sport?: string)
// On mount: record startTime
// On unmount: compute duration = now - startTime
// POST /api/parents/actividad/registrar with {userId, type, durationSeconds, contentId, sport}
// Use navigator.sendBeacon for reliability on page unload
```

Integrate the hook into:
- Home page (`app/page.tsx`): type `news_viewed`
- Reels page (`app/reels/page.tsx`): type `reels_viewed`
- Quiz page (`app/quiz/page.tsx`): type `quizzes_played`

### 5.5 Enhanced Parent Reports Panel

**Restructure `ParentalPanel.tsx`** into a tabbed/sectioned layout:

```
+----------------------------------------------------------+
|                   PARENTAL CONTROL                       |
|                                                          |
|  [Profile]  [Content]  [Restrictions]  [Activity]  [PIN] |
+----------------------------------------------------------+

--- Profile Tab ---
+----------------------------------------------------------+
|  Child's Name:  [ Juan          ] [Save]                 |
|  Age Range:     ( ) 6-8  (x) 9-11  ( ) 12-14            |
+----------------------------------------------------------+

--- Content Tab ---
+----------------------------------------------------------+
|  Allowed Sports                                          |
|  [x] Football  [x] Basketball  [ ] Tennis  [ ] Swimming  |
|  [ ] Athletics [ ] Cycling     [ ] Formula 1  [ ] Padel  |
|                                                          |
|  RSS Sources (from M1 catalog)                           |
|  [x] AS - Football                                       |
|  [x] AS - Basketball                                     |
|  [x] Mundo Deportivo                                     |
|  [ ] Marca                                               |
|  [+ Add source]                                          |
+----------------------------------------------------------+

--- Restrictions Tab ---
+----------------------------------------------------------+
|  Allowed Formats                                         |
|  [x] News    [x] Reels    [ ] Quiz                       |
|                                                          |
|  Daily Time Limit                                        |
|  ( ) 15 min  ( ) 30 min  (x) 60 min                     |
|  ( ) 90 min  ( ) 120 min ( ) No limit                    |
+----------------------------------------------------------+

--- Activity Tab ---
+----------------------------------------------------------+
|  This Week: Mar 17 - Mar 24          [< Prev] [Next >]  |
|                                                          |
|  Daily Usage (minutes)                                   |
|  60|                   ___                                |
|  50|          ___     |   |                               |
|  40|   ___   |   |    |   |  ___                          |
|  30|  |   |  |   |    |   | |   |                         |
|  20|  |   |  |   | ___|   | |   |  ___                    |
|  10|  |   |  |   ||   |   | |   | |   |                   |
|   0+--Mon---Tue---Wed--Thu--Fri---Sat---Sun--             |
|                                                          |
|    [===] News  [///] Reels  [***] Quiz                   |
|                                                          |
|  Average: 35 min/day  |  Limit alerts: 1 day             |
|                                                          |
|  Most Viewed                                             |
|  1. "Real Madrid wins Champions League" (3 views, 4min)  |
|  2. "Messi scores hat-trick" (2 views, 3min)             |
|  3. "NBA Finals recap" (2 views, 2min)                   |
+----------------------------------------------------------+

--- PIN Tab ---
+----------------------------------------------------------+
|  Change PIN                                              |
|  Current PIN:  [*][*][*][*]                              |
|  New PIN:      [ ][ ][ ][ ]                              |
|  Confirm:      [ ][ ][ ][ ]                              |
|                          [Change PIN]                     |
+----------------------------------------------------------+
```

**New component**: `apps/web/src/components/ActivityChart.tsx`

- Pure CSS bar chart — no chart libraries.
- Each day is a column. Each column is a stacked bar with segments for news (blue), reels (green), quiz (yellow).
- Column height is proportional to `maxDailyTimeMinutes` (or the highest day's value if no limit).
- If a day exceeds the limit, show a red dashed line at the limit level and color the excess portion red.

**Kid-friendly 403 message component**: `apps/web/src/components/LimitReached.tsx`

```
+----------------------------------------------------------+
|                                                          |
|                     (clock icon CSS)                     |
|                                                          |
|          That's all for today!                           |
|                                                          |
|     You've used all your screen time.                    |
|     Come back tomorrow for more sports fun!              |
|                                                          |
|              [Go to Home]                                |
|                                                          |
+----------------------------------------------------------+
```

- Shown when any API call returns a 403 with `error: "limit_reached"`.
- Different messages per error type:
  - `limit_reached` — "That's all for today! Come back tomorrow for more sports fun!"
  - `format_blocked` — "This section is not available right now. Ask your parents!"
  - `sport_blocked` — "This sport is not in your allowed list. Ask your parents to add it!"
- All messages use i18n keys.

**Additional i18n keys**:
- `parental.tab_profile` / `parental.tab_content` / `parental.tab_restrictions` / `parental.tab_activity` / `parental.tab_pin`
- `parental.child_name` / `parental.age_range`
- `parental.allowed_sports` / `parental.rss_sources` / `parental.add_source`
- `parental.daily_usage` / `parental.average_daily` / `parental.limit_alerts` / `parental.most_viewed`
- `parental.change_pin` / `parental.current_pin` / `parental.new_pin` / `parental.confirm_pin` / `parental.pin_changed`
- `parental.this_week` / `parental.prev_week` / `parental.next_week`
- `limit.reached_title` / `limit.reached_message` / `limit.format_blocked` / `limit.sport_blocked`
- `limit.go_home`

### 5.6 Configuration Session

**Server-side**: In `apps/api/src/routes/parents.ts`:

- On successful PIN verification (`POST /api/parents/verificar-pin`), generate a session token:
  ```typescript
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  parentSessions.set(token, { userId, expiresAt });
  ```
- Return `{ verified: true, sessionToken: token, expiresAt }` in the response.
- Store sessions in a module-level `Map<string, {userId: string, expiresAt: number}>`.
- Clean up expired sessions lazily on each verification request.

**New middleware**: `apps/api/src/middleware/parent-session.ts`
- Applied to: `PUT /api/parents/perfil/:userId`, `POST /api/parents/configurar` (when updating, not creating).
- Reads `X-Parent-Session` header.
- If token is valid and not expired and matches userId: allow.
- If token is missing/invalid/expired: return 401 `{ error: "session_expired", message: "Please verify your PIN again" }`.

**Client-side** (`apps/web/src/app/parents/page.tsx`):
- After PIN verification, store `{ token, expiresAt }` in component state (not localStorage — session should not survive page refresh for security).
- Include `X-Parent-Session: <token>` header in all config API calls.
- Before each config action, check `Date.now() < expiresAt`. If expired, show PIN input again.
- Show a countdown or subtle indicator: "Session active: 3:42 remaining".

## Acceptance Criteria

### Onboarding
- [ ] OnboardingWizard displays 5 steps (5 dots in the step indicator).
- [ ] Step 5 shows PIN creation with confirmation field.
- [ ] PIN mismatch shows error message; "Finish" button is disabled.
- [ ] Step 5 shows format toggles (all ON by default) and time limit selector.
- [ ] Completing step 5 calls `POST /api/parents/configurar` and creates a ParentalProfile.
- [ ] User cannot complete onboarding without setting a PIN.
- [ ] All text uses i18n keys.

### Backend Enforcement
- [ ] `GET /api/news?userId=X&sport=tennis` returns 403 if tennis is not in the user's `allowedSports`.
- [ ] `GET /api/reels?userId=X` returns 403 if "reels" is not in `allowedFormats`.
- [ ] `GET /api/quiz/questions?userId=X` returns 403 if daily time limit is exceeded.
- [ ] 403 response includes `error` field with one of: `format_blocked`, `sport_blocked`, `limit_reached`.
- [ ] Requests without `userId` pass through without restriction.
- [ ] Parental profile is cached in memory with 60s TTL; cache is invalidated on profile update.

### bcrypt Migration
- [ ] New PINs are stored as bcrypt hashes (starting with `$2a$` or `$2b$`).
- [ ] Existing SHA-256 PINs verify successfully on first attempt after migration.
- [ ] After verifying a SHA-256 PIN, the stored hash is updated to bcrypt.
- [ ] Subsequent verifications use bcrypt only (SHA-256 fallback no longer triggers).

### Activity Tracking
- [ ] `ActivityLog` table has `durationSeconds`, `contentId`, and `sport` columns.
- [ ] `POST /api/parents/actividad/registrar` accepts and stores the new fields.
- [ ] `GET /api/parents/actividad/:userId/detalle?from=2026-03-17&to=2026-03-24` returns `dailyBreakdown`, `topContent`, and `totals`.
- [ ] Web frontend sends duration on page/component unmount via `useActivityTracker` hook.
- [ ] Duration is sent via `navigator.sendBeacon` on `beforeunload` as a fallback.

### Parent Reports
- [ ] ParentalPanel has 5 tabs: Profile, Content, Restrictions, Activity, PIN.
- [ ] Activity tab shows a CSS-only stacked bar chart with 7 days.
- [ ] Chart bars are color-coded: blue (news), green (reels), yellow (quiz).
- [ ] Days exceeding the time limit show a red indicator.
- [ ] "Most Viewed" section lists up to 5 items with view count and duration.
- [ ] Week navigation (prev/next) fetches data for the selected period.
- [ ] PIN tab allows changing the PIN (requires current PIN verification).
- [ ] Content tab shows sports toggles and RSS source list (from M1 catalog).
- [ ] All text uses i18n keys.

### Configuration Session
- [ ] Successful PIN verification returns a `sessionToken` and `expiresAt`.
- [ ] Config API calls within 5 minutes succeed with the session token.
- [ ] Config API calls after 5 minutes return 401 `session_expired`.
- [ ] Client shows remaining session time indicator.
- [ ] Expired session prompts PIN re-entry.
- [ ] Session token is not persisted in localStorage.

### Kid-Friendly Error Messages
- [ ] `LimitReached` component renders when API returns 403.
- [ ] Different messages shown for `limit_reached`, `format_blocked`, and `sport_blocked`.
- [ ] Messages are age-appropriate and encouraging (not punitive).
- [ ] "Go to Home" button navigates back to the home feed.
- [ ] All messages use i18n keys.

## Technical Requirements

### New dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `bcryptjs` | `^3` | PIN hashing (pure JS, no native build) |

### New files to create
| File | Purpose |
|------|---------|
| `apps/api/src/middleware/parental-guard.ts` | Backend enforcement middleware |
| `apps/api/src/middleware/parent-session.ts` | PIN session validation middleware |
| `apps/web/src/components/ActivityChart.tsx` | CSS-only bar chart for activity reports |
| `apps/web/src/components/LimitReached.tsx` | Kid-friendly 403 error display |
| `apps/web/src/lib/use-activity-tracker.ts` | Hook for time-on-screen tracking |

### Files to modify
| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add `durationSeconds`, `contentId`, `sport` to ActivityLog |
| `apps/api/src/routes/parents.ts` | bcrypt hashing, session tokens, detail endpoint |
| `apps/api/src/routes/news.ts` | Apply `parentalGuard` middleware |
| `apps/api/src/routes/reels.ts` | Apply `parentalGuard` middleware |
| `apps/api/src/routes/quiz.ts` | Apply `parentalGuard` middleware |
| `apps/web/src/components/OnboardingWizard.tsx` | Add step 5 (parental setup) |
| `apps/web/src/components/ParentalPanel.tsx` | Restructure into tabbed layout with charts |
| `apps/web/src/components/PinInput.tsx` | Add confirmation mode prop |
| `apps/web/src/app/parents/page.tsx` | Session management, token handling |
| `apps/web/src/app/page.tsx` | Integrate `useActivityTracker`, handle 403 |
| `apps/web/src/app/reels/page.tsx` | Integrate `useActivityTracker`, handle 403 |
| `apps/web/src/app/quiz/page.tsx` | Integrate `useActivityTracker`, handle 403 |
| `apps/web/src/lib/api.ts` | Add X-User-Id header, handle 403 responses |
| `packages/shared/src/i18n/es.json` | Add all new i18n keys |
| `packages/shared/src/i18n/en.json` | Add all new i18n keys |

### Database migration
One migration: `add-activity-detail-fields`
- Add `durationSeconds Int?` to ActivityLog
- Add `contentId String?` to ActivityLog
- Add `sport String?` to ActivityLog

### Security considerations
- bcrypt salt rounds: 10 (adequate for 4-digit PINs; rate limiting is the real protection).
- Session tokens: `crypto.randomUUID()` — sufficient entropy for short-lived tokens.
- Session tokens are NOT stored in localStorage (component state only).
- Parent session middleware validates that the token's userId matches the route's userId.
- `navigator.sendBeacon` for activity tracking uses POST with `application/json` content type.

## Out of Scope

- **Mobile app (Expo)**: This milestone covers web only.
- **Push notifications**: No alerts to parents when limits are reached.
- **Multiple children per parent**: Each user has exactly one ParentalProfile.
- **Email/password authentication**: PIN is the only auth mechanism in MVP.
- **Export reports**: No PDF/CSV export of activity data.
- **Real-time WebSocket updates**: Activity data refreshes on page load only.
- **Rate limiting on PIN verification**: Should be added before production but is not part of this milestone.
- **Biometric auth**: No fingerprint/face unlock for parental access.
