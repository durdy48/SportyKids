# Code Review: Admin Dashboard

## Summary

Pass with notes. The implementation covers all five PRD sprints (S1–S5: Shared Infrastructure, Content Moderation, Overview, Jobs, Source Management, Analytics) with a comprehensive test suite (763 API tests, 151 web tests, all passing). There are no security holes or data-loss risks. Two critical issues require fixes before this branch merges: a type mismatch in `AdminBadge` usage (renders empty badges) and a `JOB_FREQUENCIES` value for `sync-feeds` that diverges from the actual cron schedule, causing incorrect STALE detection.

---

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| Route group restructuring `(main)` / `(admin)` | prd.md A2 | OK | Root layout minimal, main layout has UserProvider+NavBar, admin layout has own UserProvider |
| Admin auth check — redirect non-admin to `/` | prd.md A3 | OK | `AdminLayoutInner` + `useEffect` + loading state matches PRD spec |
| `AdminSidebar` with 6 nav links and active highlight | prd.md A4 | Issue | Sidebar has 5 links — "Users & Orgs" is missing |
| `AdminBadge` API: `label` prop | prd.md A5 | Issue | Component declares `label` prop but callers pass JSX children — badges render empty |
| `AdminMetricCard` and `AdminTable` components | prd.md A5 | OK | Correct interfaces, sortable th with keyboard support, stable row keys |
| NavBar conditional admin link | prd.md A6 | OK | Renders only when `user?.role === 'admin'` |
| `create-admin.ts` script: create or promote | prd.md A7 | OK | Crypto-safe temp password, bcrypt, email regex validation, exits 0/1 |
| `GET /api/admin/moderation/pending` with type/sport/source/page/limit | prd.md B1 | OK | Typed Prisma where clauses; sorts oldest-first after merge |
| `PATCH /admin/content/:type/:id/approve` and `/reject` | prd.md B1 | OK | Zod on reject body; missing P2025→404 (see Warnings) |
| `POST /admin/content/batch` with max-100 and reject-requires-reason | prd.md B1 | OK | Zod `refine` enforces reason requirement |
| `GET /api/admin/reports` + `PATCH /api/admin/reports/:id` with cascade | prd.md B1 | OK | Cascade reject swallows P2025 for already-deleted content (intentional) |
| `GET /api/admin/overview` — KPIs, alerts, subscriptionBreakdown, 5-min cache | prd2.md | OK | `withCache` middleware; `buildAlerts` helper with correct alert rules |
| `GET /api/admin/analytics/activity-chart` — cached until midnight UTC | prd2.md | OK | Manual cache with `msUntilMidnightUTC()` TTL; `$queryRaw` DATE_TRUNC |
| Stale RSS alert includes sources with null `lastSyncedAt` | prd2.md | OK | OR clause applied post-review |
| `JobRun` model with `@@index([jobName, startedAt])` | prd3.md | OK | Present in schema.prisma |
| All 10 job files export `run*` with JobRun instrumentation | prd3.md | OK | `existingRunId` pattern avoids double-create race condition |
| `job-runner.ts`: `KNOWN_JOBS`, `JOB_FREQUENCIES`, `triggerJob()` | prd3.md | OK | Static imports; startup sync assertion (skipped in test env) |
| `sync-feeds` frequency in `JOB_FREQUENCIES` = 30 min | prd3.md | Issue | Set to 60; actual cron is every 30 min — STALE detected after 2h instead of 1h |
| `GET /api/admin/jobs` — 11 entries, bounded query, correct statusLabels | prd3.md | OK | `take: KNOWN_JOBS.length * 5`; stuck-running→ERROR after 3× frequency |
| `POST /api/admin/jobs/:name/trigger` — 202, `syncLimiter`, 404 for unknown | prd3.md | OK | Rate-limited to 2 req/min |
| `GET /api/admin/sources/rss` and `/video` — pagination, newsCount, isStale | prd4.md | OK | N+1 acknowledged in comments; 2h/8h stale thresholds correct |
| RSS source creation validates feed reachability (5s timeout, 422 on fail) | prd4.md | OK | `AdminRssParser` alias allows test mocking |
| Delete predefined source returns 403 | prd4.md | OK | Guard on `isCustom` |
| `AnalyticsSnapshot` with `@@unique([date, metric])` and `@@index([date])` | prd5.md | OK | Present in schema.prisma |
| `admin-stats.ts`: 11 pure metric computation functions | prd5.md | OK | All present; tested independently with 21 unit tests |
| `compute-analytics` job registered at `0 2 * * *` | prd5.md | OK | `startComputeAnalyticsJob()` called in `index.ts` |
| `GET /api/admin/analytics/snapshot` — date range + metric filter | prd5.md | OK | Date NaN validation; Prisma indexed query |
| `GET /api/admin/analytics/top-content` — `$queryRaw`, cached 5 min | prd5.md | OK | BigInt cast to `Number(row.views)` |

