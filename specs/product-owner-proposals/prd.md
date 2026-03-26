# Sprint 1-2: "Base solida" + "Capa de delight" - Product Requirements Document

## Overview

This PRD covers 11 work items across two sprints that make SportyKids ship-ready for beta families. Sprint 1 ("Base solida") fixes critical bugs, adds search, skeleton loading, centralized mobile config, and starts the test suite. Sprint 2 ("Capa de delight") adds celebration animations, page transitions, illustrated empty states, PIN visual feedback, simple favorites, and a trending badge. Together they close the gap between "functional MVP" and "something a kid would enjoy using."

## Problem Statement

SportyKids has all core features built (Phases 0-4) but cannot ship to beta families because:

1. **Security holes**: 9 critical issues (unprotected endpoints, unguarded JSON.parse, PIN hash leaking in cache, streak URL mismatch) will cause crashes and data exposure.
2. **No search**: Users cannot find specific news. The only navigation is sport/age filters.
3. **Perceived slowness**: Every loading state is a spinner or "Cargando..." text. Kids interpret spinners as "broken" and leave.
4. **No tests**: Zero automated tests. Any fix risks regressing existing features.
5. **Flat UX**: Earning stickers/achievements shows a static toast. No confetti, no animations, no delight. Pages jump without transitions. Empty states are emoji + generic text.
6. **No engagement hooks**: No favorites/bookmarks, no trending indicators, nothing that says "come back."

## Goals

| Goal | Metric | Target |
|------|--------|--------|
| Zero critical bugs in beta | Critical issues from review.md | 0 remaining |
| Perceived load time < 1s | Time to first meaningful paint (skeleton visible) | < 300ms to skeleton |
| Search usage | % of sessions using search | > 30% in beta |
| Test coverage on critical paths | Vitest + RTL coverage on services + key components | > 60% on targeted files |
| Engagement lift from delight | Session duration before vs. after Sprint 2 | +15% |
| Bookmark adoption | % of active users with >= 1 saved item | > 40% in beta |

## Target Users

- **Primary**: Kids aged 6-14 who follow sports.
- **Secondary**: Parents who need to trust the app is safe and the content is appropriate.
- **Tertiary**: Implementation agent (Claude Code) who will build everything from this PRD.

---

## Sprint 1: "Base solida"

---

### B-TF2: Fix Critical Code Review Issues

#### Problem

9 critical issues and 14 warnings documented in `specs/phase-5-differentiators/review.md`. These cause crashes, security vulnerabilities, and broken features in production.

#### Critical Issues (must fix)

Each item below references a specific file and line from the review.

**C1. Unprotected quiz generation endpoint**
- File: `apps/api/src/routes/quiz.ts`, line 190
- Issue: `POST /api/quiz/generate` has no auth. Anyone can trigger expensive AI calls.
- Fix: Add parental PIN verification. Require header `X-Parental-Session` with valid session token (reuse session system from `apps/api/src/routes/parents.ts`). Return 401 if missing/invalid.

**C2. Unprotected custom RSS source creation (SSRF vector)**
- File: `apps/api/src/routes/news.ts`, line 165
- Issue: `POST /api/news/fuentes/custom` accepts any URL. Attacker can point RSS parser at internal network.
- Fix: (a) Require `userId` in body and validate it exists. (b) Validate URL is HTTPS and resolves to a public IP (reject `10.*`, `172.16-31.*`, `192.168.*`, `127.*`, `localhost`, `::1`). Use `new URL(url)` to parse hostname then DNS-resolve before fetching.

```typescript
// apps/api/src/services/url-validator.ts (new file)
import { resolve4 } from 'dns/promises';

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
];

export async function isPublicUrl(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return false;
    const addresses = await resolve4(url.hostname);
    return !addresses.some(ip => PRIVATE_RANGES.some(r => r.test(ip)));
  } catch {
    return false;
  }
}
```

**C3. Unprotected custom RSS source deletion**
- File: `apps/api/src/routes/news.ts`, line 229
- Issue: `DELETE /api/news/fuentes/custom/:id` has no auth.
- Fix: Require `userId` query param. Verify `RssSource.addedBy === userId` before deleting. Return 403 if mismatch.

**C4. PIN hash leaking in parental guard cache**
- File: `apps/api/src/middleware/parental-guard.ts`, line 5
- Issue: `profile` is typed `any`. Cache stores full Prisma model including hashed PIN.
- Fix: Define a `ParentalGuardProfile` interface with only the needed fields. Select only those fields from Prisma.

```typescript
// In apps/api/src/middleware/parental-guard.ts
interface ParentalGuardProfile {
  userId: string;
  allowedFormats: string;
  allowedSports: string;
  maxDailyTimeMinutes: number;
}

// Cache type
const profileCache = new Map<string, { profile: ParentalGuardProfile; cachedAt: number }>();

// Prisma select
const profile = await prisma.parentalProfile.findUnique({
  where: { userId },
  select: {
    userId: true,
    allowedFormats: true,
    allowedSports: true,
    maxDailyTimeMinutes: true,
  },
});
```

**C5. Unguarded JSON.parse in parental guard**
- File: `apps/api/src/middleware/parental-guard.ts`, lines 36 and 49
- Issue: `JSON.parse(profile.allowedFormats || '[]')` throws on malformed JSON, crashing the request.
- Fix: Wrap in try/catch, default to `[]` on parse failure.

```typescript
function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
```

Apply this helper in all 6 locations with unguarded JSON.parse:
1. `apps/api/src/middleware/parental-guard.ts`, lines 36 and 49
2. `apps/api/src/routes/parents.ts`, lines 370-378 (`formatProfile()`)
3. `apps/api/src/services/gamification.ts`, line 265
4. `apps/api/src/services/team-stats.ts`, line 17

Extract `safeJsonParse` into `apps/api/src/utils/safe-json-parse.ts` and import everywhere.

**C6. Streak URL mismatch**
- File: `apps/web/src/lib/api.ts`, line 244
- Issue: Frontend calls `/api/gamification/streak/${userId}` (singular) but backend route is `/api/gamification/streaks/${userId}` (plural). Always returns 404.
- Fix: Change the frontend URL to use `streaks` (plural). Verify in `apps/api/src/routes/gamification.ts` that the route is indeed `/streaks/:userId`.

**C7. CheckInResponse type mismatch**
- File: `packages/shared/src/types/index.ts`, lines 182-189
- Issue: Review notes that `CheckInResponse` type has `streak.currentStreak` nested but backend returns flat. However, reading the actual type file shows it IS flat (`currentStreak`, `longestStreak` at top level). Verify backend `gamification.ts:171` matches. If backend wraps in `streak: {}`, flatten the backend response to match the shared type.

#### Warnings (should fix)

**W1. Double retry in summarizer**
- File: `apps/api/src/services/summarizer.ts`, lines 95-127
- Fix: Remove the manual retry loop. Rely on AIClient's built-in 3-retry with exponential backoff.

**W2. Feed ranker loads all news into memory**
- File: `apps/api/src/routes/news.ts`, lines 98-113
- Fix: Add `take: 500` to the Prisma `findMany` as a safety valve.

