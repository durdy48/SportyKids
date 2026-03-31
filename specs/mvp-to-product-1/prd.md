# Legal & Compliance Foundation - Product Requirements Document

## Overview

This PRD covers the Legal & Compliance Foundation for SportyKids, the minimum set of features required before the app can be submitted to the Apple App Store and Google Play Store. Apps targeting children 6-14 must comply with COPPA (US), GDPR-K (EU), and platform-specific kids policies. Without these features, store review will reject the app.

The scope includes: age gate, parental consent flow, privacy policy and terms of service pages, a data deletion endpoint with UI, analytics consent gating, and all supporting data model changes and i18n keys.

## Problem Statement

SportyKids targets children aged 6-14 but currently has:
- No age verification or age gate
- No parental consent mechanism for children under 13
- No privacy policy or terms of service pages
- No way for parents to delete their child's data
- Analytics (PostHog) and error tracking (Sentry) that initialize without consent
- No consent fields on the User model

Apple and Google will reject any kids app missing these. COPPA requires verifiable parental consent for data collection from children under 13. GDPR-K (Article 8) requires parental consent for children under 16 in the EU (most member states set the threshold at 13-16; we use 13 as the baseline). Both app stores require a published privacy policy URL and compliance with their respective kids program policies.

## Goals

1. **Store approval**: Meet all mandatory legal requirements for App Store and Play Store submission targeting children
2. **Parental trust**: Parents understand what data is collected and can control/delete it
3. **Legal defensibility**: Reasonable-effort COPPA and GDPR-K compliance (with placeholders for final legal review)
4. **Zero data leakage**: No analytics or error tracking until consent is granted
5. **Backward compatibility**: Existing users are migrated gracefully — forced through age gate on next visit, no data loss

## Target Users

- **Children (6-12)**: Cannot consent on their own. Must have a parent present to complete age gate and grant consent.
- **Teens (13-17)**: Can accept terms themselves but see a notice about data practices.
- **Parents/Guardians**: Provide consent for children under 13, manage data deletion.

## Core Features

### 1. Age Gate

#### 1.1 Behavior

The age gate is a mandatory screen shown before onboarding. It determines the user's age bracket and routes them to the appropriate consent path.

**When shown:**
- New users: before onboarding begins
- Existing users: on next app/web visit if `ageGateCompleted` is `false` on their User record
- The age gate cannot be skipped or dismissed

**Three paths:**

| Selection | Age Range | Flow |
|-----------|-----------|------|
| "I am a parent or adult (18+)" | 18+ | Proceed directly to onboarding |
| "I am a teenager (13-17)" | 13-17 | Show privacy notice → accept → proceed to onboarding |
| "I am a child (under 13)" | <13 | Show parental consent screen → parent must be present → consent + mandatory PIN creation → proceed to onboarding |

**Path details:**

**Parent/Adult (18+):**
- Set `ageGateCompleted = true` on the User record
- Set `consentGiven = true`, `consentDate = now()` (adults consent for themselves)
- Proceed to onboarding (or home if already onboarded)

**Teen (13-17):**
- Show a single-screen notice: "By continuing, you agree to our Privacy Policy and Terms of Service" with links to `/privacy` and `/terms`
- Checkbox: "I have read and accept the Privacy Policy and Terms of Service"
- On accept: set `ageGateCompleted = true`, `consentGiven = true`, `consentDate = now()`
- Proceed to onboarding

**Child (<13):**
- Show a screen: "Please ask your parent or guardian to complete this step"
- Parent consent text: "I am the parent or legal guardian of this child. I consent to SportyKids collecting and processing data as described in the Privacy Policy to provide a personalized sports news experience."
- Links to `/privacy` and `/terms`
- Checkbox: "I confirm I am the parent/legal guardian and give my consent"
- On confirm: immediately transition to PIN creation screen (reuse existing `PinInput` component from parental setup)
- After PIN creation: set `ageGateCompleted = true`, `consentGiven = true`, `consentDate = now()`, create `ParentalProfile` with the PIN
- `consentBy` is set to the child's own `userId` (since there is no separate parent account at this stage; the field records that consent was given in the context of this user)
- Proceed to onboarding

#### 1.2 Existing User Migration

When an existing user loads the app/web and their `ageGateCompleted` is `false`:
- Redirect to age gate before any other screen
- After completing age gate, return to their intended destination
- Users who already have a `ParentalProfile` (PIN was already set up) taking the child path: skip PIN creation, just record consent fields
- The age gate check happens in:
  - Web: `UserProvider` in `apps/web/src/lib/user-context.tsx` — redirect to `/age-gate`
  - Mobile: navigation guard in `apps/mobile/src/navigation/` — navigate to `AgeGate` screen

#### 1.3 Data Model

New fields on the `User` model in `apps/api/prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields ...
  ageGateCompleted  Boolean   @default(false)
  consentGiven      Boolean   @default(false)
  consentDate       DateTime?
  consentBy         String?
}
```

#### 1.4 API

**Update existing endpoint** `PUT /api/users/:id`:

Add support for the new fields in the update body. Validated with Zod:

