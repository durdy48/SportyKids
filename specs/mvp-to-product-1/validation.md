# Human Validation — prd.md (Legal & Compliance Foundation)

## Prerequisites

Start the API and web servers:

```bash
# Terminal 1: Start PostgreSQL
docker compose -f apps/api/docker-compose.yml up -d postgres

# Terminal 2: API
npm run dev:api

# Terminal 3: Web
npm run dev:web

# Terminal 4 (optional): Mobile
npm run dev:mobile
```

Ensure the database is migrated and seeded:

```bash
cd apps/api && npx prisma migrate dev && npx tsx prisma/seed.ts
```

## Validation Steps

### 1. Age Gate — New User (Web)

1. **Action**: Open an incognito/private window. Navigate to `http://localhost:3000`.
   **Expected**: You are redirected to `/age-gate`. Three options are displayed: "I am a parent or adult (18+)", "I am a teenager (13-17)", "I am a child (under 13)".

2. **Action**: Click "I am a parent or adult (18+)".
   **Expected**: You are redirected to `/onboarding`. The user is created with `ageGateCompleted=true` and `consentGiven=true`.

3. **Action**: Open a new incognito window. Navigate to `http://localhost:3000`. Click "I am a teenager (13-17)".
   **Expected**: A notice screen appears with privacy information and a checkbox "I have read and accept the Privacy Policy and Terms of Service". The "Continue" button is disabled.

4. **Action**: Check the checkbox and click "Continue".
   **Expected**: You are redirected to `/onboarding`.

5. **Action**: Open a new incognito window. Navigate to `http://localhost:3000`. Click "I am a child (under 13)".
   **Expected**: A consent screen appears asking to hand the device to a parent. Shows what data is collected/not collected. Has a checkbox for parental consent. "Set Up Parental PIN" button is disabled.

6. **Action**: Check the consent checkbox and click "Set Up Parental PIN".
   **Expected**: A PIN input appears. Enter a 4-digit PIN and confirm it.

7. **Action**: Complete PIN creation.
   **Expected**: You are redirected to `/onboarding`. A `ParentalProfile` is created with the PIN.

### 2. Age Gate — Existing User Without Consent (Web)

8. **Action**: If you have an existing user (created before this feature), clear localStorage and reload the page.
   **Expected**: You are redirected to `/age-gate` because `ageGateCompleted` is `false`.

### 3. Legal Pages (Web)

9. **Action**: Navigate to `http://localhost:3000/privacy`.
   **Expected**: The Privacy Policy page renders with full content. "Last updated: March 2026" appears at top. Back button and locale switcher are visible.

10. **Action**: Click the locale switcher to switch to English (EN).
    **Expected**: The page content switches to English.

11. **Action**: Navigate to `http://localhost:3000/terms`.
    **Expected**: The Terms of Service page renders with full content.

12. **Action**: Check that `[LEGAL REVIEW REQUIRED]` sections are highlighted.
    **Expected**: Yellow/amber background banners appear on sections needing legal review.

13. **Action**: Try accessing `/privacy` and `/terms` without being logged in (incognito).
    **Expected**: Pages are accessible without authentication.

### 4. Legal Links Integration (Web)

14. **Action**: Navigate to `/onboarding` (step 1).
    **Expected**: "Privacy Policy" and "Terms of Service" links are visible at the bottom.

15. **Action**: Navigate to the Parental Controls panel.
    **Expected**: "Privacy Policy" and "Terms of Service" links appear in the footer area.

### 5. Data Deletion (Web)

16. **Action**: Create a user with some activity (view some news, take a quiz). Navigate to Parental Controls (enter PIN).
    **Expected**: Scroll to the bottom. A red "Danger Zone" section with "Delete Account" button is visible.

17. **Action**: Click "Delete Account".
    **Expected**: A confirmation modal appears listing all data that will be deleted. "Cancel" and "Delete Forever" buttons are shown.

18. **Action**: Click "Cancel".
    **Expected**: The modal closes. Nothing is deleted.

19. **Action**: Click "Delete Account" again, then "Delete Forever".
    **Expected**: The account is deleted. You are redirected to `/age-gate`. localStorage is cleared.

20. **Action**: Verify in the database that the user and all related records are gone.
    **Expected**: `SELECT * FROM "User" WHERE id = '<userId>'` returns no rows.

