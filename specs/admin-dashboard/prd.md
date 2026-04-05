# Admin Dashboard — Shared Infrastructure + Content Moderation (S2)
## Product Requirements Document

> **IMPLEMENT THIS FIRST.** All other admin PRDs (prd2–prd6) depend on the shared infrastructure defined in Part A. Do not start any other admin PRD until the route group restructuring, admin layout, reusable components, and auth check are working.

---

## Overview

This PRD covers two distinct but co-delivered pieces:

**Part A — Shared Infrastructure**: The structural foundation every other admin section depends on. Route group reorganization, admin layout, sidebar navigation, shared UI components, and the admin creation script.

**Part B — Content Moderation (S2)**: The primary editorial tool. Allows admin users to review, approve, and reject AI-flagged content (news items and reels), and to action user-submitted content reports.

---

## Problem Statement

SportyKids surfaces content to children aged 6–14. The AI moderation pipeline runs on ingestion but is imperfect — edge cases, provider outages, and borderline content require human review. Currently there is no UI to perform this review: admins must write raw SQL or use the existing `GET /api/admin/moderation/pending` endpoint directly, with no bulk actions, filtering, or audit trail for decisions.

Additionally, children and parents can submit content reports via `POST /api/reports`, but there is no admin interface to triage these reports and take action.

---

## Goals

1. Reorganize the Next.js app into route groups so the admin dashboard can have its own layout without affecting the main app.
2. Provide a secure, role-gated admin area using client-side auth (consistent with the app's existing localStorage JWT pattern).
3. Build reusable admin UI primitives that all 5 remaining admin sections will consume.
4. Enable admins to review pending content, approve/reject individually or in bulk, and manage user content reports.

---

## Target Users

Internal — SportyKids team members with `role: 'admin'` in the database. Not exposed to end users.

---

## Core Features

### Part A: Shared Infrastructure

#### A1. Recharts Dependency

Install Recharts into the web workspace:

```bash
npm install recharts --workspace=apps/web
```

Recharts is chosen because it is compatible with Tailwind CSS 4 (Tremor is not). It renders SVG-based charts that compose naturally with Tailwind utility classes.

#### A2. Route Group Restructuring

**Current structure** (`apps/web/src/app/`):
```
layout.tsx              ← root layout with NavBar, UserProvider
page.tsx
HomeFeedClient.tsx
onboarding/
reels/
quiz/
collection/
team/
parents/
auth/
age-gate/
privacy/
terms/
upgrade/
login/
register/
organizations/
```

**Target structure**:
```
apps/web/src/app/
├── layout.tsx                    ← minimal pass-through (html + body, no NavBar)
├── (main)/
│   ├── layout.tsx                ← was root layout.tsx (NavBar, UserProvider, theme)
│   ├── page.tsx                  ← was root page.tsx
│   ├── HomeFeedClient.tsx        ← moved as-is
│   ├── onboarding/
│   ├── reels/
│   ├── quiz/
│   ├── collection/
│   ├── team/
│   ├── parents/
│   ├── auth/
│   ├── age-gate/
│   ├── privacy/
│   ├── terms/
│   ├── upgrade/
│   ├── login/
│   ├── register/
│   └── organizations/
└── (admin)/
    ├── layout.tsx                ← admin layout (no NavBar, client component, role check)
    └── admin/
        ├── page.tsx              ← Overview (prd2.md)
        ├── moderation/
        │   └── page.tsx          ← Content Moderation (this PRD)
        ├── analytics/
        │   └── page.tsx          ← Analytics (prd5.md)
        ├── sources/
        │   └── page.tsx          ← Source Management (prd4.md)
        ├── jobs/
        │   └── page.tsx          ← Operations & Jobs (prd3.md)
        └── users/
            ├── page.tsx          ← Users list (prd6.md)
            ├── [id]/
            │   └── page.tsx      ← User detail (prd6.md)
            └── ../organizations/ ← org pages also under users section (prd6.md)
```

**Migration rules**:
- Move files physically (do not copy). Update all internal imports that use `@/app/` paths if any.
- The new root `apps/web/src/app/layout.tsx` must only contain `<html>` and `<body>` tags plus font setup and the global CSS import. No `UserProvider`, no `NavBar`.
- The `(main)/layout.tsx` takes over everything the old root layout did: `UserProvider`, `NavBar`, `OfflineBanner`, theme script, etc.
- Next.js route groups (`(main)` and `(admin)`) do not affect URL paths — `/` still resolves to `(main)/page.tsx`, `/admin` resolves to `(admin)/admin/page.tsx`.

#### A3. Admin Auth Check (Client-Side)

The app uses localStorage for JWT storage. Next.js middleware runs server-side and cannot read localStorage. Therefore, auth protection for `/admin/*` routes is handled client-side in the admin layout, not in `middleware.ts`.

**`apps/web/src/app/(admin)/layout.tsx`**:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== 'admin') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || user?.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <span className="text-slate-400 text-sm">Checking access...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-inter overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
```

This pattern is identical to how the main app guards parental screens — read `useUser()`, redirect if unauthorized.

#### A4. AdminSidebar Component

**File**: `apps/web/src/components/admin/AdminSidebar.tsx`

A fixed-width (`w-56`) left sidebar with the SportyKids admin brand mark and navigation links.

```
┌────────────────────────┐
│  ⚙ SportyKids Admin   │
├────────────────────────┤
│  Overview              │  /admin
│  Moderation            │  /admin/moderation
│  Analytics             │  /admin/analytics
│  Sources               │  /admin/sources
│  Jobs                  │  /admin/jobs
│  Users & Orgs          │  /admin/users
└────────────────────────┘
```

Active link highlighted with `bg-slate-800` and `text-white`. Inactive links: `text-slate-400 hover:text-white hover:bg-slate-800/50`. Uses `usePathname()` from `next/navigation` to determine active state.

#### A5. Reusable Admin Components

All files under `apps/web/src/components/admin/`.

**`AdminMetricCard.tsx`**:
```typescript
interface AdminMetricCardProps {
  title: string;
  value: string | number;
  trend?: { value: number; label: string }; // e.g. { value: 12, label: 'vs yesterday' }
  icon?: React.ReactNode;
  severity?: 'normal' | 'warning' | 'error';
}
```
Renders a card with title, large value, optional trend arrow (+/-), and severity-driven border color (yellow for warning, red for error).

**`AdminTable.tsx`**:
```typescript
interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  emptyMessage?: string;
}
```
Generic table with client-side sort state, previous/next pagination buttons, and a loading skeleton (3 shimmer rows). Renders `children` in `<td>` cells using the `render` function if provided, else accesses `row[key]`.

**`AdminBadge.tsx`**:
```typescript
type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple';

