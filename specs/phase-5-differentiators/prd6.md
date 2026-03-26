# PRD: Milestone 6 — Smart Feed + Enriched Favorite Team + Improved Reels

> Part of [SportyKids Differentiators](./prd.md). See main PRD for overview and dependency graph.

## Overview

Milestone 6 transforms SportyKids from a basic news aggregator into a personalized sports experience for kids. It introduces an intelligent feed that prioritizes content based on user preferences, enriches the favorite team page with stats and standings, replaces the current reels grid with an immersive TikTok-style vertical feed, and lays the groundwork for future push notifications by storing subscription preferences.

**Dependency**: Milestone 2 (AI summaries / "Explain it Easy") must be completed before this milestone, as the Smart Feed's "Explain mode" relies on M2's summary infrastructure.

## Problem Statement

Currently, SportyKids serves all users the same chronological feed regardless of their preferences. A child who only follows football still sees formula1 and cycling content. Additionally, the home page shows sport/age filters that are redundant with the preferences already configured during onboarding — this creates confusion ("why am I choosing my sports again?"). The favorite team page is a thin wrapper around filtered news with no stats or standings. Reels display in a static grid rather than the vertical swipe experience kids expect from TikTok/Instagram. These gaps reduce engagement and make the app feel generic rather than personal.

**User feedback (M1 validation)**: After onboarding, the home page should not ask the user to re-select sports/age they already configured. Filters should either be hidden for logged-in users, or limited to the user's followed sports only (as a "temporary exploration" toggle, not a redundant setup).

## Goals

1. **Increase relevance**: Users should see content matching their interests first, with zero noise from unfollowed sports.
2. **Deepen team engagement**: The favorite team page should feel like a mini team hub with stats, results, news, and reels.
3. **Modernize reels UX**: Deliver the vertical snap-scroll, auto-play experience that kids are accustomed to.
4. **Prepare for notifications**: Store user notification preferences so actual push can be wired in a future milestone.

## Core Features

### 6.1 Smart Personalized Feed

#### Backend — Feed Ranker Service

**New file**: `apps/api/src/services/feed-ranker.ts`

```typescript
interface RankingWeights {
  favoriteTeam: number;   // 5
  favoriteSport: number;  // 3
  followedSport: number;  // 1
  unfollowedSport: number; // 0 (filtered out)
}

function rankFeed(
  news: NewsItem[],
  userPrefs: { favoriteSports: string[]; favoriteTeam?: string }
): NewsItem[];
```

