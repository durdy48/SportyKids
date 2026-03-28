# PRD-2: User Locale & Country Preferences

## Overview

Add first-class locale and country selection to SportyKids so users can choose their preferred language during onboarding and have content filtered and ranked by language/country affinity. Currently, the `locale` field exists on the User model (default `"es"`) but is never set during onboarding or synced to the server. There is no `country` field on User at all. This feature closes the gap between the i18n infrastructure already in place and the actual user experience.

## Problem Statement

1. **No language choice at onboarding.** The app defaults to Spanish (`es`). Users who prefer English have no way to select it during setup. The `locale` field in the DB stays `"es"` forever.
2. **No country preference.** `RssSource` has `country` and `language` fields, but there is no matching `country` on User. Content cannot be prioritized by geographic relevance.
3. **Locale lives only in localStorage.** The web `UserContext` reads locale from `localStorage` but never persists it to the server via `PUT /api/users/:id`. Mobile has the same gap.
4. **Feed ranker underutilized.** The `languageBoost` in `feed-ranker.ts` (+2 for locale match) exists but is rarely effective because `locale` is never explicitly set per-user.
5. **Quiz and summary generation ignore user locale.** AI-generated content defaults to Spanish regardless of user preference.

## Goals

| # | Goal | Success metric |
|---|------|---------------|
| G1 | Users can select language at onboarding | 100% of new users have explicit `locale` value after onboarding |
| G2 | Country stored on user profile | `country` field populated for all new users |
| G3 | Locale persisted to server | `PUT /api/users/:id` called whenever locale changes |
| G4 | Content filtered/ranked by locale + country | Feed ranker uses persisted locale; country-matching sources boosted |
| G5 | Quiz and summaries respect user locale | AI-generated content uses `user.locale` |
| G6 | Post-onboarding locale/country editable | Settings page allows changing language and country |

## Target Users

- **Primary:** Children 6-14 in bilingual or English-speaking households using SportyKids.
- **Secondary:** Parents who configure the app and want content in their family's language.

## Core Features

### F1. Schema Change: Add `country` to User model

**File:** `apps/api/prisma/schema.prisma`

Add the `country` field to the `User` model:

```prisma
model User {
  // ... existing fields ...
  locale    String @default("es")
  country   String @default("ES")   // <-- NEW
  // ...
}
```

**Migration:** Create a new Prisma migration that adds the column with default `"ES"`.

```bash
cd apps/api
npx prisma migrate dev --name add_user_country
```

**Shared type update:**

**File:** `packages/shared/src/types/index.ts`

```typescript
export interface User {
  // ... existing fields ...
  locale?: string;   // <-- ADD (was missing from type)
  country?: string;  // <-- ADD
  createdAt: Date;
}
```

### F2. API: Accept `locale` and `country` on User CRUD

**File:** `apps/api/src/routes/users.ts`

Update `createUserSchema` and `updateUserSchema`:

```typescript
const SUPPORTED_LOCALES = ['es', 'en'] as const;
const SUPPORTED_COUNTRIES = ['ES', 'GB', 'US', 'FR', 'IT', 'DE'] as const;

const createUserSchema = z.object({
  name: z.string().min(1).max(50),
  age: z.number().int().min(4).max(18),
  favoriteSports: z.array(z.string()).min(1),
  favoriteTeam: z.string().optional(),
  selectedFeeds: z.array(z.string()).default([]),
  locale: z.enum(SUPPORTED_LOCALES).optional(),       // NEW
  country: z.enum(SUPPORTED_COUNTRIES).optional(),     // NEW
});
```

In the `POST /` handler, pass `locale` and `country` through to `prisma.user.create`.

In the `PUT /:id` handler, allow `locale` and `country` to be updated (they are scalar fields, no JSON encoding needed).

### F3. Onboarding Step 1: Language Selector

**Files:**
- `apps/web/src/components/OnboardingWizard.tsx`
- `apps/mobile/src/screens/Onboarding.tsx`

Add a language selector to **Step 1** (Name + Age), placed **above** the name input. The selector consists of two buttons showing the available languages with country flags.

**Behavior:**
- Default selection matches the current `locale` from `UserContext` (default `'es'`).
- Selecting a language immediately calls `setLocale(newLocale)` on the UserContext so the rest of the onboarding wizard renders in the chosen language.
- The selected locale is included in the `createUser()` payload as `locale`.
- Country is auto-inferred from locale: `'es'` -> `'ES'`, `'en'` -> `'GB'`. User can change it later in settings.