```typescript
{
  ageGateCompleted?: boolean,
  consentGiven?: boolean,
  consentDate?: string, // ISO 8601
  consentBy?: string,   // userId
}
```

Validation rules:
- `consentGiven` can only be set to `true` (never revoked via this endpoint — revocation is via data deletion)
- `consentDate` is auto-set server-side when `consentGiven` transitions to `true` (ignore client value)
- `consentBy` must be a valid userId or null

**Update existing endpoint** `GET /api/users/:id`:

Return the new fields in the response.

**Update existing endpoint** `POST /api/users`:

Accept optional `ageGateCompleted`, `consentGiven` fields during user creation. Default to `false`.

#### 1.5 UI Mockups

**Age Gate Screen (all platforms):**

```
┌─────────────────────────────────────┐
│                                     │
│          ⚽ SportyKids              │
│                                     │
│     How old are you?                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  👨‍👩‍👧  I am a parent or      │    │
│  │      adult (18+)            │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🧑  I am a teenager        │    │
│  │      (13-17)                │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  👧  I am a child           │    │
│  │      (under 13)             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Privacy Policy · Terms of Service  │
│                                     │
└─────────────────────────────────────┘
```

**Teen Acceptance Screen:**

```
┌─────────────────────────────────────┐
│  ←                                  │
│                                     │
│     Before you start...             │
│                                     │
│  SportyKids collects your sport     │
│  preferences and reading activity   │
│  to personalize your news feed.     │
│                                     │
│  We never share your data with      │
│  third parties for advertising.     │
│                                     │
│  Read our full:                     │
│  • Privacy Policy                   │
│  • Terms of Service                 │
│                                     │
│  ┌─┐ I have read and accept the     │
│  └─┘ Privacy Policy and Terms       │
│       of Service                    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        Continue              │    │
│  └─────────────────────────────┘    │
│  (button disabled until checked)    │
│                                     │
└─────────────────────────────────────┘
```

**Child Consent Screen:**

```
┌─────────────────────────────────────┐
│  ←                                  │
│                                     │
│  🔒 Parent Required                │
│                                     │
│  Please hand the device to your     │
│  parent or guardian.                 │
│                                     │
│  ─────────────────────────────      │
│  For parents:                       │
│                                     │
│  SportyKids is a sports news app    │
│  for kids. We collect:              │
│  • Sport preferences                │
│  • Reading activity                 │
│  • Quiz scores                      │
│                                     │
│  We do NOT collect:                 │
│  • Location data                    │
│  • Photos or contacts               │
│  • Data for advertising             │
│                                     │
│  Read our full:                     │
│  • Privacy Policy                   │
│  • Terms of Service                 │
│                                     │
│  ┌─┐ I am the parent/legal         │
│  └─┘ guardian and I consent to      │
│      my child using SportyKids      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   Set Up Parental PIN →      │    │
│  └─────────────────────────────┘    │
│  (button disabled until checked)    │
│                                     │
└─────────────────────────────────────┘
```

After pressing "Set Up Parental PIN", the existing `PinInput` component is shown for PIN creation (enter + confirm). After PIN is set, consent is recorded and user proceeds to onboarding.

---

### 2. Legal Pages (Privacy Policy & Terms of Service)

#### 2.1 Behavior

Two new public pages accessible without authentication:
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

Both pages:
- Render as Next.js pages (React components, not MDX)
- Support locale switching (ES/EN) based on URL param `?locale=` or user's stored locale, defaulting to `es`
- Are publicly accessible (no auth required)
- Have a clean, readable layout with the SportyKids branding header
- Include a "Last updated" date
- Are linked from: age gate screens, login screen, onboarding step 1, parental panel footer, user settings (web), and equivalent mobile screens

On mobile, legal pages open in an in-app browser (`expo-web-browser`) pointing to the web URLs.

#### 2.2 File Locations

- Web: `apps/web/src/app/privacy/page.tsx` and `apps/web/src/app/terms/page.tsx`
- i18n keys: `packages/shared/src/i18n/es.json` and `en.json` under `legal.*` namespace
- Mobile: no new screens — use `WebBrowser.openBrowserAsync()` from `expo-web-browser` to open web URLs

#### 2.3 Privacy Policy Content

The following is a reasonable draft for a children's sports news app. Sections marked [LEGAL REVIEW REQUIRED] need review by a qualified attorney before publication.

---

**SportyKids Privacy Policy**

*Last updated: [DATE]*

**1. Introduction**

SportyKids ("we", "us", "our") is a personalized sports news application designed for children aged 6-14. We take children's privacy very seriously. This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information.

This policy complies with the Children's Online Privacy Protection Act (COPPA), the General Data Protection Regulation (GDPR) including provisions for children's data (Article 8), and applicable app store policies for children's applications.

**2. Information We Collect**

*2.1 Information provided during account creation:*
- Display name (does not need to be a real name)
- Age range selection (6-8, 9-11, 12-14)
- Favorite sports (selected from a predefined list)
- Preferred news sources (selected from a predefined catalog)
- Email address (optional, only if parent creates an account with email authentication)
- Locale preference (Spanish or English)