**W3. Parental guard fetches all daily logs**
- File: `apps/api/src/middleware/parental-guard.ts`, lines 64-67
- Fix: Use Prisma `aggregate` with `_sum` on `durationSeconds` instead of fetching all rows.

```typescript
const result = await prisma.activityLog.aggregate({
  where: { userId, createdAt: { gte: todayStart } },
  _sum: { durationSeconds: true },
});
const totalSeconds = result._sum.durationSeconds ?? 0;
```

**W4. awardSticker fetches all stickers**
- File: `apps/api/src/services/gamification.ts`, lines 191-203
- Fix: Use a subquery: `WHERE id NOT IN (SELECT stickerId FROM UserSticker WHERE userId = ?)`.

**W5. evaluateAchievements runs 4 DB queries per call**
- File: `apps/api/src/services/gamification.ts`, lines 237-322
- Fix: Add a 60-second in-memory cache keyed by userId for achievement definitions (they rarely change).

**W6. Session store memory leak**
- File: `apps/api/src/routes/parents.ts`, line 14
- Fix: Add a cleanup interval that runs every 5 minutes and deletes expired sessions.

```typescript
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of parentSessions) {
    if (now > session.expiresAt) parentSessions.delete(token);
  }
}, 5 * 60 * 1000);
```

**W7. maxDailyTimeMinutes=0 bug**
- File: `apps/api/src/routes/parents.ts`, line 176
- Fix: Change `if (maxDailyTimeMinutes)` to `if (maxDailyTimeMinutes !== undefined)`.

**W8. Broken sports checkbox in NotificationSettings**
- File: `apps/web/src/components/NotificationSettings.tsx`, line 94
- Fix: Remove `|| true` from `checked`. Either implement the toggle or remove the checkbox entirely. For MVP, remove the checkbox and show a "Coming soon" label.

**W9. DOM manipulation in StickerCard onError**
- File: `apps/web/src/components/StickerCard.tsx`, lines 50-59
- Fix: Replace with React state. Add `const [imgError, setImgError] = useState(false)` and conditionally render fallback emoji div.

**W10. Malformed URL in ReelPlayer**
- File: `apps/web/src/components/ReelPlayer.tsx`, lines 63-65
- Fix: Use `URL` constructor to append params safely.

```typescript
const url = new URL(reel.videoUrl);
url.searchParams.set('autoplay', '1');
url.searchParams.set('mute', '1');
const embedUrl = url.toString();
```

**W11. Hardcoded text in collection page**
- File: `apps/web/src/app/collection/page.tsx`, lines 160-161
- Fix: Use i18n keys `collection.stickers_tab` and `collection.achievements_tab`. Add keys to `es.json` and `en.json`.

**W12. Content moderator regex too narrow**
- File: `apps/api/src/services/content-moderator.ts`, line 95
- Fix: Change `\{[^}]+\}` to `\{[\s\S]*\}` to handle nested JSON.

**W13. Parental guard baseUrl check**
- File: `apps/api/src/middleware/parental-guard.ts`, line 28
- Fix: Log `req.baseUrl` and `req.path` during testing to verify the middleware sees the expected path segments. Add a unit test for this.

**W14. Hardcoded day labels**
- File: `apps/web/src/components/ParentalPanel.tsx`, line 192
- Fix: Add i18n keys `days.mon`, `days.tue`, etc. to `es.json` and `en.json`.

#### Acceptance Criteria

- [ ] All 9 critical issues fixed and verified
- [ ] All 14 warnings fixed
- [ ] No new TypeScript errors introduced (`npx tsc --noEmit` passes in `apps/api/` and `apps/web/`)
- [ ] `safeJsonParse` utility extracted and used in all 6 locations
- [ ] URL validator prevents SSRF on custom RSS source creation
- [ ] Streak endpoint works end-to-end (web and mobile)
- [ ] Manual test: create parental PIN, verify it works, check that guard blocks correctly

---

### B-MP2: Centralize API_BASE in Mobile

#### Problem

`apps/mobile/src/lib/api.ts` defines `API_BASE` as a hardcoded IP (`http://192.168.1.147:3001/api`). While it is currently in a single file (not per-screen as initially thought), it should be extracted to a config module that can be easily swapped per environment.

#### Solution

Create `apps/mobile/src/config.ts`:

```typescript
// apps/mobile/src/config.ts
import Constants from 'expo-constants';

const ENV = {
  development: {
    apiBase: 'http://192.168.1.147:3001/api',
  },
  preview: {
    apiBase: 'https://api-staging.sportykids.app/api',
  },
  production: {
    apiBase: 'https://api.sportykids.app/api',
  },
};

type Environment = keyof typeof ENV;

function getEnv(): Environment {
  const channel = Constants.expoConfig?.extra?.eas?.channel;
  if (channel === 'production') return 'production';
  if (channel === 'preview') return 'preview';
  return 'development';
}

export const config = {
  ...ENV[getEnv()],
  env: getEnv(),
};
```

Update `apps/mobile/src/lib/api.ts`:

```typescript
import { config } from '../config';
const API_BASE = config.apiBase;
```

