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

- **Feed modes**: Headlines (compact list), Cards (image + summary), Explain (with "Explain it Easy" button)
- **Filters**: sport chips + age range selector
- **Cards**: image, headline, summary, source, date, sport/team badge
- **"Explain it Easy" button**: triggers age-adapted AI summary via `GET /api/news/:id/resumen`
- **Pagination**: "Load more" button at the bottom
- **Personalization**: automatically filters by the user's age, ranks by team/sport affinity
- **Activity tracking**: viewing a news item logs `news_viewed` with duration via `sendBeacon`

### Key components
- `NewsCard` -- displays a single article card with optional "Explain it Easy" button
- `AgeAdaptedSummary` -- displays the AI-generated summary for the user's age range
- `FiltersBar` -- sport chip filters and feed mode selector

### Feed Ranking
When a user is logged in, the feed ranker scores articles:
- +5 for articles about the user's favorite team
- +3 for articles about a favorite sport
- Unfollowed sources are filtered out

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
