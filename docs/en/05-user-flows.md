# User Flows

## General Navigation Diagram

```mermaid
flowchart TD
    START["Open app"] --> CHECK{"User<br/>exists?"}
    CHECK -->|No| ONB["Onboarding<br/>(5 steps)"]
    CHECK -->|Yes| CHECKIN["Daily Check-in<br/>(+2 pts, streak)"]

    ONB --> |Step 1| NAME["Name + Age"]
    NAME --> SPORTS["Favorite Sports"]
    SPORTS --> TEAM["Favorite Team"]
    TEAM --> FEEDS["Press Feeds"]
    FEEDS --> PIN_SETUP["Parental PIN +<br/>Formats + Time Limit"]
    PIN_SETUP --> |Create user| HOME

    CHECKIN --> HOME["Home Feed"]

    HOME --> REELS["Reels"]
    HOME --> QUIZ["Quiz"]
    HOME --> MYTEAM["My Team"]
    HOME --> COLLECTION["Collection"]
    HOME --> PARENTS["Parental Control"]

    PARENTS --> PIN{"Has PIN?"}
    PIN -->|No| CREATE_PIN["Create PIN"]
    PIN -->|Yes| VERIFY["Verify PIN"]
    CREATE_PIN --> PANEL["Parental Dashboard<br/>(5 tabs)"]
    VERIFY --> PANEL
```

## 1. Onboarding

The onboarding is a **5-step wizard** shown the first time the app is opened (expanded from 4 steps in the MVP to include parental setup).

```mermaid
sequenceDiagram
    actor Child as Child
    participant App as Webapp
    participant API as API

    Child->>App: Opens the app
    App->>App: Checks localStorage
    App-->>Child: Redirects to /onboarding

    Note over Child,App: Step 1: Name + Age
    Child->>App: Enters name, selects age range

    Note over Child,App: Step 2: Sports
    Child->>App: Selects favorite sports (8 options)

    Note over Child,App: Step 3: Team
    Child->>App: Chooses team (optional)

    Note over Child,App: Step 4: Feeds
    App->>API: GET /api/news/fuentes/listado
    API-->>App: List of RSS sources
    Child->>App: Selects sources

    Note over Child,App: Step 5: Parental Setup
    Child->>App: Hands device to parent
    App-->>Child: Create PIN (4 digits)
    Child->>App: Parent sets PIN
    App-->>Child: Configure allowed formats
    Child->>App: Parent toggles news/reels/quiz
    App-->>Child: Set daily time limit
    Child->>App: Parent selects minutes

    Child->>App: Clicks "Start"
    App->>API: POST /api/users
    API-->>App: User created
    App->>API: POST /api/parents/configurar
    API-->>App: Parental profile created
    App->>App: Saves ID in localStorage
    App-->>Child: Redirects to Home Feed
```

## 2. Home Feed

The main feed displays real sports news filtered by preferences and ranked by the feed ranker.

- **Search**: debounced text search (300ms) across title and summary via `q` query parameter
- **Feed modes**: Headlines (compact list), Cards (image + summary), Explain (with "Explain it Easy" button). Feed mode toggle is hidden during search.
- **Filters**: sport chips + age range selector
- **Cards**: image, headline, summary, source, date, sport/team badge
- **"Explain it Easy" button**: triggers age-adapted AI summary via `GET /api/news/:id/resumen`
- **Pagination**: "Load more" button at the bottom
- **Personalization**: automatically filters by the user's age, ranks by team/sport affinity
- **Favorites**: heart button on each card to bookmark news. Favorites are persisted in localStorage (web) / AsyncStorage (mobile). Saved news appear in a "Saved" strip above the feed.
- **Trending**: news with more than 5 views in the last 24h display an orange "Trending" pill badge
- **Activity tracking**: viewing a news item logs `news_viewed` with duration via `sendBeacon`

### Key components
- `SearchBar` -- debounced search input with suggested searches (popular teams/leagues) and clear button
- `NewsCard` -- displays a single article card with optional "Explain it Easy" button
- `AgeAdaptedSummary` -- displays the AI-generated summary for the user's age range
- `FiltersBar` -- sport chip filters and feed mode selector

### Feed Ranking
When a user is logged in, the feed ranker scores articles:
- +5 for articles about the user's favorite team
- +3 for articles about a favorite sport
- Unfollowed sources are filtered out