Also update `apps/mobile/app.json` to include the extra config field:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "channel": "development"
      }
    }
  }
}
```

#### Acceptance Criteria

- [ ] `apps/mobile/src/config.ts` created with 3 environments
- [ ] `API_BASE` in `apps/mobile/src/lib/api.ts` reads from `config.apiBase`
- [ ] Hardcoded IP removed from `api.ts`
- [ ] App still boots and can fetch news on a local device (manual test)

---

### B-UX1: Skeleton Loading

#### Problem

Every loading state in the app is either a spinning circle or `"Cargando..."` text. Children perceive spinners as "the app is broken" and tap away. Skeleton loading (shimmer placeholders that match the shape of upcoming content) communicates "content is coming" and reduces perceived wait time.

#### Current Loading States to Replace

| Page | File | Current Loading | Skeleton Shape |
|------|------|-----------------|----------------|
| Home feed | `apps/web/src/app/HomeFeedClient.tsx:151-154` | Spinning `div` | 3 NewsCard skeletons (image rect + 2 text lines + meta line) |
| Collection | `apps/web/src/app/collection/page.tsx:100-106` | `"Cargando..."` pulse text | 2x4 grid of sticker skeletons (square + text) |
| Quiz start | `apps/web/src/app/quiz/page.tsx:91-93` | `"Cargando..."` on button | Pulsing quiz card skeleton (question + 4 option bars) |
| Reels | `apps/web/src/app/reels/page.tsx` | Spinning `div` | 2x3 grid of vertical rectangles |
| Team page | `apps/web/src/app/team/page.tsx` | Spinning `div` | Stats card skeleton + horizontal reel strip skeleton |
| Parents page | `apps/web/src/app/parents/page.tsx` | Spinning `div` | Panel skeleton (tabs + content area) |

#### Shimmer Animation CSS

Add to `apps/web/src/styles/globals.css`:

```css
/* Skeleton shimmer animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #E2E8F0 25%,
    #F1F5F9 50%,
    #E2E8F0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}
```

#### Skeleton Components

Create `apps/web/src/components/skeletons/`:

**NewsCardSkeleton** (`apps/web/src/components/skeletons/NewsCardSkeleton.tsx`):

```
+-------------------------------+
|                               |
|     [skeleton: 176px tall]    |  <- image area
|                               |
+-------------------------------+
| [======== 80% width ========] |  <- title line 1
| [====== 60% width ======]     |  <- title line 2
|                               |
| [=== 40% ===]   [= 20% =]   |  <- source + date
| [========= button =========]  |  <- action row
+-------------------------------+
```

```typescript
// apps/web/src/components/skeletons/NewsCardSkeleton.tsx
export function NewsCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      <div className="skeleton h-44 w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-[80%]" />
        <div className="skeleton h-4 w-[60%]" />
        <div className="skeleton h-3 w-[40%]" />
        <div className="flex gap-2">
          <div className="skeleton h-9 flex-1 rounded-xl" />
          <div className="skeleton h-9 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
```

**StickerCardSkeleton** (`apps/web/src/components/skeletons/StickerCardSkeleton.tsx`):

```
+------------------+
|                  |
|   [square img]   |  <- 1:1 ratio
|                  |
+------------------+
| [=== name ===]   |
| [= rarity =]     |
+------------------+
```

```typescript
export function StickerCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="skeleton aspect-square w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-[70%]" />
        <div className="skeleton h-3 w-[40%]" />
      </div>
    </div>
  );
}
```

**QuizSkeleton** (`apps/web/src/components/skeletons/QuizSkeleton.tsx`):

```
+-------------------------------+
|  [====== question text =====] |
|  [==== question line 2 ====]  |
|                               |
|  [======== option A ========] |
|  [======== option B ========] |
|  [======== option C ========] |
|  [======== option D ========] |
+-------------------------------+
```

```typescript
export function QuizSkeleton() {
  return (
    <div className="max-w-lg mx-auto space-y-4 py-8">
      <div className="space-y-2 mb-6">
        <div className="skeleton h-5 w-[90%] mx-auto" />
        <div className="skeleton h-5 w-[70%] mx-auto" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}
```

**ReelCardSkeleton** (`apps/web/src/components/skeletons/ReelCardSkeleton.tsx`):

```typescript
export function ReelCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
      <div className="skeleton aspect-[9/16] w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-[80%]" />
        <div className="skeleton h-3 w-[50%]" />
      </div>
    </div>
  );
}
```

#### Mobile Skeletons

For React Native, create `apps/mobile/src/components/skeletons/` with equivalent components using `Animated` API for the shimmer effect (translate a `LinearGradient` across a `View`). Use `expo-linear-gradient` which is already available with Expo SDK 54.

```typescript
// apps/mobile/src/components/skeletons/Shimmer.tsx
import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
}

export function Shimmer({ width, height, borderRadius = 8 }: ShimmerProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={[{ width, height, borderRadius, backgroundColor: '#E2E8F0', overflow: 'hidden' }]}>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, transform: [{ translateX }] }}>
        <LinearGradient
          colors={['#E2E8F0', '#F1F5F9', '#E2E8F0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}
```

#### Integration Points

Replace each loading state:

1. **HomeFeedClient.tsx** (lines 151-154): Replace spinner with `{[1,2,3].map(i => <NewsCardSkeleton key={i} />)}` in the same grid layout.
2. **collection/page.tsx** (lines 100-106): Replace pulse text with `{[1,2,3,4,5,6,7,8].map(i => <StickerCardSkeleton key={i} />)}` in the grid.
3. **quiz/page.tsx** (line 91-93): Replace button loading text with `<QuizSkeleton />` while `loading` is true.
4. **reels/page.tsx**: Replace spinner with `{[1,2,3,4,5,6].map(i => <ReelCardSkeleton key={i} />)}`.
5. **team/page.tsx**: Custom skeleton with stats card shape + horizontal strip.
6. **parents/page.tsx**: Custom skeleton with tab bar + content area.

#### Acceptance Criteria

- [ ] `@keyframes shimmer` animation added to `globals.css`
- [ ] `.skeleton` utility class works in all browsers (Chrome, Safari, Firefox)
- [ ] `NewsCardSkeleton` component created and used in HomeFeedClient
- [ ] `StickerCardSkeleton` component created and used in collection page
- [ ] `QuizSkeleton` component created and used in quiz page
- [ ] `ReelCardSkeleton` component created and used in reels page
- [ ] No more bare spinners or "Cargando..." text on any page
- [ ] Skeleton dimensions match actual content dimensions (no layout shift on load)
- [ ] Mobile: `Shimmer` component created with `Animated` + `LinearGradient`
- [ ] Mobile: At least `NewsCardSkeleton` applied on HomeFeed screen

---

### B-CP1: Search

#### Problem

There is no search functionality anywhere in the app. Users can only browse by sport filter and age range. Kids want to search for "Champions League", "Messi", or their favorite team.

#### API Changes

**File**: `apps/api/src/routes/news.ts`

Add `q` parameter to the existing filters schema:

```typescript
const filtersSchema = z.object({
  q: z.string().max(100).optional(),   // <-- NEW
  sport: z.string().optional(),
  team: z.string().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  source: z.string().optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

In the query builder, add:

```typescript
if (q) {
  where.OR = [
    { title: { contains: q } },
    { summary: { contains: q } },
    { team: { contains: q } },
  ];
}
```

**Note**: SQLite `contains` is case-sensitive. For case-insensitive search, use Prisma raw query with `LOWER()`:

```typescript
if (q) {
  const lowerQ = q.toLowerCase();
  where.OR = [
    { title: { contains: lowerQ, mode: 'insensitive' } },
    { summary: { contains: lowerQ, mode: 'insensitive' } },
    { team: { contains: lowerQ, mode: 'insensitive' } },
  ];
}
```

**Important**: Prisma with SQLite does NOT support `mode: 'insensitive'` natively. Use a raw SQL approach or convert to lowercase on both sides. For MVP, rely on `contains` (case-sensitive) and document the limitation. When migrating to PostgreSQL, `mode: 'insensitive'` will work natively.

**Response shape**: No change. The existing `NewsResponse` format is returned.

#### Suggested Searches

Derive from the `TEAMS` constant in `packages/shared/src/constants/index.ts` plus hardcoded popular terms:

```typescript
// apps/web/src/components/SearchBar.tsx
import { TEAMS } from '@sportykids/shared';

const SUGGESTED_SEARCHES = [
  // Popular events
  'Champions League',
  'NBA',
  'Roland Garros',
  'Tour de France',
  'Olympic Games',
  'La Liga',
  'Premier League',
  'Formula 1',
  'World Cup',
  // Top teams from TEAMS constant
  ...TEAMS.slice(0, 10), // Real Madrid, Barcelona, Atletico, etc.
];
```

#### SearchBar Component (Web)

Create `apps/web/src/components/SearchBar.tsx`:

```
+--------------------------------------------------+
| [magnifying glass icon]  Search news...      [X]  |
+--------------------------------------------------+
| Suggested:                                        |
| [Champions League] [Real Madrid] [NBA] [Barcelona]|
| [Carlos Alcaraz] [Formula 1] [La Liga]           |
+--------------------------------------------------+
```

```typescript
// apps/web/src/components/SearchBar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { TEAMS, t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface SearchBarProps {
  onSearch: (query: string) => void;
  locale: Locale;
}

const SUGGESTED_SEARCHES = [
  'Champions League', 'NBA', 'Roland Garros', 'Tour de France',
  'La Liga', 'Premier League', 'Formula 1', 'World Cup',
  ...TEAMS.slice(0, 6),
];

export function SearchBar({ onSearch, locale }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    onSearch(suggestion);
    setFocused(false);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  // Show suggestions when focused and query is empty
  const showSuggestions = focused && query.length === 0;

  return (
    <div className="relative">
      <div className="flex items-center bg-white rounded-xl border border-gray-200 focus-within:border-[var(--color-blue)] transition-colors px-4 py-2.5">
        <svg className="w-5 h-5 text-gray-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={t('search.placeholder', locale)}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--color-text)] placeholder-gray-400"
        />
        {query && (
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 ml-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg p-3 z-50">
          <p className="text-xs text-gray-400 mb-2 font-medium">{t('search.suggested', locale)}</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_SEARCHES.map((s) => (
              <button
                key={s}
                onMouseDown={() => handleSuggestionClick(s)}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-[var(--color-blue)]/10 hover:text-[var(--color-blue)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Integration in HomeFeedClient

Add `SearchBar` above `FiltersBar` in `apps/web/src/app/HomeFeedClient.tsx`:

```typescript
import { SearchBar } from '@/components/SearchBar';

// Inside component, add state:
const [searchQuery, setSearchQuery] = useState('');

// In loadNews callback, add q param:
const result = await fetchNews({
  q: searchQuery || undefined,
  sport: activeSport ?? undefined,
  // ...existing params
});

// Reset page on search:
const handleSearch = (query: string) => {
  setSearchQuery(query);
  setPage(1);
};

// In JSX, before FiltersBar:
<SearchBar onSearch={handleSearch} locale={locale} />
```

Update `apps/web/src/lib/api.ts` `fetchNews` to pass `q`:

```typescript
export interface NewsFilters {
  q?: string;          // <-- NEW
  sport?: string;
  // ...existing
}

export async function fetchNews(filters: NewsFilters = {}): Promise<NewsResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);     // <-- NEW
  // ...existing
}
```

#### i18n Keys

Add to `packages/shared/src/i18n/es.json`:
```json
{
  "search.placeholder": "Buscar noticias...",
  "search.suggested": "Sugerencias",
  "search.no_results": "No se encontraron resultados para \"{query}\"",
  "search.try_another": "Prueba con otra busqueda"
}
```

Add to `packages/shared/src/i18n/en.json`:
```json
{
  "search.placeholder": "Search news...",
  "search.suggested": "Suggestions",
  "search.no_results": "No results found for \"{query}\"",
  "search.try_another": "Try a different search"
}
```

#### Mobile SearchBar

Create `apps/mobile/src/components/SearchBar.tsx` with a `TextInput` and the same debounce/suggestion pattern. Use `FlatList` horizontal for suggestions.

#### Empty Search Results State

When search returns 0 results, show in `HomeFeedClient`:

```
+-------------------------------+
|         [magnifying glass]    |
|                               |
|  No results for "query"       |
|  Try a different search       |
+-------------------------------+
```

#### Acceptance Criteria

- [ ] `GET /api/news?q=Champions` returns matching news items (title, summary, or team)
- [ ] `SearchBar` component renders above filters on Home page
- [ ] 300ms debounce on typing (no request per keystroke)
- [ ] Suggested searches appear when input is focused and empty
- [ ] Clicking a suggestion fills the input and triggers search
- [ ] Clear button (X) resets search and shows full feed
- [ ] Empty search results show contextual message with the query
- [ ] i18n keys added for es and en
- [ ] Mobile: `SearchBar` component created and integrated in HomeFeed screen
- [ ] Search is case-insensitive (or documented as case-sensitive for SQLite MVP)

---

### B-TF1: Start Automated Test Suite

#### Problem

Zero tests. Any code change (especially B-TF2 bug fixes) risks silent regressions. The review.md identifies high-risk areas that need test coverage first.

#### Test Framework Setup

Install in monorepo root:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Create `vitest.config.ts` at monorepo root:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/api/**/*.test.ts', 'packages/shared/**/*.test.ts'],
  },
});
```

Create `apps/web/vitest.config.ts` for React component tests:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@sportykids/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
```

