# Store Review Notes — Phase 5

## Apple Review Notes

To include in the "Notes for Review" field in App Store Connect:

```
SportyKids is a kids' sports news app for ages 6-14. Key review information:

KIDS CATEGORY:
- Target age range: 6-14 years old
- All content is moderated by AI before being shown to children
- Content sources are exclusively verified sports news outlets (182 RSS sources)
- YouTube embeds use child-safe parameters (no ads, no related videos, sandbox iframe)
- No user-generated content visible to children
- No external links that leave the app without parental controls

PARENTAL CONTROLS:
- 4-digit PIN required to access parental settings
- Parents can set time limits per content type (news, reels, quizzes)
- Parents can restrict allowed sports and content formats
- Schedule lock (bedtime hours) enforced server-side
- Weekly activity digest available for parents

SIGN IN WITH APPLE:
- Available on the Login screen alongside Google Sign In and email registration
- Anonymous usage is also supported (no account required)

PRIVACY:
- Privacy Policy: https://sportykids-api.fly.dev/privacy (also accessible in-app)
- No data collected without parental consent for children under 13
- COPPA and GDPR-K compliant age gate at first launch
- Analytics (PostHog) only initialized after parental consent
- Sentry crash reporting sends no PII

TEST ACCOUNT:
- The app can be used without an account (anonymous mode)
- To test parental controls: create a user, then set up a PIN in the Parents tab
```

---

## Google Review Notes

For "App content" declarations in Google Play Console:

```
FAMILIES POLICY COMPLIANCE:
- App is designed for children aged 6-14
- All content is AI-moderated before display
- No behavioral advertising
- No data collection without verifiable parental consent (COPPA)
- Parental controls with PIN protection

CONTENT RATING (IARC):
- No violence, no sexual content, no profanity
- Sports news only from verified journalistic sources
- Recommended rating: PEGI 3 / ESRB Everyone
```

---

## Apple Kids Category Requirements

| Requirement | SportyKids Status | Action Needed |
|-------------|-------------------|---------------|
| Must select a Kids age band (5 & Under, 6-8, 9-11) | Target 6-14, select "9-11" primary | Select in App Store Connect |
| No third-party analytics without consent | PostHog gated on `consentGiven` | Verified |
| No external links without parental gate | YouTube embeds sandboxed, no raw external links | Verified |
| No ads | No ads in app | Verified |
| Must comply with COPPA | Age gate + parental consent flow implemented | Verified |
| Sign In with Apple required (if any social login) | Apple Sign In implemented | Verified |
| Privacy Policy must be accessible | `/privacy` page exists | Verified |

---

## Apple Privacy Nutrition Labels

| Data Type | Collected? | Purpose | Linked to Identity? |
|-----------|-----------|---------|---------------------|
| Contact Info (email) | Yes (optional) | Account creation | Yes (if account created) |
| Identifiers (user ID) | Yes | App functionality | Yes |
| Usage Data (quiz scores, activity) | Yes | App functionality | Yes |
| Diagnostics (crash logs) | Yes (opt-in) | Crash reporting via Sentry | No |
| Analytics | Yes (opt-in) | App improvement via PostHog | No |

Selection in App Store Connect: **"Data Used to Track You": No** / **"Data Linked to You": Contact Info (if registered), Identifiers**

---

## Google Data Safety Form

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | Yes |
| Is all collected data encrypted in transit? | Yes (HTTPS enforced) |
| Can users request data deletion? | Yes (`DELETE /api/users/:id/data`) |
| **Data types collected:** | |
| - Personal info (email) | Optional, for account creation |
| - App activity (quiz scores, reading history) | For app functionality |
| - Device info (crash logs) | Optional, for diagnostics |
| **Data shared with third parties?** | No (Sentry/PostHog are processors, not third-party sharing) |

---

## IARC Content Rating Questionnaire Answers

| Question Category | Answer |
|-------------------|--------|
| Violence | None |
| Sexual Content | None |
| Language | None |
| Controlled Substances | None |
| User Interaction | Limited (content reports only, no chat) |
| Data Sharing | With parental consent only |

Expected rating: **PEGI 3 / ESRB Everyone / USK 0**

---

## Google Families Policy Compliance

| Requirement | SportyKids Compliance |
|-------------|----------------------|
| Must select target audience including children | Yes, 6-14 years |
| Comply with Families Policy | Yes |
| No behavioral advertising | No ads at all |
| No data collection without verifiable parental consent | COPPA consent flow implemented |
| API level must be current | Expo SDK 54 targets current API levels |
| Must have a privacy policy | Yes, `/privacy` |
| Must complete Data Safety form | See Google Data Safety section above |
| Must complete IARC rating | See IARC section above |
| Must declare "Teacher Approved" or not | No (not applying for this) |

---

## Common Rejection Causes & Prepared Responses

### Apple

| Rejection Reason | Response Strategy |
|-----------------|-------------------|
| **Guideline 1.3 — Kids Category** | Point to: AI content moderation, parental PIN, no external links without gate, no ads, COPPA consent flow. Include screenshots of age gate and parental controls. |
| **Guideline 2.1 — Performance** "App crashes on launch" | Fix crash, ensure Sentry is capturing it, re-test on physical device before resubmission. |
| **Guideline 2.3.1 — Sign In with Apple** | Apple Sign In IS implemented. Point reviewer to Login screen. If not visible, check OAuth env vars. |
| **Guideline 5.1.1 — Data Collection** | Point to age gate flow, COPPA consent for under-13, privacy policy. PostHog/Sentry gated on consent. |
| **Guideline 5.1.2 — Data Use and Sharing** | Review and update `/privacy` page to explicitly list all data types per Apple's feedback. |
| **Guideline 4.8 — Sign In** "Cannot test the app" | App works in anonymous mode. Add clear demo instructions in Review Notes. |

### Google

| Rejection Reason | Response Strategy |
|-----------------|-------------------|
| **Families Policy violation** | Ensure all Families declarations are accurate. Double-check no third-party SDKs send data without consent. |
| **Data Safety form incomplete** | Review form against actual data collection. Be precise about what PostHog/Sentry collect. |
| **Metadata policy violation** | Ensure description does not mention competing platforms, use misleading screenshots, or contain spam keywords. |
| **Content rating mismatch** | Re-take IARC questionnaire if content has changed. |
| **Target audience declaration** | Provide evidence of content moderation, parental controls, and COPPA compliance. |

---

## Re-submission Workflow

1. Read the rejection notice carefully — identify the exact guideline cited
2. Check this document for a prepared response
3. If it is a code/compliance issue:
   - Create branch `fix/store-review-{platform}-{issue}`
   - Fix the issue with minimal changes
   - Run full test suite (`npm run test:all`)
   - Deploy to staging, verify the fix
   - Build new production binary
   - Re-submit with a clear explanation in "Notes for Review"
4. If it is a metadata/declaration issue:
   - Fix directly in App Store Connect / Google Play Console
   - Re-submit without new build
5. If the rejection seems incorrect:
   - **Apple:** Use the Resolution Center to appeal, or request a phone call with App Review
   - **Google:** Use the "Appeal" button in the Policy Status page

**Re-submission timeline:**
- Apple re-reviews typically take 1-2 days (faster than initial)
- Google re-reviews typically take 1-3 days