*2.2 Information generated through use:*
- Reading activity (which articles were viewed, duration)
- Quiz answers and scores
- Sticker and achievement collection progress
- Daily streak information
- Content reports submitted by the user
- Video viewing activity

*2.3 Technical information:*
- Push notification tokens (if notifications are enabled by parent)
- Device type (web browser or mobile platform)
- IP address (used only for rate limiting, not stored long-term)

**3. Information We Do NOT Collect**

- Precise geolocation
- Photos, videos, or audio from the device
- Contacts or address book
- Information from other apps
- Advertising identifiers
- Data for behavioral advertising purposes
- Real names (display names are free-form)

**4. How We Use Information**

We use collected information solely to:
- Personalize the sports news feed based on favorite sports and teams
- Adapt content complexity to the child's age range
- Track quiz progress and gamification features (streaks, stickers, achievements)
- Enable parental controls and activity monitoring
- Generate weekly activity digests for parents
- Send push notifications (streak reminders, daily quiz availability) when enabled by parent
- Improve content safety through automated moderation

We do NOT use children's data for:
- Advertising of any kind
- Profiling for commercial purposes
- Sale or sharing with third parties for their marketing purposes

[LEGAL REVIEW REQUIRED: Verify that the enumerated uses are exhaustive and accurately reflect all data processing activities in the application.]

**5. Parental Consent**

For children under 13, we require verifiable parental consent before collecting any personal information. A parent or legal guardian must:
- Confirm they are the child's parent or legal guardian
- Review this Privacy Policy
- Provide affirmative consent
- Set up a parental PIN for ongoing access to parental controls

Parents can withdraw consent at any time by deleting the child's account through the Parental Controls panel.

[LEGAL REVIEW REQUIRED: COPPA requires "verifiable" parental consent. On-screen confirmation may not meet the FTC's standard for all cases. Consider whether additional verification methods (e.g., credit card micro-transaction, signed consent form, video call) are needed. The FTC's COPPA Rule lists acceptable methods in 16 CFR 312.5(b). For apps that do not collect substantial personal information, the "email plus" method (email notification to parent with mechanism to revoke) may suffice. Evaluate whether the current approach of on-screen confirmation combined with mandatory PIN creation constitutes adequate verification.]

**6. Parental Rights**

Parents and legal guardians have the right to:
- Review all information collected about their child (via the Parental Controls activity panel)
- Delete all of their child's data (via the "Delete Account" option in Parental Controls)
- Withdraw consent and prevent further data collection (by deleting the account)
- Restrict content types, daily usage time, and allowed hours
- Receive weekly activity digests summarizing their child's usage

To exercise any of these rights, access the Parental Controls section of the app using your parental PIN, or contact us at [CONTACT EMAIL - LEGAL REVIEW REQUIRED].

**7. Data Retention**

- User data is retained as long as the account exists
- When a parent deletes a child's account, ALL associated data is permanently and irreversibly deleted within 24 hours
- Automated content (aggregated news, videos) is retained independently of user data
- Push notification tokens are deleted immediately upon account deletion
- Activity logs older than 90 days may be automatically purged

[LEGAL REVIEW REQUIRED: Confirm retention periods comply with COPPA's requirement to retain children's information only as long as reasonably necessary.]

**8. Data Security**

- Parental PINs are hashed with bcrypt before storage
- Passwords are hashed with bcrypt before storage
- Authentication uses JWT tokens with short-lived access tokens and rotating refresh tokens
- API communication uses HTTPS in production
- Rate limiting protects against brute-force attacks on authentication and PIN verification
- PIN lockout activates after 5 failed attempts (15-minute cooldown)

[LEGAL REVIEW REQUIRED: Enumerate specific security measures and confirm they meet "reasonable security" standards under COPPA and GDPR.]

**9. Third-Party Services**

*When consent is granted*, we may use:
- **PostHog** (analytics): Privacy-first analytics platform. Used to understand aggregate usage patterns. No data is sent until parental consent is granted. PostHog privacy policy: https://posthog.com/privacy
- **Sentry** (error tracking): Used to detect and fix application errors. May receive anonymized error data. No data is sent until parental consent is granted. Sentry privacy policy: https://sentry.io/privacy/
- **Expo Push Notifications**: Used to deliver push notifications when enabled by parent. Expo privacy policy: https://expo.dev/privacy

We do NOT use any advertising networks or ad-tracking services.

[LEGAL REVIEW REQUIRED: Verify all third-party data processors are listed. Each must have a compliant privacy policy and data processing agreement in place.]

**10. International Data Transfers**

SportyKids may process data in servers located outside your country of residence. For users in the European Economic Area (EEA), we ensure that any transfer of personal data to countries outside the EEA is subject to appropriate safeguards as required by GDPR.

[LEGAL REVIEW REQUIRED: Specify data processing locations, legal basis for transfers (Standard Contractual Clauses, adequacy decisions, etc.), and ensure compliance with GDPR Chapter V.]

**11. Children's Content Safety**

All news content is automatically moderated by AI to filter inappropriate material (gambling, violence, sexual content, etc.). Only approved content is shown to children. Parents can review moderation decisions and report content through the app.

**12. Changes to This Policy**

