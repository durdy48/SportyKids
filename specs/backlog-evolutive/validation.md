# Human Validation — prd.md (Video Aggregator + Multi-platform Reels)

## Prerequisites

Start the API server:

```bash
cd apps/api
npm run db:generate
npx tsx prisma/seed.ts
npm run dev:api
```

## Validation Steps

### 1. Schema & Seed

1. **Action**: Check that VideoSource table exists and is seeded
   ```bash
   curl http://localhost:3001/api/reels/sources/catalog | jq
   ```
   **Expected**: JSON with `sources` array (22 entries), `total: 22`, and `bySport` object with counts for all 8 sports

2. **Action**: Check that existing seed reels still work
   ```bash
   curl "http://localhost:3001/api/reels?limit=5" | jq '.reels | length'
   ```
   **Expected**: Returns reels (at least the 10 original seed reels)

### 2. Video Aggregator Service

3. **Action**: Trigger manual video sync
   ```bash
   curl -X POST http://localhost:3001/api/reels/sync | jq
   ```
   **Expected**: JSON with sync metrics: `totalProcessed`, `totalCreated`, `totalApproved`, `sources` array. New reels should be created from YouTube RSS feeds.

4. **Action**: Verify new reels appear after sync
   ```bash
   curl "http://localhost:3001/api/reels?limit=20" | jq '.reels[] | {title, source, videoType, safetyStatus}'
   ```
   **Expected**: Mix of seed reels and newly aggregated reels. New reels have `videoType: "youtube_embed"` and `safetyStatus: "approved"`.

5. **Action**: Verify safety filtering works
   ```bash
   curl "http://localhost:3001/api/reels?limit=100" | jq '[.reels[] | .safetyStatus] | unique'
   ```
   **Expected**: Only `["approved"]` — no rejected or pending reels shown.

### 3. API Endpoints

6. **Action**: List active video sources
   ```bash
   curl http://localhost:3001/api/reels/sources/list | jq 'length'
   ```
   **Expected**: Number of active sources (should be ~22)

7. **Action**: Add a custom YouTube source
   ```bash
   curl -X POST http://localhost:3001/api/reels/sources/custom \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Channel","url":"https://www.youtube.com/feeds/videos.xml?channel_id=UCTl3QQTvqHFjurroKxexy2Q","platform":"youtube_channel","sport":"athletics","userId":"test-user","channelId":"UCTl3QQTvqHFjurroKxexy2Q"}'
   ```
   **Expected**: 201 response with `source` object and `syncResult` with metrics

8. **Action**: Delete the custom source (use the ID from step 7)
   ```bash
   curl -X DELETE "http://localhost:3001/api/reels/sources/custom/{ID}?userId=test-user"
   ```
   **Expected**: 200 response with deletion confirmation

### 4. Ordering

9. **Action**: Verify reels are ordered by publishedAt desc
   ```bash
   curl "http://localhost:3001/api/reels?limit=10" | jq '.reels[] | {title, publishedAt, createdAt}'
   ```
   **Expected**: Reels ordered by `publishedAt` descending. Seed reels (with null publishedAt) appear after dated reels.

### 5. Frontend (Web)

10. **Action**: Start the web app (`npm run dev:web`) and navigate to `/reels`
    **Expected**: Grid of reels with thumbnails. New aggregated videos should appear alongside seed reels.

11. **Action**: Click on a YouTube reel
    **Expected**: YouTube iframe loads with video playback controls.

12. **Action**: Filter by sport (e.g., "Football")
    **Expected**: Only football reels shown.

### 6. i18n

13. **Action**: Check translation keys are present
    ```bash
    grep "reels.sources_title" packages/shared/src/i18n/es.json
    grep "reels.sources_title" packages/shared/src/i18n/en.json
    ```
    **Expected**: Both files contain the key with Spanish and English translations respectively.

### 7. Tests

14. **Action**: Run full test suite
    ```bash
    npm test --prefix apps/api
    ```
    **Expected**: 171 tests passing, 16 test files, 0 failures.

---

## Appendix A: Re-validation after /t-review #1

### Security & Auth fixes

