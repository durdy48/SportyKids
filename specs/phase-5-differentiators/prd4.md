# PRD: Milestone 4 — Gamification (Stickers, Streaks, Achievements)

> Part of [SportyKids Differentiators](./prd.md). See main PRD for overview and dependency graph.

## Overview

Milestone 4 introduces an engagement and reward system for SportyKids, giving children tangible motivation to return daily and explore content. The system comprises three interconnected pillars: a digital sticker collection album, daily login streaks, and unlockable achievements. Points earned throughout the app (reading news, watching reels, completing quizzes) feed into this system, awarding stickers and unlocking achievements that children can view in a dedicated Collection page.

This milestone is independent of M2 and M3 and builds directly on the base MVP (Phases 0-4).

## Problem Statement

The current MVP awards points for quiz answers but provides no visible reward loop. Children have no reason to return daily, no sense of progression beyond a single number, and no collectible incentive tied to their favorite sports. Engagement will decay without a feedback system that makes activity feel rewarding.

## Goals

1. **Increase daily return rate** — streak mechanics and daily login stickers create a habit loop.
2. **Reward exploration** — achievements for reading across sports, watching reels, and playing quizzes encourage breadth.
3. **Provide visible progression** — a sticker album with rarity tiers and grayscale placeholders shows children what they have and what they can earn.
4. **Extend the points system** — points now come from all content interactions, not just quizzes.

## Core Features

### 4.1 Sticker / Digital Card System

#### Data Models

Add to `apps/api/prisma/schema.prisma`:

```prisma
model Sticker {
  id           String        @id @default(cuid())
  name         String
  nameKey      String        // i18n key, e.g. "sticker.messi"
  imageUrl     String
  sport        String
  team         String?
  rarity       String        // 'common' | 'rare' | 'epic' | 'legendary'
  createdAt    DateTime      @default(now())
  userStickers UserSticker[]
}

model UserSticker {
  id         String   @id @default(cuid())
  userId     String
  stickerId  String
  source     String   // 'streak' | 'quiz_perfect' | 'achievement' | 'daily_login'
  obtainedAt DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
  sticker    Sticker  @relation(fields: [stickerId], references: [id])

  @@unique([userId, stickerId])
}
```

Add relations to existing `User` model:

```prisma
model User {
  // ... existing fields ...
  currentStreak  Int       @default(0)
  longestStreak  Int       @default(0)
  lastActiveDate DateTime?
  userStickers     UserSticker[]
  userAchievements UserAchievement[]
}
```

#### Rarity Visual Treatment

