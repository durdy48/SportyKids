# Phase 6, PRD 3: B2B Channel — Clubs & Academies

| Field | Value |
|-------|-------|
| **Phase** | 6.3 — B2B Channel for Clubs & Academies |
| **Priority** | P1 (high-impact distribution channel with lower CAC) |
| **Target** | Month 2 post-launch (v1.2.0) |
| **Dependencies** | Phase 6.1 (Subscription Monetization) complete, PRD 1 `subscriptionTier` field live |
| **Estimated effort** | 10-14 days |
| **Pricing** | 1.99 EUR/child/month (organization-managed) |

---

## 1. Overview / Problem Statement

Consumer acquisition for a children's app is expensive. Parents must discover the app, trust it, install it, complete the age gate, and onboard their child. Each step has significant drop-off.

Sports clubs and academies are a natural B2B distribution channel: a single decision-maker (the club coordinator or coach) can onboard 20-100 children at once. The club lends credibility ("your coach recommends it"), children arrive pre-segmented by sport, and the club handles billing centrally.

This PRD defines the MVP of the B2B channel: an `Organization` entity, invite-code-based enrollment, a club admin dashboard, and an alternative onboarding flow for club members.

---

## 2. Goals and Non-Goals

### Goals

1. **Organization model**: Clubs/academies as first-class entities with branding, sport, and member management.
2. **Invite code enrollment**: Children join an organization by entering a 6-character alphanumeric code during onboarding or post-signup.
3. **Organization admin role**: A new `orgAdmin` role that can view group activity, manage members, and configure organization settings.
4. **Simplified onboarding**: Club members skip sport selection — the organization's sport is pre-applied.
5. **Club admin dashboard (web)**: Activity overview, member list, invite code management.
6. **Pricing enforcement**: Organization members get premium access (tier inherited from org), billed at 1.99 EUR/child/month.
7. **API-first**: All functionality exposed via REST endpoints, consumed by both web dashboard and mobile app.

### Non-Goals

- Payment processing integration (Stripe/RevenueCat for B2B billing — handled manually or via invoicing in MVP)
- Multi-sport organizations (one org = one primary sport; members can still browse other sports)
- White-label app builds per organization
- Organization-to-organization communication
- Custom RSS sources per organization (future enhancement)
- Parent dashboard within the organization context
- Organization discovery / public directory
- Transferring members between organizations

---

## 3. User Stories

### Club Coordinator (orgAdmin)

| ID | Story | Priority |
|----|-------|----------|
| B2B-1 | As a club coordinator, I want to create an organization so I can onboard my club's children. | P0 |
| B2B-2 | As a club coordinator, I want to generate and share an invite code so children can join my club. | P0 |
| B2B-3 | As a club coordinator, I want to see a dashboard of my club's aggregate activity (articles read, quizzes taken, streaks). | P0 |
| B2B-4 | As a club coordinator, I want to list all members and see their individual stats. | P0 |
| B2B-5 | As a club coordinator, I want to remove a member from my organization. | P1 |
| B2B-6 | As a club coordinator, I want to regenerate the invite code if it gets shared outside the club. | P1 |
| B2B-7 | As a club coordinator, I want to set my club's logo and colors for branded experience. | P2 |

### Child (club member)

| ID | Story | Priority |
|----|-------|----------|
| B2B-8 | As a child, I want to enter my club's invite code to join during onboarding. | P0 |
| B2B-9 | As a child, I want my club's sport to be pre-selected so I see relevant content immediately. | P0 |
| B2B-10 | As a child, I want to join a club after I have already created my account. | P1 |
| B2B-11 | As a child, I want to see my club's branding (logo, name) in the app. | P2 |

### Parent

| ID | Story | Priority |
|----|-------|----------|
| B2B-12 | As a parent, I want to see which organization my child belongs to. | P1 |
| B2B-13 | As a parent, I want parental controls to still work even if my child is in an organization. | P0 |

---

## 4. Data Model Changes

### 4.1 New Model: Organization

```prisma
model Organization {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique        // URL-friendly identifier
  sport         String                  // Primary sport (from SPORTS constant)
  logoUrl       String?
  customColors  Json?                   // { primary: '#hex', secondary: '#hex' }
  inviteCode    String   @unique        // 6-char alphanumeric, uppercase
  maxMembers    Int      @default(100)
  active        Boolean  @default(true)
  createdBy     String                  // userId of the orgAdmin who created it
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  members       User[]

  @@index([inviteCode])
  @@index([slug])
}
```