**New state variables (web & mobile):**

```typescript
const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
```

**Language options:**

```typescript
const LANGUAGE_OPTIONS: { locale: Locale; flag: string; label: string }[] = [
  { locale: 'es', flag: '\u{1F1EA}\u{1F1F8}', label: 'Espanol' },
  { locale: 'en', flag: '\u{1F1EC}\u{1F1E7}', label: 'English' },
];
```

Note: Labels are hardcoded (not i18n) because the user hasn't chosen a language yet -- they need to read the option in its own language.

**UI Mockup (Web - Step 1):**

```
+------------------------------------------+
|  [====--------]  Step 1 of 5             |
|                                          |
|              (wave emoji)                |
|        Welcome! / Bienvenido!            |
|                                          |
|  +------------------+------------------+ |
|  | (ES flag)        | (GB flag)        | |
|  | Espanol          | English          | |
|  | [selected]       |                  | |
|  +------------------+------------------+ |
|                                          |
|  Your name / Tu nombre                   |
|  +------------------------------------+  |
|  | __________________________________ |  |
|  +------------------------------------+  |
|                                          |
|  How old are you?                        |
|  +----------+----------+----------+      |
|  |  6-8     |  9-11    |  12-14   |      |
|  +----------+----------+----------+      |
|                                          |
|              [ Next -> ]                 |
+------------------------------------------+
```

**UI Mockup (Mobile - Step 1):**

```
+----------------------------------+
|  Step 1 of 5                     |
|  [====--------]                  |
|                                  |
|  (wave emoji)                    |
|  Welcome! / Bienvenido!          |
|                                  |
|  +--------------+--------------+ |
|  | (ES flag)    | (GB flag)    | |
|  | Espanol      | English      | |
|  +--------------+--------------+ |
|                                  |
|  +----------------------------+  |
|  | Name / Nombre              |  |
|  +----------------------------+  |
|                                  |
|  How old are you?                |
|  +--------+--------+--------+   |
|  | 6-8    | 9-11   | 12-14  |   |
|  +--------+--------+--------+   |
|                                  |
|  [         Next ->           ]   |
+----------------------------------+
```

### F4. UserContext: Sync Locale to Server

**Files:**
- `apps/web/src/lib/user-context.tsx`
- `apps/mobile/src/lib/user-context.tsx`

When `setLocale` is called **and** a user is logged in (has an `id`), fire a `PUT /api/users/:id` with `{ locale: newLocale }` in the background. This ensures the server always has the current locale.

```typescript
const setLocale = async (l: Locale) => {
  setLocaleState(l);
  localStorage.setItem(LOCALE_KEY, l);
  // Sync to server if user exists
  if (user) {
    try {
      await updateUser(user.id, { locale: l });
    } catch {
      // Best-effort sync; local value is source of truth for UI
    }
  }
};
```

Also, on initial user load (`getUser(id)`), sync the returned `locale` to the context:

```typescript
getUser(id).then(async (u) => {
  setUserState(u);
  if (u.locale && (u.locale === 'es' || u.locale === 'en')) {
    setLocaleState(u.locale);
    localStorage.setItem(LOCALE_KEY, u.locale);
  }
  // ... rest of init
});
```

### F5. Content Filtering by Language & Country

#### F5a. Feed Ranker: Country Boost

**File:** `apps/api/src/services/feed-ranker.ts`

Add a `country` field to `BehavioralSignals` and a `countryBoost` function:

```typescript
export interface BehavioralSignals {
  // ... existing fields ...
  locale?: string;
  country?: string;  // NEW
}

/**
 * Country match boost (B-CP6). +1 if item source country matches user country.
 */
export function countryBoost(
  itemCountry: string | null | undefined,
  userCountry: string | undefined,
): number {
  if (!itemCountry || !userCountry) return 0;
  return itemCountry.toUpperCase() === userCountry.toUpperCase() ? 1 : 0;
}
```

Apply in `rankFeed`:

```typescript
// Country match boost (B-CP6)
if (behavioral?.country && (item as Record<string, unknown>).country) {
  score += countryBoost(
    (item as Record<string, unknown>).country as string,
    behavioral.country,
  );
}
```

