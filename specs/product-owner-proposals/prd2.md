# Sprint 3-4: "Confianza parental" + "Motor de retención" — Product Requirements Document

## Overview

This PRD covers 9 work items across two sprints that transform SportyKids from a functional beta into an app parents actively trust and kids open daily. Sprint 3 ("Confianza parental") gives parents transparency and control: weekly digest reports, a "see what my kid sees" preview, granular per-content-type time limits, a kid-facing content report button, and real authentication with social login. Sprint 4 ("Motor de retención") creates the daily habit loop: daily missions with sticker rewards, mobile feature parity for RSS and check-in, real push notifications, and dark mode.

## Problem Statement

After Sprint 1-2 beta testing, two gaps remain:

1. **Parents lack trust signals.** They can set restrictions, but they cannot see a summary of what their child consumed, preview the feed through their child's eyes, or set separate time limits for different content types. There is no way for kids to flag inappropriate content. And the entire auth model is a user ID in localStorage — no real accounts, no social login, no way to recover access.
2. **Kids lack a reason to return daily.** The gamification system (streaks, stickers, achievements) exists but is passive — you earn things by browsing. There is no active daily goal. Push notifications are UI-only stubs. The mobile app is missing RSS catalog browsing and daily check-in. And the app has no dark mode, which older kids (12-14) expect.

## Goals

| Goal | Metric | Target |
|------|--------|--------|
| Parent trust score (post-beta survey) | "I feel informed about my child's app usage" (1-5) | >= 4.0 |
| Weekly digest open rate | Emails opened / emails sent | > 50% |
| Content report adoption | % of active kids who flag >= 1 item | > 15% |
| Day-1 retention (return next day) | % of new users returning within 24h | > 60% |
| Daily mission completion rate | Missions completed / missions generated | > 40% |
| Push notification opt-in rate | Users enabling push / total users | > 50% |
| Dark mode adoption | Users toggling dark mode | > 25% |

## Target Users

- **Primary**: Kids aged 6-14 who follow sports — need a reason to open the app every day.
- **Secondary**: Parents — need to trust the app with their child's screen time and content.
- **Tertiary**: Implementation agent (Claude Code) who will build everything from this PRD.

---

## Sprint 3: "Confianza parental"

---

### B-PT1: Weekly Digest for Parents (Email/PDF)

#### Problem

Parents must open the app and navigate to the parental panel to see activity. They want a passive summary delivered weekly.

#### Data Model

No new Prisma models required. Add fields to `ParentalProfile` in `apps/api/prisma/schema.prisma`:

```prisma
model ParentalProfile {
  // ... existing fields ...
  digestEnabled     Boolean  @default(false)
  digestEmail       String?
  digestDay         Int      @default(1)  // 0=Sunday, 1=Monday, ..., 6=Saturday
  lastDigestSentAt  DateTime?
}
```

Migration: `npx prisma migrate dev --name add-digest-fields`

#### Digest Content

The digest aggregates data from `ActivityLog` for the past 7 days (same as `GET /api/parents/actividad/:userId/detalle`). It includes:

1. **Usage summary**: Total time (minutes), sessions per day, average daily time.
2. **Content breakdown**: News read count, reels watched count, quizzes played count.
3. **Top sports**: Sorted by activity count.
4. **Quiz performance**: Total questions answered, correct %, perfect quizzes count (from `User.quizPerfectCount`).
5. **Moderation summary**: Count of rejected news items that week (query `NewsItem` where `safetyStatus = 'rejected'` and `moderatedAt` in range). Shows "X inappropriate articles were automatically blocked."
6. **Streak info**: Current streak, longest streak.

#### API Changes

**New service**: `apps/api/src/services/digest-generator.ts`

```typescript
export interface DigestData {
  userName: string;
  period: { from: string; to: string };
  totalMinutes: number;
  dailyAverage: number;
  byType: { news_viewed: number; reels_viewed: number; quizzes_played: number };
  topSports: Array<{ sport: string; count: number }>;
  quizPerformance: { total: number; correctPercent: number; perfectCount: number };
  moderationBlocked: number;
  streak: { current: number; longest: number };
}

export async function generateDigestData(userId: string): Promise<DigestData>;
export function renderDigestHtml(data: DigestData, locale: Locale): string;
export function renderDigestPdf(data: DigestData, locale: Locale): Promise<Buffer>;
```

**PDF generation**: Use `jspdf` (npm package `jspdf@2`) server-side. It runs in Node without browser dependencies. The PDF is a single A4 page with the SportyKids logo, child's name, period, and a formatted table/summary of the digest data. Keep it simple — no charts in PDF, just formatted text and numbers.

**Email delivery**: Use `nodemailer` with SMTP config from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). If SMTP is not configured, digest is available as PDF download only (no error, just skip email).

**New endpoints** (add to `apps/api/src/routes/parents.ts`):

| Method | Route | Description |
|--------|-------|-------------|
| PUT | `/api/parents/digest/:userId` | Update digest preferences (enabled, email, day) |
| GET | `/api/parents/digest/:userId` | Get digest preferences |
| GET | `/api/parents/digest/:userId/preview` | Generate and return digest data as JSON (for UI preview) |
| GET | `/api/parents/digest/:userId/download` | Generate and return PDF (Content-Type: application/pdf) |

Zod schema for PUT:
```typescript
const digestSchema = z.object({
  digestEnabled: z.boolean().optional(),
  digestEmail: z.string().email().optional().nullable(),
  digestDay: z.number().int().min(0).max(6).optional(),
});
```

**Cron job**: New file `apps/api/src/jobs/send-weekly-digests.ts`. Runs daily at 08:00 UTC. Queries all `ParentalProfile` where `digestEnabled = true` and `digestDay` matches today's day of week. For each, generates digest and sends email (if email configured) or skips. Updates `lastDigestSentAt`.

Register in `apps/api/src/index.ts` alongside existing cron jobs.

#### UI Changes — Parental Panel

Add a new tab `'digest'` to the `TABS` array in `apps/web/src/components/ParentalPanel.tsx`:

```typescript
type Tab = 'profile' | 'content' | 'restrictions' | 'activity' | 'digest' | 'pin';
```

```
+------------------------------------------------------------------+
| Digest tab                                                        |
+------------------------------------------------------------------+
|                                                                    |
|  Weekly Digest                                                     |
|  ──────────────────────────────────────                            |
|                                                                    |
|  [ ] Enable weekly digest                                          |
|                                                                    |
|  Email (optional):                                                 |
|  +--------------------------------------------+                    |
|  | parent@email.com                            |                   |
|  +--------------------------------------------+                    |
|                                                                    |
|  Send on:                                                          |
|  [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]                        |
|   ^^^                                                              |
|  (selected)                                                        |
|                                                                    |
|  +--------------------------------------------+                    |
|  |        Preview this week's digest           |                   |
|  +--------------------------------------------+                    |
|                                                                    |
|  +--------------------------------------------+                    |
|  |        Download PDF                         |                   |
|  +--------------------------------------------+                    |
|                                                                    |
|  Note: If no email is provided, digest is                          |
|  available as PDF download only.                                   |
+------------------------------------------------------------------+
```

#### i18n Keys

Add to `packages/shared/src/i18n/es.json` and `en.json`:

```
"digest.title": "Resumen semanal" / "Weekly Digest"
"digest.enable": "Activar resumen semanal" / "Enable weekly digest"
"digest.email_label": "Email (opcional)" / "Email (optional)"
"digest.email_placeholder": "padre@email.com" / "parent@email.com"
"digest.send_on": "Enviar el" / "Send on"
"digest.preview": "Vista previa del resumen" / "Preview this week's digest"
"digest.download_pdf": "Descargar PDF" / "Download PDF"
"digest.no_email_note": "Sin email, el resumen estará disponible como PDF." / "Without email, digest is available as PDF download."
"digest.subject": "Resumen semanal de {name} en SportyKids" / "{name}'s weekly SportyKids digest"
"digest.blocked_count": "{count} artículos inapropiados fueron bloqueados automáticamente" / "{count} inappropriate articles were automatically blocked"
```

#### Acceptance Criteria

- [ ] `ParentalProfile` has `digestEnabled`, `digestEmail`, `digestDay`, `lastDigestSentAt` fields after migration
- [ ] `PUT /api/parents/digest/:userId` validates email format with Zod, saves preferences
- [ ] `GET /api/parents/digest/:userId` returns current digest preferences
- [ ] `GET /api/parents/digest/:userId/preview` returns `DigestData` JSON with correct 7-day aggregation
- [ ] `GET /api/parents/digest/:userId/download` returns a valid PDF file with correct Content-Type header
- [ ] PDF includes: child name, period, usage summary, content breakdown, top sports, quiz performance, moderation count, streak
- [ ] Cron job runs daily at 08:00 UTC, sends emails only on matching `digestDay`
- [ ] If SMTP env vars are missing, digest generation still works (PDF download) without errors
- [ ] Digest tab appears in ParentalPanel with toggle, email input, day selector, preview and download buttons
- [ ] All UI strings use i18n keys

---