Create `apps/web/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Add scripts to root `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:api": "vitest --config vitest.config.ts",
    "test:web": "vitest --config apps/web/vitest.config.ts",
    "test:coverage": "vitest --coverage"
  }
}
```

#### Priority Test Files (ordered by risk from review.md)

**1. `safeJsonParse` utility** (`apps/api/src/utils/safe-json-parse.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { safeJsonParse } from './safe-json-parse';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('["a","b"]', [])).toEqual(['a', 'b']);
  });

  it('returns fallback on malformed JSON', () => {
    expect(safeJsonParse('{invalid', [])).toEqual([]);
  });

  it('returns fallback on null', () => {
    expect(safeJsonParse(null, [])).toEqual([]);
  });

  it('returns fallback on undefined', () => {
    expect(safeJsonParse(undefined, {})).toEqual({});
  });

  it('returns fallback on empty string', () => {
    expect(safeJsonParse('', 'default')).toBe('default');
  });
});
```

**2. URL validator** (`apps/api/src/services/url-validator.test.ts`)

```typescript
describe('isPublicUrl', () => {
  it('rejects http URLs', async () => { /* ... */ });
  it('rejects localhost', async () => { /* ... */ });
  it('rejects private IPs (10.x)', async () => { /* ... */ });
  it('rejects private IPs (192.168.x)', async () => { /* ... */ });
  it('accepts valid HTTPS public URL', async () => { /* ... */ });
  it('rejects malformed URL', async () => { /* ... */ });
});
```

**3. Feed ranker** (`apps/api/src/services/feed-ranker.test.ts`)

```typescript
describe('rankFeed', () => {
  it('boosts items matching favorite team', () => { /* ... */ });
  it('boosts items matching favorite sport', () => { /* ... */ });
  it('maintains original order for items with equal scores', () => { /* ... */ });
  it('handles empty feed', () => { /* ... */ });
  it('handles user with no favorites', () => { /* ... */ });
});
```

**4. Gamification service** (`apps/api/src/services/gamification.test.ts`)

```typescript
describe('checkAndUpdateStreak', () => {
  it('increments streak on consecutive days', () => { /* ... */ });
  it('resets streak after missed day', () => { /* ... */ });
  it('does not double-count same day', () => { /* ... */ });
  it('awards milestone sticker at 7-day streak', () => { /* ... */ });
});