We will notify parents of material changes to this Privacy Policy through:
- In-app notification
- Update to the "Last updated" date at the top of this policy

Continued use of the app after notification constitutes acceptance of the updated policy.

[LEGAL REVIEW REQUIRED: Under COPPA, material changes to data practices for children under 13 require new parental consent. Implement a mechanism to re-request consent if the policy changes materially.]

**13. Contact Us**

[LEGAL REVIEW REQUIRED: A valid contact method (email, physical address, or phone number) is required by COPPA. Insert actual operator contact information.]

For questions about this Privacy Policy or to exercise your rights, contact us at:

SportyKids
Email: [INSERT EMAIL]
Address: [INSERT ADDRESS]

---

#### 2.4 Terms of Service Content

---

**SportyKids Terms of Service**

*Last updated: [DATE]*

**1. Acceptance of Terms**

By using SportyKids ("the Service"), you agree to these Terms of Service. If you are under 18, your parent or legal guardian must agree to these terms on your behalf. For children under 13, a parent or legal guardian must provide consent before the child can use the Service.

**2. Description of Service**

SportyKids is a personalized sports news application that provides:
- Curated sports news from verified press sources
- Short sports video clips (Reels)
- Interactive sports quizzes
- Gamification features (stickers, achievements, streaks)
- Parental controls and activity monitoring

The Service is designed for children aged 6-14 and their parents/guardians.

**3. User Accounts**

- Users may create accounts anonymously, with email/password, or via social login (Google, Apple)
- Children under 13 require parental consent to create an account
- Users are responsible for maintaining the confidentiality of their account credentials
- Parents are responsible for their children's use of the Service

**4. Acceptable Use**

Users must NOT:
- Use the Service for any unlawful purpose
- Attempt to access other users' accounts or data
- Submit false content reports
- Attempt to circumvent parental controls
- Use automated tools to scrape or access the Service
- Misrepresent their age during the age verification process

**5. Content**

- All news content is aggregated from third-party RSS sources and remains the property of the original publishers
- SportyKids does not claim ownership of aggregated content
- Content is automatically moderated for child safety but we cannot guarantee all content will be appropriate
- Users can report inappropriate content through the in-app reporting feature

[LEGAL REVIEW REQUIRED: Review content aggregation practices against RSS source terms of service. Ensure fair use / linking practices are legally sound.]

**6. Intellectual Property**

- The SportyKids application, its design, features, and original content are protected by intellectual property laws
- Users are granted a limited, non-exclusive, non-transferable license to use the Service for personal, non-commercial purposes
- The sticker and achievement artwork is owned by SportyKids

**7. Privacy**

Our collection and use of personal information is governed by our Privacy Policy, available at [APP_URL]/privacy. The Privacy Policy is incorporated into these Terms by reference.

**8. Disclaimers**

- The Service is provided "as is" without warranties of any kind
- We do not guarantee the accuracy, completeness, or timeliness of aggregated news content
- We are not responsible for content published by third-party news sources
- Quiz questions are for entertainment and educational purposes; accuracy is not guaranteed

**9. Limitation of Liability**

[LEGAL REVIEW REQUIRED: Draft appropriate limitation of liability clause compliant with applicable consumer protection laws, particularly those applicable to services directed at children.]

To the maximum extent permitted by applicable law, SportyKids shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.

**10. Account Termination**

- Parents can delete their child's account at any time through Parental Controls
- We may suspend or terminate accounts that violate these Terms
- Upon account deletion, all associated personal data is permanently deleted

**11. Changes to Terms**

We may update these Terms from time to time. We will notify users of material changes through in-app notifications. Continued use after notification constitutes acceptance.

[LEGAL REVIEW REQUIRED: For children under 13, material changes may require renewed parental consent under COPPA.]

**12. Governing Law**

[LEGAL REVIEW REQUIRED: Specify governing law jurisdiction. Consider that the app targets users in multiple countries (ES, GB, US, FR, IT, DE). EU consumer protection laws may limit choice-of-law provisions for EU users.]

**13. Contact**

For questions about these Terms, contact us at:

SportyKids
Email: [INSERT EMAIL]
Address: [INSERT ADDRESS]

---

#### 2.5 UI Mockup

**Privacy/Terms Page (Web):**

```
┌─────────────────────────────────────────────────┐
│  ⚽ SportyKids              [ES ▼] [← Back]    │
│─────────────────────────────────────────────────│
│                                                  │
│  Privacy Policy                                  │
│  Last updated: March 2026                        │
│                                                  │
│  ─────────────────────────────────────────────   │
│                                                  │
│  1. Introduction                                 │
│                                                  │
│  SportyKids ("we", "us", "our") is a             │
│  personalized sports news application designed   │
│  for children aged 6-14...                       │
│                                                  │
│  [... scrollable content ...]                    │
│                                                  │
│─────────────────────────────────────────────────│
│  Privacy Policy · Terms of Service               │
│  © 2026 SportyKids                               │
└─────────────────────────────────────────────────┘
```

---

### 3. Data Deletion

#### 3.1 API Endpoint

**`DELETE /api/users/:id/data`**