### B-PT2: "See What My Kid Sees" Mode

#### Problem

Parents set restrictions but cannot verify what the child's feed actually looks like. They want a one-click preview.

#### Approach

No new data models. The parental panel renders the same feed components (`NewsCard`, `ReelCard`) but fetches data using the child's `userId` (which applies `parental-guard.ts` restrictions server-side). This is a read-only preview — no activity is logged.

#### API Changes

Add a query parameter `preview=true` to existing endpoints. When `preview=true` is present, the activity logging in `apps/api/src/routes/parents.ts` POST `/actividad/registrar` is skipped. The existing `GET /api/news`, `GET /api/reels`, and `GET /api/quiz/questions` endpoints already accept `userId` and apply parental guard — no backend changes needed for filtering.

Add one convenience endpoint:

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/parents/preview/:userId` | Returns `{ news: NewsItem[], reels: Reel[], quizAvailable: boolean }` — a single call that fetches the top 5 news items, top 3 reels, and whether quiz is available, all filtered through the child's parental restrictions. |

Implementation in `apps/api/src/routes/parents.ts`:
```typescript
router.get('/preview/:userId', async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const profile = await prisma.parentalProfile.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!profile || !user) { res.status(404).json({ error: 'Not found' }); return; }

  const allowedFormats = JSON.parse(profile.allowedFormats || '[]');
  const allowedSports = JSON.parse(profile.allowedSports || '[]');
  const favoriteSports = JSON.parse(user.favoriteSports || '[]');

  // Fetch news if format allowed
  let news: any[] = [];
  if (allowedFormats.includes('news')) {
    const sportFilter = allowedSports.length > 0
      ? { sport: { in: allowedSports } }
      : (favoriteSports.length > 0 ? { sport: { in: favoriteSports } } : {});
    news = await prisma.newsItem.findMany({
      where: { safetyStatus: 'approved', ...sportFilter },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });
  }

  // Fetch reels if format allowed
  let reels: any[] = [];
  if (allowedFormats.includes('reels')) {
    reels = await prisma.reel.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }

  const quizAvailable = allowedFormats.includes('quiz');

  res.json({ news, reels, quizAvailable });
});
```

#### UI — ParentalPanel

Add a "Preview" button to the `profile` tab (or as a floating button). Clicking it opens a modal/overlay that renders the child's feed.

```
+------------------------------------------------------------------+
| Parental Panel > Profile tab                                      |
+------------------------------------------------------------------+
|                                                                    |
|  [... existing profile content ...]                                |
|                                                                    |
|  +--------------------------------------------+                    |
|  |  [EYE ICON]  See what {name} sees          |                   |
|  +--------------------------------------------+                    |
|                                                                    |
+------------------------------------------------------------------+

           Clicking opens:

+------------------------------------------------------------------+
|  [X Close]          Preview: {name}'s Feed                        |
+------------------------------------------------------------------+
|                                                                    |
|  This is exactly what your child sees with                         |
|  current restrictions applied.                                     |
|                                                                    |
|  NEWS (5)                                                          |
|  +---------------------------+  +---------------------------+      |
|  | [img]                     |  | [img]                     |      |
|  | Title of news article     |  | Title of news article     |      |
|  | Source · 2h ago            |  | Source · 5h ago            |     |
|  +---------------------------+  +---------------------------+      |
|  [... more cards ...]                                              |
|                                                                    |
|  REELS (3)                                                         |
|  +----------+  +----------+  +----------+                          |
|  | [thumb]  |  | [thumb]  |  | [thumb]  |                         |
|  | Title    |  | Title    |  | Title    |                         |
|  +----------+  +----------+  +----------+                          |
|                                                                    |
|  QUIZ: Available / Blocked                                         |
|                                                                    |
+------------------------------------------------------------------+
```

New component: `apps/web/src/components/FeedPreviewModal.tsx`

```typescript
interface FeedPreviewModalProps {
  userId: string;
  userName: string;
  locale: Locale;
  onClose: () => void;
}
```

This component calls `GET /api/parents/preview/:userId` and renders existing `NewsCard` and `ReelCard` components in a grid inside a modal overlay. The modal has `position: fixed`, `inset: 0`, `z-index: 60`, `overflow-y: auto`, white background.

#### i18n Keys

```
"preview.title": "Vista previa: feed de {name}" / "Preview: {name}'s feed"
"preview.description": "Esto es exactamente lo que ve tu hijo/a con las restricciones actuales." / "This is exactly what your child sees with current restrictions."
"preview.button": "Ver lo que ve {name}" / "See what {name} sees"
"preview.quiz_available": "Quiz: Disponible" / "Quiz: Available"
"preview.quiz_blocked": "Quiz: Bloqueado" / "Quiz: Blocked"
"preview.no_content": "No hay contenido con las restricciones actuales." / "No content with current restrictions."
```

#### Acceptance Criteria

- [ ] `GET /api/parents/preview/:userId` returns news, reels, and quiz availability filtered by parental restrictions
- [ ] Preview button appears in the Profile tab of ParentalPanel
- [ ] Clicking the button opens a modal showing the child's feed using real `NewsCard` and `ReelCard` components
- [ ] No activity is logged when viewing the preview
- [ ] Modal is scrollable and has a close button
- [ ] If no content is available (all formats blocked or no matching sport), shows empty state message
- [ ] All strings use i18n keys

---

### B-PT3: Granular Time Limits (Per Content Type)

#### Problem

Currently `ParentalProfile.maxDailyTimeMinutes` is a single limit for all content. Parents want separate limits: "30 min news, 15 min reels, 10 min quiz."

#### Data Model Changes

Add fields to `ParentalProfile` in `apps/api/prisma/schema.prisma`:

```prisma
model ParentalProfile {
  // ... existing fields ...
  maxDailyTimeMinutes    Int    @default(60)  // keep as global fallback
  maxNewsMinutes         Int?   // null = no specific limit, use global
  maxReelsMinutes        Int?
  maxQuizMinutes         Int?
}
```

Migration: `npx prisma migrate dev --name add-granular-time-limits`

#### Shared Types

Update `ParentalProfile` in `packages/shared/src/types/index.ts`:

```typescript
export interface ParentalProfile {
  userId: string;
  allowedSports: string[];
  allowedFeeds: string[];
  allowedFormats: ('news' | 'reels' | 'quiz')[];
  maxDailyTimeMinutes?: number;
  maxNewsMinutes?: number | null;
  maxReelsMinutes?: number | null;
  maxQuizMinutes?: number | null;
}
```

#### Backend — parental-guard.ts

Update `apps/api/src/middleware/parental-guard.ts` to check per-content-type limits. The cached profile interface changes:

```typescript
interface CachedProfile {
  allowedFormats: string;
  allowedSports: string;
  maxDailyTimeMinutes: number | null;
  maxNewsMinutes: number | null;
  maxReelsMinutes: number | null;
  maxQuizMinutes: number | null;
}
```

Time limit check logic (replaces existing step 6):

```typescript
// 6. Check time limits
// Determine which limit applies based on format
let applicableLimit: number | null = null;
if (format === 'news' && profile.maxNewsMinutes !== null) {
  applicableLimit = profile.maxNewsMinutes;
} else if (format === 'reels' && profile.maxReelsMinutes !== null) {
  applicableLimit = profile.maxReelsMinutes;
} else if (format === 'quiz' && profile.maxQuizMinutes !== null) {
  applicableLimit = profile.maxQuizMinutes;
}

// Fall back to global limit if no per-type limit is set
if (applicableLimit === null) {
  applicableLimit = profile.maxDailyTimeMinutes;
}

