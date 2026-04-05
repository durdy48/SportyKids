# Admin Dashboard — Users & Organizations (S6)

## Product Requirements Document

> **Prerequisite**: Implement `prd.md` (Shared Infrastructure) before this PRD. This section uses `AdminTable`, `AdminBadge`, `AdminMetricCard`, and `authFetch`.

---

## Overview

The Users & Organizations section is the admin support tool for managing individual user accounts and B2B organization accounts. It enables searching users, viewing full profiles, changing subscription tiers, changing roles, revoking sessions, and managing organization settings. All destructive actions require explicit confirmation to prevent accidental changes.

---

## Problem Statement

When a user reports an issue (wrong tier, locked out, suspicious activity), the team currently has no UI to investigate or resolve it. Similarly, when an organization admin requests a member limit increase or reports problems with their invite code, there is no admin tool — only raw database access. This section replaces ad-hoc database queries with a safe, auditable support interface.

---

## Goals

1. Enable searching users by email or ID without database access.
2. Provide a full user profile view (auth info, activity, gamification stats).
3. Allow changing subscription tier and role with confirmation.
4. Allow revoking all active sessions for a user (force logout).
5. Enable viewing and managing all organizations.
6. Allow updating organization settings (active status, member limit).

---

## Target Users

Internal — SportyKids team members with `role: 'admin'`. Used primarily for customer support and B2B account management.

---

## Core Features

### 1. Backend Endpoints — Users

All in `apps/api/src/routes/admin.ts`. All require `requireAuth + requireRole('admin')`.

`**GET /api/admin/users?q=&role=&tier=&page=&limit=`**:

Search users by email or ID. Returns paginated list.