**Authentication:** Requires valid JWT token (via `requireAuth` middleware).

**Authorization:** The requesting user must either:
- Be the user themselves (if adult/teen), OR
- Be a parent with a valid parental session for this child (verified via `parental-guard` pattern — PIN must have been verified within the session TTL)

For children under 13, PIN verification is always required. The flow is:
1. Parent navigates to Parental Controls (already requires PIN)
2. Parent presses "Delete Account"
3. Confirmation dialog: "This will permanently delete all of [child name]'s data. This cannot be undone."
4. On confirm: `DELETE /api/users/:id/data` is called

**Request:**
```
DELETE /api/users/:id/data
Authorization: Bearer <jwt>
X-Parental-Session: <session-token>  (required for child accounts)
```

**Response (200):**
```json
{
  "deleted": true,
  "userId": "abc123",
  "deletedAt": "2026-03-29T12:00:00.000Z"
}
```

**Error responses:**
- `401`: Not authenticated
- `403`: Not authorized (not the user or their parent) or parental session invalid/expired
- `404`: User not found

**Deletion scope — all related records in this order:**

1. `PushToken` (where userId)
2. `RefreshToken` (where userId)
3. `ParentalSession` (where userId)
4. `ActivityLog` (where userId)
5. `ContentReport` (where userId)
6. `UserSticker` (where userId)
7. `UserAchievement` (where userId)
8. `DailyMission` (where userId)
9. `ParentalProfile` (where userId)
10. `User` record itself

All deletions happen in a single Prisma transaction (`prisma.$transaction`).

**Note:** `NewsSummary` records are per-newsItem (not per-user), so they are NOT deleted. `QuizQuestion` answers/scores are stored on the User model itself, so they are deleted with the User record.

#### 3.2 File Location

- Existing route file: `apps/api/src/routes/users.ts` — add the DELETE handler to the existing users router
- Reuse existing auth middleware from `apps/api/src/middleware/auth.ts`
- Reuse parental session verification pattern from `apps/api/src/routes/parents.ts`

#### 3.3 UI — Web (ParentalPanel)

Add a "Delete Account" section at the bottom of the Parental Panel (`apps/web/src/components/ParentalPanel.tsx`), within the existing panel layout:

```
┌─────────────────────────────────────────────────┐
│  Parental Controls                               │
│                                                  │
│  [... existing parental controls content ...]    │
│                                                  │
│  ─────────────────────────────────────────────   │
│                                                  │
│  ⚠️  Danger Zone                                │
│                                                  │
│  Delete all data associated with this account.   │
│  This action is permanent and cannot be undone.  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  🗑️  Delete Account                      │    │
│  └──────────────────────────────────────────┘    │
│  (red/destructive button styling)                │
│                                                  │
│  ─────────────────────────────────────────────   │
│  Privacy Policy · Terms of Service               │
└─────────────────────────────────────────────────┘
```

**Confirmation dialog (modal):**

```
┌─────────────────────────────────────┐
│                                     │
│  ⚠️  Delete Account?               │
│                                     │
│  This will permanently delete ALL   │
│  data for [child name]:             │
│                                     │
│  • Reading history                  │
│  • Quiz scores                      │
│  • Stickers & achievements          │
│  • Streaks & missions               │
│  • Parental settings                │
│  • All activity logs                │
│                                     │
│  This cannot be undone.             │
│                                     │
│  ┌──────────┐  ┌────────────────┐   │
│  │  Cancel   │  │ Delete Forever │   │
│  └──────────┘  └────────────────┘   │
│                  (red button)        │
└─────────────────────────────────────┘
```

After deletion:
- Clear local storage (`sportykids-user`, `sportykids-theme`, etc.)
- Redirect to `/age-gate` (fresh start)
- On mobile: clear AsyncStorage, navigate to `AgeGate` screen

#### 3.4 UI — Mobile (ParentalControl)

Same pattern in `apps/mobile/src/screens/ParentalControl.tsx`. Destructive button at the bottom, confirmation via `Alert.alert()` with "Cancel" and "Delete Forever" options.

---

### 4. Analytics Consent Gate

#### 4.1 Behavior

PostHog and Sentry must not initialize or send ANY data until the user's `consentGiven` field is `true`.

**API (`apps/api/src/services/monitoring.ts`):**
- Current behavior: `initMonitoring()` initializes Sentry and PostHog unconditionally at server startup
- New behavior: Sentry and PostHog initialization remains at startup (for server-level error catching), BUT:
  - Add a `shouldTrackUser(userId: string): Promise<boolean>` function that checks the user's `consentGiven` field
  - All PostHog `capture()` calls must be wrapped: only fire if `shouldTrackUser` returns true
  - Sentry error capturing for request-level errors: only attach user context and send if consent is given
  - Server-level errors (no user context) can still be captured (they contain no PII)

**Web (`apps/web/src/lib/analytics.ts`):**
- Current behavior: PostHog initializes on page load
- New behavior: Export an `initAnalytics(consentGiven: boolean)` function
  - If `consentGiven` is `false`: do not initialize PostHog, all tracking calls are no-ops
  - If `consentGiven` is `true`: initialize PostHog normally