if (applicableLimit && applicableLimit > 0) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Map format to activity log type
  const typeMap: Record<string, string> = {
    news: 'news_viewed',
    reels: 'reels_viewed',
    quiz: 'quizzes_played',
  };

  const typeFilter = format && typeMap[format] ? { type: typeMap[format] } : {};

  const aggregation = await prisma.activityLog.aggregate({
    _sum: { durationSeconds: true },
    where: { userId, createdAt: { gte: todayStart }, ...typeFilter },
  });

  const totalSeconds = aggregation._sum.durationSeconds ?? 0;
  const limitSeconds = applicableLimit * 60;

  if (totalSeconds >= limitSeconds) {
    res.status(403).json({
      error: 'limit_reached',
      message: `Daily time limit reached for ${format || 'all content'}`,
      format,
      limit: applicableLimit,
      used: Math.round(totalSeconds / 60),
    });
    return;
  }
}
```

#### Backend — parents.ts

Update the `updateSchema` and `configureSchema` in `apps/api/src/routes/parents.ts` to accept the new fields:

```typescript
const updateSchema = z.object({
  allowedSports: z.array(z.string()).optional(),
  allowedFormats: z.array(z.enum(['news', 'reels', 'quiz'])).optional(),
  maxDailyTimeMinutes: z.number().int().min(0).max(480).optional(),
  maxNewsMinutes: z.number().int().min(0).max(480).optional().nullable(),
  maxReelsMinutes: z.number().int().min(0).max(480).optional().nullable(),
  maxQuizMinutes: z.number().int().min(0).max(480).optional().nullable(),
});
```

Update `formatProfile()` to include the new fields.

#### UI — ParentalPanel Restrictions Tab

Replace the single time slider with three sliders. Keep the global limit as a "Total" option.

```
+------------------------------------------------------------------+
| Restrictions tab                                                  |
+------------------------------------------------------------------+
|                                                                    |
|  Allowed formats                                                   |
|  [News: ON] [Reels: ON] [Quiz: ON]                                |
|                                                                    |
|  ──────────────────────────────────────                            |
|                                                                    |
|  Time limits                                                       |
|                                                                    |
|  Total daily limit:                                                |
|  [15] [30] [60] [90] [120] [No limit]                              |
|                       ^^^^                                         |
|                     (selected)                                     |
|                                                                    |
|  Or set per content type:                                          |
|                                                                    |
|  News limit:          [────────●────────] 30 min                   |
|  Reels limit:         [──────●──────────] 15 min                   |
|  Quiz limit:          [────────────●────] 45 min                   |
|                                                                    |
|  Tip: Per-type limits override the total limit.                    |
|  Set to 0 for no limit on that type.                               |
|                                                                    |
+------------------------------------------------------------------+
```

Each slider is an `<input type="range" min="0" max="120" step="5">` with the current value displayed beside it. Value 0 means "no specific limit" (null in DB, falls back to global).

#### i18n Keys

```
"restrictions.time_limits": "Límites de tiempo" / "Time limits"
"restrictions.total_limit": "Límite diario total" / "Total daily limit"
"restrictions.per_type": "O establece por tipo de contenido:" / "Or set per content type:"
"restrictions.news_limit": "Límite de noticias" / "News limit"
"restrictions.reels_limit": "Límite de reels" / "Reels limit"
"restrictions.quiz_limit": "Límite de quiz" / "Quiz limit"
"restrictions.per_type_tip": "Los límites por tipo prevalecen sobre el total. Pon 0 para sin límite." / "Per-type limits override the total. Set 0 for no limit."
"restrictions.minutes": "{n} min" / "{n} min"
"restrictions.no_specific_limit": "Sin límite específico" / "No specific limit"
```

#### Acceptance Criteria

- [ ] `ParentalProfile` schema has `maxNewsMinutes`, `maxReelsMinutes`, `maxQuizMinutes` fields (nullable integers)
- [ ] `PUT /api/parents/perfil/:userId` accepts and saves per-type limits
- [ ] `parental-guard.ts` checks per-type limit first; falls back to global `maxDailyTimeMinutes` if per-type is null
- [ ] When per-type limit is exceeded, response includes `format` field indicating which type hit the limit
- [ ] Restrictions tab shows three range sliders for per-type limits
- [ ] Setting a slider to 0 sends `null` to the API (no specific limit)
- [ ] Profile cache in `parental-guard.ts` includes new fields and invalidates correctly
- [ ] `LimitReached` component (`apps/web/src/components/LimitReached.tsx`) displays which content type hit its limit
- [ ] All strings use i18n keys

---

### B-PT5: Content Report Button (for Kids)

#### Problem

Kids may encounter content that passed automated moderation but is still inappropriate or confusing. They need a simple way to flag it.

#### Data Model

New model in `apps/api/prisma/schema.prisma`:

```prisma
model ContentReport {
  id          String   @id @default(cuid())
  userId      String
  contentType String   // 'news' | 'reel'
  contentId   String
  reason      String   // 'inappropriate' | 'scary' | 'confusing' | 'other'
  comment     String?  // optional free-text (max 200 chars)
  status      String   @default("pending")  // 'pending' | 'reviewed' | 'dismissed'
  reviewedAt  DateTime?
  createdAt   DateTime @default(now())

  @@index([userId, contentType])
  @@index([status])
}
```

Migration: `npx prisma migrate dev --name add-content-report`

#### Shared Types

Add to `packages/shared/src/types/index.ts`:

```typescript
export type ReportReason = 'inappropriate' | 'scary' | 'confusing' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface ContentReport {
  id: string;
  userId: string;
  contentType: 'news' | 'reel';
  contentId: string;
  reason: ReportReason;
  comment?: string;
  status: ReportStatus;
  reviewedAt?: string;
  createdAt: string;
}
```

#### API Endpoints

New route file: `apps/api/src/routes/reports.ts` (mounted at `/api/reports`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/reports` | Submit a content report |
| GET | `/api/reports/parent/:userId` | Get all reports from a child (for parental review) |
| PUT | `/api/reports/:reportId` | Update report status (parent marks as reviewed/dismissed) |

```typescript
// POST /api/reports
const reportSchema = z.object({
  userId: z.string(),
  contentType: z.enum(['news', 'reel']),
  contentId: z.string(),
  reason: z.enum(['inappropriate', 'scary', 'confusing', 'other']),
  comment: z.string().max(200).optional(),
});

// GET /api/reports/parent/:userId — returns reports with content title
// Joins with NewsItem or Reel to include content title

// PUT /api/reports/:reportId
const updateReportSchema = z.object({
  status: z.enum(['reviewed', 'dismissed']),
});
```

Register in `apps/api/src/index.ts`:
```typescript
import reportRoutes from './routes/reports';
app.use('/api/reports', reportRoutes);
```

#### UI — Kid-facing Report Button

Add a flag icon button to `NewsCard` (`apps/web/src/components/NewsCard.tsx`) and `ReelCard` (`apps/web/src/components/ReelCard.tsx`).

**NewsCard** — add next to the "Read more" and "Explain easy" buttons:

```
+------------------------------------------------------------------+
| NewsCard                                                          |
+------------------------------------------------------------------+
| [image]                                                           |
| Title of the news article                                         |
| Summary text...                                                   |
|                                                                    |
| Source · 2h ago                           Real Madrid             |
|                                                                    |
| [  Read more  ] [ Explain easy ] [ FLAG ]                          |
+------------------------------------------------------------------+
```

**ReelCard** — add a flag icon next to the like/share buttons:

```
+------------------------------------------------------------------+
| ReelCard                                                          |
+------------------------------------------------------------------+
| [video thumbnail]                                                 |
| Title                                                              |
| Source · Team                        [HEART] [SHARE] [FLAG]       |
+------------------------------------------------------------------+
```

Clicking the FLAG button opens a small inline dropdown (not a modal — keep it lightweight for kids):

```
+---------------------------+
| Why are you reporting?    |
+---------------------------+
| [SAD]  Inappropriate      |
| [SCARED] Scary            |
| [?]  Confusing            |
| [...]  Other              |
+---------------------------+
| [Send report]             |
+---------------------------+
```

New component: `apps/web/src/components/ReportButton.tsx`

```typescript
interface ReportButtonProps {
  contentType: 'news' | 'reel';
  contentId: string;
  locale: Locale;
}
```

State: `idle` -> `selecting` (dropdown open) -> `sending` -> `sent` (shows checkmark for 2s, then back to idle). Use `useUser()` to get `userId`. After sending, button shows a green checkmark briefly.

Add API client function in `apps/web/src/lib/api.ts`:

```typescript
export async function submitReport(data: {
  userId: string;
  contentType: 'news' | 'reel';
  contentId: string;
  reason: string;
  comment?: string;
}): Promise<void>;
```

#### UI — Parental Review

Add a "Reports" section to the Activity tab in `ParentalPanel`. Fetches `GET /api/reports/parent/:userId`.

```
+------------------------------------------------------------------+
| Activity tab (existing content above)                             |
+------------------------------------------------------------------+
|                                                                    |
|  Content Reports (3 pending)                                       |
|  ──────────────────────────────────────                            |
|                                                                    |
|  [FLAG] "Messi transfer rumors shock fans"                         |
|         Reason: Confusing · 2 hours ago                            |
|         [Mark reviewed] [Dismiss]                                  |
|                                                                    |
|  [FLAG] "Champions League highlights"                              |
|         Reason: Scary · 1 day ago                                  |
|         [Mark reviewed] [Dismiss]                                  |
|                                                                    |
|  [CHECK] "Basketball dunk compilation"                             |
|          Reviewed · 3 days ago                                     |
|                                                                    |
+------------------------------------------------------------------+
```

New component: `apps/web/src/components/ContentReportList.tsx`

```typescript
interface ContentReportListProps {
  userId: string;
  locale: Locale;
}
```

#### Mobile

Add `ReportButton` to mobile `NewsCard` and screen components. Same API call, same behavior. Place in `apps/mobile/src/components/ReportButton.tsx`.

#### i18n Keys

```
"report.flag": "Reportar" / "Report"
"report.why": "¿Por qué reportas esto?" / "Why are you reporting this?"
"report.inappropriate": "Inapropiado" / "Inappropriate"
"report.scary": "Da miedo" / "Scary"
"report.confusing": "Confuso" / "Confusing"
"report.other": "Otro" / "Other"
"report.send": "Enviar reporte" / "Send report"
"report.sent": "Reporte enviado" / "Report sent"
"report.title": "Reportes de contenido" / "Content Reports"
"report.pending_count": "{count} pendientes" / "{count} pending"
"report.mark_reviewed": "Marcar revisado" / "Mark reviewed"
"report.dismiss": "Descartar" / "Dismiss"
"report.reviewed": "Revisado" / "Reviewed"
"report.dismissed": "Descartado" / "Dismissed"
```