#### F5b. News Route: Pass Country to Behavioral Signals

**File:** `apps/api/src/routes/news.ts`

When fetching user prefs for ranking, also select `locale` and `country`:

```typescript
const prefUser = await prisma.user.findUnique({
  where: { id: userId },
  select: { favoriteSports: true, favoriteTeam: true, locale: true, country: true },
});
```

Pass to `getBehavioralSignals`:

```typescript
const behavioral = userId
  ? await getBehavioralSignals(userId, prefUser?.locale, prefUser?.country)
  : undefined;
```

#### F5c. getBehavioralSignals: Accept Country

**File:** `apps/api/src/services/feed-ranker.ts`

Update signature:

```typescript
export async function getBehavioralSignals(
  userId: string,
  locale?: string,
  country?: string,
): Promise<BehavioralSignals> {
  // ... existing logic ...
  const signals: BehavioralSignals = {
    sportEngagement,
    sourceEngagement,
    readContentIds,
    locale,
    country,  // NEW
  };
  // ...
}
```

#### F5d. News Items: Attach Source Language/Country

The `NewsItem` model does not have `language` or `country` fields. The `languageBoost` and `countryBoost` need this data at ranking time.

**Approach:** When fetching news for ranking, join with `RssSource` to get `language` and `country`, and attach them to the item before passing to `rankFeed`.

In `apps/api/src/routes/news.ts`, after fetching `allNews`, enrich with source metadata:

```typescript
// Enrich news items with source language/country for ranking
const sourceNames = [...new Set(allNews.map((n) => n.source))];
const sourceMeta = await prisma.rssSource.findMany({
  where: { name: { in: sourceNames } },
  select: { name: true, language: true, country: true },
});
const sourceMap = new Map(sourceMeta.map((s) => [s.name, s]));

const enriched = allNews.map((n) => ({
  ...n,
  language: sourceMap.get(n.source)?.language ?? null,
  country: sourceMap.get(n.source)?.country ?? null,
}));

const ranked = rankFeed(enriched, userPrefs, behavioral);
```

### F6. Quiz & Summary: Use User Locale

#### F6a. Quiz Generation

**File:** `apps/api/src/jobs/generate-daily-quiz.ts`

When generating quiz questions via AI, pass the user's locale (or default `'es'`) to the prompt so questions are generated in the correct language. Since daily quiz is global (not per-user), generate in both locales or use a configurable default.

**Decision:** Generate quiz questions with a `locale` field. The `GET /api/quiz/questions` endpoint already accepts `age` -- add `locale` parameter to filter by language.

#### F6b. Summary Generation

**File:** `apps/api/src/services/summarizer.ts`

The `generateSummary` function already accepts `locale` parameter and `NewsSummary` has a `locale` field. No changes needed here -- the API endpoint `GET /api/news/:id/resumen?age=&locale=` already passes locale through. The frontend just needs to send the user's actual locale instead of the default.

### F7. Settings: Post-Onboarding Locale/Country Change

**Files:**
- `apps/web/src/app/parents/page.tsx` (or a new settings section)
- `apps/mobile/src/screens/ParentalControl.tsx`

Add a "Language & Region" section in the parental control panel (since language affects the child's content). This section is accessible **without** PIN (it's a user preference, not a parental restriction).

Alternatively, add it to the NavBar or a user profile section accessible from the main UI.

**Recommended placement:** Add to the NavBar dropdown or a small settings gear icon, since children should be able to change language themselves.

**UI Mockup (Web - Settings Section):**

```
+------------------------------------------+
|  Language & Region                        |
|                                          |
|  Language:                                |
|  +------------------+------------------+ |
|  | (ES flag)        | (GB flag)        | |
|  | Espanol          | English          | |
|  | [selected]       |                  | |
|  +------------------+------------------+ |
|                                          |
|  Country:                                 |
|  +------------------------------------+  |
|  | (ES flag) Spain              [v]   |  |
|  +------------------------------------+  |
|  (Dropdown: Spain, UK, USA, France,      |
|   Italy, Germany)                        |
|                                          |
|  [ Save ]                                |
+------------------------------------------+
```

**UI Mockup (Mobile - Settings):**