---

## TODO: Critical Issues (must fix)

- [x] **`apps/web/src/components/admin/AdminBadge.tsx` + callers** — `AdminBadge` declares `{ label: string; variant: BadgeVariant }` but callers in `apps/web/src/app/(admin)/admin/page.tsx:393–395` and `apps/web/src/app/(admin)/admin/jobs/page.tsx:159–161,371–373` pass content as JSX children (`<AdminBadge variant={...}>{job.statusLabel}</AdminBadge>`). The `label` prop is never passed so the badge renders empty text — the status label is invisible in the UI. Fix by changing all callers to pass `label={job.statusLabel}` as a prop, or add `children?: React.ReactNode` to the component and render `{label ?? children}`. The prop-based fix (option a) is preferred to keep the interface explicit.

- [x] **`apps/api/src/services/job-runner.ts:16`** — `JOB_FREQUENCIES['sync-feeds']` is `60` minutes but the cron in `sync-feeds.ts` runs every `30` minutes (`*/30 * * * *`). STALE detection threshold is `2 × frequency`, so with the wrong value the job appears STALE only after 2 hours instead of 1 hour. Change to `'sync-feeds': 30`.

---

## TODO: Warnings (should fix)

- [x] **`apps/web/src/components/admin/AdminSidebar.tsx:6–12`** — Sidebar has 5 links: Overview, Moderation, Analytics, Sources, Jobs. PRD A4 specifies 6 links including "Users & Orgs" → `/admin/users`. Even if prd6.md (Users section) is not yet implemented, add the link with a visual indicator (e.g., `opacity-50` or `(coming soon)` label) so the nav contract matches the PRD and future sections can activate it.

- [x] **`apps/api/src/routes/admin.ts:211–233` and `262–282`** — `PATCH /admin/content/:type/:id/approve` and `/reject` return 500 when Prisma throws `P2025` (record not found). They should return 404. The pattern is already correctly applied in `PATCH /sources/rss/:id` (line 960) — extend the same catch block check: `if ((err as { code?: string }).code === 'P2025') { res.status(404)... }`.

- [x] **`apps/api/src/routes/admin.ts:74–193`** — `GET /api/admin/moderation/pending` fetches ALL pending news and ALL pending reels without a server-side row limit before the in-memory merge and sort. On a large backlog (thousands of items) this loads the entire set into memory. Add `take: 2000` (or a configurable constant) to each Prisma `findMany`. The `count()` queries are unaffected and remain accurate for pagination totals.

- [x] **`apps/api/src/routes/admin.ts:574`** — `withCache('admin:overview:', ...)` has a trailing colon in the key (`'admin:overview:'`). Same issue at line 1340 (`'admin:top-content:'`). While functional, it is inconsistent with all other cache keys in the codebase which do not have trailing colons. Remove the trailing colons from both keys.

- [x] **`apps/api/src/services/admin-stats.ts:214–228`** — `computeMissionsCompleted` and `computeMissionsClaimed` use `date: { startsWith: dateStr }` where `DailyMission.date` is a Prisma `String` field. This works correctly today. Add an inline comment explaining that `startsWith` is used because `date` is stored as a `String` in `YYYY-MM-DD` format, so future developers do not silently break this if the field type changes.

- [x] **`apps/web/src/app/(admin)/admin/jobs/page.tsx`** — `JobHistoryDrawer` already has `role="dialog"` and `aria-modal="true"` on the panel element (confirmed at lines 112–114). No change required.