### Search flow

```mermaid
sequenceDiagram
    actor Child as Child
    participant App as Webapp
    participant API as API

    Child->>App: Types in the search bar
    App->>App: Debounce 300ms
    App->>API: GET /api/news?q=Madrid&sport=&age=
    API-->>App: News filtered by title/summary
    App-->>Child: Shows results (or empty state if none)
    Child->>App: Clicks suggestion "Real Madrid"
    App->>App: Fills input and searches
    Child->>App: Clicks X to clear
    App-->>Child: Returns to normal feed
```

- While typing, the feed mode selector is hidden
- Suggestions include popular teams and leagues
- If no results, an empty state with SVG illustration is shown

### Favorites flow

```mermaid
sequenceDiagram
    actor Child as Child
    participant App as Webapp
    participant Storage as localStorage

    Child->>App: Clicks heart on NewsCard
    App->>Storage: Save news ID
    App-->>Child: Heart fills red
    App-->>Child: "Saved" strip appears above feed

    Child->>App: Clicks heart again
    App->>Storage: Remove news ID
    App-->>Child: Heart returns to outline
    App-->>Child: News removed from "Saved" strip
```

- Favorites persist across sessions (localStorage web, AsyncStorage mobile)
- No authentication required — client-side local storage

## 3. Reels

Grid layout with YouTube thumbnails, like/share actions.

- **Format**: grid of video thumbnails (tappable to expand)
- **Filters**: sport chips
- **Info**: title, sport, team, duration, source
- **Playback**: embedded YouTube iframe
- **Interactions**: like and share buttons
- **Activity tracking**: viewing a reel logs `reels_viewed` with duration

## 4. Quiz

Sports trivia game with a points system, now including AI-generated daily questions.

```mermaid
stateDiagram-v2
    [*] --> Start
    Start --> Playing: Click "Start"
    Playing --> Question: Load 5 questions
    Question --> Feedback: Select option
    Feedback --> Question: Next question
    Feedback --> Result: Last question
    Result --> Start: Go back
    Result --> Playing: Play again
    Result --> CheckAwards: Evaluate gamification
    CheckAwards --> Start: Show new stickers/achievements
```

- **Start screen**: total score + daily quiz indicator + start button
- **Daily quiz**: AI-generated questions refreshed at 06:00 UTC, tied to recent news
- **Game**: 5 random questions (or 5 daily), 4 options each, age-appropriate difficulty
- **Feedback**: immediate (green = correct, red = incorrect)
- **Result**: points earned + accumulated total score
- **Gamification**: +10 per correct answer, +50 bonus for perfect 5/5 round
- **Fallback**: if AI is unavailable, seed questions (15 static) are used

## 5. My Team

Section dedicated to the user's favorite team, now with stats.

- **Team stats card**: wins/draws/losses, league position, top scorer, next match
- **Filtered feed**: articles mentioning the team (ranked by relevance)
- **Change team**: selector with a list of known teams (15 seeded)
- **No team**: shows a selector to choose one
- **Route**: `/team` (web), `FavoriteTeam` screen (mobile)

## 6. Collection

New section for viewing collected stickers and unlocked achievements.

- **Sticker grid**: 36 stickers across 8 sports, filterable by sport
- **Rarity tiers**: common, rare, epic, legendary (visual distinction)
- **Achievements**: 20 achievements shown as cards (locked/unlocked state)
- **Progress indicators**: sticker count, achievement count, completion percentage
- **Route**: `/collection` (web), `Collection` screen (mobile)

### Sticker awards
Stickers are awarded automatically by the gamification service based on activity milestones (e.g., viewing 10 football articles awards a football sticker).

### Achievement evaluation
Achievements unlock when conditions are met (e.g., 7-day login streak, first perfect quiz, viewing content in all 8 sports).

## 7. Parental Control

PIN-protected access for parents with robust server-side enforcement.