**Field details:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `cuid` | Primary key |
| `name` | `String` | Display name (e.g., "CD Leganes Academy") |
| `slug` | `String` (unique) | URL-safe identifier for dashboard routes |
| `sport` | `String` | Primary sport — must be one of `SPORTS` |
| `logoUrl` | `String?` | Club logo URL (optional) |
| `customColors` | `Json?` | Branding colors `{ primary, secondary }` |
| `inviteCode` | `String` (unique) | 6-character uppercase alphanumeric code |
| `maxMembers` | `Int` | Seat limit (default 100) |
| `active` | `Boolean` | Whether the org accepts new members |
| `createdBy` | `String` | userId of the creator (orgAdmin) |

### 4.2 User Model Changes

Add the following fields to the existing `User` model:

```prisma
model User {
  // ... existing fields ...

  // Organization (B2B)
  organizationId    String?
  organization      Organization? @relation(fields: [organizationId], references: [id])
  organizationRole  String?       // 'member' | 'admin' — null if not in an org

  @@index([organizationId])
}
```

**Field details:**

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | `String?` | FK to Organization. Null for consumer users. |
| `organizationRole` | `String?` | `'member'` for children, `'admin'` for club coordinators. Null if no org. |

### 4.3 Invite Code Format

- 6 characters, uppercase alphanumeric: `[A-Z0-9]{6}`
- Excludes ambiguous characters: `O`, `0`, `I`, `1`, `L` (to avoid confusion when shared verbally)
- Effective alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (28 chars)
- Total combinations: 28^6 = ~481 million (more than sufficient)
- Generated server-side with collision check

---

## 5. API Specification

### 5.1 Organization CRUD

#### `POST /api/organizations`

Create a new organization. Requires authenticated user with `role: 'parent'` or system admin.

**Request body:**

```json
{
  "name": "CD Leganes Academy",
  "sport": "football",
  "logoUrl": "https://example.com/logo.png",
  "customColors": { "primary": "#2563EB", "secondary": "#22C55E" },
  "maxMembers": 50
}
```

**Validation (Zod):**

```typescript
const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  sport: z.enum(SPORTS),
  logoUrl: z.string().url().optional(),
  customColors: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  }).optional(),
  maxMembers: z.number().int().min(5).max(500).optional()
});
```

**Response (201):**

```json
{
  "id": "clx...",
  "name": "CD Leganes Academy",
  "slug": "cd-leganes-academy",
  "sport": "football",
  "logoUrl": "https://example.com/logo.png",
  "customColors": { "primary": "#2563EB", "secondary": "#22C55E" },
  "inviteCode": "HK7M3P",
  "maxMembers": 50,
  "active": true,
  "createdBy": "clx...",
  "memberCount": 0
}
```

**Side effects:**
- Sets the creator's `organizationId` to the new org and `organizationRole` to `'admin'`.
- Generates a unique 6-character invite code.

---

#### `GET /api/organizations/:id`

Get organization details. Requires `orgAdmin` of the org or system admin.

**Response (200):**

```json
{
  "id": "clx...",
  "name": "CD Leganes Academy",
  "slug": "cd-leganes-academy",
  "sport": "football",
  "logoUrl": "https://example.com/logo.png",
  "customColors": { "primary": "#2563EB", "secondary": "#22C55E" },
  "inviteCode": "HK7M3P",
  "maxMembers": 50,
  "active": true,
  "memberCount": 23,
  "createdAt": "2026-04-15T10:00:00Z"
}
```

---

#### `PUT /api/organizations/:id`

Update organization settings. Requires `orgAdmin` of the org.

**Request body (partial):**

```json
{
  "name": "CD Leganes Youth Academy",
  "logoUrl": "https://example.com/new-logo.png",
  "customColors": { "primary": "#DC2626", "secondary": "#FBBF24" },
  "maxMembers": 75,
  "active": false
}
```

**Validation:** Same schema as create, all fields optional. `sport` cannot be changed after creation. `inviteCode` cannot be set directly (use regenerate endpoint).

---

#### `POST /api/organizations/:id/regenerate-code`

Regenerate invite code. Requires `orgAdmin` of the org. Invalidates the previous code immediately.

**Response (200):**