- `UserProvider` calls `initAnalytics(user.consentGiven)` when user data is loaded
- If consent changes from false to true (e.g., after age gate), re-initialize

**Mobile (`apps/mobile/src/lib/`):**
- Same pattern as web. Analytics/error tracking disabled until `consentGiven` is true on the user record.

#### 4.2 File Changes

| File | Change |
|------|--------|
| `apps/api/src/services/monitoring.ts` | Add `shouldTrackUser()`, wrap PostHog calls |
| `apps/web/src/lib/analytics.ts` | Gate initialization on consent |
| `apps/web/src/lib/user-context.tsx` | Call `initAnalytics` with consent status |
| `apps/mobile/src/lib/` | Mirror web consent gating pattern |

---

### 5. i18n Keys

All user-facing text must use the i18n system. New keys to add in both `packages/shared/src/i18n/es.json` and `packages/shared/src/i18n/en.json`:

```json
{
  "age_gate": {
    "title": "How old are you?",
    "parent_option": "I am a parent or adult (18+)",
    "teen_option": "I am a teenager (13-17)",
    "child_option": "I am a child (under 13)",
    "teen_notice_title": "Before you start...",
    "teen_notice_body": "SportyKids collects your sport preferences and reading activity to personalize your news feed. We never share your data with third parties for advertising.",
    "teen_accept": "I have read and accept the Privacy Policy and Terms of Service",
    "child_consent_title": "Parent Required",
    "child_consent_hand_device": "Please hand the device to your parent or guardian.",
    "child_consent_for_parents": "For parents:",
    "child_consent_we_collect": "SportyKids is a sports news app for kids. We collect:",
    "child_consent_collect_prefs": "Sport preferences",
    "child_consent_collect_activity": "Reading activity",
    "child_consent_collect_quiz": "Quiz scores",
    "child_consent_we_dont_collect": "We do NOT collect:",
    "child_consent_no_location": "Location data",
    "child_consent_no_photos": "Photos or contacts",
    "child_consent_no_ads": "Data for advertising",
    "child_consent_checkbox": "I am the parent/legal guardian and I consent to my child using SportyKids",
    "child_consent_set_pin": "Set Up Parental PIN",
    "continue": "Continue"
  },
  "legal": {
    "privacy_policy": "Privacy Policy",
    "terms_of_service": "Terms of Service",
    "last_updated": "Last updated: {date}",
    "back": "Back"
  },
  "delete_account": {
    "title": "Danger Zone",
    "description": "Delete all data associated with this account. This action is permanent and cannot be undone.",
    "button": "Delete Account",
    "confirm_title": "Delete Account?",
    "confirm_body": "This will permanently delete ALL data for {name}:",
    "confirm_reading": "Reading history",
    "confirm_quiz": "Quiz scores",
    "confirm_stickers": "Stickers & achievements",
    "confirm_streaks": "Streaks & missions",
    "confirm_parental": "Parental settings",
    "confirm_activity": "All activity logs",
    "confirm_warning": "This cannot be undone.",
    "confirm_cancel": "Cancel",
    "confirm_delete": "Delete Forever",
    "success": "Account deleted successfully",
    "error": "Failed to delete account. Please try again."
  }
}
```

Spanish translations follow the same keys with appropriate translations.

---

### 6. Legal Links Integration

Add links to Privacy Policy and Terms of Service in existing screens:

| Location | File | Change |
|----------|------|--------|
| Login screen (mobile) | `apps/mobile/src/screens/Login.tsx` | Add footer links (open in-app browser) |
| Register screen (mobile) | `apps/mobile/src/screens/Register.tsx` | Add footer links |
| Onboarding step 1 (web) | `apps/web/src/components/OnboardingWizard.tsx` | Add links below first step |
| Onboarding (mobile) | `apps/mobile/src/screens/Onboarding.tsx` | Add links |
| Parental Panel footer (web) | `apps/web/src/components/ParentalPanel.tsx` | Add links above/below danger zone |
| Parental Control footer (mobile) | `apps/mobile/src/screens/ParentalControl.tsx` | Add links |

---

## Acceptance Criteria

### Age Gate
- [ ] New users cannot access the app without completing the age gate
- [ ] Existing users with `ageGateCompleted=false` are redirected to the age gate on next visit
- [ ] Adult (18+) path sets consent fields and proceeds to onboarding
- [ ] Teen (13-17) path requires checkbox acceptance before continuing
- [ ] Child (<13) path requires parent confirmation checkbox AND PIN creation before proceeding
- [ ] Child path with existing ParentalProfile skips PIN creation but still records consent
- [ ] All three paths set `ageGateCompleted=true` and `consentGiven=true` on User
- [ ] Age gate works on both web and mobile
- [ ] Back button on teen/child screens returns to age selection
- [ ] Privacy Policy and Terms links on age gate screens are functional

### Legal Pages
- [ ] `/privacy` renders the full Privacy Policy in the user's locale
- [ ] `/terms` renders the full Terms of Service in the user's locale
- [ ] Both pages are accessible without authentication
- [ ] Locale can be switched via `?locale=en` or `?locale=es`
- [ ] Pages have proper meta tags for SEO (title, description)
- [ ] Pages render correctly on mobile viewport
- [ ] Links to legal pages work from age gate, login, onboarding, and parental panel