### 6. Analytics Consent Gate (Web)

21. **Action**: Open browser DevTools > Network tab. Create a new user via the child (<13) age gate path (which requires consent).
    **Expected**: Before completing consent, no PostHog requests appear in the Network tab. After completing consent, PostHog may initialize.

22. **Action**: Create a new user via a fresh incognito window. Before completing the age gate, check browser localStorage/cookies.
    **Expected**: No PostHog-related localStorage entries or cookies exist until consent is given.

### 7. Age Gate — Mobile

23. **Action**: Open the mobile app (Expo Go). If no user exists or user has `ageGateCompleted=false`.
    **Expected**: The AgeGate screen appears with three options.

24. **Action**: Test each path (adult, teen, child).
    **Expected**: Same behavior as web — adult proceeds directly, teen shows notice, child shows consent + PIN creation.

### 8. Legal Links — Mobile

25. **Action**: Navigate to the Login screen in the mobile app.
    **Expected**: "Privacy Policy" and "Terms of Service" links appear at the bottom.

26. **Action**: Tap a legal link.
    **Expected**: An in-app browser opens showing the web privacy/terms page.

### 9. Delete Account — Mobile

27. **Action**: In the mobile app, navigate to Parental Controls (enter PIN).
    **Expected**: Scroll to bottom. "Danger Zone" section with "Delete Account" button is visible.

28. **Action**: Tap "Delete Account".
    **Expected**: An Alert dialog appears with "Cancel" and "Delete Forever" options.

### 10. API Endpoint Verification

29. **Action**: Call `DELETE /api/users/<userId>/data` without auth header.
    **Expected**: Returns 401.

30. **Action**: Call `DELETE /api/users/<nonexistent-id>/data` with valid auth.
    **Expected**: Returns 404.

31. **Action**: Call `GET /api/users/<userId>` for a user with consent.
    **Expected**: Response includes `ageGateCompleted`, `consentGiven`, `consentDate`, `consentBy` fields.

---

## Appendix A: Re-validation after /t-review #1

### Delete Authorization Fixes

32. **Action**: Create a child user with parental profile (go through child age gate path). Navigate to Parental Controls. Click "Delete Account" and confirm.
    **Expected**: Deletion succeeds (returns 200). The parental session token is included in the request. User is redirected to `/age-gate`.

33. **Action**: (Mobile) Same flow — create child, enter parental controls, tap "Delete Account", confirm.
    **Expected**: Deletion succeeds. The `X-Parental-Session` header is included in the request.

34. **Action**: Create a parent account that has linked child accounts (via `parentUserId`). Delete the parent account.
    **Expected**: Deletion succeeds. Child accounts still exist but their `parentUserId` is set to `null`.

### Configurable WEB_BASE in Mobile

35. **Action**: Check `apps/mobile/src/config.ts` for `WEB_BASE` constant.
    **Expected**: `WEB_BASE` exists alongside `API_BASE`, configurable via environment.

36. **Action**: Tap a legal link on any mobile screen (Login, Register, Onboarding, ParentalControl, AgeGate).
    **Expected**: The URL uses `WEB_BASE` from config, not hardcoded `localhost:3000`.

### Age Gate Error Handling

37. **Action**: (Web) With API server stopped, try completing the age gate as an adult.
    **Expected**: An error message is displayed. The user is NOT redirected to onboarding — they stay on the age gate.

### Analytics Consent Guard

38. **Action**: Call `initAnalytics()` without arguments (or with `undefined`).
    **Expected**: PostHog is NOT initialized. The guard checks `consentGiven !== true`.

### localStorage Cleanup After Deletion

39. **Action**: (Web) Delete an account via ParentalPanel. Check localStorage in DevTools.
    **Expected**: All `sportykids`-prefixed keys are removed (not just `sportykids-user` and `sportykids-theme`).

### Next.js Link Components

40. **Action**: (Web) Navigate to Parental Controls. Inspect the legal links in the footer.
    **Expected**: Links use Next.js `<Link>` component (client-side navigation, no full page reload).

### Regression Check

41. **Action**: Re-run all original validation steps (1-31) to confirm no regressions.
    **Expected**: All original checks still pass.