- [x] **`apps/web/src/app/(admin)/admin/page.tsx:182`** — `PIE_COLORS` is typed as `Record<string, string>` keyed with `'Free'` and `'Premium'`. If `pieData[].name` values change case, the fallback `?? '#475569'` silently renders all slices gray. Type it as `Record<'Free' | 'Premium', string>` so TypeScript flags mismatches at compile time.

---

## TODO: Suggestions (nice to have)

- [x] **`apps/api/src/services/admin-stats.ts:148–154`** — `computeSubscriptionBreakdown` runs two `prisma.user.count()` queries in a `Promise.all`. This could be replaced with a single `prisma.user.groupBy({ by: ['subscriptionTier'], _count: true })` (same pattern used in `GET /api/admin/overview`) to reduce DB round-trips from 2 to 1.

- [x] **`apps/api/src/routes/admin.test.ts:236`** — The test asserts `items[0].type === 'news'` and `items[1].type === 'reel'` relying on the sort-by-pending-minutes-descending logic. The news item fixture is intentionally older than the reel item, making the sort deterministic. Add a comment in the test explaining the fixture ordering is intentional and validates sort behaviour, so future test authors don't inadvertently swap the timestamps.

- [x] **`apps/api/src/services/job-runner.ts:47–54`** — The startup sync assertion is skipped in test env. Add a dedicated unit test in `job-runner.test.ts` (or `admin.test.ts`) that imports `KNOWN_JOBS` and `JOB_FREQUENCIES` and asserts their keys are identical, providing a compile-time guard against future divergence when new jobs are added.

- [x] **`apps/web/src/app/(admin)/admin/page.tsx:121–160`** — The overview page has no manual refresh mechanism. Since the server caches overview data for 5 minutes, add a "Refresh" button next to "Last updated" that re-calls `fetchData()`. This avoids the admin needing to reload the entire page to see updated KPIs.

- [x] **`apps/web/src/components/admin/AdminBadge.test.tsx`** — Tests only cover the `label` prop usage. Once the critical `AdminBadge` children bug is fixed (whichever approach is chosen), add a test covering the fixed usage pattern to prevent regression.

---

## Technical Debt Assessment

Net-positive. The changes eliminate several existing debt items: persistent job tracking replaces ephemeral Pino logs, pre-computed analytics replaces ad-hoc SQL, and the route group restructuring cleanly separates admin from the main app with zero duplication. The acknowledged N+1 `newsCount` query in `GET /sources/rss` is the main debt carried forward — mitigated by a code comment and acceptable at current scale. The `(prisma as any).jobRun` casts from the initial implementation have been cleaned up. No new architectural debt is introduced.

---

## Files Reviewed

- `apps/api/prisma/schema.prisma` — `JobRun` and `AnalyticsSnapshot` models correct; `DailyMission.date` is `String` (relevant to missions filter)
- `apps/api/src/routes/admin.ts` — 1,393 lines; all endpoints present; P2025 missing on approve/reject; trailing colon cache keys; unbounded moderation fetch
- `apps/api/src/routes/admin.test.ts` — Good auth/filter/batch/jobs coverage; fixture ordering comment missing
- `apps/api/src/services/job-runner.ts` — Static imports, pre-create pattern, startup assertion; `sync-feeds` frequency wrong (60 vs 30)
- `apps/api/src/services/admin-stats.ts` — 11 pure functions; correct retention cohort logic; `startsWith` filter needs comment
- `apps/api/src/services/admin-stats.test.ts` — 21 unit tests; good edge cases (empty cohorts, zero DAU, unknown sports)
- `apps/api/src/jobs/compute-analytics.ts` — Follows JobRun pattern; `existingRunId` path correct; registered at `0 2 * * *`
- `apps/api/scripts/create-admin.ts` — Crypto-safe temp password, bcrypt, email regex, graceful `$disconnect`
- `apps/web/src/app/layout.tsx` — Minimal root (fonts + CSS + theme flash prevention); correct
- `apps/web/src/app/(admin)/layout.tsx` — Own `UserProvider` with explanatory comment; correct role check
- `apps/web/src/app/(admin)/admin/page.tsx` — Full overview page; `AdminBadge` children misuse (critical); `PIE_COLORS` fragile typing
- `apps/web/src/app/(admin)/admin/jobs/page.tsx` (partial) — Drawer ARIA post-review fixes noted; `AdminBadge` children misuse also present
- `apps/web/src/components/admin/AdminSidebar.tsx` — 5 links (missing Users & Orgs); `aria-current="page"` present
- `apps/web/src/components/admin/AdminMetricCard.tsx` — Correct severity border colors; trend display clean
- `apps/web/src/components/admin/AdminTable.tsx` — Generic typed table; sortable `th` with keyboard (Enter) support; stable row keys
- `apps/web/src/components/admin/AdminBadge.tsx` — Declares `label` prop; callers misuse as children component (critical bug)
- `apps/web/src/components/admin/AdminBadge.test.tsx` — Tests `label` prop correctly; no test for children usage
- `apps/web/src/components/admin/AdminMetricCard.test.tsx` — Good coverage of all severity levels, trend, icon
- `apps/web/src/components/admin/AdminTable.test.tsx` — Good coverage: sort, pagination, custom render, empty, loading skeleton