describe('evaluateAchievements', () => {
  it('unlocks achievement when threshold met', () => { /* ... */ });
  it('does not re-unlock already unlocked achievement', () => { /* ... */ });
});
```

**5. Content moderator** (`apps/api/src/services/content-moderator.test.ts`)

```typescript
describe('moderateContent', () => {
  it('approves safe content', () => { /* ... */ });
  it('rejects content with gambling keywords', () => { /* ... */ });
  it('returns approved on AI failure (fail-open)', () => { /* ... */ });
  it('parses nested JSON in AI response', () => { /* ... */ });
});
```

**6. SearchBar component** (`apps/web/src/components/SearchBar.test.tsx`)

```typescript
describe('SearchBar', () => {
  it('renders input with placeholder', () => { /* ... */ });
  it('shows suggestions when focused and empty', () => { /* ... */ });
  it('calls onSearch after debounce', async () => { /* ... */ });
  it('clears input and calls onSearch with empty string', () => { /* ... */ });
  it('fills input when suggestion clicked', () => { /* ... */ });
});
```

**7. PinInput component** (`apps/web/src/components/PinInput.test.tsx`)

```typescript
describe('PinInput', () => {
  it('renders 4 input boxes', () => { /* ... */ });
  it('auto-focuses next input on digit entry', () => { /* ... */ });
  it('calls onSubmit with complete PIN', () => { /* ... */ });
  it('disables submit button when PIN incomplete', () => { /* ... */ });
  it('shows error message when error prop set', () => { /* ... */ });
});
```

#### Mocking Strategy

- **Prisma**: Use `vitest.mock` to mock `prisma` from `apps/api/src/config/database.ts`. Mock individual methods (`findMany`, `create`, etc.) per test.
- **AI Client**: Mock `apps/api/src/services/ai-client.ts` to return fixed responses. Never call real AI in tests.
- **fetch**: Use `vitest.fn()` to mock global `fetch` for API client tests.

#### Acceptance Criteria

- [ ] Vitest installed and configured for API and web workspaces
- [ ] `npm run test` runs all test suites
- [ ] `safeJsonParse` has 100% branch coverage
- [ ] `isPublicUrl` has tests for all private IP ranges
- [ ] `feed-ranker` has tests for team/sport boosting
- [ ] `gamification` has tests for streak logic
- [ ] `content-moderator` has tests including fail-open behavior
- [ ] `SearchBar` has RTL tests for core interactions
- [ ] `PinInput` has RTL tests for digit entry and submit
- [ ] All tests pass in CI-compatible mode (`vitest run`)
- [ ] Minimum 15 test cases across all files

---

## Sprint 2: "Capa de delight"

---

### B-UX2: Celebration Animations

#### Problem

Earning stickers, unlocking achievements, and hitting streak milestones are the core engagement loops. Currently, `RewardToast` (in `apps/web/src/components/RewardToast.tsx`) is a static card that slides in. There is zero celebration. Kids need dopamine hits.

#### Library

Use `canvas-confetti` (~3KB gzipped). Install:

```bash
npm install canvas-confetti
npm install -D @types/canvas-confetti
```

#### Trigger Points

| Event | Animation | Trigger Location |
|-------|-----------|------------------|
| Sticker earned (daily check-in) | Confetti burst (center screen) | `apps/web/src/lib/user-context.tsx` after `checkIn()` returns `dailyStickerAwarded` |
| Achievement unlocked | Gold glow + shake on badge | `RewardToast` when `type === 'achievement'` |
| Streak milestone (7, 30, 100) | Fire emoji rain + confetti | `apps/web/src/lib/user-context.tsx` after `checkIn()` when `currentStreak % 7 === 0` |
| Quiz perfect score (5/5) | Confetti + star explosion | `apps/web/src/components/QuizGame.tsx` on finish with all correct |
| First sticker ever | Extra-long confetti (3s) | `apps/web/src/lib/user-context.tsx` when `dailyStickerAwarded` and user had 0 stickers |

#### Confetti Utility

Create `apps/web/src/lib/confetti.ts`:

```typescript
import confetti from 'canvas-confetti';

export function celebrateSticker() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#2563EB', '#22C55E', '#FACC15', '#9333EA'],
  });
}

export function celebrateAchievement() {
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.5 },
    colors: ['#FACC15', '#F59E0B', '#D97706'],
  });
}

export function celebrateStreak() {
  // Left side
  confetti({
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0 },
    colors: ['#EF4444', '#F97316', '#FACC15'],
  });
  // Right side
  confetti({
    particleCount: 50,
    angle: 120,
    spread: 55,
    origin: { x: 1 },
    colors: ['#EF4444', '#F97316', '#FACC15'],
  });
}