| Rarity    | Border / Effect          | Drop Weight |
|-----------|--------------------------|-------------|
| common    | 1px solid gray (#94A3B8) | 60%         |
| rare      | 2px solid blue + glow    | 25%         |
| epic      | 2px solid purple + glow  | 12%         |
| legendary | 3px solid gold + pulse animation | 3%   |

#### Sticker Selection Logic

When awarding a random sticker, the service must:

1. Query stickers the user does NOT yet own.
2. Filter by the allowed rarity tier for the source (e.g., daily login awards only `common`; perfect quiz awards `rare`).
3. Pick one at random from the filtered set.
4. If no unowned stickers remain in that rarity, fall back to the next higher rarity. If all owned, return `null` (no duplicate awards — the `@@unique` constraint enforces this).

#### Shared Types

Add to `packages/shared/src/types/index.ts`:

```typescript
export type StickerRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Sticker {
  id: string;
  name: string;
  nameKey: string;
  imageUrl: string;
  sport: string;
  team: string | null;
  rarity: StickerRarity;
}

export interface UserSticker {
  id: string;
  stickerId: string;
  source: string;
  obtainedAt: string;
  sticker: Sticker;
}
```

#### Shared Constants

Add to `packages/shared/src/constants/index.ts`:

```typescript
export const STICKER_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export const RARITY_COLORS: Record<string, string> = {
  common: '#94A3B8',
  rare: '#2563EB',
  epic: '#9333EA',
  legendary: '#F59E0B',
};
```

### 4.2 Daily Streaks

#### Streak Logic

Create `apps/api/src/services/gamification.ts` with the following core function:

```typescript
async function checkAndUpdateStreak(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
  dailyStickerAwarded: UserSticker | null;
  pointsAwarded: number;
}>;
```

**Algorithm:**

1. Fetch user's `lastActiveDate`, `currentStreak`, `longestStreak`.
2. Compute `today` and `yesterday` using UTC date boundaries (strip time component).
3. If `lastActiveDate` equals `today` → return current values, no changes, `pointsAwarded: 0`.
4. If `lastActiveDate` equals `yesterday` → increment `currentStreak` by 1.
5. Otherwise (null or older) → set `currentStreak` to 1, set `streakBroken: true`.
6. Update `longestStreak` to `max(longestStreak, currentStreak)`.
7. Set `lastActiveDate` to `today`.
8. Award +2 points for daily login.
9. Call `awardSticker(userId, 'daily_login')` to grant one random common sticker per day.
10. Evaluate streak milestones (7-day, 30-day) and call `evaluateAchievements(userId)`.
11. Persist all changes in a single transaction.

#### Streak Milestone Rewards

| Milestone | Points | Sticker Award |
|-----------|--------|---------------|
| 3-day     | +25    | —             |
| 7-day     | +100   | 1 epic sticker |
| 14-day    | +200   | —             |
| 30-day    | +500   | 1 legendary sticker |

### 4.3 Achievements

#### Data Model

```prisma
model Achievement {
  id               String            @id @default(cuid())
  key              String            @unique
  nameKey          String            // i18n key
  descriptionKey   String            // i18n key
  icon             String            // emoji or icon identifier
  threshold        Int
  type             String            // 'streak' | 'quiz' | 'reading' | 'reels' | 'login' | 'collection'
  rewardStickerId  String?
  createdAt        DateTime          @default(now())
  userAchievements UserAchievement[]
}

model UserAchievement {
  id            String      @id @default(cuid())
  userId        String
  achievementId String
  unlockedAt    DateTime    @default(now())
  user          User        @relation(fields: [userId], references: [id])
  achievement   Achievement @relation(fields: [achievementId], references: [id])

  @@unique([userId, achievementId])
}
```

#### Achievement Definitions (seed data)

| Key                 | Name (i18n key)                     | Type       | Threshold | Icon | Reward Sticker |
|---------------------|-------------------------------------|------------|-----------|------|----------------|
| `first_read`        | `achievement.first_read`            | reading    | 1         | 📰   | —              |
| `news_10`           | `achievement.news_10`              | reading    | 10        | 📚   | —              |
| `news_50`           | `achievement.news_50`              | reading    | 50        | 🏅   | rare           |
| `news_100`          | `achievement.news_100`             | reading    | 100       | 🏆   | epic           |
| `first_reel`        | `achievement.first_reel`           | reels      | 1         | 🎬   | —              |
| `reels_20`          | `achievement.reels_20`             | reels      | 20        | 🎥   | —              |
| `first_quiz`        | `achievement.first_quiz`           | quiz       | 1         | ❓   | —              |
| `quiz_perfect`      | `achievement.quiz_perfect`         | quiz       | 1         | 💯   | rare           |
| `quiz_10_perfect`   | `achievement.quiz_10_perfect`      | quiz       | 10        | 🧠   | epic           |
| `streak_3`          | `achievement.streak_3`             | streak     | 3         | 🔥   | —              |
| `streak_7`          | `achievement.streak_7`             | streak     | 7         | ⚡   | epic           |
| `streak_14`         | `achievement.streak_14`            | streak     | 14        | 💪   | —              |
| `streak_30`         | `achievement.streak_30`            | streak     | 30        | 👑   | legendary      |
| `all_sports`        | `achievement.all_sports`           | reading    | 8         | 🌍   | epic           |
| `first_sticker`     | `achievement.first_sticker`        | collection | 1         | ⭐   | —              |
| `stickers_10`       | `achievement.stickers_10`          | collection | 10        | 🎨   | rare           |
| `stickers_25`       | `achievement.stickers_25`          | collection | 25        | 🖼️   | epic           |
| `daily_login_7`     | `achievement.daily_login_7`        | login      | 7         | 📅   | —              |
| `points_500`        | `achievement.points_500`           | reading    | 500       | 💰   | rare           |
| `points_1000`       | `achievement.points_1000`          | reading    | 1000      | 💎   | legendary      |

#### Achievement Evaluation

```typescript
async function evaluateAchievements(userId: string): Promise<UserAchievement[]>;
```

This function:

1. Fetches user stats: total `ActivityLog` counts by type, `currentStreak`, `totalPoints`, sticker count, distinct sports read.
2. Fetches all achievements the user has NOT yet unlocked.
3. For each unearned achievement, checks if the user's relevant stat meets or exceeds the threshold.
4. For `quiz_perfect` type: query `ActivityLog` entries or add a counter — see section 4.4.
5. Creates `UserAchievement` records for any newly earned achievements.
6. If the achievement has a `rewardStickerId`, calls `awardSticker`.
7. Returns the list of newly unlocked achievements (used for toast notifications).

### 4.4 Points System Update

#### Points Award Table

| Action              | Points | Trigger Location                          |
|---------------------|--------|-------------------------------------------|
| Read news           | +5     | POST `/api/parents/actividad/registrar` when type = `news_viewed` |
| Watch reel          | +3     | POST `/api/parents/actividad/registrar` when type = `reels_viewed` |
| Correct quiz answer | +10    | POST `/api/quiz/answer` (existing, already awards points) |
| Perfect quiz (5/5)  | +50    | POST `/api/quiz/answer` (detect when 5th consecutive correct answer) |
| 7-day streak        | +100   | `checkAndUpdateStreak` |
| 30-day streak       | +500   | `checkAndUpdateStreak` |
| Daily login         | +2     | POST `/api/gamification/check-in` |

**Implementation note:** The existing `/api/parents/actividad/registrar` endpoint (in `apps/api/src/routes/parents.ts`) currently only creates an `ActivityLog` record. Modify it to also:
1. Increment `user.totalPoints` by the appropriate amount (+5 for `news_viewed`, +3 for `reels_viewed`).
2. Call `evaluateAchievements(userId)` after logging the activity.

For perfect quiz detection, add a `quizPerfectCount` field to `User` (Int, default 0). In the quiz answer endpoint, after awarding points for a correct answer, check if the user has answered the last 5 questions correctly. Track this in a new field `currentQuizCorrectStreak Int @default(0)` on `User`. Reset to 0 on wrong answer; increment on correct. When it reaches 5, award the +50 bonus, award a random rare sticker, increment `quizPerfectCount`, and reset `currentQuizCorrectStreak` to 0.

#### Updated User Model (all new fields)

```prisma
model User {
  // ... existing fields ...
  currentStreak           Int       @default(0)
  longestStreak           Int       @default(0)
  lastActiveDate          DateTime?
  currentQuizCorrectStreak Int      @default(0)
  quizPerfectCount        Int       @default(0)
  userStickers            UserSticker[]
  userAchievements        UserAchievement[]
}
```

### 4.5 API Routes

Create `apps/api/src/routes/gamification.ts`:

| Method | Route                                | Response |
|--------|--------------------------------------|----------|
| GET    | `/api/gamification/stickers`         | `{ stickers: Sticker[] }` |
| GET    | `/api/gamification/stickers/:userId` | `{ stickers: UserSticker[], total: number, collected: number }` |
| GET    | `/api/gamification/achievements`     | `{ achievements: Achievement[] }` |
| GET    | `/api/gamification/achievements/:userId` | `{ achievements: UserAchievement[], total: number, unlocked: number }` |
| GET    | `/api/gamification/streaks/:userId`  | `{ currentStreak, longestStreak, lastActiveDate }` |
| POST   | `/api/gamification/check-in`         | `{ streak: {...}, dailySticker: UserSticker \| null, newAchievements: UserAchievement[], pointsAwarded: number }` |

Request body for `POST /api/gamification/check-in`:

```json
{ "userId": "string" }
```

Validate with Zod. Register the router in `apps/api/src/index.ts`.

### 4.6 Collection / Album Page (Web)

Create `apps/web/src/app/collection/page.tsx` and supporting components.

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| `StickerAlbum` | `apps/web/src/components/StickerAlbum.tsx` | Grid layout, sport filter tabs, progress bar |
| `StickerCard` | `apps/web/src/components/StickerCard.tsx` | Individual sticker: image, rarity border, name, grayscale if not owned |
| `AchievementBadge` | `apps/web/src/components/AchievementBadge.tsx` | Achievement icon + name + description, locked/unlocked state |
| `StreakCounter` | `apps/web/src/components/StreakCounter.tsx` | Fire icon + current streak number + "longest: N" |
| `RewardToast` | `apps/web/src/components/RewardToast.tsx` | Animated toast for new sticker/achievement, auto-dismiss 4s |

#### Page Layout

```
┌──────────────────────────────────────────────────────┐
│  NavBar  [News] [Reels] [Quiz] [Collection] [Team] [Parents]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🔥 5-day streak          ⭐ 320 points             │
│  ░░░░░░░░░░▓▓▓▓▓ 14/40 stickers collected          │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [All] [⚽] [🏀] [🎾] [🏊] [🏃] [🚴] [🏎️] [🏸]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐      │
│  │     │  │     │  │ ░░░ │  │     │  │ ░░░ │      │
│  │ 🏆  │  │ ⚽  │  │ ??? │  │ 🏀  │  │ ??? │      │
│  │     │  │     │  │     │  │     │  │     │      │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘      │
│  Messi    Balón    Locked   Jordan   Locked         │
│  ★★★★    ★★☆☆    ★☆☆☆    ★★★☆    ★★★★            │
│  LEGEND.  RARE    COMMON   EPIC    LEGEND.          │
│                                                      │
│  ... (scrollable grid, 3-4 columns)                 │
│                                                      │
├──────────────────────────────────────────────────────┤
│  ACHIEVEMENTS                                        │
│                                                      │
│  ✅ First Read       ✅ 7-Day Streak                │
│  ✅ Quiz Perfect     🔒 50 News Read                │
│  🔒 All Sports       🔒 30-Day Streak              │
│  ... (horizontal scroll or 2-col grid)              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Streak Counter Widget

```
┌─────────────────────────────┐
│  🔥 5   Best: 12           │
│  ▓▓▓▓▓░░  next reward: 7d  │
└─────────────────────────────┘
```

#### Achievement Toast (overlays page, bottom-right)

```
┌──────────────────────────────────┐
│  🏆 Achievement Unlocked!       │
│  ⚡ 7-Day Streak                │
│  "You visited 7 days in a row!" │
│  +100 points  +1 epic sticker   │
└──────────────────────────────────┘
```

### 4.7 NavBar Update

Modify `apps/web/src/components/NavBar.tsx` to add a "Collection" link between "Quiz" and "My Team":

```typescript
{ href: '/collection', label: t('nav.collection', locale), icon: '🏆' }
```

### 4.8 i18n Keys

Add to `packages/shared/src/i18n/es.json` and `en.json` (showing es/en pairs):

- `nav.collection` — "Colección" / "Collection"
- `collection.title` — "Mi Colección" / "My Collection"
- `collection.stickers_collected` — "{{collected}} de {{total}} stickers"
- `collection.all_sports` — "Todos" / "All"
- `collection.achievements` — "Logros" / "Achievements"
- `collection.locked` — "Bloqueado" / "Locked"
- `collection.obtained` — "Obtenido" / "Obtained"
- `collection.source.streak` — "Racha diaria" / "Daily streak"
- `collection.source.quiz_perfect` — "Quiz perfecto" / "Perfect quiz"
- `collection.source.achievement` — "Logro" / "Achievement"
- `collection.source.daily_login` — "Login diario" / "Daily login"
- `sticker.rarity.common` — "Común" / "Common"
- `sticker.rarity.rare` — "Raro" / "Rare"
- `sticker.rarity.epic` — "Épico" / "Epic"
- `sticker.rarity.legendary` — "Legendario" / "Legendary"
- `streak.current` — "Racha actual" / "Current streak"
- `streak.longest` — "Mejor racha" / "Best streak"
- `streak.next_reward` — "Próxima recompensa en {{days}} días" / "Next reward in {{days}} days"
- `achievement.unlocked` — "¡Logro desbloqueado!" / "Achievement unlocked!"
- All 20 achievement name/description keys (see section 4.3)
- `gamification.points_earned` — "+{{points}} puntos" / "+{{points}} points"
- `gamification.sticker_earned` — "¡Nuevo sticker!" / "New sticker!"
- `gamification.perfect_quiz` — "¡Quiz perfecto!" / "Perfect quiz!"

### 4.9 Seed Data

Extend `apps/api/prisma/seed.ts` to insert:

**Stickers (30-40):**
- 8 sport-icon stickers (one per sport, common rarity)
- 8 sport-equipment stickers (ball, racket, bike, etc., common rarity)
- 10 team-crest stickers (top 10 teams from `TEAMS`, rare rarity)
- 6 athlete stickers (famous names per sport, epic rarity)
- 4 legendary stickers (golden versions of top athletes/icons)
- 4 additional rare/epic stickers for milestone rewards

For `imageUrl`, use placeholder paths: `/stickers/{sport}-{name}.png`. The UI should render a colored placeholder div matching the sport color when the image 404s.

**Achievements (20):** All entries from the table in section 4.3.

### 4.10 Frontend API Client

Add to `apps/web/src/lib/api.ts`:

```typescript
export async function getStickers(): Promise<Sticker[]>;
export async function getUserStickers(userId: string): Promise<{ stickers: UserSticker[]; total: number; collected: number }>;
export async function getAchievements(): Promise<Achievement[]>;
export async function getUserAchievements(userId: string): Promise<{ achievements: UserAchievement[]; total: number; unlocked: number }>;
export async function getStreakInfo(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastActiveDate: string | null }>;
export async function checkIn(userId: string): Promise<{ streak: object; dailySticker: UserSticker | null; newAchievements: UserAchievement[]; pointsAwarded: number }>;
```

### 4.11 Daily Check-in Integration

The web app should call `checkIn(userId)` once per session on page load. Implement this in the `UserProvider` (`apps/web/src/lib/user-context.tsx`):

1. After loading the user from localStorage, if a user exists, call `POST /api/gamification/check-in`.
2. If `newAchievements` is non-empty, display a `RewardToast` for each.
3. If `dailySticker` is non-null, display a `RewardToast` showing the sticker.
4. Store a `lastCheckInDate` in localStorage to avoid redundant calls on same-page navigation (but always call on fresh page load / new session).

## Acceptance Criteria

### Stickers
- [ ] `Sticker` and `UserSticker` tables created via Prisma migration.
- [ ] Seed populates 30+ stickers across all 8 sports and 4 rarity tiers.
- [ ] GET `/api/gamification/stickers` returns the full sticker catalog.
- [ ] GET `/api/gamification/stickers/:userId` returns only stickers the user has collected, with `total` and `collected` counts.
- [ ] `@@unique([userId, stickerId])` prevents duplicate sticker awards.
- [ ] Sticker award logic respects rarity tiers per source.

### Streaks
- [ ] `currentStreak`, `longestStreak`, and `lastActiveDate` fields added to `User`.
- [ ] POST `/api/gamification/check-in` increments streak when `lastActiveDate` is yesterday.
- [ ] POST `/api/gamification/check-in` resets streak to 1 when `lastActiveDate` is older than yesterday.
- [ ] POST `/api/gamification/check-in` is idempotent when called multiple times on the same day.
- [ ] `longestStreak` is updated when `currentStreak` exceeds it.
- [ ] Streak milestones (3, 7, 14, 30) award correct points and stickers.
- [ ] GET `/api/gamification/streaks/:userId` returns current streak data.

### Achievements
- [ ] `Achievement` and `UserAchievement` tables created via Prisma migration.
- [ ] Seed populates 15+ achievement definitions.
- [ ] `evaluateAchievements` correctly checks thresholds for all achievement types.
- [ ] Achievements with `rewardStickerId` trigger sticker award on unlock.
- [ ] GET `/api/gamification/achievements/:userId` returns unlocked achievements.
- [ ] No duplicate `UserAchievement` records (enforced by `@@unique`).

### Points System
- [ ] Reading news awards +5 points (via activity registration endpoint).
- [ ] Watching reels awards +3 points (via activity registration endpoint).
- [ ] Perfect quiz (5 consecutive correct) awards +50 bonus points and a rare sticker.
- [ ] `currentQuizCorrectStreak` resets to 0 on wrong answer.
- [ ] Daily login awards +2 points.

### Collection Page (Web)
- [ ] `/collection` page renders sticker grid with sport filter tabs.
- [ ] Owned stickers display in full color with rarity border treatment.
- [ ] Unowned stickers display in grayscale with "?" overlay.
- [ ] Progress bar shows `collected / total` stickers.
- [ ] Achievements section shows unlocked (checkmark) and locked (lock icon) states.
- [ ] `StreakCounter` widget displays current streak and longest streak.
- [ ] All visible text uses i18n keys via `t()`.
- [ ] Page is responsive: 2 columns on mobile, 3-4 on desktop.

### NavBar
- [ ] "Collection" tab appears between "Quiz" and "My Team" in the NavBar.
- [ ] Active state highlights correctly when on `/collection`.

### Toast Notifications
- [ ] `RewardToast` appears on achievement unlock with achievement name and rewards.
- [ ] `RewardToast` appears on new sticker award with sticker image and rarity.
- [ ] Toast auto-dismisses after 4 seconds.
- [ ] Multiple toasts stack (newest on top).

### i18n
- [ ] All new UI strings have keys in both `es.json` and `en.json`.
- [ ] Sticker names use `nameKey` resolved via `t()`.
- [ ] Achievement names and descriptions use `nameKey` and `descriptionKey`.

## Technical Requirements

### Migration
- Create a single Prisma migration for all new models and User field additions.
- Migration name: `add_gamification_tables`.

### Service Layer
- All gamification logic lives in `apps/api/src/services/gamification.ts`.
- Functions: `checkAndUpdateStreak`, `evaluateAchievements`, `awardSticker`, `awardPointsForActivity`.
- Use Prisma transactions for operations that modify multiple tables.

### Zod Validation
- Validate `POST /api/gamification/check-in` body with Zod: `{ userId: z.string().min(1) }`.
- Validate query params on GET endpoints where applicable.

### Error Handling
- Return 404 if userId does not exist on any user-specific endpoint.
- Return 400 for invalid request bodies.
- Use the existing `error-handler.ts` middleware pattern.

### Sticker Image Fallback
- `StickerCard` component should render a colored placeholder (using `sportToColor` from shared utils) when the image URL returns 404.
- Use `onError` handler on `<img>` to swap to placeholder.

## Out of Scope

- **Mobile app (React Native)**: This milestone covers the web app only. Mobile integration is a follow-up task.
- **Real sticker images**: Using placeholder paths and fallback colored divs. Actual artwork is a design task.
- **Trading/gifting stickers between users**: Future social feature.
- **Leaderboards**: Global or friend-group rankings are a separate milestone.
- **Push notifications**: Toast notifications are in-app only; no browser push or mobile push.
- **Parental restrictions on gamification**: Parents cannot currently restrict access to the Collection page.
- **Backend tests**: Consistent with current MVP state (no automated tests exist yet).