### Data Deletion
- [ ] `DELETE /api/users/:id/data` deletes all user-related records in a single transaction
- [ ] Endpoint requires authentication
- [ ] Endpoint requires valid parental session for child accounts
- [ ] Returns `{ deleted: true, userId, deletedAt }` on success
- [ ] Returns 403 if parental session is missing/expired for child accounts
- [ ] Returns 404 if user not found
- [ ] Web: "Delete Account" button appears in ParentalPanel with confirmation dialog
- [ ] Mobile: "Delete Account" button appears in ParentalControl with Alert confirmation
- [ ] After deletion, local storage/AsyncStorage is cleared and user is redirected to age gate
- [ ] Deletion is irreversible — no soft-delete

### Analytics Consent Gate
- [ ] PostHog does not initialize on web until `consentGiven=true`
- [ ] PostHog `capture()` calls on API are gated by user's consent status
- [ ] Sentry does not attach user context for users without consent
- [ ] Server-level Sentry errors (no user context) still work regardless of consent
- [ ] When consent is granted (age gate completion), analytics initializes on next page load

### i18n
- [ ] All new user-facing strings use i18n keys
- [ ] Spanish and English translations exist for all new keys
- [ ] No hardcoded user-visible text in components

### Legal Links
- [ ] Links to Privacy Policy and Terms appear on login, register, onboarding, and parental screens
- [ ] Links work on both web (Next.js navigation) and mobile (in-app browser)

---

## Technical Requirements

### Database Migration

Create a new Prisma migration in `apps/api/prisma/migrations/`:

```sql
ALTER TABLE "User" ADD COLUMN "ageGateCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "consentGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "consentDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "consentBy" TEXT;
```

Update `apps/api/prisma/schema.prisma` with the new fields.

### New Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/age-gate/page.tsx` | Age gate page (web) |
| `apps/web/src/app/privacy/page.tsx` | Privacy Policy page |
| `apps/web/src/app/terms/page.tsx` | Terms of Service page |
| `apps/mobile/src/screens/AgeGate.tsx` | Age gate screen (mobile) |

### Modified Files

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add 4 fields to User model |
| `apps/api/src/routes/users.ts` | Add `DELETE /:id/data` handler |
| `apps/api/src/services/monitoring.ts` | Add `shouldTrackUser()`, consent gating |
| `apps/web/src/lib/analytics.ts` | Gate PostHog init on consent |
| `apps/web/src/lib/user-context.tsx` | Add age gate redirect logic, pass consent to analytics |
| `apps/web/src/components/ParentalPanel.tsx` | Add delete account section, legal links footer |
| `apps/web/src/components/OnboardingWizard.tsx` | Add legal links |
| `apps/mobile/src/screens/ParentalControl.tsx` | Add delete account button, legal links |
| `apps/mobile/src/screens/Onboarding.tsx` | Add legal links |
| `apps/mobile/src/screens/Login.tsx` | Add legal links |
| `apps/mobile/src/screens/Register.tsx` | Add legal links |
| `apps/mobile/src/navigation/` | Add AgeGate screen, navigation guard |
| `apps/mobile/src/lib/user-context.tsx` | Add age gate navigation logic |
| `packages/shared/src/i18n/es.json` | Add age_gate, legal, delete_account keys |
| `packages/shared/src/i18n/en.json` | Add age_gate, legal, delete_account keys |
| `packages/shared/src/types/` | Add consent fields to User type |

### Shared Types Update

In `packages/shared/src/types/` (wherever the User type is defined), add:

```typescript
interface User {
  // ... existing fields ...
  ageGateCompleted: boolean;
  consentGiven: boolean;
  consentDate: string | null; // ISO 8601
  consentBy: string | null;
}
```

### API Route Shape

```typescript
// DELETE /api/users/:id/data
// Request headers: Authorization: Bearer <jwt>, X-Parental-Session: <token>
// Response 200: { deleted: true, userId: string, deletedAt: string }
// Response 401: { error: 'auth_required' }
// Response 403: { error: 'forbidden' }
// Response 404: { error: 'not_found' }
```

---

## Implementation Decisions

### Why a separate age gate page instead of inline in onboarding?

The age gate determines the consent flow (no consent needed vs. notice vs. full parental consent + PIN). Embedding this in onboarding would complicate the already 4-step wizard with branching logic. A separate page keeps concerns clean: age gate handles legal compliance, onboarding handles preferences.

### Why on-screen consent instead of email verification?

Email verification adds friction that would significantly reduce conversion for a free kids app. The COPPA "email plus" method and on-screen confirmation with PIN creation provides a reasonable level of verification — the parent must be physically present and must create a PIN they will need for ongoing parental control access. This is a pragmatic balance. The [LEGAL REVIEW REQUIRED] tags flag this for attorney review.

### Why hard delete instead of soft delete?

COPPA and GDPR require actual deletion upon parent request, not just marking records as inactive. Soft delete would be legally insufficient and would create ongoing data retention liability. The deletion is wrapped in a transaction to ensure atomicity.