```json
{
  "inviteCode": "R4WN8V"
}
```

---

### 5.2 Membership

#### `POST /api/auth/join-organization`

Join an organization using an invite code. Requires authenticated user (any role).

**Request body:**

```json
{
  "inviteCode": "HK7M3P"
}
```

**Validation:**

```typescript
const JoinOrganizationSchema = z.object({
  inviteCode: z.string().length(6).regex(/^[A-Z0-9]{6}$/)
});
```

**Response (200):**

```json
{
  "organizationId": "clx...",
  "organizationName": "CD Leganes Academy",
  "sport": "football",
  "message": "Successfully joined the organization"
}
```

**Error responses:**

| Code | Condition |
|------|-----------|
| 400 | Invalid invite code format |
| 404 | No organization with that invite code |
| 409 | User already belongs to an organization |
| 403 | Organization is not active |
| 422 | Organization has reached maxMembers |

**Side effects:**
- Sets user's `organizationId` and `organizationRole` to `'member'`.
- If user has no `favoriteSports` set, adds the org's sport to `favoriteSports`.

---

#### `DELETE /api/organizations/:id/members/:userId`

Remove a member from the organization. Requires `orgAdmin` of the org.

**Response (200):**

```json
{
  "message": "Member removed"
}
```

**Side effects:**
- Sets the user's `organizationId` to null and `organizationRole` to null.
- Does NOT delete the user account or any activity data.

---

#### `POST /api/organizations/:id/leave`

Leave an organization voluntarily. Requires authenticated user who is a member.

**Response (200):**

```json
{
  "message": "Left organization"
}
```

**Restriction:** An `orgAdmin` cannot leave their own organization. They must transfer admin role first or delete the organization.

---

### 5.3 Activity & Members

#### `GET /api/organizations/:id/members`

List organization members with basic stats. Requires `orgAdmin` of the org.

**Query params:** `?page=1&limit=20&sort=name|lastActive|streak`

**Response (200):**

```json
{
  "members": [
    {
      "id": "clx...",
      "name": "Lucas",
      "age": 10,
      "totalPoints": 450,
      "currentStreak": 7,
      "lastActiveDate": "2026-04-14T18:30:00Z",
      "joinedAt": "2026-04-01T10:00:00Z"
    }
  ],
  "total": 23,
  "page": 1,
  "limit": 20
}
```

**Privacy:** Only exposes `name`, `age`, `totalPoints`, `currentStreak`, `lastActiveDate`, and join date. No email, no parental info, no detailed activity logs.

---

#### `GET /api/organizations/:id/activity`

Aggregate activity for the organization. Requires `orgAdmin` of the org.

**Query params:** `?period=7d|30d|all`

**Response (200):**

```json
{
  "period": "7d",
  "summary": {
    "totalMembers": 23,
    "activeMembers": 18,
    "totalNewsRead": 342,
    "totalReelsWatched": 156,
    "totalQuizAnswered": 89,
    "averageStreak": 4.2,
    "averagePoints": 280
  },
  "daily": [
    {
      "date": "2026-04-14",
      "activeMembers": 15,
      "newsRead": 52,
      "reelsWatched": 24,
      "quizAnswered": 13
    }
  ],
  "topMembers": [
    { "name": "Lucas", "points": 450, "streak": 7 },
    { "name": "Sofia", "points": 420, "streak": 5 },
    { "name": "Diego", "points": 390, "streak": 12 }
  ]
}
```

**Aggregation:** Uses `ActivityLog` table, grouped by `userId` where `user.organizationId` matches. `topMembers` returns top 5 by points.

---