#### Acceptance Criteria

- [ ] `ContentReport` model exists in Prisma schema with correct fields and indexes
- [ ] `POST /api/reports` validates input with Zod and creates a report
- [ ] `POST /api/reports` rejects duplicate reports from same user for same content (unique constraint or check)
- [ ] `GET /api/reports/parent/:userId` returns reports with content title (joined from NewsItem/Reel)
- [ ] `PUT /api/reports/:reportId` updates status to `reviewed` or `dismissed`
- [ ] Flag button appears on every `NewsCard` and `ReelCard`
- [ ] Clicking flag shows inline reason selector (not a full modal)
- [ ] After submitting, button shows confirmation for 2 seconds
- [ ] Reports section appears in Activity tab of ParentalPanel
- [ ] Parent can mark reports as reviewed or dismiss them
- [ ] Mobile `ReportButton` component works identically
- [ ] All strings use i18n keys
- [ ] Rate limit: max 10 reports per user per day (check in API)

---

### B-TF3: Authentication (JWT + Social Login)

#### Problem

Currently users are identified by a `cuid` stored in localStorage/AsyncStorage. There is no account creation, no login, no session management, and no way to recover access or link parent to child.

#### Recommended Approach: NextAuth.js (web) + Expo AuthSession (mobile)

**Why not Clerk/Auth0**: They add external dependencies and cost. NextAuth.js is open-source, runs on our own infra, and supports all required providers out of the box. For mobile, Expo AuthSession handles OAuth flows natively.

#### Data Model Changes

Update `User` model in `apps/api/prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields ...
  email             String?   @unique
  authProvider      String?   // 'google' | 'microsoft' | 'facebook' | 'apple' | 'email'
  authProviderId    String?   // provider's unique user ID
  role              String    @default("child")  // 'child' | 'parent'
  parentUserId      String?   // links child to parent's User record
  parentUser        User?     @relation("ParentChild", fields: [parentUserId], references: [id])
  children          User[]    @relation("ParentChild")
  refreshToken      String?
  lastLoginAt       DateTime?

  @@unique([authProvider, authProviderId])
}
```

New model for JWT refresh tokens:

```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([expiresAt])
}
```

Add relation to User: `refreshTokens RefreshToken[]`

Migration: `npx prisma migrate dev --name add-auth-fields`

#### Auth Flow

```
Parent creates account (social login)
  -> Parent account created (role: 'parent')
  -> Parent creates child profile (role: 'child', parentUserId: parent.id)
  -> Child gets simple PIN-less access via parent's session

OR (backward compatible)

Anonymous user from existing flow
  -> User continues with existing ID (no auth)
  -> Later, parent can "claim" this profile by linking it
```

#### JWT Implementation

New file: `apps/api/src/services/auth-service.ts`

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

export interface JwtPayload {
  userId: string;
  role: 'child' | 'parent';
  parentUserId?: string;
}

export function generateAccessToken(payload: JwtPayload): string;
export function generateRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }>;
export function verifyAccessToken(token: string): JwtPayload | null;
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null>;
export async function revokeRefreshToken(token: string): Promise<void>;
```

#### Auth Middleware

Update `apps/api/src/middleware/auth.ts` (replace the single-comment placeholder):

```typescript
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Backward compatibility: if no auth header but userId in query/header, allow (anonymous mode)
  if (!authHeader) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'invalid_token', message: 'Access token is invalid or expired' });
    return;
  }

  // Attach user info to request
  (req as any).auth = payload;
  next();
}

// Strict version — rejects unauthenticated requests
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).auth) {
    res.status(401).json({ error: 'auth_required', message: 'Authentication required' });
    return;
  }
  next();
}

// Role check
export function requireRole(role: 'parent' | 'child') {
  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).auth?.role !== role) {
      res.status(403).json({ error: 'forbidden', message: `Requires ${role} role` });
      return;
    }
    next();
  };
}
```

Apply `authMiddleware` globally in `apps/api/src/index.ts` (non-blocking, just attaches if present). Apply `requireAuth` only on sensitive routes (parental endpoints, digest download).

#### Auth Routes

New file: `apps/api/src/routes/auth.ts` (mounted at `/api/auth`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/social` | Exchange social provider token for JWT |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Get current user from JWT |
| POST | `/api/auth/link-child` | Parent links an existing anonymous child profile |

`POST /api/auth/social` body:
```typescript
{
  provider: 'google' | 'microsoft' | 'facebook' | 'apple';
  providerToken: string;  // ID token from social provider
  providerUserId: string;
  email: string;
  name: string;
}
```

This endpoint verifies the provider token (provider-specific validation), finds or creates the User, and returns `{ accessToken, refreshToken, user }`.

`POST /api/auth/link-child` body:
```typescript
{
  childUserId: string;  // existing anonymous user ID
}
```

This sets `parentUserId` on the child and `role` to `'child'`. Only callable by authenticated parent.

#### Web Integration (NextAuth.js)

Install: `npm install next-auth@5` in `apps/web/`.

Config file: `apps/web/src/app/api/auth/[...nextauth]/route.ts`

Providers: Google, Microsoft (Azure AD), Facebook, Apple. Each requires env vars:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`

The NextAuth callback exchanges the social token with our API (`POST /api/auth/social`) and stores the JWT in the NextAuth session.

#### Mobile Integration (Expo AuthSession)

In `apps/mobile/src/lib/auth.ts`:

```typescript
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

export function useGoogleAuth() { /* ... */ }
export function useMicrosoftAuth() { /* ... */ }
export function useAppleAuth() { /* ... */ }  // iOS only
export function useFacebookAuth() { /* ... */ }
```

Each hook returns `{ signIn, loading }`. On success, calls `POST /api/auth/social` and stores tokens in `AsyncStorage`.

#### Login Screen

New screen for both web and mobile:

```
+------------------------------------------------------------------+
|                                                                    |
|               [LOGO]  SportyKids                                   |
|                                                                    |
|          The sports news app for kids!                              |
|                                                                    |
|  +--------------------------------------------+                    |
|  | [G]  Continue with Google                   |                   |
|  +--------------------------------------------+                    |
|  +--------------------------------------------+                    |
|  | [M]  Continue with Microsoft                |                   |
|  +--------------------------------------------+                    |
|  +--------------------------------------------+                    |
|  | [F]  Continue with Facebook                 |                   |
|  +--------------------------------------------+                    |
|  +--------------------------------------------+                    |
|  | [A]  Continue with Apple                    |                   |
|  +--------------------------------------------+                    |
|                                                                    |
|  ─────────── or ───────────                                        |
|                                                                    |
|  +--------------------------------------------+                    |
|  |  Continue without account                   |                   |
|  +--------------------------------------------+                    |
|                                                                    |
|  Parents: Create an account with YOUR social                       |
|  account, then set up your child's profile.                        |
|                                                                    |
+------------------------------------------------------------------+
```

Web: `apps/web/src/app/login/page.tsx`
Mobile: `apps/mobile/src/screens/Login.tsx`

#### Backward Compatibility

- Existing anonymous users continue to work. The `authMiddleware` is non-blocking by default.
- When a parent creates an account and links a child, the child's existing data (stickers, achievements, activity logs) is preserved.
- The "Continue without account" option runs the existing onboarding flow (no auth).

#### Env Vars

Add to `.env.example`:
```
JWT_SECRET=change-me-in-production
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
```

#### i18n Keys

```
"auth.login_title": "Iniciar sesión" / "Sign in"
"auth.continue_google": "Continuar con Google" / "Continue with Google"
"auth.continue_microsoft": "Continuar con Microsoft" / "Continue with Microsoft"
"auth.continue_facebook": "Continuar con Facebook" / "Continue with Facebook"
"auth.continue_apple": "Continuar con Apple" / "Continue with Apple"
"auth.continue_anonymous": "Continuar sin cuenta" / "Continue without account"
"auth.parent_note": "Padres: crea una cuenta con TU red social, luego configura el perfil de tu hijo/a." / "Parents: Create an account with YOUR social account, then set up your child's profile."
"auth.link_child": "Vincular perfil existente" / "Link existing profile"
"auth.logout": "Cerrar sesión" / "Sign out"
```

#### Acceptance Criteria

- [ ] `User` model has `email`, `authProvider`, `authProviderId`, `role`, `parentUserId`, `lastLoginAt` fields
- [ ] `RefreshToken` model exists with `token`, `userId`, `expiresAt`
- [ ] `POST /api/auth/social` creates/finds user and returns JWT + refresh token
- [ ] `POST /api/auth/refresh` issues new access token from valid refresh token
- [ ] `POST /api/auth/logout` revokes refresh token
- [ ] `GET /api/auth/me` returns current user from JWT
- [ ] `POST /api/auth/link-child` links anonymous child to parent (requires parent role)
- [ ] `authMiddleware` is non-blocking (anonymous users still work)
- [ ] `requireAuth` middleware rejects unauthenticated requests with 401
- [ ] NextAuth.js configured with Google, Microsoft, Facebook, Apple providers
- [ ] Mobile uses Expo AuthSession for all 4 providers
- [ ] Login screen exists on web and mobile with all provider buttons + anonymous option
- [ ] JWT access tokens expire in 15 minutes, refresh tokens in 7 days
- [ ] Existing anonymous users can continue using the app without auth
- [ ] Parent can link an existing anonymous child profile to their account
- [ ] All strings use i18n keys

---

## Sprint 4: "Motor de retención"

---

### B-EN1: Daily Mission / Daily Challenge

#### Problem

Kids open the app but have no goal. The existing gamification (streaks, stickers) is passive. A daily mission gives a concrete, achievable target that creates a habit loop: open app -> see mission -> complete it -> earn rare sticker -> come back tomorrow.

#### Data Model

New models in `apps/api/prisma/schema.prisma`:

```prisma
model DailyMission {
  id          String   @id @default(cuid())
  userId      String
  date        String   // 'YYYY-MM-DD' format, one mission per user per day
  type        String   // mission type key (see below)
  title       String   // pre-rendered title for display
  description String   // pre-rendered description
  target      Int      // e.g., 2 (read 2 news)
  progress    Int      @default(0)
  completed   Boolean  @default(false)
  completedAt DateTime?
  rewardType  String   // 'sticker' | 'points' | 'both'
  rewardRarity String?  // sticker rarity if rewardType includes sticker
  rewardPoints Int      @default(0)
  claimed     Boolean  @default(false)  // user explicitly claimed reward
  claimedAt   DateTime?
  createdAt   DateTime @default(now())

  @@unique([userId, date])
  @@index([userId, completed])
}
```

Migration: `npx prisma migrate dev --name add-daily-mission`

#### Mission Types

The mission generator picks one mission type per day per user, adapted to their preferences:

| Type Key | Title (en) | Description | Target | Reward |
|----------|-----------|-------------|--------|--------|
| `read_news` | "News Explorer" | "Read {target} news articles" | 2-5 | rare sticker |
| `watch_reels` | "Reel Watcher" | "Watch {target} reels" | 2-4 | rare sticker |
| `quiz_master` | "Quiz Master" | "Answer {target} quiz questions correctly" | 3-5 | epic sticker |
| `quiz_perfect` | "Perfect Score" | "Get a perfect score on today's quiz" | 1 | epic sticker |
| `read_and_quiz` | "Scholar" | "Read {n} news + play quiz" | 2+1 | rare sticker + 50 pts |
| `multi_sport` | "Sports Fan" | "Read news from {target} different sports" | 2-3 | rare sticker |
| `streak_keeper` | "Streak Keeper" | "Check in today to keep your streak" | 1 | 25 pts |
| `first_report` | "Content Guardian" | "Report a confusing or inappropriate article" | 1 | common sticker |

#### Mission Generator Service

New file: `apps/api/src/services/mission-generator.ts`

```typescript
export interface MissionDefinition {
  type: string;
  titleKey: string;       // i18n key
  descriptionKey: string; // i18n key with {target} placeholder
  minTarget: number;
  maxTarget: number;
  rewardType: 'sticker' | 'points' | 'both';
  rewardRarity?: string;
  rewardPoints: number;
  weight: number;  // probability weight for selection
}