## Verification

**Tests** (2026-04-05): All passing.
- API: 56 test files, 763 tests — ✅ PASS
- Web: 21 test files, 151 tests — ✅ PASS
- Mobile: 20 test files, 178 tests — ✅ PASS

**Lint**: `npm run lint` — ✅ No errors, no warnings.

**TypeScript** (`tsc --noEmit`): 3 pre-existing errors in `monitoring.ts` (missing `@sentry/node` types) and `redis-cache.ts` (ioredis callback type mismatch) — identical errors exist on `main`, unrelated to this feature. `gamification.ts` errors are also pre-existing (confirmed by stash comparison).

---

# Code Review: prd6.md — Users & Organizations

## Summary

Solid implementation that meets most PRD requirements. All 8 new backend endpoints are properly secured with `requireAuth + requireRole('admin')`, all PATCH/POST payloads use Zod validation, and `passwordHash` is correctly excluded via explicit `select` destructuring. One critical bug: the `scheduleLocked` field is present in both the PRD spec and the frontend TypeScript interface (`ParentalProfileSummary`) but is **missing from the backend select and response serialization** — the field always resolves to `undefined` in the response. One warning: `GET /api/admin/users/:id` uses `include` for `parentalProfile` instead of a full explicit `select`, which means the raw `pin` hash is temporarily held in memory before destructuring (though it never leaves the handler). The frontend pages are well-structured with debounced search, controlled modals, loading/error states, and correct ARIA. The `user-context.tsx` anonymous-user redirect fix is correct and targeted.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| `GET /admin/users?q=&role=&tier=&page=&limit=` with ILIKE search | prd6.md | OK | `mode: 'insensitive'` on email, exact match on id |
| Response `{ users, total, page, totalPages }` | prd6.md | OK | Correct shape |
| `page` default 1, `limit` default 25, max 100 | prd6.md | OK | `Math.min(100, ...)` guard present |
| `GET /admin/users/:id` — explicit select excludes `passwordHash` | prd6.md | Issue | Uses `include` (not explicit `select`) + destructuring to strip `passwordHash`; the raw hash is loaded into the Node process before being dropped. Not a data-leak but deviates from PRD wording "explicit select excluding passwordHash" |
| `GET /admin/users/:id` — `recentActivity` last 10 ordered desc | prd6.md | OK | `take: 10, orderBy: { createdAt: 'desc' }` |
| `GET /admin/users/:id` — `stats: { stickerCount, achievementCount, totalQuizAnswers, totalNewsViewed }` | prd6.md | OK | All 4 counts via `Promise.all` |
| `GET /admin/users/:id` — `parentalProfile.scheduleLocked` | prd6.md | **Critical** | Field is required by PRD and present in frontend `ParentalProfileSummary` interface but **missing from backend `parentalProfile` select and response** — always `undefined` in API response |
| `PATCH /admin/users/:id/tier` — Zod-validated `{ tier: 'free' | 'premium' }` | prd6.md | OK | `userTierSchema` with `safeParse` |
| `PATCH /admin/users/:id/role` — self-change blocked (403) | prd6.md | OK | `req.auth?.userId === id` check |
| `POST /admin/users/:id/revoke-tokens` — deletes RefreshTokens, returns `{ revoked: N }` | prd6.md | OK | `deleteMany` + `result.count` |
| `GET /admin/organizations?sport=&active=&page=&limit=` with `memberCount` | prd6.md | OK | `_count: { select: { members: true } }` |
| `GET /admin/organizations/:id` — full detail with members + activitySummary | prd6.md | OK | `$queryRaw` for 30-day activity; no N+1 |
| `PATCH /admin/organizations/:id` — `maxMembers >= memberCount` validation | prd6.md | OK | Counts members first, returns 400 if violated |
| Users list page — tabs (Users / Organizations) | prd6.md | OK | URL-driven tab with `?tab=organizations` |
| Users list page — debounced search (300ms) | prd6.md | OK | `useDebounce` with `clearTimeout` cleanup |
| Users list page — Role and Tier filter dropdowns | prd6.md | OK | Present |
| User detail page — 3 sections: profile, parental, activity | prd6.md | OK | All 3 present |
| User detail page — Change Tier modal with RevenueCat warning | prd6.md | OK | Yellow warning text present |
| User detail page — Change Role modal with admin warning | prd6.md | OK | Conditional red warning when `selected === 'admin'` |
| User detail page — Revoke Sessions confirmation modal | prd6.md | OK | Confirmation dialog with destructive button |
| Org detail page — CopyButton for invite code | prd6.md | OK | `navigator.clipboard.writeText` with 2s feedback |
| Org detail page — Recharts AreaChart for 30-day activity | prd6.md | OK | `AreaChart` with gradient fill; empty state handled |
| Org detail page — Members table | prd6.md | OK | Email, Role, Org Role, Tier, Last Login, Joined |
| Org detail page — Deactivate/Reactivate modal | prd6.md | OK | Toggles based on `organization.active` |
| AdminSidebar — `comingSoon` removed from Users & Orgs link | prd6.md | OK | Link is fully active; `comingSoon` not set |
| Anonymous user redirect fix in `user-context.tsx` | prd6.md | OK | `isAnonymousUser` check prevents redirecting anonymous users away from `/login`/`/register` |