```
+----------------------------------+
|  Language & Region               |
|                                  |
|  Language                        |
|  +--------------+--------------+ |
|  | (ES flag)    | (GB flag)    | |
|  | Espanol      | English      | |
|  +--------------+--------------+ |
|                                  |
|  Country                         |
|  +----------------------------+  |
|  | (flag) Spain          [v]  |  |
|  +----------------------------+  |
|                                  |
|  [          Save             ]   |
+----------------------------------+
```

### F8. i18n Keys

**Files:**
- `packages/shared/src/i18n/es.json`
- `packages/shared/src/i18n/en.json`

Add new keys:

```json
{
  "settings": {
    "language_region": "Idioma y region",
    "language": "Idioma",
    "country": "Pais",
    "save": "Guardar",
    "saved": "Guardado"
  },
  "onboarding": {
    "welcome_bilingual": "Bienvenido! / Welcome!",
    "select_language": "Elige tu idioma"
  },
  "countries": {
    "ES": "Espana",
    "GB": "Reino Unido",
    "US": "Estados Unidos",
    "FR": "Francia",
    "IT": "Italia",
    "DE": "Alemania"
  }
}
```

English equivalent:

```json
{
  "settings": {
    "language_region": "Language & Region",
    "language": "Language",
    "country": "Country",
    "save": "Save",
    "saved": "Saved"
  },
  "onboarding": {
    "welcome_bilingual": "Welcome! / Bienvenido!",
    "select_language": "Choose your language"
  },
  "countries": {
    "ES": "Spain",
    "GB": "United Kingdom",
    "US": "United States",
    "FR": "France",
    "IT": "Italy",
    "DE": "Germany"
  }
}
```

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC1 | Prisma migration adds `country` column to User with default `"ES"` | `npx prisma migrate dev` succeeds; column visible in DB |
| AC2 | `POST /api/users` accepts `locale` and `country` and persists them | API test: create user with `{ locale: 'en', country: 'GB' }`, verify returned user has those values |
| AC3 | `PUT /api/users/:id` accepts `locale` and `country` updates | API test: update locale from `'es'` to `'en'`, verify DB |
| AC4 | Onboarding Step 1 (web) shows language selector above name input | Manual: open `/onboarding`, see two language buttons |
| AC5 | Selecting English in onboarding switches all wizard text to English | Manual: select English, verify step titles/buttons change |
| AC6 | Onboarding Step 1 (mobile) shows language selector | Manual: open onboarding screen, see language buttons |
| AC7 | UserContext syncs locale to server on change | Inspect network: changing locale fires `PUT /api/users/:id` |
| AC8 | UserContext loads locale from server on init | Create user with `locale: 'en'`, reload app, verify English UI |
| AC9 | Feed ranker applies `countryBoost` (+1 for country match) | Unit test: item with `country: 'ES'` and user country `'ES'` gets +1 |
| AC10 | Feed ranker applies existing `languageBoost` (+2 for locale match) | Unit test: item with `language: 'es'` and user locale `'es'` gets +2 |
| AC11 | News items are enriched with source language/country before ranking | Integration test: ranked results prefer matching locale/country |
| AC12 | Settings page allows changing locale and country after onboarding | Manual: navigate to settings, change language, verify UI updates |
| AC13 | `User` shared type includes `locale` and `country` | TypeScript compilation passes |
| AC14 | i18n keys for settings, onboarding, and countries exist in both `es.json` and `en.json` | Keys resolve without fallback |

## Technical Requirements

### Database

- **Prisma migration:** Add `country String @default("ES")` to `User` model.
- **No breaking change:** Existing users get `country = "ES"` via default. `locale` already exists with default `"es"`.
- **SQLite compatibility:** Both fields are simple strings, no array/JSON concerns.

### API

- **Zod validation:** `locale` restricted to `['es', 'en']`. `country` restricted to `['ES', 'GB', 'US', 'FR', 'IT', 'DE']`.
- **Backward compatibility:** Both fields are optional in `createUserSchema` and `updateUserSchema`. Existing clients that don't send them get defaults.

### Frontend

- **Immediate locale switch:** Selecting a language in onboarding must instantly re-render the wizard in the new language (via `setLocale` on UserContext).
- **No flash of wrong language:** On app load, read locale from localStorage/AsyncStorage before first render.
- **Country auto-inference:** Map `'es'` -> `'ES'`, `'en'` -> `'GB'` as default. Editable in settings.

### Performance