export function celebratePerfectQuiz() {
  const duration = 2000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#22C55E', '#FACC15'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#22C55E', '#FACC15'],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
```

#### Enhanced RewardToast

Update `apps/web/src/components/RewardToast.tsx` to add visual flair:

```css
/* Add to globals.css */
@keyframes achievement-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(250, 204, 21, 0.3); }
  50% { box-shadow: 0 0 20px rgba(250, 204, 21, 0.8); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.toast-achievement {
  animation: achievement-glow 1s ease-in-out 3, shake 0.3s ease-in-out 1;
}

.toast-sticker {
  animation: shake 0.3s ease-in-out 1;
}
```

Add `className` conditionally in RewardToast based on `type`.

#### Mobile Celebrations

For React Native, use `react-native-confetti-cannon` (lightweight, Expo-compatible):

```bash
cd apps/mobile && npm install react-native-confetti-cannon
```

Render a `<ConfettiCannon />` component conditionally when celebrations trigger.

#### Acceptance Criteria

- [ ] `canvas-confetti` installed (~3KB gzipped, verify bundle impact)
- [ ] Confetti fires on sticker earn during daily check-in
- [ ] Gold glow + shake animation on achievement toast
- [ ] Confetti fires from both sides on streak milestones (7, 30, 100)
- [ ] Confetti fires on perfect quiz score (5/5)
- [ ] Animations do not block user interaction (non-blocking, pointer-events: none on canvas)
- [ ] `celebrateSticker`, `celebrateAchievement`, `celebrateStreak`, `celebratePerfectQuiz` exported from `confetti.ts`
- [ ] Mobile: Confetti cannon renders on sticker/achievement events
- [ ] Reduced motion: Respect `prefers-reduced-motion` media query (skip confetti if set)

---

### B-UX3: Page Transitions

#### Problem

Pages "jump" into view without any transition. Moving between Home, Reels, Quiz, Collection, and Parents feels abrupt and cheap.

#### Web: CSS @keyframes

Add to `apps/web/src/styles/globals.css`:

```css
/* Page transition: fade-in + slide-up */
@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-transition {
  animation: page-enter 0.25s ease-out;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .page-transition {
    animation: none;
  }
}
```

Apply `page-transition` class to the main content wrapper in each page:

| File | Where to add |
|------|-------------|
| `apps/web/src/app/HomeFeedClient.tsx` | Outer `<div className="space-y-6">` |
| `apps/web/src/app/reels/page.tsx` | Outer wrapper div |
| `apps/web/src/app/quiz/page.tsx` | Outer `<div className="space-y-6">` |
| `apps/web/src/app/collection/page.tsx` | Outer `<div className="max-w-6xl ...">` |
| `apps/web/src/app/team/page.tsx` | Outer wrapper div |
| `apps/web/src/app/parents/page.tsx` | Outer wrapper div |

#### Mobile: React Navigation Native Transitions

React Navigation 7 with native stack (`@react-navigation/native-stack`) already provides native slide transitions. Verify that `apps/mobile/src/navigation/` uses `createNativeStackNavigator` (not `createStackNavigator`). If not, switch.

For tab transitions, add `tabBarAnimationEnabled: true` to the tab navigator options.

#### Acceptance Criteria

- [ ] `@keyframes page-enter` added to `globals.css`
- [ ] `.page-transition` class applied to all 6 main pages
- [ ] Animation duration is 250ms ease-out
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Mobile: Verify native stack transitions are active
- [ ] No visible layout shift during transition (content does not "jump" after animation)

---

### B-UX5: Empty States with Illustrations

#### Problem

Current empty states across the app use a large emoji + generic text. For example, the Home feed empty state (in `apps/web/src/app/HomeFeedClient.tsx`, lines 117-122) shows a stadium emoji and "No news found." This is uninspiring for kids.

#### Empty State Inventory

| Location | File | Current State | New Illustration + CTA |
|----------|------|---------------|------------------------|
| Home feed (no news) | `HomeFeedClient.tsx:117-122` | Stadium emoji + "No news" | Kid reading newspaper SVG + "Check back soon!" |
| Home feed (search no results) | New (B-CP1) | N/A | Detective kid SVG + "Try a different search" |
| Collection (no stickers) | `collection/page.tsx:217-220` | Card emoji + reused "no news" text | Kid opening treasure chest SVG + "Play the quiz to earn your first sticker!" + button to `/quiz` |
| Collection (no achievements) | `collection/page.tsx:237-240` | Trophy emoji + generic text | Kid climbing mountain SVG + "Keep exploring to unlock achievements!" |
| Quiz (loading error) | `quiz/page.tsx:54-56` | `console.error` only | Confused kid SVG + "Oops, couldn't load the quiz. Try again!" + retry button |
| Reels (no reels) | `reels/page.tsx` | Assumed empty | Kid with camera SVG + "No reels yet. Check back soon!" |
| Favorites (empty, new B-EN2) | New | N/A | Kid with heart SVG + "Tap the heart on any news to save it here!" |

#### SVG Illustration Style

Kid-friendly, flat design, matching the app color palette:
- Primary outlines: `#1E293B` (--color-text)
- Fill colors: `#2563EB` (blue), `#22C55E` (green), `#FACC15` (yellow)
- Size: 200x200px viewBox, render at `w-48 h-48 mx-auto`
- No faces (inclusive), action-based poses (reading, running, exploring)

Create `apps/web/src/components/illustrations/` directory with SVG components:

```typescript
// apps/web/src/components/illustrations/EmptyNews.tsx
export function EmptyNewsIllustration() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Kid reading a newspaper - flat style */}
      {/* ... SVG paths ... */}
    </svg>
  );
}
```

Files to create:
- `apps/web/src/components/illustrations/EmptyNews.tsx`
- `apps/web/src/components/illustrations/EmptySearch.tsx`
- `apps/web/src/components/illustrations/EmptyCollection.tsx`
- `apps/web/src/components/illustrations/EmptyAchievements.tsx`
- `apps/web/src/components/illustrations/EmptyReels.tsx`
- `apps/web/src/components/illustrations/EmptyFavorites.tsx`
- `apps/web/src/components/illustrations/ErrorState.tsx`

#### Empty State Component

Create a reusable `apps/web/src/components/EmptyState.tsx`:

```typescript
'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  illustration: ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({ illustration, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-48 h-48 mb-6">{illustration}</div>
      <h3 className="font-[family-name:var(--font-poppins)] text-lg font-bold text-[var(--color-text)] mb-2">
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm text-gray-400 mb-6 max-w-xs">{subtitle}</p>
      )}
      {action && (
        action.href ? (
          <a
            href={action.href}
            className="px-6 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="px-6 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
```

#### i18n Keys

Add to `packages/shared/src/i18n/es.json`:
```json
{
  "empty.no_news_title": "No hay noticias todavia",
  "empty.no_news_subtitle": "Vuelve pronto, estamos buscando las mejores noticias para ti",
  "empty.no_search_title": "Sin resultados",
  "empty.no_search_subtitle": "Prueba con otra busqueda",
  "empty.no_stickers_title": "Tu album esta vacio",
  "empty.no_stickers_subtitle": "Juega al quiz para ganar tu primer cromo!",
  "empty.no_stickers_action": "Ir al Quiz",
  "empty.no_achievements_title": "Aun no tienes logros",
  "empty.no_achievements_subtitle": "Sigue explorando para desbloquear logros!",
  "empty.no_reels_title": "No hay videos todavia",
  "empty.no_reels_subtitle": "Vuelve pronto, estamos preparando videos para ti",
  "empty.no_favorites_title": "No tienes guardados",
  "empty.no_favorites_subtitle": "Toca el corazon en cualquier noticia para guardarla aqui",
  "empty.error_title": "Algo salio mal",
  "empty.error_subtitle": "No pudimos cargar el contenido. Intentalo de nuevo!",
  "empty.error_action": "Reintentar"
}
```

Add equivalent keys to `en.json`.

#### Acceptance Criteria

- [ ] 7 SVG illustration components created in `apps/web/src/components/illustrations/`
- [ ] Reusable `EmptyState` component created with illustration, title, subtitle, optional CTA
- [ ] All 7 empty states replaced in web app (Home, Search, Collection stickers, Collection achievements, Quiz error, Reels, Favorites)
- [ ] Each empty state has a contextual CTA where appropriate (e.g., empty collection -> go to quiz)
- [ ] SVG illustrations use app design tokens (blue, green, yellow, text colors)
- [ ] i18n keys added for all empty state strings (es + en)
- [ ] No emoji used in empty states (replaced by SVG illustrations)

---

### B-UX6: PIN Visual Feedback

#### Problem

`PinInput` (`apps/web/src/components/PinInput.tsx`) shows 4 input boxes that fill with dots. There is no visual feedback on digit entry and no animation on wrong PIN. The experience feels static and kids don't know if their tap registered.

#### Animations (CSS only, no library)

Add to `apps/web/src/styles/globals.css`:

```css
/* PIN digit entry: scale pop */
@keyframes pin-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.pin-digit-entered {
  animation: pin-pop 0.2s ease-out;
  border-color: var(--color-blue) !important;
}

/* PIN wrong: shake */
@keyframes pin-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}

.pin-shake {
  animation: pin-shake 0.4s ease-out;
}

/* PIN success: pulse green */
@keyframes pin-success {
  0% { border-color: var(--color-green); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  100% { border-color: var(--color-green); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
}

.pin-success {
  animation: pin-success 0.5s ease-out;
}
```

#### PinInput Changes

Update `apps/web/src/components/PinInput.tsx`:

```typescript
// Add state
const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
const [shaking, setShaking] = useState(false);
const [success, setSuccess] = useState(false);

// On digit entry, trigger pop animation
const handleChange = (index: number, value: string) => {
  if (!/^\d?$/.test(value)) return;
  const newDigits = [...digits];
  newDigits[index] = value;
  setDigits(newDigits);

  if (value) {
    setAnimatingIndex(index);
    setTimeout(() => setAnimatingIndex(null), 200);
    if (index < 3) {
      refs[index + 1].current?.focus();
    }
  }
};

// Expose shake trigger via prop callback or useImperativeHandle
// When error prop changes to a truthy value, trigger shake:
useEffect(() => {
  if (error) {
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
      setDigits(['', '', '', '']);
      refs[0].current?.focus();
    }, 400);
  }
}, [error]);

// Apply classes to input:
className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all
  ${animatingIndex === i ? 'pin-digit-entered' : ''}
  ${shaking ? 'pin-shake border-red-400' : 'border-gray-200'}
  ${success ? 'pin-success' : ''}
  focus:border-[var(--color-blue)] focus:outline-none`}
