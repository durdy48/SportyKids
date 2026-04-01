# Phase 6, PRD 5: kidSAFE Certification

| Field | Value |
|-------|-------|
| **Phase** | 6.5 — kidSAFE Certification |
| **Priority** | P2 (trust signal, not blocking) |
| **Target** | Month 3 post-launch (v1.3.x) |
| **Dependencies** | Phases 0-5 complete, app published on App Store & Google Play |
| **Estimated effort** | 3-5 days of engineering + 2-4 weeks audit turnaround |
| **Annual cost** | ~$500-1,500/year |

---

## 1. Overview / Problem Statement

SportyKids is a kids app built by an unknown indie developer. Parents downloading an app for their 6-14 year old child need a trust signal beyond "we say it's safe." The **kidSAFE Seal Program** is the most recognized third-party safety certification for children's digital services. Displaying the seal in-app and on store listings gives parents immediate confidence that privacy, content moderation, and parental controls have been independently audited.

This PRD covers both the **process** (application, audit preparation, certification) and the **code changes** needed to display the seal and ensure all data practices are audit-ready.

---

## 2. Goals and Non-Goals

### Goals

1. **Pass the kidSAFE audit** on first submission by documenting all data flows accurately.
2. **Display the kidSAFE seal** in-app (mobile Settings/About, web footer) and store metadata.
3. **Produce a compliance audit document** that maps every data collection, storage, sharing, and deletion path.
4. **Review and harden content moderation** to ensure >99% accuracy before the audit.
5. **Ensure privacy policy matches actual behavior** — no gaps between policy text and code.

### Non-Goals

- kidSAFE+ certification (requires social/community features, which SportyKids does not have).
- COPPA Safe Harbor certification (separate program, consider post-kidSAFE).
- Automated compliance monitoring tooling.
- Changes to core data architecture — this phase documents and verifies, not redesigns.

---

## 3. kidSAFE Certification Process

### 3.1 Application