### Why gate analytics initialization instead of just not sending events?

If PostHog JS initializes, it may set cookies or local storage entries before any events are sent, which could constitute data collection under GDPR. Preventing initialization entirely is the safest approach.

### Why store consent on the User model instead of a separate ConsentLog table?

For this phase, we need a simple boolean gate: does this user have consent? A separate table would be needed if we tracked consent history (grant, revoke, re-grant), but that is out of scope. The `consentDate` field provides an audit trail of when consent was given. If consent versioning is needed later, a `ConsentLog` table can be added.

### Why open legal pages in in-app browser on mobile?

Building native screens for long legal text is unnecessary work. The web pages already handle i18n and responsive layout. In-app browser (`expo-web-browser`) provides a clean experience and avoids duplicating content.

### Why `consentBy` stores the child's own userId?

In the current architecture, there is no separate parent account at consent time — the parent is physically present and consenting on the child's device. The field exists to support the future case where a parent account links to a child account. For now, storing the child's userId documents that consent was given in this user's context.

---

## Testing Decisions

### Unit Tests

**API tests** (add to `apps/api/` test suite, Vitest):

1. **Age gate fields on User CRUD:**
   - `POST /api/users` with `ageGateCompleted` and `consentGiven` creates user correctly
   - `PUT /api/users/:id` with consent fields updates them
   - `consentDate` is auto-set server-side when `consentGiven` transitions to `true`
   - `GET /api/users/:id` returns consent fields

2. **Data deletion endpoint:**
   - Returns 401 without auth
   - Returns 403 without parental session for child users
   - Returns 404 for non-existent user
   - Deletes all related records (verify each table is empty for that userId after deletion)
   - Returns correct response shape
   - Transaction rollback: if any deletion fails, no records are deleted (mock a Prisma error mid-transaction)

3. **Analytics consent gating:**
   - `shouldTrackUser` returns false for users with `consentGiven=false`
   - `shouldTrackUser` returns true for users with `consentGiven=true`

**Web tests** (add to `apps/web/` test suite, Vitest):

4. **Age gate page:**
   - Renders three options
   - Adult path sets fields and navigates to onboarding
   - Teen path shows notice, requires checkbox, navigates on accept
   - Child path shows consent screen, requires checkbox, transitions to PIN creation

5. **Legal pages:**
   - `/privacy` renders without auth
   - `/terms` renders without auth
   - Locale switching works (via query param)

6. **ParentalPanel delete section:**
   - Delete button renders
   - Confirmation dialog appears on click
   - Cancel dismisses dialog
   - Confirm calls DELETE endpoint
   - After deletion, clears localStorage and redirects

**Mobile tests** (add to `apps/mobile/` test suite, Vitest):

7. **AgeGate screen:**
   - Renders three options
   - Navigation works for each path

8. **ParentalControl delete:**
   - Delete button renders
   - Alert.alert is called with correct options

### What NOT to Test

- Legal page content accuracy (that is a legal review, not a code test)
- PostHog/Sentry internal behavior (third-party library)
- Prisma migration execution (tested by `db:migrate` command itself)

---

## Out of Scope

- **Email-based parental consent verification**: The current implementation uses on-screen confirmation. Email-plus or other COPPA-approved methods may be added in a future phase after legal review.
- **Consent versioning / audit log**: No `ConsentLog` table. If the privacy policy changes materially, re-consent will be handled in a future phase.
- **Age verification beyond self-declaration**: No ID verification, no date-of-birth collection, no third-party age verification services.
- **COPPA Safe Harbor program membership**: This would provide a legal safe harbor but requires third-party certification.
- **Cookie consent banner**: The app does not use advertising cookies. Analytics cookies are gated by consent. A cookie banner may be needed for EU web users in a future compliance pass.
- **Data export (GDPR portability)**: The right to data portability is a GDPR requirement but is deferred to a future phase. Parents can currently view all data through the parental panel.
- **Multi-child management under one parent account**: Currently each child is a separate user. Linking multiple children to one parent account is a separate feature.
- **Re-consent on policy changes**: Flagged in [LEGAL REVIEW REQUIRED] sections but not implemented in this phase.

---

## Future Considerations

1. **COPPA Safe Harbor**: Consider joining a Safe Harbor program (e.g., kidSAFE, PRIVO) for stronger legal protection.
2. **Data Export**: Implement `GET /api/users/:id/data/export` for GDPR data portability.
3. **Consent Versioning**: Track consent version to enable re-consent when privacy policy changes.
4. **Email-Plus Verification**: Send email to parent after on-screen consent with "if you did NOT consent, click here to revoke" as additional COPPA protection.
5. **Parent Account Linking**: Allow a parent account to manage multiple children, providing a single consent point.
6. **Cookie Consent Banner**: Add for EU web users if cookie usage expands.
7. **Regional Age Thresholds**: Some EU countries set the consent age at 14, 15, or 16 instead of 13. Consider using the `country` field to apply country-specific thresholds.
8. **Accessibility**: Ensure age gate and consent screens meet WCAG 2.1 AA standards (sufficient contrast, screen reader support, keyboard navigation).