### 5.4 Endpoint Summary

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/organizations` | requireAuth + parent/admin | Create organization |
| GET | `/api/organizations/:id` | requireAuth + orgAdmin | Get organization details |
| PUT | `/api/organizations/:id` | requireAuth + orgAdmin | Update organization |
| POST | `/api/organizations/:id/regenerate-code` | requireAuth + orgAdmin | Regenerate invite code |
| GET | `/api/organizations/:id/members` | requireAuth + orgAdmin | List members with stats |
| DELETE | `/api/organizations/:id/members/:userId` | requireAuth + orgAdmin | Remove member |
| POST | `/api/organizations/:id/leave` | requireAuth + member | Leave organization |
| POST | `/api/auth/join-organization` | requireAuth | Join with invite code |
| GET | `/api/organizations/:id/activity` | requireAuth + orgAdmin | Group activity stats |

---

## 6. Authorization Model

### 6.1 New Middleware: `requireOrgAdmin`

```typescript
// Checks: user is authenticated, user.organizationId === req.params.id,
//         user.organizationRole === 'admin'
function requireOrgAdmin(req, res, next) {
  const user = req.user;
  const orgId = req.params.id;
  if (!user) return res.status(401).json({ error: 'auth_required' });
  if (user.organizationId !== orgId || user.organizationRole !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}
```

### 6.2 Permission Matrix

| Action | Anonymous | Child (no org) | Org Member | Org Admin | Parent | System Admin |
|--------|-----------|----------------|------------|-----------|--------|-------------|
| Create organization | No | No | No | No | Yes | Yes |
| View organization | No | No | Own org | Own org | Child's org | Any |
| Edit organization | No | No | No | Own org | No | Any |
| Join organization | No | Yes | No (already in one) | No | No | No |
| Leave organization | No | No | Yes | No (must transfer) | No | No |
| View members | No | No | No | Own org | No | Any |
| Remove member | No | No | No | Own org | No | Any |
| View group activity | No | No | No | Own org | No | Any |
| Regenerate code | No | No | No | Own org | No | Any |

---

## 7. Onboarding Flow Changes

### 7.1 Standard Onboarding (unchanged)

```
Age Gate → Name/Age → Sport Selection → Favorite Team → Push Prefs → Home
```

### 7.2 Organization Onboarding (new path)

```
Age Gate → Name/Age → Enter Invite Code → (sport auto-set from org) → Favorite Team → Push Prefs → Home
```

**Trigger:** A new optional step appears between Name/Age and Sport Selection: "Do you have a club code?" If the user enters a valid code, sport selection is skipped and the org's sport is applied.

**Skip logic:**
- If `user.organizationId` is set and the org has a `sport`, skip the sport selection step.
- `favoriteSports` is set to `[organization.sport]` automatically.
- The user can still add more sports later from settings (if premium).

### 7.3 Post-Signup Join

Users who already completed onboarding can join an organization from:
- **Mobile:** Settings screen → "Join a Club" button → invite code input
- **Web:** NavBar dropdown → "Join a Club" → invite code modal

---

## 8. UI Specifications

### 8.1 Mobile: Join Organization Screen

**Route:** `JoinOrganization` (new screen in navigation stack)

**Layout:**
```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│    🏟️                       │
│  Join Your Club             │
│                             │
│  Enter the code your coach  │
│  gave you                   │
│                             │
│  ┌─┬─┬─┬─┬─┬─┐             │
│  │H│K│7│M│3│P│             │
│  └─┴─┴─┴─┴─┴─┘             │
│                             │
│  [ Join Club ]              │
│                             │
│  Skip — I don't have a code │
│                             │
└─────────────────────────────┘
```

**Components:**
- 6 individual character input boxes (auto-advance, uppercase forced)
- "Join Club" button (disabled until 6 chars entered)
- "Skip" link at the bottom
- On success: show organization name + logo briefly, then continue onboarding
- On error: inline error message below the input boxes

### 8.2 Web: Organization Admin Dashboard

**Route:** `/organizations/:slug` (new page, requires orgAdmin)

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  NavBar                                              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [Logo] CD Leganes Academy          [Settings ⚙️]    │
│  Football · 23 members · Code: HK7M3P [Copy]        │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Period: [7d] [30d] [All]                            │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Active   │ │ Articles │ │ Avg      │             │
│  │ 18/23    │ │ 342 read │ │ Streak   │             │
│  │ members  │ │ this week│ │ 4.2 days │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│                                                      │
│  Daily Activity Chart (bar chart, 7 bars)            │
│  ┌──────────────────────────────────────┐            │
│  │  ██                                  │            │
│  │  ██  ██                              │            │
│  │  ██  ██  ██  ██                      │            │
│  │  ██  ██  ██  ██  ██  ██  ██          │            │
│  └──────────────────────────────────────┘            │
│                                                      │
│  Top Members                                         │
│  ┌──────────────────────────────────────┐            │
│  │ 🥇 Lucas    450 pts   🔥 7 days     │            │
│  │ 🥈 Sofia    420 pts   🔥 5 days     │            │
│  │ 🥉 Diego    390 pts   🔥 12 days    │            │
│  └──────────────────────────────────────┘            │
│                                                      │
│  Members (23)                    [Search] [Sort ▼]   │
│  ┌──────────────────────────────────────┐            │
│  │ Lucas, 10    450 pts  Active today   │            │
│  │ Sofia, 9     420 pts  Active today   │            │
│  │ Diego, 12    390 pts  2 days ago     │ [Remove]  │
│  │ ...                                  │            │
│  └──────────────────────────────────────┘            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Components (new):**
- `OrganizationDashboard.tsx` — main dashboard page component
- `OrgActivitySummary.tsx` — stat cards (active members, articles, streak)
- `OrgActivityChart.tsx` — daily bar chart (CSS-only, no chart library)
- `OrgMemberList.tsx` — paginated member table with sort and search
- `OrgSettings.tsx` — modal for editing name, logo, colors, regenerate code

### 8.3 Web: Join Organization Modal

**Trigger:** "Join a Club" button in NavBar dropdown or settings page.

```
┌───────────────────────────────┐
│  Join Your Club         [✕]   │
│                               │
│  Enter the invite code from   │
│  your coach or academy        │
│                               │
│  ┌─────────────────────────┐  │
│  │  HK7M3P                 │  │
│  └─────────────────────────┘  │
│                               │
│  [Cancel]        [Join Club]  │
└───────────────────────────────┘
```

---

## 9. Subscription & Pricing Integration

### 9.1 Organization Subscription Tier

Organization members receive premium-equivalent access while they are part of the organization. This is independent of the individual subscription system from PRD 1.

**Logic in `subscription.ts`:**

```typescript
function getEffectiveTier(user: User): 'free' | 'premium' {
  // 1. If user belongs to an active organization, they get premium
  if (user.organizationId && user.organization?.active) {
    return 'premium';
  }
  // 2. Otherwise, check individual subscription
  return user.subscriptionTier;
}
```

### 9.2 Billing Model (MVP)

For the MVP, organization billing is handled outside the app:

- Club coordinator contacts SportyKids via email
- Invoice sent monthly: memberCount x 1.99 EUR
- Manual activation: SportyKids admin sets `organization.active = true`
- If payment lapses: `organization.active = false` — members fall back to their individual tier

**Future (post-MVP):** Stripe integration for self-service org billing with seat-based pricing.

---

## 10. i18n Keys

Add to `packages/shared/src/i18n/en.json`:

```json
{
  "org": {
    "join_title": "Join Your Club",
    "join_subtitle": "Enter the code your coach gave you",
    "join_button": "Join Club",
    "join_skip": "Skip — I don't have a code",
    "join_success": "Welcome to {{name}}!",
    "join_error_invalid": "Invalid invite code",
    "join_error_full": "This club has reached its member limit",
    "join_error_inactive": "This club is no longer active",
    "join_error_already_member": "You already belong to a club",
    "leave_title": "Leave Club",
    "leave_confirm": "Are you sure you want to leave {{name}}?",
    "leave_button": "Leave Club",
    "dashboard_title": "Club Dashboard",
    "dashboard_members": "Members",
    "dashboard_active": "Active",
    "dashboard_articles_read": "Articles Read",
    "dashboard_avg_streak": "Avg Streak",
    "dashboard_top_members": "Top Members",
    "dashboard_period_7d": "7 days",
    "dashboard_period_30d": "30 days",
    "dashboard_period_all": "All time",
    "settings_title": "Club Settings",
    "settings_name": "Club Name",
    "settings_logo": "Logo URL",
    "settings_colors": "Club Colors",
    "settings_invite_code": "Invite Code",
    "settings_regenerate": "Regenerate Code",
    "settings_regenerate_confirm": "This will invalidate the current code. Continue?",
    "settings_max_members": "Max Members",
    "member_remove": "Remove Member",
    "member_remove_confirm": "Remove {{name}} from the club?",
    "member_joined": "Joined {{date}}",
    "member_last_active": "Last active {{date}}",
    "code_copied": "Code copied to clipboard",
    "create_title": "Create a Club",
    "create_button": "Create Club"
  },
  "a11y": {
    "org_code_input": "Invite code character {{position}} of 6",
    "org_dashboard": "Club dashboard",
    "org_member_list": "Club member list",
    "org_remove_member": "Remove {{name}} from club",
    "org_copy_code": "Copy invite code to clipboard",
    "org_regenerate_code": "Generate new invite code"
  }
}
```

Add equivalent keys to `packages/shared/src/i18n/es.json`:

```json
{
  "org": {
    "join_title": "Unete a tu club",
    "join_subtitle": "Introduce el codigo que te dio tu entrenador",
    "join_button": "Unirme al club",
    "join_skip": "Saltar — No tengo codigo",
    "join_success": "Bienvenido a {{name}}!",
    "join_error_invalid": "Codigo de invitacion no valido",
    "join_error_full": "Este club ha alcanzado su limite de miembros",
    "join_error_inactive": "Este club ya no esta activo",
    "join_error_already_member": "Ya perteneces a un club",
    "leave_title": "Salir del club",
    "leave_confirm": "Estas seguro de que quieres salir de {{name}}?",
    "leave_button": "Salir del club",
    "dashboard_title": "Panel del club",
    "dashboard_members": "Miembros",
    "dashboard_active": "Activos",
    "dashboard_articles_read": "Articulos leidos",
    "dashboard_avg_streak": "Racha media",
    "dashboard_top_members": "Mejores miembros",
    "dashboard_period_7d": "7 dias",
    "dashboard_period_30d": "30 dias",
    "dashboard_period_all": "Todo",
    "settings_title": "Ajustes del club",
    "settings_name": "Nombre del club",
    "settings_logo": "URL del logo",
    "settings_colors": "Colores del club",
    "settings_invite_code": "Codigo de invitacion",
    "settings_regenerate": "Regenerar codigo",
    "settings_regenerate_confirm": "Esto invalidara el codigo actual. Continuar?",
    "settings_max_members": "Maximo de miembros",
    "member_remove": "Eliminar miembro",
    "member_remove_confirm": "Eliminar a {{name}} del club?",
    "member_joined": "Se unio el {{date}}",
    "member_last_active": "Activo por ultima vez {{date}}",
    "code_copied": "Codigo copiado al portapapeles",
    "create_title": "Crear un club",
    "create_button": "Crear club"
  },
  "a11y": {
    "org_code_input": "Caracter {{position}} de 6 del codigo de invitacion",
    "org_dashboard": "Panel del club",
    "org_member_list": "Lista de miembros del club",
    "org_remove_member": "Eliminar a {{name}} del club",
    "org_copy_code": "Copiar codigo de invitacion",
    "org_regenerate_code": "Generar nuevo codigo de invitacion"
  }
}
```

---

## 11. Files to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `apps/api/src/routes/organizations.ts` | All organization REST endpoints |
| `apps/api/src/middleware/require-org-admin.ts` | `requireOrgAdmin` middleware |
| `apps/api/src/services/invite-code.ts` | Invite code generation and validation |
| `apps/web/src/app/organizations/[slug]/page.tsx` | Organization admin dashboard |
| `apps/web/src/components/OrgDashboard.tsx` | Dashboard main component |
| `apps/web/src/components/OrgActivitySummary.tsx` | Stat cards |
| `apps/web/src/components/OrgActivityChart.tsx` | Daily activity bar chart |
| `apps/web/src/components/OrgMemberList.tsx` | Paginated member list |
| `apps/web/src/components/OrgSettings.tsx` | Settings modal |
| `apps/web/src/components/JoinOrgModal.tsx` | Join organization modal |
| `apps/mobile/src/screens/JoinOrganization.tsx` | Mobile join screen |

### Modified files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `Organization` model, add `organizationId`/`organizationRole` to `User` |
| `apps/api/src/routes/index.ts` (or server entry) | Register `/api/organizations` routes |
| `apps/api/src/services/subscription.ts` | `getEffectiveTier` checks org membership |
| `apps/web/src/components/OnboardingWizard.tsx` | Add optional "Join Club" step |
| `apps/web/src/components/NavBar.tsx` | Add "Join a Club" to user dropdown |
| `apps/mobile/src/screens/Onboarding.tsx` | Add optional invite code step |
| `apps/mobile/src/navigation/index.tsx` | Add `JoinOrganization` screen to stack |
| `packages/shared/src/i18n/en.json` | Add `org.*` and `a11y.org_*` keys |
| `packages/shared/src/i18n/es.json` | Add `org.*` and `a11y.org_*` keys |
| `packages/shared/src/types/index.ts` | Add `Organization` type export |

---

## 12. Security Considerations

### 12.1 Invite Code Brute Force

- The 6-char code from a 28-char alphabet has ~481M combinations.
- Rate limit the `POST /api/auth/join-organization` endpoint: **5 attempts per minute per IP** (reuse `RATE_LIMIT_AUTH` tier).
- After 10 failed attempts from the same user, block further attempts for 15 minutes (reuse PIN lockout logic).

### 12.2 Data Privacy (COPPA / GDPR-K)

- Club admins see only: child's name, age, points, streak, and last active date.
- Club admins do NOT see: email, parental info, detailed activity content, or parental control settings.
- Parental controls always override organization settings. A parent can still restrict sports, formats, and time limits regardless of org membership.
- The `DELETE /api/users/:id/data` endpoint (GDPR Art. 17) also clears `organizationId` — the user vanishes from the member list.

### 12.3 Organization Admin Trust

- Only users with `role: 'parent'` can create organizations (ensures an adult is behind the org).
- The `orgAdmin` role is separate from system `admin` — an orgAdmin has no access to other organizations or system-wide data.
- Organization creation could be gated behind manual approval in the future.

---

## 13. Acceptance Criteria

### P0 (must ship)

- [ ] `Organization` model exists in Prisma schema with all specified fields.
- [ ] `User` model has `organizationId` and `organizationRole` fields.
- [ ] `POST /api/organizations` creates an org, generates invite code, sets creator as admin.
- [ ] `POST /api/auth/join-organization` validates code, checks capacity, adds user to org.
- [ ] `GET /api/organizations/:id/members` returns paginated member list with stats.
- [ ] `GET /api/organizations/:id/activity` returns aggregate activity for the specified period.
- [ ] Organization members receive premium-equivalent access (`getEffectiveTier` returns `'premium'`).
- [ ] Mobile: invite code input screen works during onboarding and post-signup.
- [ ] Web: organization admin dashboard shows activity summary and member list.
- [ ] Onboarding skips sport selection when org sport is auto-applied.
- [ ] Parental controls still work for org members (time limits, schedule lock, format restrictions).
- [ ] Rate limiting on join-organization endpoint prevents brute force.
- [ ] All user-facing strings use i18n keys in both EN and ES.

### P1 (should ship)

- [ ] `DELETE /api/organizations/:id/members/:userId` removes a member.
- [ ] `POST /api/organizations/:id/leave` allows voluntary departure.
- [ ] `POST /api/organizations/:id/regenerate-code` invalidates old code.
- [ ] `PUT /api/organizations/:id` updates org settings (name, logo, colors, maxMembers).
- [ ] Web dashboard has period selector (7d, 30d, all).
- [ ] Member list supports sort by name, last active, and streak.
- [ ] Parent can see which organization their child belongs to in parental panel.
- [ ] GDPR data deletion removes org membership cleanly.

### P2 (nice to have)

- [ ] Organization branding (logo, colors) visible in child's app experience.
- [ ] Web dashboard shows daily activity bar chart.
- [ ] Top members leaderboard on dashboard.
- [ ] Copy invite code to clipboard button.

---

## 14. Testing Strategy

### 14.1 Unit Tests (Vitest)

| Test file | Coverage target |
|-----------|----------------|
| `apps/api/src/routes/__tests__/organizations.test.ts` | CRUD endpoints, validation, error cases |
| `apps/api/src/services/__tests__/invite-code.test.ts` | Code generation, uniqueness, format |
| `apps/api/src/middleware/__tests__/require-org-admin.test.ts` | Auth checks, role validation |
| `apps/web/src/components/__tests__/OrgDashboard.test.tsx` | Render with mock data, period switching |
| `apps/web/src/components/__tests__/OrgMemberList.test.tsx` | Pagination, sort, remove |
| `apps/web/src/components/__tests__/JoinOrgModal.test.tsx` | Input validation, success/error states |
| `apps/mobile/src/screens/__tests__/JoinOrganization.test.tsx` | Code input, API call, navigation |

**Key test cases for `organizations.test.ts`:**

```
POST /api/organizations
  ✓ creates org with valid data and returns invite code
  ✓ rejects if user is not authenticated
  ✓ rejects if user role is not parent
  ✓ rejects invalid sport value
  ✓ rejects duplicate slug
  ✓ sets creator as orgAdmin

POST /api/auth/join-organization
  ✓ joins org with valid invite code
  ✓ rejects invalid code format
  ✓ returns 404 for non-existent code
  ✓ returns 409 if user already in an org
  ✓ returns 403 if org is inactive
  ✓ returns 422 if org is at capacity
  ✓ auto-sets favoriteSports from org sport
  ✓ rate-limited to 5 attempts per minute

GET /api/organizations/:id/members
  ✓ returns paginated member list
  ✓ rejects non-orgAdmin
  ✓ supports sort by name, lastActive, streak
  ✓ does not expose email or parental info

GET /api/organizations/:id/activity
  ✓ returns aggregate stats for 7d period
  ✓ returns daily breakdown
  ✓ returns top 5 members by points
  ✓ rejects non-orgAdmin

DELETE /api/organizations/:id/members/:userId
  ✓ removes member and clears organizationId
  ✓ rejects if requester is not orgAdmin
  ✓ cannot remove self (admin)

POST /api/organizations/:id/regenerate-code
  ✓ generates new unique code
  ✓ old code no longer works
```

### 14.2 E2E Tests (Playwright)

Add one spec file: `apps/web/e2e/organization.spec.ts`

**Flows:**

1. **Create organization:** Login as parent → create org → verify dashboard shows → copy invite code.
2. **Join organization:** Login as child → enter invite code → verify sport auto-set → verify premium access.
3. **Dashboard activity:** Seed org with members and activity → verify stats render correctly.

### 14.3 Manual Testing Checklist

- [ ] Create org on web → share code → child joins on mobile → verify dashboard updates.
- [ ] Child in org hits paywall content → verify premium access (no upgrade prompt).
- [ ] Parent sets time limit on org member child → verify limit still enforced.
- [ ] Org admin removes member → verify member loses premium, can browse as free tier.
- [ ] Regenerate invite code → verify old code rejected, new code works.
- [ ] Child in org runs GDPR deletion → verify removed from member list.
- [ ] Org reaches maxMembers → verify new join attempts return 422.
- [ ] Deactivate org → verify members fall back to individual subscription tier.

---

## 15. Migration Plan

### 15.1 Database Migration

```sql
-- CreateTable: Organization
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "logoUrl" TEXT,
    "customColors" JSONB,
    "inviteCode" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Add columns to User
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "User" ADD COLUMN "organizationRole" TEXT;

-- Create indexes
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_inviteCode_key" ON "Organization"("inviteCode");
CREATE INDEX "Organization_inviteCode_idx" ON "Organization"("inviteCode");
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- Add foreign key
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### 15.2 Rollback

- Drop FK constraint on `User.organizationId`
- Drop columns `organizationId`, `organizationRole` from `User`
- Drop `Organization` table

No data loss: existing users are unaffected (both new fields are nullable).

---

## 16. Rollout Plan

| Phase | Duration | Actions |
|-------|----------|---------|
| 1. Internal | 2 days | Deploy to staging. Create test org. Validate all endpoints. |
| 2. Pilot | 2 weeks | Onboard 2-3 real clubs (direct contact). Monitor activity and feedback. |
| 3. Iterate | 1 week | Fix issues from pilot feedback. Polish dashboard UX. |
| 4. Launch | Ongoing | Open org creation to all parent accounts. Marketing material for clubs. |

---

## 17. Metrics

| Metric | Target (3 months) |
|--------|--------------------|
| Organizations created | 10+ |
| Total org members | 200+ |
| Org member D7 retention | > 40% (vs. ~25% for consumer) |
| Avg members per org | 20+ |
| Org member avg streak | > 5 days |
| Revenue from B2B | > 200 EUR/month |

---

## 18. Open Questions

1. **Should org admins be able to create quizzes specific to their club?** Deferred — would require a quiz editor UI and content moderation for user-generated questions.
2. **Should org members see a leaderboard within their club?** High engagement potential but may create pressure. Recommend opt-in per org.
3. **Should we support multiple admins per organization?** Useful for larger clubs. Deferred to post-MVP — for now, one admin per org.
4. **Should there be an org-specific feed?** E.g., the club's own news or announcements. High value but requires a CMS-like feature. Deferred.
5. **Stripe integration timeline?** Manual invoicing works for <20 orgs. Plan Stripe integration when reaching 10+ active orgs.

Al