1. Complete the application form at [kidsafeseal.com](https://www.kidsafeseal.com).
2. Select the **kidSAFE Seal** tier (content app, no social features).
3. Provide: app name, platform URLs (App Store + Google Play), privacy policy URL, contact info.
4. Pay the application fee (~$500-1,500 depending on app size/revenue).

### 3.2 Audit Preparation

Before submitting, prepare these deliverables:

| Deliverable | Description | Owner |
|-------------|-------------|-------|
| Compliance audit document | Full map of data flows (Section 4) | Developer |
| Privacy policy review | Diff between policy text and actual code behavior | Developer |
| Content moderation report | Accuracy stats from last 30 days of moderation | Developer |
| Test accounts | Parent + child accounts for auditors | Developer |
| Parental controls walkthrough | Step-by-step documentation of PIN, limits, schedule lock | Developer |

### 3.3 Audit & Certification

- kidSAFE reviews the app, privacy policy, and data practices.
- They may request changes or clarifications (typically 1-2 rounds).
- Upon approval: receive seal assets (badge images) and permission to display.
- Certification is valid for 1 year, renewable.

---

## 4. Compliance Audit Document

Create `docs/en/11-compliance-audit.md` mapping every data touchpoint.

### 4.1 Data Collection Inventory

| Data Point | Where Collected | Storage | Retention | Shared With |
|------------|----------------|---------|-----------|-------------|
| Age range (6-8, 9-11, 12-14) | Age gate screen | `User.ageRange` (PostgreSQL) | Until account deletion | Nobody |
| Favorite sports | Onboarding | `User.favoriteSports` (PostgreSQL array) | Until account deletion | Nobody |
| Favorite team | Onboarding | `User.favoriteTeam` (PostgreSQL) | Until account deletion | Nobody |
| Email + password hash | Registration | `User.email`, `User.passwordHash` | Until account deletion | Nobody |
| Parental PIN (bcrypt) | Parental setup | `ParentalProfile.pinHash` | Until account deletion | Nobody |
| Quiz answers | Quiz gameplay | `QuizQuestion` join | Until account deletion | Nobody |
| Activity logs | Passive tracking | `ActivityLog` table | Until account deletion | Aggregated to parent via digest |
| Push tokens | Notification opt-in | `PushToken` table | Until account deletion | Expo Push Service (delivery only) |
| Content reports | User-initiated | `ContentReport` table | Until review + 90 days | Nobody |
| OAuth social ID | Google/Apple sign-in | `User.socialId` | Until account deletion | Nobody |
| Device locale | Auto-detected | `User.locale` | Until account deletion | Nobody |

### 4.2 Data Sharing

SportyKids shares data with exactly these third parties:

| Service | Data Sent | Purpose | DPA Required |
|---------|-----------|---------|--------------|
| Expo Push | Push token + message | Notification delivery | Yes |
| Sentry | Error stack traces (no PII) | Crash monitoring | Yes (have) |
| PostHog | Anonymized events (consent-gated) | Analytics | Yes (have) |
| AI Provider (Ollama/OpenRouter) | News text (no user data) | Content moderation + summarization | N/A (no user data) |

### 4.3 Data Deletion

- `DELETE /api/users/:id/data` performs transactional hard delete of all user data (GDPR Art. 17).
- Cascade deletes: User -> ActivityLog, PushToken, RefreshToken, ParentalSession, UserSticker, UserAchievement, DailyMission, ContentReport, ParentalProfile.
- No soft deletes, no backup retention of deleted user data.

### 4.4 Parental Controls

- PIN-protected access (4-digit, bcrypt hashed, 5-attempt lockout with 15-min cooldown).
- Per-content-type time limits (news, reels, quiz minutes).
- Schedule lock (allowed hours with timezone support).
- Sport and format restrictions.
- Activity digest (weekly PDF/email).
- Feed preview (parent can see exactly what child sees).
- Content reporting review.

---

## 5. Privacy Policy Review

### 5.1 Checklist

Before audit submission, verify each claim in `/privacy` and `/terms` matches code:

- [ ] "We do not sell personal data" — verify no third-party data sale endpoints exist.
- [ ] "Analytics only with parental consent" — verify PostHog/Sentry gated on `consentGiven`.
- [ ] "Data deletion available" — verify `DELETE /api/users/:id/data` works end-to-end.
- [ ] "Content moderated by AI" — verify moderation pipeline is active, not bypassed.
- [ ] "No ads" — verify zero ad SDKs in dependencies.
- [ ] "Parental PIN required for settings" — verify `parental-guard.ts` middleware is enforced.
- [ ] Age ranges listed match actual `AGE_RANGES` constant.
- [ ] Third-party services listed match actual integrations.

### 5.2 Potential Gaps to Address

| Gap | Risk | Fix |
|-----|------|-----|
| YouTube embeds load third-party cookies | Medium | Already sandboxed; document in policy |
| Google/Apple OAuth shares email with provider | Low | Document in policy; email only used for auth |
| AI provider sees news text | Low | No user data sent; document in policy |

---

## 6. Content Moderation Hardening

### 6.1 Accuracy Review

Before the audit, run a moderation accuracy report:

1. Query all `NewsItem` records from the last 30 days.
2. Sample 100 `approved` items — manually verify none contain inappropriate content.
3. Sample all `rejected` items — verify no false positives blocking legitimate sports news.
4. Target: >99% accuracy on both approved and rejected.

### 6.2 Fallback Rules

Add keyword-based fallback moderation that runs when AI is unavailable:

```typescript
// apps/api/src/services/content-moderator.ts
const BLOCKED_KEYWORDS = [
  'betting', 'gambling', 'apuestas',
  'arrested', 'detenido',
  'scandal', 'escándalo',
  'doping',
  'abuse', 'abuso',
];
```

This is a safety net, not a replacement for AI moderation. Items matching blocked keywords when AI is down should be held as `pending` rather than auto-approved.

### 6.3 Moderation Logging

Add a `ModerationLog` entry for each decision (already partially tracked via `safetyStatus`, `safetyReason`, `moderatedAt`). Ensure these fields are populated for 100% of items — no nulls on approved content.

---

## 7. UI Changes

### 7.1 kidSAFE Badge — Mobile

Add to the Settings/About section in `ParentalControl.tsx`:

```
┌─────────────────────────────┐
│  [kidSAFE Seal Image]       │
│  kidSAFE Certified          │
│  Learn more →               │
└─────────────────────────────┘
```

- Badge image: `assets/kidsafe-seal.png` (provided by kidSAFE after certification).
- "Learn more" links to `https://www.kidsafeseal.com/certifiedproducts/sportykids.html`.
- Wrapped in `accessibilityLabel={t('a11y.kidsafe_badge', locale)}`.

### 7.2 kidSAFE Badge — Web

Add to the footer in `NavBar.tsx` or a new `Footer.tsx` component:

```html
<a href="https://www.kidsafeseal.com/certifiedproducts/sportykids.html"
   target="_blank" rel="noopener noreferrer"
   aria-label={t('a11y.kidsafe_badge', locale)}>
  <img src="/kidsafe-seal.png" alt="kidSAFE Certified" width="120" />
</a>
```

### 7.3 Store Metadata

Update `apps/mobile/store-metadata/{en,es}.json`:

- Add "kidSAFE Certified" to the app description.
- Add "kidsafe, certified, safe for kids" to keywords.

---

## 8. i18n Keys

Add to `packages/shared/src/i18n/en.json`:

```json
{
  "certification": {
    "kidsafe_title": "kidSAFE Certified",
    "kidsafe_description": "This app has been independently certified as safe for children by the kidSAFE Seal Program.",
    "learn_more": "Learn more"
  },
  "a11y": {
    "kidsafe_badge": "kidSAFE safety certification badge. Tap to learn more."
  }
}
```

Add equivalent keys to `es.json`:

```json
{
  "certification": {
    "kidsafe_title": "Certificado kidSAFE",
    "kidsafe_description": "Esta app ha sido certificada de forma independiente como segura para niños por el programa kidSAFE Seal.",
    "learn_more": "Saber más"
  },
  "a11y": {
    "kidsafe_badge": "Sello de certificación de seguridad kidSAFE. Toca para saber más."
  }
}
```

---

## 9. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `docs/en/11-compliance-audit.md` | Create | Full data flow audit document |
| `docs/es/11-auditoria-compliance.md` | Create | Spanish translation |
| `packages/shared/src/i18n/en.json` | Modify | Add `certification.*` and `a11y.kidsafe_badge` keys |
| `packages/shared/src/i18n/es.json` | Modify | Add Spanish equivalents |
| `apps/mobile/src/screens/ParentalControl.tsx` | Modify | Add kidSAFE badge section |
| `apps/web/src/components/NavBar.tsx` (or new `Footer.tsx`) | Modify | Add kidSAFE badge to footer |
| `apps/mobile/store-metadata/en.json` | Modify | Add certification mention |
| `apps/mobile/store-metadata/es.json` | Modify | Add certification mention |
| `apps/api/src/services/content-moderator.ts` | Modify | Add keyword fallback rules |
| `apps/mobile/assets/kidsafe-seal.png` | Create | Badge asset (from kidSAFE after approval) |
| `apps/web/public/kidsafe-seal.png` | Create | Badge asset (from kidSAFE after approval) |

---

## 10. Timeline

| Week | Activity |
|------|----------|
| 1 | Write compliance audit document. Review privacy policy against code. Run moderation accuracy report. |
| 1 | Implement keyword fallback moderation. Add i18n keys. Prepare test accounts. |
| 2 | Submit kidSAFE application with all documentation. |
| 2-4 | Audit period (kidSAFE reviews, 1-2 rounds of feedback). |
| 4 | Receive seal. Add badge assets to mobile + web. Update store metadata. Ship update. |

**Total engineering effort**: 3-5 days spread across weeks 1-2 and week 4.

---

## 11. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| kidSAFE certification granted | Pass/fail |
| Compliance audit document complete | All data flows documented with zero gaps |
| Privacy policy matches code | Zero discrepancies found in review |
| Content moderation accuracy | >99% on 30-day sample |
| kidSAFE badge visible in app | Mobile (ParentalControl) + Web (footer) |
| Store metadata updated | Both en/es mention certification |
| Keyword fallback moderation active | Blocked keywords prevent auto-approval when AI is down |

---

## 12. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| kidSAFE requests changes to data practices | Medium | Pre-audit with compliance checklist (Section 5.1) |
| YouTube embeds flagged as third-party content risk | Medium | Document sandbox restrictions; prepare to switch to native video (PRD 3) |
| Audit takes longer than 4 weeks | Low | No code dependency — badge is additive, not blocking |
| Cost increases in future years | Low | Budget $1,500/year; ROI justified by conversion lift from trust signal |
| kidSAFE program changes requirements | Low | Annual renewal includes re-review; stay current |