const MISSION_DEFINITIONS: MissionDefinition[] = [ /* ... as table above ... */ ];

export async function generateDailyMission(userId: string): Promise<DailyMission>;
export async function checkMissionProgress(userId: string, activityType: string, sport?: string): Promise<{
  missionUpdated: boolean;
  completed: boolean;
  mission: DailyMission | null;
}>;
export async function claimMissionReward(userId: string): Promise<{
  claimed: boolean;
  sticker: AwardedSticker | null;
  pointsAwarded: number;
}>;
```

**Generation logic** (`generateDailyMission`):
1. Check if mission already exists for today (`userId` + today's date string).
2. If exists, return it.
3. Get user preferences (favoriteSports, age).
4. Filter mission types: remove `watch_reels` if reels format is blocked, etc.
5. Weighted random selection from remaining types.
6. Pick target in [minTarget, maxTarget] range. For younger kids (6-8), use lower targets.
7. Render title and description using i18n with locale from user preferences (default 'es').
8. Create and return.

**Progress tracking** (`checkMissionProgress`):
Called from `apps/api/src/routes/parents.ts` POST `/actividad/registrar` (the existing activity logging endpoint). After logging activity, call `checkMissionProgress` to update the mission.

```typescript
// In POST /actividad/registrar handler, after existing gamification logic:
const missionResult = await checkMissionProgress(
  parsed.data.userId,
  parsed.data.type,
  parsed.data.sport,
);

res.json({
  ok: true,
  pointsAwarded: gamificationResult.pointsAwarded,
  newAchievements: gamificationResult.newAchievements,
  missionUpdate: missionResult.missionUpdated ? {
    progress: missionResult.mission?.progress,
    target: missionResult.mission?.target,
    completed: missionResult.completed,
  } : undefined,
});
```

**Progress mapping** (inside `checkMissionProgress`):

| Mission Type | Activity Type that increments | How |
|-------------|------|-----|
| `read_news` | `news_viewed` | +1 per news_viewed |
| `watch_reels` | `reels_viewed` | +1 per reels_viewed |
| `quiz_master` | `quizzes_played` | +1 per correct answer (needs answer correctness — check from quiz answer endpoint) |
| `quiz_perfect` | Special | Check after quiz completion if all answers correct |
| `read_and_quiz` | `news_viewed` + `quizzes_played` | Compound: track both, complete when both met |
| `multi_sport` | `news_viewed` | Count distinct sports from today's news_viewed logs |
| `streak_keeper` | check-in | Completed on daily check-in |
| `first_report` | report submitted | Completed on content report |

For `quiz_master` and `quiz_perfect`: Also hook into `POST /api/quiz/answer` in `apps/api/src/routes/quiz.ts`. After recording the answer, call `checkMissionProgress` with a special type.

**Reward claiming** (`claimMissionReward`):
1. Find today's mission for user where `completed = true` and `claimed = false`.
2. Award sticker via existing `awardSticker()` from `apps/api/src/services/gamification.ts`.
3. Award points via `prisma.user.update({ totalPoints: { increment } })`.
4. Set `claimed = true`, `claimedAt = now()`.
5. Return awarded sticker and points.

#### API Endpoints

Add to existing routes or new file `apps/api/src/routes/missions.ts` (mounted at `/api/missions`):

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/missions/today/:userId` | Get or generate today's mission |
| POST | `/api/missions/claim` | Claim completed mission reward |

```typescript
// GET /api/missions/today/:userId
// Returns { mission: DailyMission | null, isNew: boolean }

// POST /api/missions/claim
// Body: { userId: string }
// Returns: { claimed: boolean, sticker: {...} | null, pointsAwarded: number }
```

#### Cron Job

New file: `apps/api/src/jobs/generate-daily-missions.ts`

Runs at 05:00 UTC daily (before quiz generation at 06:00). Pre-generates missions for all active users (users with `lastActiveDate` in the last 7 days). This avoids latency on first request.

Register in `apps/api/src/index.ts`.

#### UI — MissionCard Component

New component: `apps/web/src/components/MissionCard.tsx`

```typescript
interface MissionCardProps {
  mission: DailyMission;
  locale: Locale;
  onClaim: () => void;
}
```

Placement: At the top of the Home page (`apps/web/src/app/page.tsx`), above the feed. Always visible, collapses after claiming.

```
+------------------------------------------------------------------+
| Home page                                                         |
+------------------------------------------------------------------+
|                                                                    |
|  +--------------------------------------------------------------+  |
|  |  TODAY'S MISSION                                    [STAR]   |  |
|  |                                                              |  |
|  |  "News Explorer"                                             |  |
|  |  Read 3 news articles                                        |  |
|  |                                                              |  |
|  |  [=====>-----------]  1 / 3                                  |  |
|  |                                                              |  |
|  |  Reward: Rare sticker                                        |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  [Feed content below...]                                           |
|                                                                    |
+------------------------------------------------------------------+

When completed but not claimed:

+--------------------------------------------------------------+
|  TODAY'S MISSION                               COMPLETED!     |
|                                                               |
|  "News Explorer"                                              |
|  Read 3 news articles                                         |
|                                                               |
|  [=============================]  3 / 3                       |
|                                                               |
|  +----------------------------------------------+             |
|  |  [STAR]  Claim your rare sticker!            |            |
|  +----------------------------------------------+             |
+--------------------------------------------------------------+

After claiming:

+--------------------------------------------------------------+
|  MISSION COMPLETE!  +25 pts  [Rare sticker image]             |
|  Come back tomorrow for a new challenge!                      |
+--------------------------------------------------------------+
```

Styling:
- Uncompleted: `bg-blue-50 border border-blue-200`
- Completed unclaimed: `bg-yellow-50 border border-yellow-300` with pulse animation on claim button
- Claimed: `bg-green-50 border border-green-200`, auto-collapses after 5 seconds