```

#### Mobile PinInput

For React Native, use `Animated.spring` for the pop effect and `Animated.sequence` with `Animated.timing` for the shake. No external library needed.

#### Acceptance Criteria

- [ ] Each digit entry triggers a scale pop animation (0.2s)
- [ ] Input border turns blue on digit entry
- [ ] Wrong PIN triggers shake animation (0.4s) on all 4 boxes
- [ ] After shake, digits clear and focus returns to first box
- [ ] Wrong PIN border turns red during shake
- [ ] Successful PIN triggers green pulse (optional, if parent verifies inline)
- [ ] Animations are CSS-only (no JavaScript animation library)
- [ ] `prefers-reduced-motion` disables all PIN animations
- [ ] Mobile: Animated pop and shake implemented with RN Animated API

---

### B-EN2: Favorites (Simple Bookmark)

#### Problem

Kids see interesting news but have no way to save them. The only way to find a news item again is to scroll back through the feed. One tap, one heart, saved.

#### Data Storage

**No backend changes.** Favorites are stored client-side only:
- Web: `localStorage` key `sportykids_favorites` (JSON array of news IDs)
- Mobile: `AsyncStorage` key `sportykids_favorites`

Maximum 100 saved items (FIFO: oldest removed when limit reached).

```typescript
// apps/web/src/lib/favorites.ts
const FAVORITES_KEY = 'sportykids_favorites';
const MAX_FAVORITES = 100;

export function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function toggleFavorite(newsId: string): boolean {
  const favorites = getFavorites();
  const index = favorites.indexOf(newsId);
  if (index >= 0) {
    favorites.splice(index, 1);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return false; // unfavorited
  } else {
    favorites.unshift(newsId);
    if (favorites.length > MAX_FAVORITES) favorites.pop();
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return true; // favorited
  }
}

export function isFavorite(newsId: string): boolean {
  return getFavorites().includes(newsId);
}
```

#### Heart Button on NewsCard

Update `apps/web/src/components/NewsCard.tsx` to add a heart icon:

```
+-------------------------------+
| [image]                       |
|   [sport badge]               |
+-------------------------------+
| Title of the news article     |
| Summary text goes here...     |
|                               |
| Source · Date    [team badge]  |
| [Read more] [Explain] [heart]|
+-------------------------------+
```

Add a heart button to the action row:

```typescript
import { useState, useEffect } from 'react';
import { isFavorite, toggleFavorite } from '@/lib/favorites';

// Inside NewsCard:
const [favorited, setFavorited] = useState(false);

useEffect(() => {
  setFavorited(isFavorite(news.id));
}, [news.id]);

const handleFavorite = () => {
  const result = toggleFavorite(news.id);
  setFavorited(result);
};

// In JSX action row, add:
<button
  onClick={handleFavorite}
  className="p-2 rounded-xl border border-gray-200 hover:border-red-300 transition-colors"
  aria-label={favorited ? t('buttons.unsave', locale) : t('buttons.save', locale)}
>
  <svg className={`w-5 h-5 transition-colors ${favorited ? 'text-red-500 fill-red-500' : 'text-gray-400'}`}
    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      fill={favorited ? 'currentColor' : 'none'}
    />
  </svg>
</button>
```

#### "Saved" Section on Home

Add a "Saved" section at the top of the Home feed when the user has favorites. No new page.

In `apps/web/src/app/HomeFeedClient.tsx`, above the main feed grid:

```typescript
import { getFavorites } from '@/lib/favorites';

// Inside component:
const [favorites, setFavorites] = useState<string[]>([]);

useEffect(() => {
  setFavorites(getFavorites());
}, []);

// Filter news to get favorited items
const savedNews = news.filter(n => favorites.includes(n.id));

// JSX before main grid (only if savedNews.length > 0 and no active search/filter):
{savedNews.length > 0 && !searchQuery && !activeSport && (
  <div className="mb-6">
    <h2 className="font-[family-name:var(--font-poppins)] text-lg font-bold text-[var(--color-text)] mb-3">
      {t('home.saved', locale)}
    </h2>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {savedNews.slice(0, 5).map(item => (
        <div key={item.id} className="shrink-0 w-64">
          <NewsCard news={item} locale={locale} />
        </div>
      ))}
    </div>
  </div>
)}
```

**Limitation**: The "Saved" section only shows favorites that are present in the current news fetch. If a favorited item has scrolled out of the API window, it won't appear. This is acceptable for MVP. A future improvement would fetch favorites by ID from the API.

#### i18n Keys

```json
// es.json
{
  "home.saved": "Guardados",
  "buttons.save": "Guardar",
  "buttons.unsave": "Quitar de guardados"
}

// en.json
{
  "home.saved": "Saved",
  "buttons.save": "Save",
  "buttons.unsave": "Remove from saved"
}
```

#### Mobile

Create `apps/mobile/src/lib/favorites.ts` using `AsyncStorage` with the same interface. Add heart button to `apps/mobile/src/components/NewsCard.tsx`.

#### Acceptance Criteria

- [ ] Heart icon visible on every NewsCard (web and mobile)
- [ ] Tapping heart toggles fill (empty outline -> filled red)
- [ ] State persists across page reloads (localStorage/AsyncStorage)
- [ ] "Saved" horizontal strip appears on Home when user has favorites
- [ ] "Saved" strip hidden when searching or filtering by sport
- [ ] Maximum 100 favorites enforced (FIFO)
- [ ] i18n keys for save/unsave/saved section (es + en)
- [ ] Empty favorites state uses EmptyState component from B-UX5 (not applicable until favorites gets its own view)

---

### B-EN3: Trending Badge

#### Problem

There is no social proof or urgency indicator. Kids don't know what other kids are reading. A simple "Trending" badge on popular news creates FOMO and guides discovery.

#### Backend: View Count Tracking

The `ActivityLog` model already tracks `news_viewed` events with `contentId`. We need a new endpoint or extend the news endpoint to include a trending flag.

**Option A (chosen): Add trending calculation in the news route.**

In `apps/api/src/routes/news.ts`, after fetching news items, compute trending status:

```typescript
// After getting `newsItems` from Prisma:

