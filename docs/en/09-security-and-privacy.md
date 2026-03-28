# Security and privacy

## Target audience

SportyKids is aimed at children aged 6 to 14. Content security and privacy are **fundamental requirements**, not optional.

## Implemented measures

### Content filtering by age
- Each news item and reel has an age range (`minAge`, `maxAge`)
- The API automatically filters based on the user's age
- AI content moderation classifies articles as `approved` or `rejected` (see below)

### AI Content Moderation (M1)
- The content moderator (`content-moderator.ts`) uses AI to classify every ingested news article
- Articles receive a `safetyStatus`: `pending` (not yet checked), `approved` (safe), or `rejected` (inappropriate)
- **Fail-open policy**: if the AI provider is unavailable, content defaults to `approved` to avoid blocking all content
- Only articles from verified sports press sources are ingested -- no user-generated content

### Parental control (Robust -- M5)
- Access protected by a 4-digit PIN
- **PIN stored as bcrypt hash** (upgraded from SHA-256; transparent migration on first successful verification of legacy hashes)
- **PIN lockout**: after 5 consecutive failed attempts, the account is locked for 15 minutes. The `ParentalProfile` model tracks `failedAttempts` (Int, default 0) and `lockedUntil` (DateTime, nullable). Failed attempts return 401 with `attemptsRemaining`; locked accounts return 423 with `lockedUntil` and `remainingSeconds`.
- **Session tokens**: 5-minute TTL issued after PIN verification, required for parental dashboard operations
- Parents control:
  - Allowed formats (news, reels, quiz)
  - Allowed sports (8 sports individually toggleable)
  - Maximum daily screen time
- **Server-side enforcement** via parental guard middleware:
  - Format restrictions: blocks API access to disabled content types (returns 403)
  - Sport restrictions: filters out content from blocked sports
  - Time enforcement: checks if daily time limit has been exceeded
- Restrictions are also enforced on the frontend (tabs disappear for blocked formats)

### SSRF Prevention (Custom RSS Sources)
- Custom RSS sources added by users (`POST /api/news/fuentes/custom`) are validated
- URL validation prevents internal network access (localhost, private IPs, etc.)
- Only HTTP/HTTPS protocols are allowed
- Source URLs are stored and fetched server-side only

### Rate limiting
All API endpoints are protected by `express-rate-limit` middleware with 5 tiers:

| Tier | Routes | Limit | Env var |
|------|--------|-------|---------|
| Auth | `/api/auth/login`, `/api/auth/register` | 5 req/min | `RATE_LIMIT_AUTH` |
| PIN | `/api/parents/verify-pin` | 10 req/min | `RATE_LIMIT_PIN` |
| Content | `/api/news/*`, `/api/reels/*`, `/api/quiz/*` | 60 req/min | `RATE_LIMIT_CONTENT` |
| Sync | `/api/news/sync`, `/api/reels/sync`, `/api/teams/sync` | 2 req/min | `RATE_LIMIT_SYNC` |
| Default | All other `/api/*` | 100 req/min | `RATE_LIMIT_DEFAULT` |

All limits are configurable via environment variables. Exceeded limits return `429 Too Many Requests` with standard rate-limit headers.

### User data
- No emails or passwords are collected
- No identity verification is required
- Profile is created with: name, age, sports preferences
- Data is stored locally (localStorage / AsyncStorage) + server DB
- Notification preferences are stored but not acted upon (MVP -- no push notifications sent)

### External content
- News comes from 182 verified sports press RSS sources across 8 sports with global coverage
- Reels are manually curated (seed)
- No user-generated content
- No chat or interaction between users
- AI-generated content (summaries, quiz questions) is derived from verified sources only

## Security diagram