- **Source metadata lookup:** The join to get `language`/`country` for news items adds one query per feed request. Use the existing `apiCache` to cache source metadata (TTL: 30 min, source metadata rarely changes).
- **No additional API calls in hot path:** Country boost is computed alongside existing language boost in the same scoring loop.

## Implementation Decisions

| Decision | Rationale |
|----------|-----------|
| Add `country` to User model, not derive from locale | Locale `'en'` could mean GB, US, or AU. Explicit country is more accurate for content filtering. |
| Language selector in onboarding Step 1 (not a separate step) | Keeps the 5-step flow. Language is a prerequisite for understanding the rest of the wizard. |
| Hardcoded language labels (not i18n) | Users need to read the language name in that language before they've chosen one. "Espanol" must always say "Espanol". |
| Country boost is +1 (lower than language boost +2) | Language match is more important than geographic proximity. A Spanish speaker in the US cares more about Spanish-language content than US-origin content. |
| Auto-infer country from locale at onboarding | Reduces friction. Users can override in settings. |
| Sync locale to server on every change | Ensures server-side features (quiz, summaries, feed ranking) use the correct locale even if the client cache is cleared. |
| Settings accessible without parental PIN | Language preference is a user preference, not a parental restriction. Children should be able to switch language. |

## Testing Decisions

### Unit Tests

**File:** `apps/api/src/__tests__/feed-ranker.test.ts` (extend existing)

| Test | Description |
|------|-------------|
| `countryBoost returns +1 for matching country` | `countryBoost('ES', 'ES')` returns `1` |
| `countryBoost returns 0 for non-matching country` | `countryBoost('GB', 'ES')` returns `0` |
| `countryBoost returns 0 for null/undefined` | `countryBoost(null, 'ES')` returns `0` |
| `countryBoost is case-insensitive` | `countryBoost('es', 'ES')` returns `1` |
| `rankFeed applies country boost` | Item with matching country scores higher than one without |

### API Integration Tests

**File:** `apps/api/src/__tests__/users-locale.test.ts` (new)

| Test | Description |
|------|-------------|
| `POST /api/users accepts locale and country` | Create user with `locale: 'en', country: 'GB'`, verify response |
| `POST /api/users defaults locale to 'es' and country to 'ES'` | Create user without locale/country, verify defaults |
| `PUT /api/users/:id updates locale` | Update locale to `'en'`, verify persisted |
| `PUT /api/users/:id updates country` | Update country to `'US'`, verify persisted |
| `PUT /api/users/:id rejects invalid locale` | Send `locale: 'xx'`, expect 400 |
| `PUT /api/users/:id rejects invalid country` | Send `country: 'XX'`, expect 400 |

### Migration Test

**File:** `apps/api/src/__tests__/migration-country.test.ts` (new)

| Test | Description |
|------|-------------|
| `Existing users have country defaulted to 'ES'` | After migration, query users without explicit country, verify `'ES'` |

## Out of Scope

- **Adding new locales beyond `es`/`en`.** The i18n system supports it, but translation files for other languages are not part of this PRD.
- **Auto-detecting locale from browser `Accept-Language` header.** Could be a future enhancement.
- **Per-content-type locale (e.g., news in Spanish but quiz in English).** Single locale per user.
- **Locale-based RSS source auto-selection in onboarding Step 4.** Could pre-filter catalog by user locale, but is a separate enhancement.
- **RTL language support.** Not needed for es/en.
- **OAuth locale passthrough.** OAuth is not yet implemented.

## Future Considerations

1. **Browser locale auto-detection:** Read `navigator.language` on first visit and pre-select the matching locale in onboarding.
2. **Pre-filter RSS catalog by locale:** In onboarding Step 4, default to showing sources matching the user's locale/country first, with others collapsed.
3. **Per-locale quiz generation:** Run the daily quiz cron for each supported locale, generating questions in both Spanish and English.
4. **Additional locales:** Adding Portuguese (`pt`), French (`fr`), or Italian (`it`) requires only a new translation file and updating the `Locale` type and validation arrays.
5. **Country-specific content moderation:** Some content may be appropriate in one country but not another (e.g., betting regulations differ). Country field enables future per-country moderation rules.
6. **Locale in URL path:** For SEO, the web app could use `/es/` or `/en/` URL prefixes. Not needed for a kid-focused SPA but useful if the app grows.
