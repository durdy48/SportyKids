# User Flows

## General Navigation Diagram

```mermaid
flowchart TD
    START["Open app"] --> CHECK{"User<br/>exists?"}
    CHECK -->|No| ONB["Onboarding<br/>(4 steps)"]
    CHECK -->|Yes| HOME["Home Feed"]

    ONB --> |Step 1| NAME["Name + Age"]
    NAME --> SPORTS["Favorite Sports"]
    SPORTS --> TEAM["Favorite Team"]
    TEAM --> FEEDS["Press Feeds"]
    FEEDS --> |Create user| HOME

    HOME --> REELS["Reels"]
    HOME --> QUIZ["Quiz"]
    HOME --> MYTEAM["My Team"]
    HOME --> PARENTS["Parental Control"]

    PARENTS --> PIN{"Has PIN?"}
    PIN -->|No| CREATE_PIN["Create PIN"]
    PIN -->|Yes| VERIFY["Verify PIN"]
    CREATE_PIN --> PANEL["Parental Dashboard"]
    VERIFY --> PANEL
```

## 1. Onboarding

The onboarding is a 4-step wizard shown the first time the app is opened.

```mermaid
sequenceDiagram
    actor Child as Child
    participant App as Webapp
    participant API as API

    Child->>App: Opens the app
    App->>App: Checks localStorage
    App-->>Child: Redirects to /onboarding

    Note over Child,App: Step 1: Name + Age
    Child->>App: Enters name, selects range

    Note over Child,App: Step 2: Sports
    Child->>App: Selects favorite sports

    Note over Child,App: Step 3: Team
    Child->>App: Chooses team (optional)

    Note over Child,App: Step 4: Feeds
    App->>API: GET /api/news/sources/list
    API-->>App: List of RSS sources
    Child->>App: Selects sources

    Child->>App: Clicks "Start"
    App->>API: POST /api/users
    API-->>App: User created
    App->>App: Saves ID in localStorage
    App-->>Child: Redirects to Home Feed
```

## 2. Home Feed

The main feed displays real sports news filtered by preferences.

- **Filters**: sport chips + age range selector
- **Cards**: image, headline, summary, source, date, sport/team badge
- **Pagination**: "Load more" button at the bottom
- **Personalization**: automatically filters by the user's age

### Key components
- `NewsCard` — displays a single article card
- `FiltersBar` — sport chip filters and controls

## 3. Reels

Vertical short video feed with scroll snap.

- **Format**: one video per screen (TikTok/Instagram Reels style)
- **Filters**: sport chips
- **Info**: title, sport, team, duration, source
- **Playback**: embedded YouTube iframe

## 4. Quiz

Sports trivia game with a points system.

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
```

- **Start screen**: total score + start button
- **Game**: 5 random questions, 4 options each
- **Feedback**: immediate (green = correct, red = incorrect)
- **Result**: points earned + accumulated total score

## 5. My Team

Section dedicated to the user's favorite team.

- **Filtered feed**: articles mentioning the team
- **Change team**: selector with a list of known teams
- **No team**: shows a selector to choose one
- **Route**: `/team` (web), `FavoriteTeam` screen (mobile)

## 6. Parental Control

PIN-protected access for parents.

```mermaid
sequenceDiagram
    actor Parent as Parent
    participant App as Webapp
    participant API as API

    Parent->>App: Clicks lock icon
    App->>API: GET /api/parents/profile/:id
    API-->>App: exists: true/false

    alt First time
        App-->>Parent: Create PIN (4 digits)
        Parent->>App: Enters PIN
        App-->>Parent: Confirm PIN
        Parent->>App: Repeats PIN
        App->>API: POST /api/parents/configure
        API-->>App: Profile created
    else Already has PIN
        App-->>Parent: Verify PIN
        Parent->>App: Enters PIN
        App->>API: POST /api/parents/verify-pin
        API-->>App: verified: true + profile
    end

    App-->>Parent: Parental Dashboard
    Note over Parent,App: Weekly activity summary
    Note over Parent,App: Format toggles (news/reels/quiz)
    Note over Parent,App: Maximum daily time

    Parent->>App: Disables "Reels"
    App->>API: PUT /api/parents/profile/:id
    API-->>App: Profile updated
    App->>App: NavBar hides Reels tab
```

### Key components
- Web: `ParentalPanel` component at `/parents`
- Mobile: `ParentalControl` screen

### Parental dashboard includes:

| Section | Description |
|---------|-------------|
| **Weekly activity** | Counters: articles read (`news_viewed`), reels viewed (`reels_viewed`), quizzes played (`quizzes_played`), points |
| **Allowed formats** | Toggles to enable/disable news, reels, quiz |
| **Maximum time** | Minutes per day selector (15, 30, 45, 60, 90, 120) |