```typescript
// Query:
//   q: search term (matches email ILIKE %q% OR id = q)
//   role: filter by role ('child' | 'parent' | 'admin')
//   tier: filter by subscriptionTier ('free' | 'premium')
//   page: default 1
//   limit: default 25, max 100
//
// Response:
{
  users: Array<{
    id: string;
    email: string | null;
    role: string;
    subscriptionTier: string;
    authProvider: string;
    country: string | null;
    locale: string;
    createdAt: string;
    lastLoginAt: string | null;
    organizationId: string | null;
    organizationRole: string | null;
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

Prisma query:

```typescript
const where = {
  AND: [
    q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { id: q }] } : {},
    role ? { role } : {},
    tier ? { subscriptionTier: tier } : {},
  ],
};
```

`**GET /api/admin/users/:id**`:

Full user profile with related data:

```typescript
{
  user: {
    // All User model fields (exclude passwordHash)
    id, email, role, subscriptionTier, authProvider, socialId?,
    country, locale, createdAt, updatedAt, lastLoginAt,
    favoriteSports, selectedFeeds,
    currentStreak, longestStreak, lastActiveDate,
    currentQuizCorrectStreak, quizPerfectCount,
    ageGateCompleted, consentGiven, consentDate, consentBy,
    organizationId, organizationRole,
    subscriptionExpiry,
  };
  recentActivity: Array<{
    id: string;
    type: string;
    sport: string | null;
    contentId: string | null;
    durationSeconds: number | null;
    createdAt: string;
  }>; // Last 10 ActivityLog entries, ordered by createdAt desc
  stats: {
    stickerCount: number;        // UserSticker count for this user
    achievementCount: number;    // UserAchievement count for this user
    totalQuizAnswers: number;    // count of quiz_answered in ActivityLog
    totalNewsViewed: number;     // count of news_viewed in ActivityLog
  };
  parentalProfile: {
    hasPin: boolean;             // ParentalProfile exists for this user
    allowedSports: string[];
    allowedFormats: string[];
    maxNewsMinutes: number | null;
    scheduleLocked: boolean;     // allowedHoursStart !== 0 || allowedHoursEnd !== 24
  } | null;
}
```

`**PATCH /api/admin/users/:id/tier**`:

```typescript
// Body: { tier: 'free' | 'premium' }
// Zod validation
// Updates User.subscriptionTier
// Returns: { id, subscriptionTier }
```

`**PATCH /api/admin/users/:id/role**`:

```typescript
// Body: { role: 'child' | 'parent' | 'admin' }
// Cannot demote self (req.userId === id → 403 "Cannot change your own role")
// Updates User.role
// Returns: { id, role }
```

`**POST /api/admin/users/:id/revoke-tokens**`:

```typescript
// Deletes ALL RefreshToken records for this userId
// This forces the user to log in again on all devices
// Returns: { revoked: number } (count of deleted tokens)
```

### 2. Backend Endpoints — Organizations

`**GET /api/admin/organizations?sport=&active=&page=&limit=**`:

```typescript
// Query params: sport, active (true/false), page, limit
// Returns paginated list of organizations with member count
{
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    sport: string;
    logoUrl: string | null;
    inviteCode: string;
    maxMembers: number;
    memberCount: number;  // count of User where organizationId = this org's id
    active: boolean;
    createdAt: string;
    createdBy: string;    // userId of creator
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

`**GET /api/admin/organizations/:id**`:

Full org detail with members and recent activity:

```typescript
{
  organization: {
    // All Organization model fields
    id, name, slug, sport, logoUrl, customColors?,
    inviteCode, maxMembers, active, createdAt, createdBy,
  };
  members: Array<{
    id: string;
    email: string | null;
    role: string;           // User.role (child/parent/admin)
    orgRole: string;        // organizationRole (member/admin)
    subscriptionTier: string;
    lastLoginAt: string | null;
    joinedAt: string;       // User.createdAt as proxy (no explicit joinedAt field)
  }>;
  memberCount: number;
  activitySummary: {
    // Pre-computed from AnalyticsSnapshot if available, else null
    // Shows last 30 days — queried from ActivityLog filtered by organizationId
    dailyActivity: Array<{ date: string; count: number }>;
    totalViews: number;
  };
}
```

`**PATCH /api/admin/organizations/:id**`:

```typescript
// Body: { active?: boolean, maxMembers?: number }
// Validation: maxMembers >= current memberCount (cannot set below current members)
// Returns: { id, active, maxMembers }
```

**Reuse** `POST /api/organizations/:id/regenerate-code` — existing endpoint already requires auth + org admin. Admin can call it directly.

### 3. Frontend — Users List Page

**File**: `apps/web/src/app/(admin)/admin/users/page.tsx`

```
Search bar → [AdminTable]
```

- Search input (debounced 300ms): filters by email or user ID.
- Dropdown filters: Role (All / Child / Parent / Admin), Tier (All / Free / Premium).
- `AdminTable` columns: Email, Role (badge), Tier (badge), Auth Provider (badge), Country, Last Login (relative), Actions.
- Actions column: [View] button → navigates to `/admin/users/:id`.
- Empty state: "No users found. Try a different search term."

### 4. Frontend — User Detail Page

**File**: `apps/web/src/app/(admin)/admin/users/[id]/page.tsx`

Three sections:

**Section 1 — Profile Info Cards** (2-column grid):

- Left card: Account info (email, role, authProvider, country, locale, created, last login, org membership)
- Right card: Subscription (tier badge, expiry if premium) + Gamification (current streak, longest streak, sticker count, achievement count, quiz answers, news viewed)

**Section 2 — Parental Profile** (if exists):

- Compact info: has PIN, allowed sports, allowed formats, max time limits, schedule locked

**Section 3 — Recent Activity** (last 10 entries):

- Table: Type, Sport, Content ID, Duration, Date

**Action Bar** (top of page, below breadcrumb):

- [← Back to Users]
- [Change Tier] — opens modal
- [Change Role] — opens modal
- [Revoke Tokens] — opens confirmation modal

**Change Tier Modal**:

```
┌─────────────────────────────────────┐
│  Change Subscription Tier           │
│─────────────────────────────────────│
│  User: user@example.com             │
│  Current tier: free                 │
│                                     │
│  New tier: [free ▼] [premium ▼]    │
│                                     │
│  ⚠ This overrides RevenueCat data  │
│    until next webhook sync.         │
│                                     │
│       [Cancel]  [Confirm Change]    │
└─────────────────────────────────────┘
```

**Change Role Modal**:

```
┌─────────────────────────────────────┐
│  Change Role                        │
│─────────────────────────────────────│
│  User: user@example.com             │
│  Current role: child                │
│                                     │
│  New role: [child ▼] [parent ▼]    │
│            [admin ▼]                │
│                                     │
│  ⚠ Admin role grants full          │
│    dashboard access.                │
│                                     │
│       [Cancel]  [Confirm Change]    │
└─────────────────────────────────────┘
```

**Revoke Tokens Modal**:

```
┌─────────────────────────────────────┐
│  Revoke All Sessions                │
│─────────────────────────────────────│
│  This will immediately log out      │
│  user@example.com from all devices. │
│  They will need to log in again.    │
│                                     │
│       [Cancel]  [Revoke Sessions]   │
└─────────────────────────────────────┘
```

### 5. Frontend — Organizations List Page

**File**: `apps/web/src/app/(admin)/admin/users/organizations/page.tsx`

Note: Organizations are nested under the "Users & Orgs" section in the sidebar. The sidebar link "Users & Orgs" expands to show "Users" and "Organizations" sub-links, or navigates to `/admin/users` with a tab switcher.

Alternative (simpler): Two tabs on `/admin/users/page.tsx` — "Users" and "Organizations".

**Decision**: Use tabs on the same page. This avoids nested routing complexity and keeps the sidebar clean (one "Users & Orgs" entry).

**Organizations tab**:

- Filters: Sport dropdown, Status (All / Active / Inactive)
- `AdminTable` columns: Name, Sport (badge), Members/Max, Status (Active/Inactive badge), Created, Actions
- Actions: [View] → `/admin/users/organizations/:id`

### 6. Frontend — Organization Detail Page

**File**: `apps/web/src/app/(admin)/admin/users/organizations/[id]/page.tsx`

**Section 1 — Org Info Card**:

- Name, slug, sport, invite code (copyable), max members, active status, created date, creator user ID

**Section 2 — Members Table**:

- Columns: Email, Role, Org Role (badge), Tier, Last Login, Joined
- No pagination needed for most orgs (max 100 members)

**Section 3 — Activity Chart (last 30 days)**:

- Recharts `AreaChart` using `activitySummary.dailyActivity`
- Shows total daily activity count for all members of this org
- If no data: empty state message

**Action Bar**:

- [← Back to Organizations]
- [Regenerate Invite Code] — calls `POST /api/organizations/:id/regenerate-code`, shows new code
- [Deactivate Org] / [Reactivate Org] — toggle `active` field with confirmation modal

**Deactivate Org Confirmation**:

```
┌─────────────────────────────────────┐
│  Deactivate Organization            │
│─────────────────────────────────────│
│  Deactivate "FC Barcelona Academy"? │
│                                     │
│  Members will no longer be able to  │
│  use organization features. Their   │
│  accounts remain intact.            │
│                                     │
│     [Cancel]  [Deactivate Org]      │
└─────────────────────────────────────┘
```

---

## UI Mockups (ASCII Art)

### Users List Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin                                                          │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview      │  Users & Organizations                                     │
│  Moderation    │                                                            │
│  Analytics     │  [Users (4,821)]  [Organizations (14)]                     │
│  Sources       │                                                            │
│  Jobs          │  🔍 [Search by email or user ID...  ] [Role ▼] [Tier ▼]   │
│  Users & Orgs◀ ├────────────────────────────────────────────────────────────┤
│                │ Email             │ Role   │ Tier   │ Auth   │ Last Login  │
│                │───────────────────┼────────┼────────┼────────┼─────────────│
│                │ maria@gmail.com   │[PARENT]│[FREE]  │ Google │ 2 days ago  │
│                │ anon-abc123       │[CHILD] │[FREE]  │ Anon   │ 5h ago      │
│                │ admin@sportyk...  │[ADMIN] │[PREM]  │ Email  │ 1h ago      │
│                │ carlos@email.com  │[CHILD] │[PREM]  │ Apple  │ 12h ago     │
│                │───────────────────┴────────┴────────┴────────┴─────────────│
│                │  < Prev   Page 1 of 193   Next >                           │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### User Detail Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin                                                          │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview      │  ← Users   maria@gmail.com                                 │
│  Moderation    │  [Change Tier]  [Change Role]  [Revoke Sessions]           │
│  Analytics     │                                                            │
│  Sources       │  ┌──────────────────────────┐ ┌─────────────────────────┐ │
│  Jobs          │  │ Account                  │ │ Gamification            │ │
│  Users & Orgs◀ │  │ Role:    [PARENT]        │ │ Streak:   12 days       │ │
│                │  │ Tier:    [FREE]           │ │ Longest:  18 days       │ │
│                │  │ Auth:    Google           │ │ Stickers: 34            │ │
│                │  │ Country: ES               │ │ Achiev.:  8             │ │
│                │  │ Created: Mar 10, 2026     │ │ Quiz ans: 47            │ │
│                │  │ Login:   2 days ago       │ │ News:     182           │ │
│                │  │ Org:     FC Barça Acad.   │ └─────────────────────────┘ │
│                │  └──────────────────────────┘                             │
│                │                                                            │
│                │  Parental Profile                                          │
│                │  PIN set: Yes  │  Allowed: all sports  │  Schedule: none  │
│                │                                                            │
│                │  Recent Activity (last 10)                                 │
│                │  ┌─────────────┬──────────┬────────────┬──────┬─────────┐ │
│                │  │ Type        │ Sport    │ Content ID │ Dur  │ Date    │ │
│                │  │ news_viewed │ Football │ clmabc123  │ 45s  │ 2d ago  │ │
│                │  │ quiz_answ.  │ —        │ —          │ —    │ 2d ago  │ │
│                │  └─────────────┴──────────┴────────────┴──────┴─────────┘ │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### Organization Detail Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin                                                          │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview      │  ← Organizations   FC Barcelona Academy                    │
│  Moderation    │  [Regenerate Code]  [Deactivate Org]                      │
│  Analytics     │                                                            │
│  Sources       │  ┌──────────────────────────────────────────────────────┐  │
│  Jobs          │  │ Sport: Football  │ Members: 47 / 100  │ Status: [OK]  │  │
│  Users & Orgs◀ │  │ Slug: fc-barce.. │ Invite: ABC123    [📋 Copy]       │  │
│                │  └──────────────────────────────────────────────────────┘  │
│                │                                                            │
│                │  Member Activity (last 30 days)                           │
│                │  ┌────────────────────────────────────────────────────┐   │
│                │  │              ___                                   │   │
│                │  │         ___/   \___/\___                          │   │
│                │  │ Mar5     Mar15      Mar25  Mar30                  │   │
│                │  └────────────────────────────────────────────────────┘   │
│                │                                                            │
│                │  Members (47)                                              │
│                │  ┌────────────────┬────────┬─────────┬──────┬──────────┐  │
│                │  │ Email          │ Role   │ Org Role│ Tier │ Login    │  │
│                │  │ coach@fcb.com  │[PARENT]│[ADMIN]  │[PREM]│ Today    │  │
│                │  │ kid1@fcb.com   │[CHILD] │[MEMBER] │[FREE]│ 2d ago   │  │
│                │  │ kid2@fcb.com   │[CHILD] │[MEMBER] │[FREE]│ 3d ago   │  │
│                │  └────────────────┴────────┴─────────┴──────┴──────────┘  │
└────────────────┴────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### Users

- `GET /api/admin/users?q=maria` returns users whose email contains "maria" (case-insensitive).
- `GET /api/admin/users?q=<exact-uuid>` returns the user with that exact ID.
- `GET /api/admin/users?role=admin` returns only admin users.
- `GET /api/admin/users?tier=premium` returns only premium users.
- `GET /api/admin/users/:id` response does NOT include `passwordHash`.
- `GET /api/admin/users/:id` includes `recentActivity` (last 10 entries).
- `GET /api/admin/users/:id` includes `stats.stickerCount` and `stats.achievementCount`.
- `PATCH /api/admin/users/:id/tier` with `{ tier: 'premium' }` updates the user's tier.
- `PATCH /api/admin/users/:id/role` with own user ID returns 403.
- `PATCH /api/admin/users/:id/role` with `{ role: 'admin' }` updates the user's role.
- `POST /api/admin/users/:id/revoke-tokens` deletes all RefreshToken records for the user.
- `POST /api/admin/users/:id/revoke-tokens` returns `{ revoked: N }` where N is the count deleted.
- Users list page renders with search input and filters.
- Search input is debounced (300ms) and triggers new fetch.
- User detail page renders all three sections (profile, parental, activity).
- Change Tier modal opens, shows current tier, allows selecting new tier.
- Change Role modal shows admin role warning.
- Revoke Tokens shows confirmation modal before executing.
- All actions show success toast or error feedback.

### Organizations

- `GET /api/admin/organizations` returns paginated list with `memberCount`.
- `GET /api/admin/organizations?sport=football` filters to football orgs.
- `GET /api/admin/organizations?active=false` filters to inactive orgs.
- `GET /api/admin/organizations/:id` includes full members list and activity summary.
- `PATCH /api/admin/organizations/:id` with `{ maxMembers: 50 }` succeeds when current member count ≤ 50.
- `PATCH /api/admin/organizations/:id` with `maxMembers` below current member count returns 400.
- `PATCH /api/admin/organizations/:id` with `{ active: false }` deactivates the org.
- Org list page renders with sport and status filters.
- Org detail page shows invite code with copy button.
- Regenerate Invite Code button calls the endpoint and updates displayed code.
- Deactivate Org opens confirmation modal.
- Activity chart renders with daily counts for last 30 days.
- All admin endpoints return 401 without auth, 403 without admin role.

---

## Technical Requirements

### New Files


| File                                                               | Description                |
| ------------------------------------------------------------------ | -------------------------- |
| `apps/web/src/app/(admin)/admin/users/page.tsx`                    | Users + Orgs list (tabbed) |
| `apps/web/src/app/(admin)/admin/users/[id]/page.tsx`               | User detail page           |
| `apps/web/src/app/(admin)/admin/users/organizations/[id]/page.tsx` | Org detail page            |


### Modified Files


| File                           | Change                        |
| ------------------------------ | ----------------------------- |
| `apps/api/src/routes/admin.ts` | Add all users + org endpoints |


### Excluding passwordHash

```typescript
// In GET /api/admin/users/:id:
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    // Explicitly list all fields EXCEPT passwordHash
    id: true, email: true, role: true, subscriptionTier: true,
    authProvider: true, socialId: true, country: true, locale: true,
    createdAt: true, updatedAt: true, lastLoginAt: true,
    favoriteSports: true, selectedFeeds: true,
    currentStreak: true, longestStreak: true, lastActiveDate: true,
    currentQuizCorrectStreak: true, quizPerfectCount: true,
    ageGateCompleted: true, consentGiven: true, consentDate: true, consentBy: true,
    organizationId: true, organizationRole: true, subscriptionExpiry: true,
    // passwordHash: NOT included
  },
});
```

### Org Activity Summary Query

The `activitySummary.dailyActivity` on the org detail page uses a direct query (not pre-computed snapshot) because it is organization-filtered:

```typescript
const rows = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
  SELECT DATE_TRUNC('day', al."createdAt") AS date, COUNT(*) AS count
  FROM "ActivityLog" al
  JOIN "User" u ON u.id = al."userId"
  WHERE u."organizationId" = ${orgId}
    AND al."createdAt" >= NOW() - INTERVAL '30 days'
  GROUP BY DATE_TRUNC('day', al."createdAt")
  ORDER BY date ASC
`;
```

### Debounced Search (Frontend)

```typescript
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// In component:
const debouncedSearch = useDebounce(searchInput, 300);
useEffect(() => { fetchUsers(debouncedSearch, roleFilter, tierFilter, 1); }, [debouncedSearch, roleFilter, tierFilter]);
```

### Invite Code Copy Button

```typescript
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs text-slate-400 hover:text-white ml-2"
    >
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  );
}
```

### Tier Change Warning

The Change Tier modal must display a warning:

> "This overrides RevenueCat data until the next webhook sync. If RevenueCat sends a webhook event for this user, it will overwrite this change."

This prevents confusion when support manually sets a tier but RevenueCat later reverts it via webhook.

---

## Implementation Decisions

**Why tabs (Users + Orgs) on one page instead of separate routes?**
The sidebar already has 6 items. Adding "Users" and "Organizations" as separate sidebar entries would make 7, reducing the sidebar to a list. Tabs on the same page group the two related entity types (users and their organizations) while keeping the sidebar clean. The detail pages still have their own routes.

**Why does the admin role endpoint block self-demotion?**
If an admin accidentally selects `child` for their own account and confirms, they would immediately lose admin access and have no way to revert via the UI. The `req.userId === id` check prevents this. Other admin users can still change the role if needed.

**Why does `maxMembers` validation check against current member count?**
Setting `maxMembers` below the current member count would create an inconsistent state: the org would be "over capacity" but existing members would not be removed. Since there is no eviction mechanism, we block this operation. The admin must manually remove members before reducing the limit.

**Why is org activity not pre-computed in AnalyticsSnapshot?**
Organizations are tenant-scoped: each org's activity is a filtered subset of `ActivityLog`. Pre-computing per-org metrics would require one snapshot row per org per day per metric — potentially thousands of rows if orgs scale. A direct filtered query on `ActivityLog` (bounded to 30 days with org join) is fast enough and simpler to maintain.

**Why exclude `passwordHash` via `select` instead of `omit`?**
Prisma's `omit` option is available but its behaviour differs across Prisma versions. The explicit `select` approach is unambiguous — the field cannot leak through because it is not listed. This is a security-critical pattern for any endpoint returning user data.

---

## Testing Decisions

**Unit tests** in `apps/api/src/routes/admin.test.ts`:

- `GET /api/admin/users` search by email (case-insensitive match).
- `GET /api/admin/users` search by exact ID.
- `GET /api/admin/users/:id` response does not contain `passwordHash`.
- `PATCH /api/admin/users/:id/role` with self-ID returns 403.
- `POST /api/admin/users/:id/revoke-tokens` returns count of deleted tokens.
- `GET /api/admin/organizations` returns `memberCount`.
- `PATCH /api/admin/organizations/:id` with `maxMembers` below member count returns 400.
- All endpoints return 401 without auth, 403 without admin role.

---

## Out of Scope

- Impersonating a user (logging in as them to reproduce issues).
- Viewing a user's full quiz answer history.
- Exporting user data as CSV (GDPR data export — users have this via their account settings).
- Creating users from the admin UI (users self-register; admins use `create-admin.ts` script for admin accounts).
- Deleting users from the admin UI (data deletion goes through `DELETE /api/users/:id/data` which requires parental session for minors — not a simple admin toggle).
- Merging duplicate user accounts.
- Direct message / email to a user from the admin UI.

---

## Future Considerations

- Add an audit log: record every admin action (who changed what, when) in a new `AdminAuditLog` model.
- Impersonation mode: allow admin to preview the app as a specific user (read-only, no writes).
- Bulk tier change: upload CSV of user IDs and new tiers.
- User flags: soft-ban users from creating content reports or adding custom sources.
- Organization member activity breakdown: per-member activity chart inside org detail.