## TODO: Critical Issues (must fix)

- [x] **`apps/api/src/routes/admin.ts:1562–1570`** — `scheduleLocked` is missing from the `parentalProfile` select and the response object. The PRD requires it, the frontend `ParentalProfileSummary` interface at `apps/web/src/app/(admin)/admin/users/[id]/page.tsx:19–26` declares it, and the test fixture at `admin.test.ts:1810` passes it — but it is never fetched or returned by the backend. The field does not exist in the `ParentalProfile` Prisma model as a native boolean; it must be computed from `allowedHoursStart` and `allowedHoursEnd` (a schedule is "locked" when hours are restricted, i.e. `allowedHoursStart !== 0 || allowedHoursEnd !== 24`). Add `allowedHoursStart` and `allowedHoursEnd` to the `parentalProfile` select and compute `scheduleLocked: pp.allowedHoursStart !== 0 || pp.allowedHoursEnd !== 24` in the response serialization.

## TODO: Warnings (should fix)

- [x] **`apps/api/src/routes/admin.ts:1517–1529`** — `GET /admin/users/:id` uses `include: { parentalProfile: { select: ... } }` which loads the user row via `findUnique` with `include`. The `passwordHash` field is present on the fetched object and stripped only via destructuring (`const { passwordHash: _passwordHash, ... } = rawUser`). The PRD wording specifies "explicit select excluding passwordHash". Prefer `select: { id: true, email: true, ... }` (listing every field except `passwordHash`) over the current `include`+destructure pattern to guarantee the hash is never loaded from Postgres. At current scale the risk is low, but the approach is not aligned with the stated security requirement.

- [x] **`apps/web/src/app/(admin)/admin/users/organizations/[id]/page.tsx:200–210`** — `handleRegenerateCode` calls `${API_BASE}/organizations/${id}/regenerate-code` (the non-admin organizations route), not an admin-specific endpoint. This means it goes through the org-admin permission check (`requireOrgAdmin`) rather than the admin panel's `requireRole('admin')`. An admin user who is not an org member will receive a 403. Consider either: (a) exposing a dedicated `POST /api/admin/organizations/:id/regenerate-code` endpoint secured by `requireRole('admin')`, or (b) documenting the current behaviour as intentional with a code comment.