```mermaid
sequenceDiagram
    actor Parent as Parent
    participant App as Webapp
    participant API as API

    Parent->>App: Clicks lock icon
    App->>API: GET /api/parents/perfil/:id
    API-->>App: exists: true/false

    alt First time
        App-->>Parent: Create PIN (4 digits)
        Parent->>App: Enters PIN
        App-->>Parent: Confirm PIN
        Parent->>App: Repeats PIN
        App->>API: POST /api/parents/configurar
        API-->>App: Profile created (PIN bcrypt-hashed)
    else Already has PIN
        App-->>Parent: Verify PIN
        Parent->>App: Enters PIN
        App->>API: POST /api/parents/verificar-pin
        API-->>App: verified: true + sessionToken (5-min TTL)
    end

    App-->>Parent: Parental Dashboard (5 tabs)

    Note over Parent,App: Tab 1 - Profile: Child info, points, streak
    Note over Parent,App: Tab 2 - Content: Allowed sports filter
    Note over Parent,App: Tab 3 - Restrictions: Formats + daily time
    Note over Parent,App: Tab 4 - Activity: Weekly summary with duration
    Note over Parent,App: Tab 5 - PIN: Change PIN

    Parent->>App: Disables "Reels"
    App->>API: PUT /api/parents/perfil/:id
    API-->>App: Profile updated
    App->>App: NavBar hides Reels tab
    Note over App,API: Parental guard middleware also blocks<br/>reels API requests server-side
```

### Key components
- Web: `ParentalPanel` component at `/parents` (5-tab layout)
- Mobile: `ParentalControl` screen

### Parental dashboard includes:

| Tab | Section | Description |
|-----|---------|-------------|
| 1 | **Profile** | Child's name, age, points, login streak |
| 2 | **Content** | Allowed sports toggles (8 sports) |
| 3 | **Restrictions** | Allowed formats (news/reels/quiz toggles), maximum daily time (15-120 min) |
| 4 | **Activity** | Weekly summary: articles read, reels viewed, quizzes played, total duration in minutes, points earned |
| 5 | **PIN** | Change parental PIN |

### Server-side enforcement (Parental Guard)
The `parental-guard` middleware runs on news, reels, and quiz routes. It checks:
- **Format restrictions**: blocks access to disabled content types (e.g., if reels are disabled, `GET /api/reels` returns 403)
- **Sport restrictions**: filters out content from blocked sports
- **Time enforcement**: checks if the child has exceeded their daily time limit

### Content reporting

Children can flag any news article or reel as inappropriate directly from the content card:

1. The child taps the report button (flag icon) on a NewsCard or ReelCard
2. Selects a reason from the dropdown (inappropriate, not sports, other)
3. Optionally adds a comment
4. The report is sent to `POST /api/reports`
5. The parent sees pending reports in the Activity tab of the parental panel (`GET /api/reports/parent/:userId`)
6. The parent can mark the report as reviewed or take action

### Feed preview

Parents can see exactly what their child sees:

1. From the parental panel, the parent clicks "Preview child's feed"
2. A modal (`FeedPreviewModal`) opens showing news and reels with the child's filters applied
3. The preview includes active format, sport, and time limit restrictions
4. Data via `GET /api/parents/preview/:userId`

## 8. Daily Check-in

Automatic flow on app start for returning users.

```mermaid
sequenceDiagram
    actor Child as Child
    participant App as App
    participant API as API

    Child->>App: Opens the app
    App->>App: Checks user ID in storage
    App->>API: POST /api/gamification/check-in
    API-->>App: +2 points, streak: N
    App-->>Child: Welcome back! Streak: N days
    App->>App: Navigate to Home Feed
```

- Awards +2 points per daily login
- Increments `loginStreak` counter
- Resets streak if a day is skipped
- May trigger sticker/achievement awards

## 9. Weekly Digest

Parents can enable an automatic weekly summary of their child's activity.

1. From the parental panel, "Digest" tab, the parent enables the weekly digest
2. Configures destination email and send day (Monday by default)
3. A cron job (08:00 UTC daily) checks which users are due for a digest
4. The digest includes: weekly activity, top sports, unlocked achievements, streak info
5. Can be previewed as JSON (`GET /api/parents/digest/:userId/preview`) or downloaded as PDF (`GET /api/parents/digest/:userId/download`)

## 10. Daily Mission

Each day the child receives a personalized mission that incentivizes app usage.