Progress bar: `bg-gray-200` track, `bg-[var(--color-blue)]` fill, width proportional to `progress/target`.

#### Mobile MissionCard

`apps/mobile/src/components/MissionCard.tsx` — same logic, React Native styling. Placed at top of HomeFeed screen.

#### i18n Keys

```
"mission.today": "Misión del día" / "Today's Mission"
"mission.completed": "¡Completada!" / "Completed!"
"mission.claim": "¡Reclama tu recompensa!" / "Claim your reward!"
"mission.claimed": "¡Misión completada!" / "Mission complete!"
"mission.come_back": "¡Vuelve mañana para un nuevo reto!" / "Come back tomorrow for a new challenge!"
"mission.reward_sticker": "Recompensa: Sticker {rarity}" / "Reward: {rarity} sticker"
"mission.reward_points": "Recompensa: {points} puntos" / "Reward: {points} points"
"mission.progress": "{current} / {target}" / "{current} / {target}"
"mission.read_news": "Explorador de noticias" / "News Explorer"
"mission.read_news_desc": "Lee {target} noticias" / "Read {target} news articles"
"mission.watch_reels": "Fan de reels" / "Reel Watcher"
"mission.watch_reels_desc": "Mira {target} reels" / "Watch {target} reels"
"mission.quiz_master": "Maestro del quiz" / "Quiz Master"
"mission.quiz_master_desc": "Responde {target} preguntas correctamente" / "Answer {target} quiz questions correctly"
"mission.quiz_perfect": "Puntuación perfecta" / "Perfect Score"
"mission.quiz_perfect_desc": "Consigue un quiz perfecto hoy" / "Get a perfect score on today's quiz"
"mission.read_and_quiz": "Erudito" / "Scholar"
"mission.read_and_quiz_desc": "Lee {n} noticias y juega al quiz" / "Read {n} news + play quiz"
"mission.multi_sport": "Fan deportivo" / "Sports Fan"
"mission.multi_sport_desc": "Lee noticias de {target} deportes diferentes" / "Read news from {target} different sports"
"mission.streak_keeper": "Guardián de la racha" / "Streak Keeper"
"mission.streak_keeper_desc": "Haz check-in hoy para mantener tu racha" / "Check in today to keep your streak"
"mission.first_report": "Guardián del contenido" / "Content Guardian"
"mission.first_report_desc": "Reporta un artículo confuso o inapropiado" / "Report a confusing or inappropriate article"
```

#### Acceptance Criteria

- [ ] `DailyMission` model exists with correct fields, unique constraint on `[userId, date]`
- [ ] `GET /api/missions/today/:userId` returns or generates today's mission
- [ ] Mission generation selects type based on user preferences and filters blocked formats
- [ ] Younger kids (6-8) get lower targets
- [ ] `checkMissionProgress` is called from activity logging endpoint and updates mission progress
- [ ] `checkMissionProgress` is called from quiz answer endpoint for quiz-related missions
- [ ] `POST /api/missions/claim` awards sticker and/or points, sets `claimed = true`
- [ ] Cannot claim an uncompleted or already-claimed mission
- [ ] MissionCard appears at top of Home page on web
- [ ] MissionCard shows progress bar, reward info, and claim button when completed
- [ ] After claiming, card collapses to a compact "complete" state
- [ ] Cron job pre-generates missions at 05:00 UTC for active users
- [ ] MissionCard component exists for mobile
- [ ] Activity logging response includes `missionUpdate` field when mission progress changes
- [ ] All strings use i18n keys

---

### B-MP1: Mobile Feature Parity (RSS Custom + Check-in)

#### Problem

The mobile app is missing two features that exist on web: (1) RSS catalog browser from onboarding step 4 and (2) daily check-in functionality from UserProvider.

#### RSS Catalog Browser

**Source**: `apps/web/src/components/OnboardingWizard.tsx` step 4 — renders available RSS sources, lets user toggle selections.

**Port to mobile**: New screen `apps/mobile/src/screens/RssCatalog.tsx`

The screen:
1. Fetches `GET /api/news/fuentes/catalogo` (existing endpoint).
2. Displays sources grouped by sport.
3. User can toggle sources on/off.
4. Saves selections to user profile via `PUT /api/users/:id` with `selectedFeeds`.

```
+----------------------------------+
|  < Back       RSS Sources        |
+----------------------------------+
|                                  |
|  Football (12)                   |
|  +----------------------------+  |
|  | [LOGO] AS                  |  |
|  | Noticias deportivas        |  |
|  | ES · es         [TOGGLE ON]|  |
|  +----------------------------+  |
|  +----------------------------+  |
|  | [LOGO] Marca              |  |
|  | Deportes                   |  |
|  | ES · es        [TOGGLE OFF]|  |
|  +----------------------------+  |
|                                  |
|  Basketball (5)                  |
|  +----------------------------+  |
|  | [LOGO] ESPN Basketball     |  |
|  | NBA coverage               |  |
|  | US · en         [TOGGLE ON]|  |
|  +----------------------------+  |
|                                  |
|  [  Save selections  ]          |
+----------------------------------+
```

Navigation: Add a "Manage RSS Sources" button in the user's profile/settings area. In the mobile navigation, this could be accessible from a settings icon in the Home tab header or as an item in the Parents tab.

#### Daily Check-in

**Source**: `apps/web/src/lib/user-context.tsx` — the web UserProvider calls `POST /api/gamification/check-in` on load.

**Port to mobile**: Update `apps/mobile/src/lib/user-context.tsx` to call `POST /api/gamification/check-in` when the app loads and a user is present. The logic:

```typescript
useEffect(() => {
  if (user?.id) {
    fetch(`${API_BASE}/gamification/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    .then(res => res.json())
    .then(data => {
      // Update streak info in context
      if (data.currentStreak !== undefined) {
        setUser(prev => prev ? {
          ...prev,
          currentStreak: data.currentStreak,
          longestStreak: data.longestStreak,
        } : prev);
      }
      // Show reward toast if sticker awarded
      if (data.dailyStickerAwarded) {
        // Show toast/alert
      }
    })
    .catch(() => { /* silent fail */ });
  }
}, [user?.id]);
```

Also port the `StreakCounter` component: `apps/mobile/src/components/StreakCounter.tsx` — shows current streak, flame icon, days count. Place it in the HomeFeed header.

#### Acceptance Criteria

- [ ] `RssCatalog` screen exists at `apps/mobile/src/screens/RssCatalog.tsx`
- [ ] Screen fetches and displays RSS sources grouped by sport
- [ ] User can toggle sources on/off with a Switch component
- [ ] Saving updates user's `selectedFeeds` via `PUT /api/users/:id`
- [ ] Navigation to RssCatalog is accessible from the mobile app
- [ ] Mobile UserProvider calls `POST /api/gamification/check-in` on app load
- [ ] Check-in result updates streak info in user context
- [ ] If a daily sticker is awarded on check-in, a toast/alert is shown
- [ ] `StreakCounter` component exists in mobile and appears on HomeFeed
- [ ] API_BASE uses the centralized config (fix debt: single source for API URL)

---

### B-MP5: Push Notifications (Complete)

#### Problem

`NotificationSettings` UI and `POST /api/users/:id/notifications/subscribe` exist but are stubs. Push notifications are not actually delivered.

#### Architecture

Use **Expo Push Notifications** service (free, no third-party service needed). Flow:

```
Mobile app registers for push -> Gets ExpoPushToken
  -> Sends token to API (POST /api/users/:id/notifications/subscribe)
  -> API stores token in DB
  -> When trigger fires, API sends push via Expo Push API
```

For web: Use **Web Push API** with VAPID keys. This is a secondary priority — focus on mobile first.

#### Data Model

New model in `apps/api/prisma/schema.prisma`:

```prisma
model PushToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique  // ExpoPushToken or web push subscription
  platform  String   // 'expo' | 'web'
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

Migration: `npx prisma migrate dev --name add-push-tokens`

#### API Changes

Update `POST /api/users/:id/notifications/subscribe` in `apps/api/src/routes/users.ts`:

```typescript
const subscribeSchema = z.object({
  enabled: z.boolean(),
  preferences: z.object({
    sports: z.array(z.string()),
    dailyQuiz: z.boolean(),
    teamUpdates: z.boolean(),
  }),
  pushToken: z.string().optional(),     // NEW: Expo push token
  platform: z.enum(['expo', 'web']).optional(), // NEW
});
```

When `pushToken` is provided, upsert into `PushToken` table. When `enabled = false`, set `active = false` on all user's push tokens.

#### Push Delivery Service

New file: `apps/api/src/services/push-sender.ts`

```typescript
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;  // e.g., { screen: 'quiz', newsId: '...' }
  sound?: 'default' | null;
  badge?: number;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void>;
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void>;
```

Install: `npm install expo-server-sdk` in `apps/api/`.