```mermaid
flowchart TD
    subgraph "Access layer"
        A["Child opens app"] --> B{"Has a<br/>user?"}
        B -->|No| C["Onboarding<br/>(no sensitive data)"]
        B -->|Yes| D["Home Feed<br/>(age-filtered, AI-moderated)"]
    end

    subgraph "Parental control"
        E["Parent accesses"] --> F["Verify PIN<br/>(bcrypt hash)"]
        F -->|OK| G["Session token (5-min TTL)"]
        G --> H["Parental panel (5 tabs)"]
        F -->|Fail| I["Access denied"]
        H --> J["Configure restrictions"]
        J --> K["Formats / Sports / Time"]
    end

    subgraph "Server-side enforcement"
        L["Child API request"] --> M["Parental guard middleware"]
        M -->|Allowed| N["Serve content"]
        M -->|Blocked format| O["403 Forbidden"]
        M -->|Blocked sport| P["Filter results"]
        M -->|Time exceeded| Q["403 Time limit"]
    end

    subgraph "Content pipeline"
        R["47 RSS Sources"] --> S["Aggregator"]
        S --> T["Classifier<br/>(age + sport + team)"]
        T --> U["AI Content Moderator"]
        U -->|approved| V["DB"]
        U -->|rejected| W["Filtered out"]
        U -->|AI unavailable| X["Fail-open: approved"]
        X --> V
        V --> Y["API with filters + ranking"]
        Y --> D
    end

    K -.->|"Enforced by guard"| M
```

## Activity tracking

User activity is recorded with detailed tracking:

| Activity type | Description | Additional fields |
|---------------|-------------|-------------------|
| `news_viewed` | Child viewed an article | `durationSeconds`, `contentId`, `sport` |
| `reels_viewed` | Child watched a reel | `durationSeconds`, `contentId`, `sport` |
| `quizzes_played` | Child played a quiz round | `durationSeconds`, `contentId`, `sport` |

Duration tracking uses `sendBeacon` for reliable reporting even when the user navigates away. These are stored in the `ActivityLog` model and used for the weekly parental summary with total duration calculations.

## Recommended improvements for production

### Authentication
- Implement JWT with refresh tokens
- Biometric authentication (TouchID/FaceID) for parental control on mobile
- Sessions with expiration

### PIN lockout
- ~~Implement lockout after 5 failed PIN verification attempts~~ -- **Implemented**: 5 failed attempts = 15-minute lockout with `failedAttempts` and `lockedUntil` fields on `ParentalProfile`
- PIN recovery option via parent's email

### HTTPS and network
- Enforce HTTPS on all endpoints
- Configure CORS with specific domains (not `*`)
- ~~Implement rate limiting (express-rate-limit)~~ -- **Implemented**: 5 tiers (auth, PIN, content, sync, default) with configurable limits via env vars
- Security headers (Helmet.js)

### Data
- Encrypt sensitive data at rest
- Data retention policy (delete activity older than 90 days)
- GDPR / LOPD compliance (right to be forgotten)
- COPPA compliance (if launching in the US)

### AI safety
- Review AI-generated summaries for accuracy before serving to children
- Monitor content moderator false positive/negative rates
- Add human review queue for rejected content
- Rate limit AI-generated quiz questions

### Monitoring
- Alert if an RSS feed returns unusual content
- Alert if content moderator rejection rate spikes
- Parental control access logs
- Detect anomalous usage patterns

## Legal considerations

| Regulation | Applies | Status |
|-----------|---------|--------|
| **GDPR** (EU) | Yes | Partial -- explicit consent missing |
| **LOPD** (Spain) | Yes | Partial -- privacy policy missing |
| **COPPA** (US) | Yes, if launching in the US | Not implemented |
| **Age verification** | Recommended | Self-declaration only |

### Pending actions before launch
1. Draft privacy policy
2. Draft terms of use
3. Implement verifiable parental consent
4. Designate DPO (Data Protection Officer) if applicable
5. Conduct impact assessment (DPIA)
6. Review AI content generation for compliance with child safety regulations