```mermaid
sequenceDiagram
    actor Child as Child
    participant App as Webapp
    participant API as API

    Child->>App: Opens the app
    App->>API: GET /api/missions/today/:userId
    API-->>App: Today's mission (type, progress, target)
    App-->>Child: Shows MissionCard on Home Feed

    Child->>App: Performs the activity (e.g. read 3 news)
    App->>API: POST /api/parents/actividad/registrar
    API-->>API: checkMissionProgress() updates progress
    App->>API: GET /api/missions/today/:userId
    API-->>App: progress: 3/3, completed: true

    Child->>App: Clicks "Claim reward"
    App->>API: POST /api/missions/claim
    API-->>App: pointsAwarded + stickerAwarded
    App-->>Child: Reward animation
```

- **Generation**: daily cron at 05:00 UTC or on-demand when queried
- **Types**: `read_news`, `watch_reels`, `play_quiz`, `check_in`, `explore_sports`
- **Rewards**: points + possible sticker (rarity varies by difficulty)
- **3 states**: in-progress, completed (unclaimed), claimed

## 11. Authentication (JWT)

Users can optionally register with email and password to secure their account. Anonymous access remains supported for backward compatibility.

```mermaid
sequenceDiagram
    actor User as User
    participant App as App
    participant API as API

    Note over User,API: Registration
    User->>App: Enters email + password
    App->>API: POST /api/auth/register
    API-->>App: user + accessToken + refreshToken
    App->>App: Stores tokens

    Note over User,API: Login
    User->>App: Enters email + password
    App->>API: POST /api/auth/login
    API-->>App: user + accessToken + refreshToken
    App->>App: Stores tokens

    Note over User,API: Authenticated request
    App->>API: GET /api/news (Authorization: Bearer <accessToken>)
    API-->>App: Personalized response

    Note over User,API: Token refresh
    App->>App: Access token expired
    App->>API: POST /api/auth/refresh {refreshToken}
    API-->>App: New accessToken + rotated refreshToken
    App->>App: Stores new tokens

    Note over User,API: Logout
    User->>App: Clicks logout
    App->>API: POST /api/auth/logout {refreshToken}
    API-->>App: Token revoked
    App->>App: Clears stored tokens
```

### Key details
- Access tokens have a 15-minute TTL
- Refresh tokens have a 7-day TTL and are rotated on each use
- Anonymous users can upgrade to authenticated accounts via `POST /api/auth/upgrade`
- Parents can link child accounts via `POST /api/auth/link-child`
- The auth middleware is non-blocking: requests without a token proceed as anonymous

## 12. Push Notifications

Push notifications keep children engaged and informed about new content.

```mermaid
sequenceDiagram
    actor Child as Child
    participant App as Mobile App
    participant API as API
    participant Expo as Expo Push Service

    Note over Child,Expo: Registration
    App->>App: Request notification permissions
    App->>App: Get Expo push token
    App->>API: POST /api/users/:id/notifications/subscribe {pushToken}
    API-->>App: Token registered

    Note over Child,Expo: Push triggers
    API->>Expo: Send push (quiz ready / team news / streak reminder / sticker earned / mission ready)
    Expo->>App: Deliver notification
    App-->>Child: Shows notification

    Note over Child,Expo: Deep linking
    Child->>App: Taps notification
    App->>App: Navigate to relevant screen (quiz, news, collection, etc.)
```

### Push notification triggers

| Trigger | When | Content |
|---------|------|---------|
| Quiz ready | Daily quiz generated (06:00 UTC) | "New daily quiz is ready!" |
| Team news | New article about favorite team | "New news about {team}!" |
| Streak reminder | 20:00 UTC daily | "Don't lose your streak! Log in today." |
| Sticker earned | Sticker awarded via gamification | "You earned a new sticker!" |
| Mission ready | Daily mission generated (05:00 UTC) | "Your daily mission is ready!" |

- Push delivery uses `expo-server-sdk` for Expo push tokens
- A cron job at 20:00 UTC sends streak reminders to users who haven't checked in
- The `User.locale` field is used for per-user notification localization

## 13. Dark Mode

The user can toggle between light, dark, or system (automatic) theme.

1. The toggle is in the NavBar (web), cycling: system -> dark -> light
2. The preference is saved in `localStorage` (`sportykids-theme`)
3. An inline script in `<head>` applies the `.dark` class before render to prevent flash
4. If the theme is `system`, it listens for changes to `prefers-color-scheme`
5. All CSS variables adapt automatically (background, text, surface, border, muted)