interface AdminBadgeProps {
  label: string;
  variant: BadgeVariant;
}
```
Pill-shaped badge with background color per variant. Maps: `green → bg-green-900 text-green-300`, `yellow → bg-yellow-900 text-yellow-300`, `red → bg-red-900 text-red-300`, `gray → bg-slate-700 text-slate-300`, `blue → bg-blue-900 text-blue-300`, `purple → bg-purple-900 text-purple-300`.

#### A6. NavBar Admin Link

**File**: `apps/web/src/components/NavBar.tsx`

Add a conditional link visible only when `user?.role === 'admin'`:

```typescript
{user?.role === 'admin' && (
  <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
    <span>⚙</span>
    <span>Admin</span>
  </Link>
)}
```

Place this link at the end of the nav items, before the theme toggle if present.

#### A7. Admin Creation Script

**File**: `apps/api/scripts/create-admin.ts`

CLI script to create or promote a user to admin role.

```
Usage:
  npx tsx apps/api/scripts/create-admin.ts <email>

Behavior:
  - If user with email exists: update role to 'admin', print confirmation.
  - If user does not exist: create User with authProvider='email', role='admin',
    random temp password (16 chars), print email + temp password to console.
  - Script exits with code 0 on success, 1 on error.
```

Uses `apps/api/src/config/database.ts` (Prisma singleton). Uses `bcrypt.hash` for temp password. Does not use `auth-service.ts` directly to avoid circular deps with passport — import bcrypt directly.

---

### Part B: Content Moderation (S2)

#### B1. Backend — Extended Moderation Endpoints

All endpoints in `apps/api/src/routes/admin.ts`. All require `requireAuth` + `requireRole('admin')`.

**Extend existing `GET /api/admin/moderation/pending`**:

Current implementation returns a flat list, no filters, no pagination. Extend to:

```
GET /api/admin/moderation/pending?type=news|reel&sport=football&source=<rssSourceId>&page=1&limit=20
```

Response:
```typescript
{
  items: Array<{
    id: string;
    type: 'news' | 'reel';
    title: string;
    sport: string;
    source: string;         // RssSource.name or VideoSource.name
    safetyReason: string | null;
    pendingSinceMinutes: number; // Math.round((now - createdAt) / 60000)
    url: string;
    imageUrl?: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

Implementation: two separate Prisma queries (`NewsItem` where `safetyStatus: 'pending'` + `Reel` where `safetyStatus: 'pending'`), merged and sorted by `createdAt asc`. When `type` filter is provided, skip the other query. Pagination applied after merge.

**`PATCH /api/admin/content/:type/:id/approve`**:

```typescript
// type: 'news' | 'reel'
// Updates safetyStatus → 'approved', moderatedAt → now()
// Returns updated item (id, safetyStatus, moderatedAt)
```

**`PATCH /api/admin/content/:type/:id/reject`**:

```typescript
// Body: { reason: string } (required, min 3 chars)
// Updates safetyStatus → 'rejected', safetyReason → reason, moderatedAt → now()
// Returns updated item
```

**`POST /api/admin/content/batch`**:

```typescript
// Body: {
//   ids: string[];          // max 100
//   type: 'news' | 'reel';
//   action: 'approve' | 'reject';
//   reason?: string;        // required when action === 'reject'
// }
// Uses Prisma updateMany with id in ids[]
// Returns { updated: number }
```

**`GET /api/admin/reports`**:

```typescript
// Query: status=pending|reviewed|dismissed|actioned, contentType=news|reel, page, limit
// Returns ContentReport list (all users, no userId filter — admin sees all)
// Include joined User (email, id) and a preview of the associated content (title/url)
```

Response items:
```typescript
{
  id: string;
  contentType: 'news' | 'reel';
  contentId: string;
  contentTitle: string | null; // joined from NewsItem/Reel
  reason: string;
  details: string | null;
  status: string;
  user: { id: string; email: string | null };
  createdAt: string;
}
```

**`PATCH /api/admin/reports/:id`**:

```typescript
// Body: { status: 'reviewed' | 'dismissed' | 'actioned', action?: 'reject_content' }
// Updates ContentReport.status
// If action === 'reject_content': also rejects the associated content (same logic as PATCH /content/:type/:id/reject with reason='User report actioned')
```

#### B2. Frontend — Moderation Page

**File**: `apps/web/src/app/(admin)/admin/moderation/page.tsx`

Client component. Two tabs: "Pending Content" and "User Reports".

---

## UI Mockups (ASCII Art)

### Moderation Page — Pending Content Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin    Content Moderation                                    │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview      │  [Pending Content (47)]  [User Reports (12)]               │
│  Moderation ◀  │                                                            │
│  Analytics     │  Filters: [All types ▼]  [All sports ▼]  [All sources ▼]  │
│  Sources       │                                                            │
│  Jobs          │  [□ Select All]  [✓ Approve Selected]  [✗ Reject Selected]│
│  Users & Orgs  ├────────────────────────────────────────────────────────────┤
│                │ □ │TYPE │ Title               │ Sport    │Pending │ Actions│
│                │───┼─────┼─────────────────────┼──────────┼────────┼────────│
│                │ □ │NEWS │ Real Madrid beat...  │ Football │ 42 min │ [✓][✗]│
│                │ □ │REEL │ Goals of the week 5  │ Football │ 18 min │ [✓][✗]│
│                │ □ │NEWS │ Nadal returns to...  │ Tennis   │  5 min │ [✓][✗]│
│                │ □ │NEWS │ Verstappen takes...  │ Formula1 │ 61 min │ [✓][✗]│
│                │───┴─────┴─────────────────────┴──────────┴────────┴────────│
│                │  < Prev   Page 1 of 3   Next >                             │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### Reject Modal

```
┌─────────────────────────────────────┐
│  Reject Content                     │
│─────────────────────────────────────│
│  "Real Madrid beat Atlético 3-1..." │
│                                     │
│  Reason:                            │
│  ┌───────────────────────────────┐  │
│  │ Contains gambling reference   │  │
│  └───────────────────────────────┘  │
│                                     │
│       [Cancel]  [Confirm Reject]    │
└─────────────────────────────────────┘
```

### User Reports Tab

```
┌────────────────┬────────────────────────────────────────────────────────────┐
│  Overview      │  [Pending Content (47)]  [User Reports (12)]               │
│  Moderation ◀  │                                                            │
│  Analytics     │  Filters: [All status ▼]  [All types ▼]                   │
│  Sources       ├────────────────────────────────────────────────────────────┤
│  Jobs          │ Type │ Content             │ Reason     │ Status  │ Actions│
│  Users & Orgs  │──────┼─────────────────────┼────────────┼─────────┼────────│
│                │ NEWS │ Real Madrid beat...  │ Violence   │ PENDING │[▣][✗] │
│                │ REEL │ Goals of the week 5  │ Unsuitable │ PENDING │[▣][✗] │
│                │ NEWS │ Verstappen takes...  │ Offensive  │ REVIEWED│  —    │
└────────────────┴────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### Part A — Infrastructure

- [ ] `recharts` is installed in `apps/web` workspace without `--legacy-peer-deps`.
- [ ] All existing pages accessible at their original URLs (e.g., `/`, `/reels`, `/quiz`) after route group migration.
- [ ] `/admin` redirects to `/` for non-admin users within 500ms of load.
- [ ] `/admin` renders admin layout (sidebar + main area, no NavBar) for admin users.
- [ ] `AdminSidebar` active link highlights correctly for all 6 sections.
- [ ] `AdminMetricCard` renders title, value, and trend with correct severity border color.
- [ ] `AdminTable` renders data, supports pagination button clicks, shows loading skeleton.
- [ ] `AdminBadge` renders correct colors for all 6 variants.
- [ ] NavBar shows "⚙ Admin" link only when `user.role === 'admin'`.
- [ ] `create-admin.ts` script promotes an existing user to admin when run with their email.
- [ ] `create-admin.ts` script creates a new admin user and prints temp password when run with a new email.

### Part B — Content Moderation

- [ ] `GET /api/admin/moderation/pending` accepts `type`, `sport`, `source`, `page`, `limit` query params.
- [ ] `GET /api/admin/moderation/pending` returns `total` and `totalPages` for pagination.
- [ ] `PATCH /api/admin/content/news/:id/approve` sets `safetyStatus: 'approved'` and `moderatedAt`.
- [ ] `PATCH /api/admin/content/reel/:id/approve` sets `safetyStatus: 'approved'` and `moderatedAt`.
- [ ] `PATCH /api/admin/content/news/:id/reject` requires `reason`, sets `safetyStatus: 'rejected'` and `safetyReason`.
- [ ] `POST /api/admin/content/batch` with `action: 'approve'` updates all provided IDs.
- [ ] `POST /api/admin/content/batch` with `action: 'reject'` and no `reason` returns 400.
- [ ] `POST /api/admin/content/batch` rejects requests with more than 100 IDs (returns 400).
- [ ] `GET /api/admin/reports` returns all ContentReport records with user email and content title.
- [ ] `PATCH /api/admin/reports/:id` with `action: 'reject_content'` also rejects the linked content item.
- [ ] Moderation page renders pending items table with correct columns.
- [ ] Select-all checkbox selects/deselects all visible rows.
- [ ] Bulk approve updates all selected rows optimistically and re-fetches.
- [ ] Reject button opens modal; confirming sends reject request with reason.
- [ ] User Reports tab renders reports with correct status badges.
- [ ] All admin endpoints return 401 without auth and 403 without admin role.

---

## Technical Requirements

### File Paths — Created

| File | Description |
|------|-------------|
| `apps/web/src/app/layout.tsx` | Minimal root layout (html + body) |
| `apps/web/src/app/(main)/layout.tsx` | Main app layout (was root layout) |
| `apps/web/src/app/(admin)/layout.tsx` | Admin layout with role check |
| `apps/web/src/app/(admin)/admin/moderation/page.tsx` | Moderation page |
| `apps/web/src/components/admin/AdminSidebar.tsx` | Sidebar nav |
| `apps/web/src/components/admin/AdminMetricCard.tsx` | KPI card |
| `apps/web/src/components/admin/AdminTable.tsx` | Generic table |
| `apps/web/src/components/admin/AdminBadge.tsx` | Status badge |
| `apps/api/scripts/create-admin.ts` | Admin user creation CLI |

### File Paths — Modified

| File | Change |
|------|--------|
| `apps/web/src/components/NavBar.tsx` | Add conditional admin link |
| `apps/api/src/routes/admin.ts` | Extend moderation endpoints, add batch + reports |
| `apps/web/package.json` | Add `recharts` dependency |

### API Client Usage

All admin frontend pages use `authFetch` from `apps/web/src/lib/api.ts`:

```typescript
import { authFetch } from '@/lib/api';

const res = await authFetch('/api/admin/moderation/pending?page=1&limit=20');
const data = await res.json();
```

The `authFetch` function automatically attaches `Authorization: Bearer <token>` and handles token refresh. Admin pages do not need to manage tokens manually.

### Zod Validation on Batch Endpoint

```typescript
const batchSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  type: z.enum(['news', 'reel']),
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(3).optional(),
}).refine(d => d.action !== 'reject' || !!d.reason, {
  message: 'reason is required when action is reject',
  path: ['reason'],
});
```

### Prisma Queries

Approve (news):
```typescript
await prisma.newsItem.update({
  where: { id },
  data: { safetyStatus: 'approved', moderatedAt: new Date() },
});
```

Batch approve (news):
```typescript
await prisma.newsItem.updateMany({
  where: { id: { in: ids } },
  data: { safetyStatus: 'approved', moderatedAt: new Date() },
});
```

---

## Implementation Decisions

**Why client-side auth instead of Next.js middleware?**
The app stores JWTs in localStorage (not cookies), which is a browser-only API. Next.js middleware runs on the Edge runtime before the browser executes any JavaScript, so it cannot read localStorage. Rather than introducing a cookie-based auth parallel system just for the admin, we use the same pattern the rest of the app uses: check `useUser()` in the layout and redirect if unauthorized. The flicker is minimal (< 200ms) and acceptable for an internal tool.

**Why route groups instead of a separate Next.js app?**
A separate `apps/admin` workspace would duplicate the shared API client, UserProvider, and all component dependencies. Route groups achieve layout isolation with zero duplication — the admin pages live in the same Next.js app but with a completely different layout tree.

**Why merge news+reels in the moderation endpoint?**
Content moderators work through a queue regardless of type. Separating into two tabs by type would require two loading states and two pagination contexts. The merged approach with a type filter gives the best review UX.

**Why Recharts instead of a higher-level library?**
Tremor, the most common admin chart library for Next.js, does not support Tailwind CSS 4 (it pins to Tailwind v3 PostCSS plugin). Recharts is lower-level but fully compatible and already used in the ecosystem. The `AdminChart` wrapper pattern (defined in prd2.md) abstracts the boilerplate.

---

## Testing Decisions

**Unit tests** for all new API endpoints in `apps/api/src/routes/admin.test.ts`:
- Test approve/reject with valid and invalid IDs.
- Test batch with >100 IDs (expect 400).
- Test batch reject without reason (expect 400).
- Test reports endpoint with status filter.
- Test report action `reject_content` cascades to content.
- Test all endpoints without auth (expect 401) and with child role (expect 403).

**No frontend unit tests** for the moderation page itself — it is primarily integration-level UI. Manual testing per acceptance criteria is sufficient for an internal tool.

**No E2E tests** for admin (Playwright E2E suite tests the child-facing app). Admin is tested via API unit tests + manual QA.

---

## Out of Scope

- Real-time push updates to moderation queue (polling on tab focus is sufficient).
- Moderation audit log / history of who approved what (future consideration).
- Email notifications to admins when content queue grows.
- WYSIWYG content editing (admins can only approve or reject, not edit content).
- Role management UI (handled by `create-admin.ts` script and prd6.md user detail page).

---

## Future Considerations

- Add a moderation audit log model to track `adminUserId`, `action`, `reason`, and `timestamp` for each decision.
- Add Slack/email webhook when pending queue exceeds a configurable threshold.
- Allow admins to preview content inline (thumbnail + excerpt) before approving.
- Migrate to cookie-based JWT to enable proper server-side middleware protection.