15. **Action**: POST `/api/reels/sources/custom` without auth token
    ```bash
    curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/reels/sources/custom \
      -H "Content-Type: application/json" \
      -d '{"name":"Test","feedUrl":"https://example.com","platform":"youtube_channel","sport":"football","userId":"x"}'
    ```
    **Expected**: 401 (requireAuth now enforced)

16. **Action**: POST `/api/reels/sync` as child user (non-parent)
    **Expected**: 403 (requireRole('parent') enforced). Only parent accounts can trigger sync.

17. **Action**: POST custom source with private IP URL
    ```bash
    curl -X POST http://localhost:3001/api/reels/sources/custom \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer {token}" \
      -d '{"name":"Evil","feedUrl":"http://192.168.1.1/rss","platform":"youtube_channel","sport":"football","userId":"{userId}"}'
    ```
    **Expected**: 400 with "not allowed" error (SSRF prevention)

18. **Action**: POST custom source with invalid RSS feed URL
    ```bash
    curl -X POST http://localhost:3001/api/reels/sources/custom \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer {token}" \
      -d '{"name":"Bad","feedUrl":"https://example.com/not-rss","platform":"youtube_channel","sport":"football","userId":"{userId}"}'
    ```
    **Expected**: 422 with "valid RSS feed" error

19. **Action**: POST custom source with invalid platform
    **Expected**: 400 (Zod enum validation rejects unknown platforms)

### Performance fixes

20. **Action**: Run tests and verify N+1 query fix works
    ```bash
    npm test --prefix apps/api -- --reporter verbose 2>&1 | grep -i "pre-fetch\|batch"
    ```
    **Expected**: Tests pass confirming batch rssGuid lookup

### Code Quality

21. **Action**: Verify `lang="en"` in layout.tsx
    ```bash
    grep 'lang=' apps/web/src/app/layout.tsx
    ```
    **Expected**: `lang="en"` (not `lang="es"`)

22. **Action**: Run full test suite (regression check)
    ```bash
    npm test --prefix apps/api
    ```
    **Expected**: 185 tests passing, 0 failures

---

# Human Validation — prd2.md (User Locale & Country)

## Validation Steps

### 1. Schema & API

23. **Action**: Create user with locale and country
    ```bash
    curl -X POST http://localhost:3001/api/users \
      -H "Content-Type: application/json" \
      -d '{"name":"LocaleTest","age":10,"favoriteSports":["football"],"locale":"en","country":"GB"}'
    ```
    **Expected**: 201 with user having `locale: "en"` and `country: "GB"`

24. **Action**: Update user locale
    ```bash
    curl -X PUT http://localhost:3001/api/users/{ID} \
      -H "Content-Type: application/json" \
      -d '{"locale":"es","country":"ES"}'
    ```
    **Expected**: 200 with updated locale/country

25. **Action**: Reject invalid locale
    ```bash
    curl -X PUT http://localhost:3001/api/users/{ID} \
      -H "Content-Type: application/json" \
      -d '{"locale":"xx"}'
    ```
    **Expected**: 400 validation error

### 2. Onboarding Language Selector (Web)

26. **Action**: Navigate to http://localhost:3000/onboarding
    **Expected**: Step 1 shows two language buttons (🇪🇸 Español / 🇬🇧 English) above the name input

27. **Action**: Click "English" button
    **Expected**: The wizard text switches to English immediately (step labels, buttons)

28. **Action**: Complete onboarding in English
    **Expected**: User created with `locale: "en"` and `country: "GB"`

### 3. Language & Region Settings (Web)

29. **Action**: In NavBar, look for language/globe icon or dropdown
    **Expected**: A Language & Region section with language buttons + country selector

30. **Action**: Change language to English and country to US
    **Expected**: UI switches to English, country saved to server

### 4. Feed Ranking

31. **Action**: As a user with `locale: "es"` and `country: "ES"`, check news feed
    **Expected**: Spanish-language sources (AS, Marca, Mundo Deportivo) ranked higher than English sources

### 5. Tests

32. **Action**: Run full test suite
    ```bash
    npm test --prefix apps/api
    ```
    **Expected**: 216 tests passing, 21 test files, 0 failures