- [x] **`apps/api/src/routes/admin.test.ts:1783–1834`** — The `GET /admin/users/:id` test fixture at line 1810 includes `scheduleLocked: false` in the `parentalProfile` mock, but the backend never reads or returns that field (see critical issue above). The test asserts `res.body.parentalProfile.hasPin` and `res.body.parentalProfile.allowedSports` but does NOT assert `res.body.parentalProfile.scheduleLocked`. Add an assertion `expect(res.body.parentalProfile.scheduleLocked).toBeDefined()` once the backend bug is fixed, to prevent regression.

## TODO: Suggestions (nice to have)

- [x] **`apps/web/src/app/(admin)/admin/users/page.tsx:84–92`** — `sportBadgeVariant` casts `'red' as 'gray'` for `formula1` because the `AdminBadge` variant type does not include `'red'`. Either extend `AdminBadge`'s `BadgeVariant` to include `'red'` (which is already used in role badges) or map `formula1` to an existing variant cleanly. The cast is a type safety escape hatch.

- [x] **`apps/web/src/app/(admin)/admin/users/page.tsx:237–245`** — `AdminTable` columns are cast via `as unknown as Parameters<...>` because the typed generics do not match. This pattern appears in both `UsersTab` and `OrganizationsTab`. If `AdminTable` supports a generic `<T>`, both tab components should declare their row type explicitly and pass `columns` typed against it, removing the unsafe cast.

- [x] **`apps/web/src/app/(admin)/admin/users/[id]/page.tsx:483`** — The Organization field in the Account section renders `user.organizationId` (UUID string) rather than the org name, because the user detail API response does not join the org. If the org name is needed for readability, either include it in the `GET /admin/users/:id` response (join `Organization` and return `organizationName`) or link the UUID to `/admin/users/organizations/:orgId`.

- [x] **`apps/web/src/app/(admin)/admin/users/organizations/[id]/page.tsx`** — The members table has no pagination: all members are loaded in a single `GET /admin/organizations/:id` call. For organizations with many members (up to `maxMembers`, default 100) this is acceptable, but if `maxMembers` ever increases significantly a paginated member list would be warranted. Add a TODO comment.

## Technical Debt Assessment

Low. The implementation is clean and consistent with the existing codebase patterns. No new `any` types are introduced beyond the `as unknown as` AdminTable cast (pre-existing pattern). All fetch calls use try/catch with loading and error states. The `useDebounce` hook is properly implemented with `clearTimeout` in its cleanup function. Modals are correctly controlled with explicit open/close state. The one meaningful debt item carried forward is the `scheduleLocked` omission — a missing field that creates a silent frontend lie (always renders "No" because `undefined` is falsy). All other items are minor.

## Files Reviewed

- `apps/web/src/app/(admin)/admin/users/page.tsx` — Users list with tabs, debounce, filters; AdminTable cast is a pre-existing pattern
- `apps/web/src/app/(admin)/admin/users/[id]/page.tsx` — User detail with 3 sections and 3 modals; 403 handling on role change; RevenueCat warning present
- `apps/web/src/app/(admin)/admin/users/organizations/[id]/page.tsx` — Org detail with CopyButton, AreaChart, members table, deactivate modal; regenerate-code routes to non-admin endpoint
- `apps/api/src/routes/admin.ts` (lines 1403–1913) — 8 new endpoints; all gated with admin middleware; Zod on all mutations; `scheduleLocked` missing from parentalProfile response
- `apps/api/src/routes/admin.test.ts` (lines 1700–2296) — 43 new tests; 401/403 on every endpoint; self-role 403 tested; maxMembers < memberCount 400 tested; passwordHash exclusion asserted; `scheduleLocked` not asserted in response
- `apps/web/src/components/admin/AdminSidebar.tsx` — `comingSoon` correctly absent from Users & Orgs link; active-path detection covers sub-routes
- `apps/web/src/lib/user-context.tsx` — Anonymous user redirect fix: `isAnonymousUser` check on line 206 prevents anonymous users from being bounced away from `/login`/`/register` pages

## Verification (prd6.md)

**Tests** (2026-04-05):
- API: 57 test files, 808 tests — ✅ PASS (+45 tests vs previous review: 1 new test file, 43 new tests + 2 existing tests gained from fixtures)
- Web: 21 test files, 152 tests — ✅ PASS (+1 test vs previous review)

**Lint**: `npm run lint` — ✅ No errors, no warnings.