Implementation:
1. Query `PushToken` for user(s) where `active = true`.
2. Chunk tokens into batches of 100 (Expo limit).
3. Send via `expo.sendPushNotificationsAsync()`.
4. Handle receipts: if a token is `DeviceNotRegistered`, set `active = false`.

#### Trigger Conditions

| Trigger | When | Payload | Opt-in preference |
|---------|------|---------|-------------------|
| Quiz available | After `generate-daily-quiz.ts` cron (06:00 UTC) | "Today's quiz is ready! Test your sports knowledge." | `dailyQuiz` |
| Team news | After `sync-feeds.ts` finds new article matching user's `favoriteTeam` | "{team} news: {title}" | `teamUpdates` |
| Streak about to break | At 20:00 UTC if user hasn't checked in today and has streak >= 3 | "Don't lose your {n}-day streak! Open SportyKids now." | Always (core retention) |
| Sticker earned | After sticker is awarded (check-in, mission, achievement) | "You earned a {rarity} sticker: {name}!" | Always |
| Mission available | At 07:00 UTC | "Your daily mission is ready! Complete it for a {rarity} sticker." | `dailyQuiz` (reuse) |

#### Integration Points

1. **Quiz generation cron** (`apps/api/src/jobs/generate-daily-quiz.ts`): After generating, call `sendPushToUsers` for all users with `dailyQuiz: true`.

2. **Feed sync cron** (`apps/api/src/jobs/sync-feeds.ts`): After syncing, for each new article with a detected team, find users with that `favoriteTeam` and `teamUpdates: true`, send push.

3. **Streak reminder**: New cron job `apps/api/src/jobs/streak-reminder.ts` at 20:00 UTC. Queries users where `lastActiveDate` is yesterday, `currentStreak >= 3`, and `pushEnabled = true`. Sends reminder.

4. **Gamification service** (`apps/api/src/services/gamification.ts`): After awarding a sticker in `awardSticker`, call `sendPushToUser`.

5. **Mission generation cron**: After generating, send push.

#### Mobile Integration

In `apps/mobile/src/lib/push-notifications.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  return tokenData.data;  // 'ExponentPushToken[...]'
}

export function setupNotificationHandlers() {
  // Handle notification received while app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Handle notification tap (deep link to screen)
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    // Navigate to screen based on data.screen
  });

  return subscription;
}
```

Call `registerForPushNotifications()` after user opts in via NotificationSettings. Send the token to `POST /api/users/:id/notifications/subscribe` with `pushToken` and `platform: 'expo'`.

#### i18n Keys

```
"push.quiz_ready_title": "¡Quiz del día listo!" / "Today's quiz is ready!"
"push.quiz_ready_body": "Pon a prueba tus conocimientos deportivos." / "Test your sports knowledge."
"push.team_news_title": "Noticias de {team}" / "{team} news"
"push.streak_warning_title": "¡No pierdas tu racha!" / "Don't lose your streak!"
"push.streak_warning_body": "Abre SportyKids para mantener tu racha de {days} días." / "Open SportyKids to keep your {days}-day streak."
"push.sticker_earned_title": "¡Nuevo sticker!" / "New sticker!"
"push.sticker_earned_body": "Has ganado un sticker {rarity}: {name}" / "You earned a {rarity} sticker: {name}"
"push.mission_ready_title": "¡Tu misión diaria está lista!" / "Your daily mission is ready!"
"push.mission_ready_body": "Complétala para ganar un sticker {rarity}." / "Complete it for a {rarity} sticker."
```

#### Acceptance Criteria

- [ ] `PushToken` model exists with `token`, `userId`, `platform`, `active` fields
- [ ] `POST /api/users/:id/notifications/subscribe` accepts and stores `pushToken` + `platform`
- [ ] `sendPushToUser` and `sendPushToUsers` correctly send via Expo Push API
- [ ] Invalid tokens (DeviceNotRegistered) are marked `active = false`
- [ ] Push fires after quiz generation cron for opted-in users
- [ ] Push fires for team news matching user's favoriteTeam
- [ ] Streak reminder cron runs at 20:00 UTC, sends to at-risk users
- [ ] Sticker award triggers push notification
- [ ] Mission generation triggers push notification
- [ ] Mobile app requests notification permissions and registers Expo push token
- [ ] Notification tap deep-links to correct screen (quiz, news, etc.)
- [ ] Users can opt out (disable push in settings), which sets `active = false` on tokens
- [ ] All push payloads respect user's locale
- [ ] All strings use i18n keys

---

### B-UX4: Dark Mode

#### Problem

Older kids (12-14) expect dark mode. The app only has a light theme.

#### Approach

1. **CSS custom properties** — define dark variants of every design token.
2. **Tailwind `dark:` variant** — Tailwind CSS 4 supports `@media (prefers-color-scheme: dark)` natively.
3. **Manual toggle** — user can override system preference.
4. **Persistence** — theme choice stored in localStorage (web) / AsyncStorage (mobile) and in user context.

#### CSS Variables — Dark Theme

Update `apps/web/src/styles/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-blue: #2563EB;
  --color-green: #22C55E;
  --color-yellow: #FACC15;
  --color-background: #F8FAFC;
  --color-text: #1E293B;
  --color-surface: #FFFFFF;
  --color-border: #E5E7EB;
  --color-muted: #6B7280;

  --font-poppins: 'Poppins', sans-serif;
  --font-inter: 'Inter', sans-serif;
}

/* Dark mode overrides */
.dark {
  --color-background: #0F172A;
  --color-text: #F1F5F9;
  --color-surface: #1E293B;
  --color-border: #334155;
  --color-muted: #94A3B8;
  --color-blue: #3B82F6;    /* slightly brighter for dark bg */
  --color-green: #34D399;
  --color-yellow: #FCD34D;
}
```

New CSS variables added: `--color-surface` (card backgrounds), `--color-border` (borders), `--color-muted` (secondary text). These replace hardcoded values like `bg-white`, `border-gray-100`, `text-gray-500` across all components.

#### Components to Update

Every component that uses hardcoded colors needs migration. Key files:

| File | Changes needed |
|------|---------------|
| `apps/web/src/components/NavBar.tsx` | `bg-white` -> `bg-[var(--color-surface)]`, `border-gray-100` -> `border-[var(--color-border)]`, `text-gray-500` -> `text-[var(--color-muted)]` |
| `apps/web/src/components/NewsCard.tsx` | `bg-white` -> `bg-[var(--color-surface)]`, `border-gray-100` -> `border-[var(--color-border)]`, `text-gray-500` -> `text-[var(--color-muted)]`, `text-gray-400` -> `text-[var(--color-muted)]` |
| `apps/web/src/components/ReelCard.tsx` | Same pattern as NewsCard |
| `apps/web/src/components/ParentalPanel.tsx` | All card backgrounds, borders, muted text |
| `apps/web/src/components/FiltersBar.tsx` | Active/inactive filter styles |
| `apps/web/src/components/QuizGame.tsx` | Option buttons, score display |
| `apps/web/src/components/NotificationSettings.tsx` | Card background, toggle track color |
| `apps/web/src/components/StickerCard.tsx` | Card background |
| `apps/web/src/components/AchievementBadge.tsx` | Background |
| `apps/web/src/app/layout.tsx` | `<body>` background |
| `apps/web/src/app/page.tsx` | Page background |
| All page files in `apps/web/src/app/` | Background color |

**Pattern for migration**: Replace all instances of:
- `bg-white` -> `bg-[var(--color-surface)]`
- `bg-gray-50` / `bg-gray-100` -> `bg-[var(--color-background)]`
- `border-gray-100` / `border-gray-200` -> `border-[var(--color-border)]`
- `text-gray-400` / `text-gray-500` -> `text-[var(--color-muted)]`
- `text-gray-600` / `text-gray-700` -> `text-[var(--color-text)]`