---

# Human Validation — prd4.md (Security Hardening: PIN Lockout + Rate Limiting)

## Prerequisites

Start the test environment:

```bash
cd apps/api && npm run dev:api
```

Ensure a user with parental profile exists (run seed if needed: `npx tsx prisma/seed.ts`).

## Validation Steps

### PIN Lockout — Data Model

1. **Action**: Check migration applied successfully
   ```bash
   sqlite3 apps/api/prisma/dev.db ".schema ParentalProfile" | grep -E "failedAttempts|lockedUntil"
   ```
   **Expected**: Both `failedAttempts` (INTEGER DEFAULT 0) and `lockedUntil` columns present

### PIN Lockout — Wrong PIN Behavior

2. **Action**: Submit a wrong PIN
   ```bash
   curl -s -X POST http://localhost:3001/api/parents/verify-pin \
     -H "Content-Type: application/json" \
     -d '{"userId":"<USER_ID>","pin":"9999"}' | jq
   ```
   **Expected**: HTTP 401 response with `{ "error": "...", "attemptsRemaining": 4 }`

3. **Action**: Submit 3 more wrong PINs (total 4 wrong)
   **Expected**: Each returns 401 with decreasing `attemptsRemaining` (3, 2, 1)

4. **Action**: Submit 5th wrong PIN
   **Expected**: HTTP 423 response with `{ "error": "...", "lockedUntil": "...", "remainingSeconds": 900 }`

5. **Action**: Try the correct PIN during lockout
   ```bash
   curl -s -X POST http://localhost:3001/api/parents/verify-pin \
     -H "Content-Type: application/json" \
     -d '{"userId":"<USER_ID>","pin":"<CORRECT_PIN>"}' | jq
   ```
   **Expected**: HTTP 423 (still locked, correct PIN rejected without bcrypt)

6. **Action**: Manually reset lockout to expired time and verify correct PIN works
   ```bash
   sqlite3 apps/api/prisma/dev.db "UPDATE ParentalProfile SET lockedUntil = datetime('now', '-1 minute') WHERE userId = '<USER_ID>'"
   ```
   Then retry correct PIN.
   **Expected**: HTTP 200 with session token, `failedAttempts` reset to 0

### PIN Lockout — Web UI

7. **Action**: Navigate to http://localhost:3000/parents and enter wrong PINs
   **Expected**: Error message shows remaining attempts count

8. **Action**: Enter 5 wrong PINs to trigger lockout
   **Expected**: Input fields disabled, countdown timer shown with progress bar, auto-re-enables when timer reaches 0

### PIN Lockout — Mobile UI

9. **Action**: Open Parental Control screen on mobile and enter wrong PINs
   **Expected**: Error messages with remaining attempts, haptic feedback on lockout

### Rate Limiting — Auth Tier

10. **Action**: Send 6 rapid POST requests to /api/auth/login
    ```bash
    for i in $(seq 1 6); do
      echo "Request $i: $(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"wrong"}')"
    done
    ```
    **Expected**: First 5 return non-429, 6th returns 429

11. **Action**: Check rate-limit headers on a normal request
    ```bash
    curl -s -D - http://localhost:3001/api/news?limit=1 2>&1 | grep -i ratelimit
    ```
    **Expected**: `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset` headers present

### Rate Limiting — Sync Tier

12. **Action**: Send 3 rapid POST requests to /api/news/sync
    **Expected**: First 2 succeed, 3rd returns 429

### Rate Limiting — Health Endpoint

13. **Action**: GET /api/health
    **Expected**: Returns 200 (under default 100/min limit)

### Rate Limiting — Environment Configuration

14. **Action**: Set RATE_LIMIT_AUTH=2 and restart server, then send 3 auth requests
    **Expected**: 3rd request returns 429 (confirms env override works)

### i18n Keys

15. **Action**: Verify i18n keys exist in both locale files
    ```bash
    grep "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited" packages/shared/src/i18n/es.json
    grep "pin_locked\|pin_incorrect\|pin_locked_short\|rate_limited" packages/shared/src/i18n/en.json
    ```
    **Expected**: 4 keys in each file