// Get view counts for the last 24 hours
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const viewCounts = await prisma.activityLog.groupBy({
  by: ['contentId'],
  where: {
    type: 'news_viewed',
    contentId: { in: newsItems.map(n => n.id) },
    createdAt: { gte: oneDayAgo },
  },
  _count: { id: true },
});

const TRENDING_THRESHOLD = 5; // views in 24h to be "trending"

const viewCountMap = new Map(
  viewCounts.map(vc => [vc.contentId, vc._count.id])
);

const enrichedNews = newsItems.map(n => ({
  ...n,
  isTrending: (viewCountMap.get(n.id) ?? 0) >= TRENDING_THRESHOLD,
  viewCount: viewCountMap.get(n.id) ?? 0,
}));
```

**API Response Change**:

```typescript
// Updated NewsItem in API response (not in shared types — add new fields)
interface NewsItemResponse extends NewsItem {
  isTrending?: boolean;
  viewCount?: number;  // only included for trending items
}
```

Update `packages/shared/src/types/index.ts` `NewsItem`:

```typescript
export interface NewsItem {
  // ...existing fields
  isTrending?: boolean;  // <-- NEW
}
```

**Threshold**: Start with 5 views in 24 hours. Make it configurable via environment variable `TRENDING_THRESHOLD` (default: 5). In beta with 5-10 families, even 3-5 views indicates genuine interest.

#### Frontend: Trending Badge on NewsCard

Update `apps/web/src/components/NewsCard.tsx`:

```
+-------------------------------+
| [image]                       |
|   [sport badge]  [TRENDING]   |  <- new badge top-right
+-------------------------------+
```

```typescript
// Inside NewsCard, in the image area:
{news.isTrending && (
  <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 7.5a1 1 0 00-2 0v2.793l-1.146-1.147a1 1 0 00-1.414 1.414l2.5 2.5a1 1 0 001.414 0l2.5-2.5a1 1 0 00-1.414-1.414L13 10.293V7.5z" />
    </svg>
    {t('news.trending', locale)}
  </span>
)}
```

For `HeadlineRow` (`apps/web/src/components/HeadlineRow.tsx`), add a small fire emoji or "Trending" text inline:

```typescript
{news.isTrending && (
  <span className="text-xs bg-red-500/10 text-red-500 font-bold px-2 py-0.5 rounded-full ml-2">
    {t('news.trending', locale)}
  </span>
)}
```

#### i18n Keys

```json
// es.json
{ "news.trending": "Tendencia" }

// en.json
{ "news.trending": "Trending" }
```

#### Mobile

Add the same badge to `apps/mobile/src/components/NewsCard.tsx` using a `View` with red background positioned absolutely in the image area.

#### Performance Consideration

The `groupBy` query on `ActivityLog` adds one DB query per news page load. For MVP with SQLite and <1000 daily logs, this is negligible (<5ms). Add an index on `ActivityLog(type, contentId, createdAt)` if performance degrades:

```prisma
// In schema.prisma, add to ActivityLog:
@@index([type, contentId, createdAt])
```

#### Acceptance Criteria

- [ ] News API response includes `isTrending: boolean` field
- [ ] Trending threshold is configurable via `TRENDING_THRESHOLD` env var (default: 5)
- [ ] "Trending" badge appears on NewsCard image area (top-right, red pill)
- [ ] "Trending" inline label appears on HeadlineRow
- [ ] Badge uses i18n (`news.trending` key in es/en)
- [ ] Only news with >= threshold views in last 24h are marked trending
- [ ] `ActivityLog` index added for `[type, contentId, createdAt]`
- [ ] Mobile: Trending badge on NewsCard component
- [ ] Manual test: View a news item 5+ times, verify it shows "Trending" badge

---

## Out of Scope

- **Real authentication (JWT/sessions)**: Deferred. MVP identifies users by ID only.
- **Push notifications**: UI is present but marked "Coming soon." No actual push delivery.
- **PostgreSQL migration**: Stays on SQLite for beta.
- **Server-side favorites**: Favorites are client-only (localStorage/AsyncStorage). No sync across devices.
- **Full-text search**: SQLite `LIKE` is sufficient for MVP. No FTS5 extension or Elasticsearch.
- **Accessibility audit**: Beyond `prefers-reduced-motion`, no WCAG audit in this sprint.
- **Internationalization of SVG illustrations**: Illustrations are text-free, no i18n needed.
- **E2E tests (Playwright/Cypress)**: Only unit + component tests in Sprint 1.
- **Dark mode**: Not in scope.

## Documentation Update

After implementing this PRD, review and update **all** documents in `docs/es/` and `docs/en/` to reflect the changes. Specifically:

| Document | Expected updates |
|----------|-----------------|
| `01-arquitectura.md` / `01-architecture.md` | New test infrastructure (Vitest config), skeleton component layer |
| `02-modelo-de-datos.md` / `02-data-model.md` | No schema changes in this PRD, but verify accuracy |
| `03-api-reference.md` / `03-api-reference.md` | New `?q=` search parameter on `GET /api/news`, trending badge endpoint if added |
| `04-guia-desarrollo.md` / `04-development-guide.md` | New test commands (`npm run test`, `npm run test:api`, `npm run test:web`), centralized `API_BASE` config for mobile |
| `05-flujos-de-usuario.md` / `05-user-flows.md` | Search flow, favorites flow, skeleton loading states |
| `06-service-overview.md` / `06-service-overview.md` | No new services, but verify existing descriptions |
| `08-diseno-y-ux.md` / `08-design-and-ux.md` | Skeleton loading patterns, celebration animations, page transitions, empty states, PIN feedback, trending badge |
| `09-seguridad-y-privacidad.md` / `09-security-and-privacy.md` | Fixed critical issues (JSON.parse safety, endpoint protection, PIN hash cache) |
| `10-roadmap-y-decisiones.md` / `10-roadmap-and-decisions.md` | Mark Sprint 1-2 items as completed, update technical debt section |

**Process**: Read each document, identify sections affected by the changes, and update them. Add new sections if a feature introduces concepts not previously documented. Keep both languages (ES/EN) in sync.

## Future Considerations

- **Server-side favorites with sync**: When auth is added, migrate favorites to a `UserFavorite` model in Prisma. Sync localStorage on login.
- **Full-text search**: Migrate to PostgreSQL FTS or add a search index (MeiliSearch/Typesense) when news volume exceeds 10K items.
- **Analytics dashboard**: Use trending data + ActivityLog to build a "What kids read" dashboard for parents.
- **Celebration sounds**: Add optional sound effects to confetti (with a mute toggle in parental settings).
- **Skeleton loading for age-adapted summaries**: The `AgeAdaptedSummary` component already has its own loading state. Consider unifying with the skeleton system.
- **Trending algorithm v2**: Weight by unique users (not total views) and add time decay.
- **Integration tests**: After unit tests, add API integration tests with a test database.
- **Storybook**: Add Storybook for visual component testing (skeletons, empty states, animations).