Note: Colored backgrounds like `bg-blue-50`, `bg-green-50`, `bg-yellow-50` should get dark variants: `bg-blue-950/30`, `bg-green-950/30`, `bg-yellow-950/30` respectively (using Tailwind's `dark:` prefix or conditional class).

#### Theme Toggle — Web

Add toggle to NavBar (`apps/web/src/components/NavBar.tsx`):

```
+------------------------------------------------------------------+
| NavBar                                                            |
+------------------------------------------------------------------+
| [LOGO] SportyKids   [News] [Reels] [Quiz] [Collection] [Team]    |
|                                              [MOON/SUN] [LOCK] Al |
+------------------------------------------------------------------+
```

The toggle button shows a sun icon in dark mode and a moon icon in light mode. Clicking toggles the `dark` class on `<html>`.

#### Theme Context — Web

Add theme state to `apps/web/src/lib/user-context.tsx`:

```typescript
// Add to UserContextType
type Theme = 'system' | 'light' | 'dark';

interface UserContextType {
  // ... existing fields ...
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';  // actual applied theme
}
```

On mount:
1. Read `theme` from localStorage (key: `sportykids-theme`).
2. If `'system'`, use `window.matchMedia('(prefers-color-scheme: dark)')`.
3. Apply/remove `dark` class on `document.documentElement`.

```typescript
useEffect(() => {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark);
  setResolvedTheme(isDark ? 'dark' : 'light');
}, [theme]);
```

Persist to localStorage on change.

#### Theme Context — Mobile

In `apps/mobile/src/lib/user-context.tsx`:

```typescript
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Add theme state
const systemScheme = useColorScheme();  // 'light' | 'dark' | null
const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

const resolvedTheme = theme === 'system'
  ? (systemScheme ?? 'light')
  : theme;

// Persist to AsyncStorage
useEffect(() => {
  AsyncStorage.setItem('sportykids-theme', theme);
}, [theme]);

// Load on mount
useEffect(() => {
  AsyncStorage.getItem('sportykids-theme').then(stored => {
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setTheme(stored);
    }
  });
}, []);
```

Mobile components use a `COLORS` object that reads from the resolved theme:

```typescript
const DARK_COLORS = {
  background: '#0F172A',
  text: '#F1F5F9',
  surface: '#1E293B',
  border: '#334155',
  muted: '#94A3B8',
  blue: '#3B82F6',
  green: '#34D399',
  yellow: '#FCD34D',
};

const LIGHT_COLORS = {
  background: '#F8FAFC',
  text: '#1E293B',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  muted: '#6B7280',
  blue: '#2563EB',
  green: '#22C55E',
  yellow: '#FACC15',
};

export function useThemeColors() {
  const { resolvedTheme } = useUser();
  return resolvedTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}
```

#### Flash Prevention (Web)

To prevent a white flash on dark-mode load, add an inline script in `apps/web/src/app/layout.tsx` before the body renders:

```tsx
<head>
  <script dangerouslySetInnerHTML={{ __html: `
    (function() {
      try {
        var theme = localStorage.getItem('sportykids-theme');
        var isDark = theme === 'dark' || (!theme || theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) document.documentElement.classList.add('dark');
      } catch(e) {}
    })();
  `}} />
</head>
```

#### i18n Keys

```
"theme.toggle": "Cambiar tema" / "Toggle theme"
"theme.light": "Claro" / "Light"
"theme.dark": "Oscuro" / "Dark"
"theme.system": "Sistema" / "System"
```

#### Acceptance Criteria

- [ ] CSS variables `--color-surface`, `--color-border`, `--color-muted` are defined in both light and dark variants
- [ ] `.dark` class on `<html>` switches all CSS variables to dark values
- [ ] NavBar has a theme toggle button (moon/sun icon)
- [ ] Theme preference persists in localStorage (web) and AsyncStorage (mobile)
- [ ] `'system'` option respects OS-level preference and updates on change
- [ ] No white flash on dark-mode page load (inline script in layout)
- [ ] All components listed above are migrated from hardcoded colors to CSS variables
- [ ] Mobile `useThemeColors()` hook returns correct color set based on resolved theme
- [ ] All mobile screens use `useThemeColors()` for background, text, and surface colors
- [ ] Colored accent backgrounds (`bg-blue-50`, etc.) have appropriate dark equivalents
- [ ] All strings use i18n keys

---

## Technical Requirements

### Dependencies to Add

| Package | Workspace | Purpose |
|---------|-----------|---------|
| `jspdf@2` | `apps/api` | PDF generation for weekly digest |
| `nodemailer@6` | `apps/api` | Email delivery for digest |
| `@types/nodemailer` | `apps/api` (dev) | TypeScript types |
| `jsonwebtoken@9` | `apps/api` | JWT signing/verification |
| `@types/jsonwebtoken` | `apps/api` (dev) | TypeScript types |
| `next-auth@5` | `apps/web` | Social login for web |
| `expo-server-sdk@3` | `apps/api` | Push notification delivery |
| `expo-notifications` | `apps/mobile` | Push notification registration |
| `expo-device` | `apps/mobile` | Device detection for push |
| `expo-auth-session` | `apps/mobile` | Social login for mobile |

### Database Migrations (in order)

1. `add-digest-fields` — ParentalProfile digest columns
2. `add-granular-time-limits` — ParentalProfile per-type limit columns
3. `add-content-report` — ContentReport model
4. `add-auth-fields` — User auth columns + RefreshToken model
5. `add-daily-mission` — DailyMission model
6. `add-push-tokens` — PushToken model

### New Files Summary

| File | Type |
|------|------|
| `apps/api/src/services/digest-generator.ts` | Service |
| `apps/api/src/services/mission-generator.ts` | Service |
| `apps/api/src/services/push-sender.ts` | Service |
| `apps/api/src/services/auth-service.ts` | Service |
| `apps/api/src/routes/reports.ts` | Route |
| `apps/api/src/routes/missions.ts` | Route |
| `apps/api/src/routes/auth.ts` | Route |
| `apps/api/src/jobs/send-weekly-digests.ts` | Cron |
| `apps/api/src/jobs/generate-daily-missions.ts` | Cron |
| `apps/api/src/jobs/streak-reminder.ts` | Cron |
| `apps/web/src/components/FeedPreviewModal.tsx` | Component |
| `apps/web/src/components/ReportButton.tsx` | Component |
| `apps/web/src/components/ContentReportList.tsx` | Component |
| `apps/web/src/components/MissionCard.tsx` | Component |
| `apps/web/src/app/login/page.tsx` | Page |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | NextAuth route |
| `apps/mobile/src/screens/RssCatalog.tsx` | Screen |
| `apps/mobile/src/screens/Login.tsx` | Screen |
| `apps/mobile/src/components/MissionCard.tsx` | Component |
| `apps/mobile/src/components/ReportButton.tsx` | Component |
| `apps/mobile/src/components/StreakCounter.tsx` | Component |
| `apps/mobile/src/lib/push-notifications.ts` | Utility |
| `apps/mobile/src/lib/auth.ts` | Utility |

### Env Vars to Add

```bash
# Digest (B-PT1)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@sportykids.app

# Auth (B-TF3)
JWT_SECRET=change-me-in-production
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
```

---

## Out of Scope

- **Email verification**: Not required for MVP social login (providers handle verification).
- **Password-based accounts**: Only social login + anonymous. No email/password registration.
- **Web push notifications**: Mobile push is priority. Web push is future.
- **Offline mode**: App requires network connection.
- **Multi-language push**: Push payloads use user's stored locale. No runtime language negotiation.
- **A/B testing missions**: All users get same mission pool. Personalization is future.
- **Dark mode for PDF digest**: PDF is always light-themed for printability.
- **Content report moderation queue for admins**: Only parents see their child's reports. No admin dashboard.
- **Two-factor authentication**: Social providers handle 2FA. No app-level 2FA.

---

## Documentation Update

After implementing this PRD, review and update **all** documents in `docs/es/` and `docs/en/` to reflect the changes. Specifically:

| Document | Expected updates |
|----------|-----------------|
| `01-arquitectura.md` / `01-architecture.md` | Authentication layer (JWT + Social Login), push notification service, dark mode theming system |
| `02-modelo-de-datos.md` / `02-data-model.md` | New models: `ContentReport`, `DailyMission`, `UserMission`, `RefreshToken`. Updated: `User` (auth fields), `ParentalProfile` (per-type time limits) |
| `03-api-reference.md` / `03-api-reference.md` | New endpoints: auth (login, register, social), missions (daily, progress), content reports, digest download. Updated: parental guard per-type limits |
| `04-guia-desarrollo.md` / `04-development-guide.md` | Auth setup (NextAuth config, Expo AuthSession), push notification testing, dark mode development |
| `05-flujos-de-usuario.md` / `05-user-flows.md` | Social login flow, daily mission flow, content report flow, parental digest flow, "see what my kid sees" flow |
| `06-service-overview.md` / `06-service-overview.md` | New services: `mission-generator.ts`, `digest-generator.ts`, `push-service.ts` |
| `08-diseno-y-ux.md` / `08-design-and-ux.md` | Dark mode tokens and patterns, MissionCard component, content report UI, parental preview mode, digest layout |
| `09-seguridad-y-privacidad.md` / `09-security-and-privacy.md` | JWT authentication, social login security, content reporting system, push notification permissions |
| `10-roadmap-y-decisiones.md` / `10-roadmap-and-decisions.md` | Mark Sprint 3-4 items as completed, document auth provider decision (NextAuth vs Clerk) |

**Process**: Read each document, identify sections affected by the changes, and update them. Add new sections if a feature introduces concepts not previously documented. Keep both languages (ES/EN) in sync.

## Future Considerations

- **Mission leaderboards**: Compare mission completion with friends (requires friend system).
- **Parental digest analytics**: Track which digests are opened, which sections are read.
- **Content report AI review**: Auto-classify reports and take action (hide content if multiple reports).
- **OAuth scope management**: Request minimal scopes, add more as needed.
- **Token rotation**: Implement refresh token rotation for additional security.
- **Web push**: Add VAPID-based web push notifications after mobile push is stable.
- **Theme per child**: Allow each child profile to have its own theme preference.
- **High contrast mode**: Accessibility improvement beyond dark/light.
- **Mission streaks**: Complete missions N days in a row for bonus rewards.
- **Family accounts**: Multiple children under one parent account with individual profiles.