### Full Test Suite

16. **Action**: Run all tests
    ```bash
    npx vitest run
    ```
    **Expected**: 216 tests passing, 21 test files, 0 failures

---

## Appendix A: Re-validation after /t-review #1

These checks verify fixes from code review Pass 4 (prd4.md).

### Review Fix: Locale in verify-pin responses

17. **Action**: Create user with locale='en', set up PIN, submit wrong PIN and verify error is in English
    **Expected**: Error message in English (not Spanish) — e.g., "Wrong PIN. 4 attempts remaining."

### Review Fix: Profile does not leak lockout internals

18. **Action**: Verify correct PIN response profile does not include failedAttempts/lockedUntil
    **Expected**: Profile object does NOT contain `failedAttempts` or `lockedUntil`

### Review Fix: i18n in lockout UI

19. **Action**: Check PinInput web component uses i18n for lockout text
    ```bash
    grep "t('parental.pin_locked_short'" apps/web/src/components/PinInput.tsx
    grep "t('parental.pin_lockout_warning'" apps/web/src/components/PinInput.tsx
    ```
    **Expected**: Both i18n calls present, no hardcoded Spanish strings

20. **Action**: Check mobile ParentalControl uses i18n for lockout text
    ```bash
    grep "t('parental.pin_locked_short'" apps/mobile/src/screens/ParentalControl.tsx
    ```
    **Expected**: i18n call present, no hardcoded "PIN bloqueado"

### Review Fix: Health check before rate limiters

21. **Action**: Verify health check is defined before rate limiters in index.ts
    ```bash
    grep -n "health\|defaultLimiter" apps/api/src/index.ts | head -5
    ```
    **Expected**: Health check route appears BEFORE rate limiter middleware

### Review Fix: New i18n key

22. **Action**: Verify parental.pin_lockout_warning key exists in both locales
    ```bash
    grep "pin_lockout_warning" packages/shared/src/i18n/es.json packages/shared/src/i18n/en.json
    ```
    **Expected**: Key present in both files

### Regression Check

23. **Action**: Re-run all original prd4.md validation steps (1-16)
    **Expected**: All checks still pass after review fixes

---

# Human Validation — prd5.md (Enhanced Feed Algorithm)

## Prerequisites

Start the API: `cd apps/api && npm run dev:api`

## Validation Steps

### sportFrequencyBoost

24. **Action**: Run feed-ranker tests
    ```bash
    npx vitest run apps/api/src/services/feed-ranker.test.ts
    ```
    **Expected**: 44 tests passing, including sportFrequencyBoost, recencyDecay, diversity injection suites

### Source Affinity

25. **Action**: Verify sourceEngagement is populated by checking code
    ```bash
    grep "sourceEngagement.set" apps/api/src/services/feed-ranker.ts
    ```
    **Expected**: Source engagement map is populated from NewsItem join query

### Recency Decay

26. **Action**: Verify recencyDecay is continuous (no step function)
    ```bash
    grep "Math.exp" apps/api/src/services/feed-ranker.ts
    ```
    **Expected**: Exponential decay formula present

### Diversity Injection

27. **Action**: Verify diversity injection is applied in rankFeed
    ```bash
    grep "applyDiversityInjection" apps/api/src/services/feed-ranker.ts
    ```
    **Expected**: Function defined and called in rankFeed

### RANKING_WEIGHTS

28. **Action**: Verify weights exported
    ```bash
    grep "RANKING_WEIGHTS" apps/api/src/services/feed-ranker.ts | head -3
    ```
    **Expected**: Exported const with TEAM, SPORT, SOURCE, RECENCY, LOCALE all 1.0

### Cache Invalidation

29. **Action**: Verify invalidateBehavioralCache is called in activity logging
    ```bash
    grep "invalidateBehavioralCache" apps/api/src/routes/parents.ts
    ```
    **Expected**: Called after ActivityLog creation

### Full Test Suite

30. **Action**: Run all tests
    ```bash
    npx vitest run
    ```
    **Expected**: 231 tests passing, 21 test files, 0 failures