**Algorithm**:
- Each news item receives a relevance score.
- Favorite team match: score += 5.
- Favorite sport match (the sport is in the user's `favoriteSports`): score += 3.
- Other followed sport: score += 1.
- Unfollowed sport (sport is NOT in `favoriteSports`): score = 0 — **filter out entirely**.
- Within the same score tier, sort by `publishedAt` descending (newest first).
- If the user has no preferences set (empty `favoriteSports`), return all news sorted by `publishedAt`.

**API change**: Modify the existing `GET /api/news` route handler in `apps/api/src/routes/news.ts`.
- Add optional query param `userId` (string).
- When `userId` is provided: fetch user preferences from DB, pass news through `rankFeed()` before pagination.
- When `userId` is absent: current behavior unchanged.
- Existing params (`sport`, `team`, `age`, `source`, `page`, `limit`) continue to work. The ranker applies **after** any explicit filters.

#### Frontend — Feed Display Modes

**Modified file**: `apps/web/src/app/page.tsx`

Add a three-way toggle above the news list. The toggle state persists in `localStorage` via a key `feedDisplayMode`.

Three modes:

| Mode | Key | Description |
|------|-----|-------------|
| Headlines | `headlines` | Compact rows: title, source name, relative time. No image. |
| Cards | `cards` | Current default. Image + title + summary snippet. |
| Explain | `explain` | Same as Cards but each card shows an "Explain it Easy" button (from M2). |

**New component**: `apps/web/src/components/FeedModeToggle.tsx`
- Three icon buttons in a pill-shaped container.
- Props: `{ mode: 'headlines' | 'cards' | 'explain'; onChange: (mode) => void; locale: Locale }`

**New component**: `apps/web/src/components/HeadlineRow.tsx`
- Props: `{ newsItem: NewsItem; locale: Locale }`
- Single row: sport color dot, title (truncated to 80 chars), source, relative time.

**Modified component**: `apps/web/src/components/NewsCard.tsx`
- Add optional prop `showExplainButton?: boolean`.
- When true, render the "Explain it Easy" button (from M2).

#### i18n Keys

- `feed.mode_headlines` — "Titulares" / "Headlines"
- `feed.mode_cards` — "Tarjetas" / "Cards"
- `feed.mode_explain` — "Explicado fácil" / "Explain mode"
- `feed.personalized` — "Tu feed personalizado" / "Your personalized feed"

---

### 6.2 Enriched Favorite Team

#### Backend — Team Stats Model and Service

**Prisma schema addition** in `apps/api/prisma/schema.prisma`:

```prisma
model TeamStats {
  id             String   @id @default(cuid())
  teamName       String   @unique
  sport          String
  leaguePosition Int?
  recentResults  String   // JSON: [{opponent, score, result: "W"|"D"|"L", date}]
  topScorer      String?
  nextMatch      String?  // JSON: {opponent, date, competition}
  updatedAt      DateTime @updatedAt
}
```

**New file**: `apps/api/src/services/team-stats.ts`
- `getTeamStats(teamName: string): Promise<TeamStats | null>` — DB lookup.
- No external API calls in MVP. Data comes from seed.

**New route**: `GET /api/teams/:teamName/stats` → Returns `TeamStats` object or 404.

**Shared type addition** in `packages/shared/src/types/index.ts`:

```typescript
interface RecentResult {
  opponent: string;
  score: string;
  result: 'W' | 'D' | 'L';
  date: string;
}

interface NextMatch {
  opponent: string;
  date: string;
  competition: string;
}

interface TeamStats {
  id: string;
  teamName: string;
  sport: string;
  leaguePosition?: number;
  recentResults: RecentResult[];
  topScorer?: string;
  nextMatch?: NextMatch;
  updatedAt: string;
}
```

#### Frontend — Team Page Overhaul

**Modified file**: `apps/web/src/app/team/page.tsx`

Replace the current simple layout with a multi-section team hub:

1. **Team header**: Team name, sport badge (colored pill), league position badge.
2. **Stats card**: `TeamStatsCard` component.
3. **Recent news**: Filtered news for this team, displayed in Card mode.
4. **Team reels**: Filtered reels, displayed as horizontal scrollable thumbnails.

**New component**: `apps/web/src/components/TeamStatsCard.tsx`
- Props: `{ stats: TeamStats; locale: Locale }`
- Sections:
  - **League Position**: Large number with ordinal suffix ("3rd in La Liga").
  - **Last 5 Results**: Row of 5 colored circles — green (W), yellow (D), red (L) — with opponent name below.
  - **Top Scorer**: Name with icon.
  - **Next Match**: Opponent, date, competition name.

**New component**: `apps/web/src/components/TeamReelsStrip.tsx`
- Props: `{ reels: Reel[]; locale: Locale }`
- Horizontal scroll container with reel thumbnails.

#### i18n Keys

- `team.league_position` — "Posición en liga" / "League position"
- `team.recent_results` — "Últimos resultados" / "Recent results"
- `team.top_scorer` — "Máximo goleador" / "Top scorer"
- `team.next_match` — "Próximo partido" / "Next match"
- `team.news` — "Noticias del equipo" / "Team news"
- `team.reels` — "Reels del equipo" / "Team reels"
- `team.win` / `team.draw` / `team.loss` — "V"/"E"/"D" / "W"/"D"/"L"
- `team.position_ordinal` — "{{position}}º en {{league}}" / "{{position}}{{ordinal}} in {{league}}"

---

### 6.3 TikTok-Style Reels

#### Backend — Reel Model Updates

**Prisma schema change** — add fields to existing `Reel` model:

```prisma
model Reel {
  // ... existing fields ...
  videoType     String?   // "youtube_embed" | "mp4" | "hls"
  aspectRatio   String?   // "9:16" | "16:9" | "1:1"
  previewGifUrl String?
}
```

#### Frontend — Vertical Snap Feed

**New component**: `apps/web/src/components/ReelPlayer.tsx`

Props:
```typescript
{
  reel: Reel;
  isActive: boolean;   // true when this reel is the one "snapped" in viewport
  locale: Locale;
}
```

Behavior:
- When `isActive` becomes true: auto-play the video (for YouTube embeds, use `?autoplay=1&mute=1` params). When false: pause.
- Overlay controls at bottom: title, sport badge, team name.
- Right-side floating buttons: like (heart icon, toggles red, stored in localStorage), share (copies link to clipboard).
- Tap/click on the video area toggles play/pause.
- Display duration badge in top-right corner.

**New component**: `apps/web/src/components/VerticalFeed.tsx`

Props:
```typescript
{
  reels: Reel[];
  locale: Locale;
  onLoadMore: () => void;  // infinite scroll trigger
  startAtId?: string;       // scroll to this reel on mount
}
```

Behavior:
- Container: `h-screen overflow-y-scroll snap-y snap-mandatory`.
- Each child: `h-screen snap-start snap-always`.
- Uses `IntersectionObserver` (threshold: 0.6) to determine which reel is "active".
- When the second-to-last reel enters viewport, call `onLoadMore()`.
- On mount, if `startAtId` is provided, scroll to that reel.

**Modified file**: `apps/web/src/app/reels/page.tsx`
- Replace the current grid layout with `VerticalFeed`.
- Keep sport filter buttons, but move them to a floating pill at the top.
- Read `startAt` from URL search params and pass to `VerticalFeed`.

**CSS additions** in `apps/web/src/styles/globals.css`:
```css
.reel-container {
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
}
.reel-item {
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

#### Shared Type Update

```typescript
interface Reel {
  // ... existing fields ...
  videoType?: 'youtube_embed' | 'mp4' | 'hls';
  aspectRatio?: '9:16' | '16:9' | '1:1';
  previewGifUrl?: string;
}
```

#### i18n Keys

- `reels.like` — "Me gusta" / "Like"
- `reels.share` — "Compartir" / "Share"
- `reels.copied` — "¡Enlace copiado!" / "Link copied!"
- `reels.tap_to_play` — "Toca para reproducir" / "Tap to play"
- `reels.filter` — "Filtrar" / "Filter"

---

### 6.4 Notification Concept (MVP)

#### Backend

**Prisma schema change** — add fields to existing `User` model:

```prisma
model User {
  // ... existing fields ...
  pushEnabled      Boolean  @default(false)
  pushPreferences  String?  // JSON: {sports: string[], dailyQuiz: boolean, teamUpdates: boolean}
}
```

**New routes** in `apps/api/src/routes/users.ts`:
- `POST /api/users/:id/notifications/subscribe` — Body: `{ enabled: boolean, preferences: { sports: string[], dailyQuiz: boolean, teamUpdates: boolean } }`. Updates `pushEnabled` and `pushPreferences`.
- `GET /api/users/:id/notifications` — Returns current `{ pushEnabled, pushPreferences }`.

**No actual push delivery in this milestone.** The routes only persist preferences.

#### Frontend

**New component**: `apps/web/src/components/NotificationSettings.tsx`
- Props: `{ userId: string; locale: Locale }`
- Master toggle: enable/disable notifications.
- When enabled: checkboxes for sports updates, daily quiz reminder, team updates.
- "Coming soon" note explaining notifications aren't active yet.

#### i18n Keys

- `notifications.title` — "Notificaciones" / "Notifications"
- `notifications.enable` — "Activar notificaciones" / "Enable notifications"
- `notifications.sports` — "Actualizaciones deportivas" / "Sports updates"
- `notifications.daily_quiz` — "Recordatorio de quiz diario" / "Daily quiz reminder"
- `notifications.team_updates` — "Novedades de mi equipo" / "Team updates"
- `notifications.saved` — "Preferencias guardadas" / "Preferences saved"
- `notifications.mvp_note` — "Las notificaciones estarán disponibles pronto" / "Notifications coming soon"

---

### 6.5 Seed Data

**Modified file**: `apps/api/prisma/seed.ts`

#### TeamStats Seed

Seed `TeamStats` for 15 teams with realistic data:

| Team | Sport | Position | Recent Results (last 5) |
|------|-------|----------|------------------------|
| Real Madrid | football | 1 | W W D W L |
| FC Barcelona | football | 2 | W L W W D |
| Atletico Madrid | football | 3 | D W W L W |
| Manchester City | football | 1 | W W W D W |
| Liverpool | football | 2 | W D W W L |
| Bayern Munich | football | 1 | W W L W W |
| PSG | football | 1 | W W W W D |
| Juventus | football | 3 | D L W W W |
| LA Lakers | basketball | 5 | W L W L W |
| Golden State Warriors | basketball | 3 | W W L W W |
| Carlos Alcaraz | tennis | 2 | W W W L W |
| Rafa Nadal | tennis | null | L W D L W |
| Red Bull Racing | formula1 | 1 | W W D W W |
| Ferrari | formula1 | 2 | L W W D W |
| Movistar Team | cycling | null | W D L W W |

Each `recentResults` JSON array has 5 entries with opponent, score, result, and date.

#### Reel Updates

Update existing Reel seed records to include:
- `videoType: "youtube_embed"` for all current YouTube embed reels.
- `aspectRatio: "16:9"` for YouTube embeds (default).
- `previewGifUrl: null`.

---

## UI Mockups (ASCII)

### Smart Feed — Headlines Mode

```
┌─────────────────────────────────────────┐
│  ☰  SportyKids         [👤]            │
├─────────────────────────────────────────┤
│  Your personalized feed                 │
│  [Headlines] [Cards] [Explain]          │
│                                         │
│  ● Mbappé scores hat-trick in...        │
│    AS · 2h ago                          │
│  ─────────────────────────────────────  │
│  ● Real Madrid signs new defender...    │
│    Mundo Deportivo · 3h ago             │
│  ─────────────────────────────────────  │
│  ● Champions League draw revealed...   │
│    Marca · 4h ago                       │
│  ─────────────────────────────────────  │
│  ● Barcelona wins Copa del Rey...      │
│    AS · 5h ago                          │
│  ─────────────────────────────────────  │
│  ● Lakers beat Warriors in OT...       │
│    AS · 6h ago                          │
│                                         │
├─────────────────────────────────────────┤
│  News    Reels    Quiz    Team   Parent │
└─────────────────────────────────────────┘
```

### Enriched Team Page

```
┌─────────────────────────────────────────┐
│  ☰  SportyKids         [👤]            │
├─────────────────────────────────────────┤
│                                         │
│  ⚽ Real Madrid                         │
│  ─────────────────────────────────────  │
│                                         │
│  ┌─ League Position ─────────────────┐  │
│  │         1st in La Liga            │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ Last 5 Results ──────────────────┐  │
│  │  🟢   🟢   🟡   🟢   🔴          │  │
│  │  BAR  ATL  SEV  BET  VAL         │  │
│  │  3-1  2-0  1-1  4-0  0-1         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ Top Scorer ──────────────────────┐  │
│  │  ⚡ Mbappé (22 goals)             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ Next Match ──────────────────────┐  │
│  │  vs Barcelona · Mar 28 · La Liga  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── Team News ───────────────────────── │
│  ┌──────────┐ ┌──────────┐             │
│  │ [Image]  │ │ [Image]  │  ...        │
│  │ Title... │ │ Title... │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  ── Team Reels ──────────────────────── │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ [▶]  │ │ [▶]  │ │ [▶]  │  →       │
│  │ 0:45 │ │ 1:20 │ │ 0:30 │           │
│  └──────┘ └──────┘ └──────┘           │
│                                         │
├─────────────────────────────────────────┤
│  News    Reels    Quiz    Team   Parent │
└─────────────────────────────────────────┘
```

### TikTok-Style Reels (Vertical Feed)

```
┌─────────────────────────────────────────┐
│  ┌─ Floating Filters ────────────┐      │
│  │ [All] [⚽] [🏀] [🎾] [🏊]   │      │
│  └───────────────────────────────┘      │
│                                         │
│                                         │
│         ┌───────────────────┐           │
│         │                   │           │
│         │                   │           │
│         │   [VIDEO PLAYING] │     ♡ 12  │
│         │                   │     ↗ Share│
│         │                   │           │
│         │                   │           │
│         └───────────────────┘           │
│                                         │
│  ⚽ Mbappé's incredible goal            │
│  Real Madrid · 0:45                     │
│                                         │
│  ─ ─ ─  swipe up for next  ─ ─ ─ ─ ─  │
│                                         │
├─────────────────────────────────────────┤
│  News    Reels    Quiz    Team   Parent │
└─────────────────────────────────────────┘
```

---

## Acceptance Criteria

### Smart Personalized Feed
- [ ] `GET /api/news?userId=X` returns news ranked by user preferences.
- [ ] News from unfollowed sports is excluded when `userId` is provided.
- [ ] Favorite team news appears before other news of the same sport.
- [ ] Without `userId`, the endpoint behaves identically to current behavior.
- [ ] Existing filter params (`sport`, `team`, `age`, `source`) work correctly alongside `userId`.
- [ ] Headlines mode renders compact rows without images.
- [ ] Cards mode renders the current card layout (no visual regression).
- [ ] Explain mode renders cards with a functional "Explain it Easy" button (requires M2).
- [ ] Feed mode selection persists across page reloads via `localStorage`.
- [ ] All visible text uses i18n keys.

### Enriched Favorite Team
- [ ] `GET /api/teams/:teamName/stats` returns stats for seeded teams.
- [ ] `GET /api/teams/:teamName/stats` returns 404 for unknown teams.
- [ ] Team page shows league position, last 5 results with W/D/L indicators, top scorer, and next match.
- [ ] Team page shows filtered news for the selected team.
- [ ] Team page shows a horizontal reels strip for the team's sport.
- [ ] W/D/L indicators use correct colors (green/yellow/red).
- [ ] `TeamStats` model has a migration and seed data for at least 10 teams.
- [ ] All visible text uses i18n keys.

### TikTok-Style Reels
- [ ] Reels page displays a vertical snap-scrolling feed (one reel per viewport height).
- [ ] Only the currently visible reel auto-plays; others are paused.
- [ ] Swiping/scrolling snaps to the next reel cleanly.
- [ ] Like button toggles state and persists in `localStorage`.
- [ ] Share button copies the reel URL to clipboard and shows a confirmation toast.
- [ ] Sport filter buttons float over the feed and filter reels by sport.
- [ ] Infinite scroll loads the next page when approaching the last reel.
- [ ] `startAt` URL param scrolls to the specified reel on mount.
- [ ] Reel model migration adds `videoType`, `aspectRatio`, `previewGifUrl` fields.
- [ ] Existing reels are updated in seed with `videoType` and `aspectRatio` values.

### Notification Concept
- [ ] `POST /api/users/:id/notifications/subscribe` stores preferences in DB.
- [ ] `GET /api/users/:id/notifications` returns stored preferences.
- [ ] Notification settings UI shows master toggle and preference checkboxes.
- [ ] A "coming soon" note is displayed.

### Seed Data
- [ ] `TeamStats` seed includes at least 10 teams across 3+ sports.
- [ ] Each `TeamStats` entry has 5 `recentResults` with opponent, score, result, and date.
- [ ] Existing Reel records are updated with `videoType` and `aspectRatio`.

---

## Technical Requirements

### Database Migrations

1. **Add `TeamStats` model** — new table.
2. **Add fields to `Reel`** — `videoType`, `aspectRatio`, `previewGifUrl` (all nullable).
3. **Add fields to `User`** — `pushEnabled` (Boolean, default false), `pushPreferences` (nullable String).

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/feed-ranker.ts` | Feed ranking algorithm |
| `apps/api/src/services/team-stats.ts` | Team stats DB access |
| `apps/api/src/routes/teams.ts` | Team stats route |
| `apps/web/src/components/FeedModeToggle.tsx` | Headlines/Cards/Explain toggle |
| `apps/web/src/components/HeadlineRow.tsx` | Compact headline row |
| `apps/web/src/components/TeamStatsCard.tsx` | Team stats display |
| `apps/web/src/components/TeamReelsStrip.tsx` | Horizontal reel thumbnails |
| `apps/web/src/components/ReelPlayer.tsx` | Individual reel with auto-play |
| `apps/web/src/components/VerticalFeed.tsx` | Snap-scroll reel container |
| `apps/web/src/components/NotificationSettings.tsx` | Notification preferences UI |

### Modified Files

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add `TeamStats` model, new fields on `Reel` and `User` |
| `apps/api/prisma/seed.ts` | Add `TeamStats` seed, update `Reel` seed |
| `apps/api/src/routes/news.ts` | Accept `userId` param, integrate `rankFeed()` |
| `apps/api/src/routes/users.ts` | Add notification subscribe/get endpoints |
| `apps/web/src/app/page.tsx` | Integrate `FeedModeToggle`, pass `userId`, render by mode |
| `apps/web/src/app/reels/page.tsx` | Replace grid with `VerticalFeed` |
| `apps/web/src/app/team/page.tsx` | Full overhaul with stats, news, reels sections |
| `apps/web/src/components/NewsCard.tsx` | Add optional `showExplainButton` prop |
| `apps/web/src/lib/api.ts` | Add `fetchTeamStats()`, update `fetchNews()` signature |
| `apps/web/src/styles/globals.css` | Add scroll-snap CSS |
| `packages/shared/src/types/index.ts` | Add `TeamStats`, `RecentResult`, `NextMatch`, `PushPreferences`; update `Reel`, `User` |
| `packages/shared/src/i18n/es.json` | Add all new i18n keys |
| `packages/shared/src/i18n/en.json` | Add all new i18n keys |

### Performance Considerations

- `rankFeed()` operates on already-fetched news arrays (in-memory sort, no extra DB queries beyond user lookup).
- `IntersectionObserver` in `VerticalFeed` should disconnect on unmount to avoid memory leaks.
- Reels lazy-load iframes only for the active reel and one above/below (3 total in DOM) to minimize resource usage.

---

## Out of Scope

- **Actual push notification delivery** (FCM, APNs, web push) — only preference storage.
- **External API integration for live team stats** — MVP uses seed data only.
- **Machine learning or collaborative filtering** for feed ranking.
- **Video upload or transcoding** — reels remain YouTube embeds or static URLs.
- **Mobile app (React Native) changes** — web app only.
- **Real-time updates** (WebSockets, SSE) for live scores.
- **GIF preview generation** for reels — field added but not populated.
- **Offline support or service workers**.
