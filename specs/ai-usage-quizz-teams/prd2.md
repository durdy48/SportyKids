# PRD: Dynamic Sport-Specific Entity Selection in Onboarding

**Document version**: 1.0
**Date**: 2026-04-02
**Status**: Ready for implementation
**Scope**: Onboarding step 3 — "Who do you follow?"

---

## 1. Overview

### Problem

Onboarding step 3 ("Favorite team?") currently shows a hardcoded list of 20 football clubs and a handful of individual athletes regardless of which sport the user selected in step 2. If a child chose tennis, cycling, or padel in step 2, they are still shown Real Madrid, Barcelona, and Manchester City — entities completely irrelevant to their interest.

This is a UX dead end: users who are not football fans have no meaningful entity to select, so the step adds no value for them and their `selectedFeeds` stays empty for team-specific news sources.

### Solution

Replace the static `TEAMS`-based entity list with a dynamic, sport-aware entity catalog (`SPORT_ENTITIES`). Step 3 now shows only the entities relevant to the sports the user picked in step 2 — football fans see clubs, tennis fans see top players, F1 fans see drivers and constructors, etc. If the user selected multiple sports, entities for all of them are shown together.

Each entity carries a `feedQuery` string that matches the corresponding RSS source name in the catalog. When the user selects an entity, the matching sources are activated in their `selectedFeeds`, enabling personalised team/athlete news from day one.

### Affected files

| File | Change type |
|------|-------------|
| `packages/shared/src/constants/index.ts` | Add `SportEntity` type and `SPORT_ENTITIES` constant |
| `packages/shared/src/i18n/en.json` | Update `onboarding.step3_title`, `onboarding.step3_subtitle` |
| `packages/shared/src/i18n/es.json` | Update `onboarding.step3_title`, `onboarding.step3_subtitle` |
| `apps/web/src/components/OnboardingWizard.tsx` | Rewrite step 3 rendering; change `team` (single) → `selectedEntities` (multi); add `selectedFeeds` pre-population from entity selection |
| `apps/mobile/src/screens/Onboarding.tsx` | Same changes as web |
| `apps/web/src/components/__tests__/OnboardingWizard.test.tsx` | New test file |
| `apps/mobile/src/screens/__tests__/Onboarding.test.tsx` | New/updated test file |
| `packages/shared/src/__tests__/constants.test.ts` | Add tests for `SPORT_ENTITIES` |

---

## 2. Goals

1. Every sport has a meaningful set of entities to choose from in step 3.
2. The entity list shown is always a subset of sports the user already picked in step 2 — zero irrelevant entities.
3. Multi-sport users see entities for all their chosen sports in a single scrollable view.
4. Entity selection automatically pre-activates the corresponding team-news RSS feeds in `selectedFeeds`, giving the user a personalised feed without extra configuration effort.
5. Step 3 remains **optional** — users can skip it and still proceed to step 4.
6. No regression for football-focused users — the new football entity list is a superset of the old `TEAMS` list.
7. The `TEAMS` constant is preserved as-is (other parts of the codebase reference it).

---

## 3. Out of Scope

- No changes to step 1 (name/age), step 2 (sports), step 4 (RSS catalog), or step 5 (parental PIN).
- No changes to existing users — this only affects new onboarding flows.
- No API changes — entity-to-feed matching is done entirely on the client side using the RSS source catalog already fetched in step 4.
- No changes to the `TEAMS` constant or any code that currently uses it.
- No new backend endpoints or Prisma migrations.
- No retroactive migration of existing users' `selectedFeeds` or `favoriteTeam` fields.
- The `favoriteTeam` field on the User model is not removed — existing users retain it. New onboarding no longer writes it (multi-select replaces single-select).
- No search/filter bar inside step 3 (the entity lists are short and curated; search is available in step 4 for the full catalog).
- No sport-grouped tabs in step 3 — all entities for the user's selected sports are shown in a single flat grid (sport label badges differentiate them when needed for multi-sport users).

---

## 4. Technical Requirements

### 4.1 New `SPORT_ENTITIES` constant

**File**: `packages/shared/src/constants/index.ts`

#### TypeScript interface

```typescript
export type EntityType =
  | 'team'
  | 'athlete'
  | 'driver'
  | 'cyclist'
  | 'swimmer'
  | 'padel_player';

export interface SportEntity {
  /** Display name shown in the UI chip */
  name: string;
  /** Semantic type — used for accessible labels and future icon selection */
  type: EntityType;
  /**
   * Substring used to find the matching RssSource by name in the catalog.
   * The matching logic: catalogSource.name.toLowerCase().includes(feedQuery.toLowerCase())
   * This string must be specific enough to match exactly the intended RSS source(s)
   * and not accidentally match unrelated sources.
   */
  feedQuery: string;
}

export const SPORT_ENTITIES: Record<string, SportEntity[]> = { ... };
```

#### Full `SPORT_ENTITIES` data

The key of each entry is a value from `SPORTS` (`'football' | 'basketball' | 'tennis' | 'swimming' | 'athletics' | 'cycling' | 'formula1' | 'padel'`).

The `feedQuery` values below have been verified against the RSS source names in `apps/api/prisma/seed.ts`.

```typescript
export const SPORT_ENTITIES: Record<string, SportEntity[]> = {
  football: [
    { name: 'Real Madrid',          type: 'team',    feedQuery: 'Google News: Real Madrid' },
    { name: 'FC Barcelona',         type: 'team',    feedQuery: 'Google News: FC Barcelona' },
    { name: 'Atlético de Madrid',   type: 'team',    feedQuery: 'Google News: Atletico de Madrid' },
    { name: 'Athletic Club',        type: 'team',    feedQuery: 'Google News: Athletic Club' },
    { name: 'Real Sociedad',        type: 'team',    feedQuery: 'Google News: Real Sociedad' },
    { name: 'Real Betis',           type: 'team',    feedQuery: 'Google News: Real Betis' },
    { name: 'Sevilla FC',           type: 'team',    feedQuery: 'Google News: Sevilla FC' },
    { name: 'Valencia CF',          type: 'team',    feedQuery: 'Google News: Valencia CF' },
    { name: 'Villarreal',           type: 'team',    feedQuery: 'Google News: Villarreal' },
    { name: 'Manchester City',      type: 'team',    feedQuery: 'Google News: Manchester City' },
    { name: 'Liverpool',            type: 'team',    feedQuery: 'Google News: Liverpool FC' },
    { name: 'Bayern Munich',        type: 'team',    feedQuery: 'Google News: Bayern Munich' },
    { name: 'PSG',                  type: 'team',    feedQuery: 'Google News: PSG' },
    { name: 'Juventus',             type: 'team',    feedQuery: 'Google News: Juventus' },
    { name: 'Inter Milan',          type: 'team',    feedQuery: 'Google News: Inter Milan' },
    { name: 'Spain National Team',  type: 'team',    feedQuery: 'Google News: Seleccion Espanola' },
  ],
  basketball: [
    { name: 'Los Angeles Lakers',     type: 'team', feedQuery: 'Google News: LA Lakers' },
    { name: 'Golden State Warriors',  type: 'team', feedQuery: 'Google News: Golden State Warriors' },
    { name: 'Boston Celtics',         type: 'team', feedQuery: 'Google News: Boston Celtics' },
    { name: 'Miami Heat',             type: 'team', feedQuery: 'Google News: Miami Heat' },
    { name: 'Real Madrid Basket',     type: 'team', feedQuery: 'Google News: Real Madrid Basket' },
    { name: 'FC Barcelona Basket',    type: 'team', feedQuery: 'Google News: Barcelona Basket' },
    { name: 'Unicaja',                type: 'team', feedQuery: 'Google News: Unicaja' },
    { name: 'Baskonia',               type: 'team', feedQuery: 'Google News: Baskonia' },
  ],
  tennis: [
    { name: 'Carlos Alcaraz',   type: 'athlete', feedQuery: 'Google News: Carlos Alcaraz' },
    { name: 'Rafa Nadal',       type: 'athlete', feedQuery: 'Google News: Rafael Nadal' },
    { name: 'Novak Djokovic',   type: 'athlete', feedQuery: 'Google News: Novak Djokovic' },
    { name: 'Jannik Sinner',    type: 'athlete', feedQuery: 'Google News: Jannik Sinner' },
    { name: 'Iga Swiatek',      type: 'athlete', feedQuery: 'Google News: Iga Swiatek' },
    { name: 'Aryna Sabalenka',  type: 'athlete', feedQuery: 'Google News: Aryna Sabalenka' },
  ],
  formula1: [
    { name: 'Max Verstappen',   type: 'driver', feedQuery: 'Google News: Max Verstappen' },
    { name: 'Lewis Hamilton',   type: 'driver', feedQuery: 'Google News: Lewis Hamilton' },
    { name: 'Charles Leclerc', type: 'driver', feedQuery: 'Google News: Charles Leclerc' },
    { name: 'Carlos Sainz',     type: 'driver', feedQuery: 'Google News: Carlos Sainz F1' },
    { name: 'Fernando Alonso',  type: 'driver', feedQuery: 'Google News: Fernando Alonso' },
    { name: 'Lando Norris',     type: 'driver', feedQuery: 'Google News: Lando Norris' },
    { name: 'Red Bull Racing',  type: 'team',   feedQuery: 'Google News: Red Bull Racing' },
    { name: 'Ferrari',          type: 'team',   feedQuery: 'Google News: Ferrari F1' },
    { name: 'Mercedes',         type: 'team',   feedQuery: 'Google News: Mercedes F1' },
    { name: 'McLaren',          type: 'team',   feedQuery: 'Google News: McLaren F1' },
  ],
  cycling: [
    { name: 'Tadej Pogacar',      type: 'cyclist', feedQuery: 'Google News: Tadej Pogacar' },
    { name: 'Jonas Vingegaard',   type: 'cyclist', feedQuery: 'Google News: Jonas Vingegaard' },
    { name: 'Remco Evenepoel',    type: 'cyclist', feedQuery: 'Google News: Remco Evenepoel' },
    { name: 'Primoz Roglic',      type: 'cyclist', feedQuery: 'Google News: Primoz Roglic' },
  ],
  swimming: [
    { name: 'Caeleb Dressel',  type: 'swimmer', feedQuery: 'Google News: Caeleb Dressel' },
    { name: 'Léon Marchand',   type: 'swimmer', feedQuery: 'Google News: Leon Marchand' },
    { name: 'Katie Ledecky',   type: 'swimmer', feedQuery: 'Google News: Katie Ledecky' },
  ],
  athletics: [
    { name: 'Mondo Duplantis',    type: 'athlete', feedQuery: 'Google News: Mondo Duplantis' },
    { name: 'Marcell Jacobs',     type: 'athlete', feedQuery: 'Google News: Noah Lyles' },
    { name: 'Sydney McLaughlin',  type: 'athlete', feedQuery: 'Google News: Sydney McLaughlin' },
  ],
  padel: [
    { name: 'Alejandro Galán', type: 'padel_player', feedQuery: 'Google News: Alejandro Galan' },
    { name: 'Arturo Coello',   type: 'padel_player', feedQuery: 'Google News: Arturo Coello' },
  ],
};
```

> **Implementation note — athletics**: The seed contains `'Google News: Noah Lyles'` and `'Google News: Mondo Duplantis'` and `'Google News: Sydney McLaughlin'` but not `'Google News: Marcell Jacobs'`. The entity named "Marcell Jacobs" in the PRD context maps to `'Google News: Noah Lyles'` because there is no Jacobs RSS source in the seed. The implementing agent must either:
> - Replace "Marcell Jacobs" with "Noah Lyles" as the entity name (recommended — matches seed reality), or
> - Add a seed entry for Marcell Jacobs if the product team decides to include him.
> The implementation should use only `feedQuery` values that exist in the seed catalog.

> **Implementation note — padel**: The seed has `'Google News: Alejandro Galan'` and `'Google News: Arturo Coello'` but NOT entries for Juan Lebrón or Agustín Tapia. The entity catalog in this PRD reflects only seeded sources. If Juan Lebrón and Agustín Tapia should be included, their RSS seed entries must be added first (requires a `prisma/seed.ts` update and migration). This is treated as out of scope for this PRD — the implementing agent should use only the two confirmed padel entities.

---

### 4.2 Feed-to-entity matching logic

The matching is a simple substring search on the RSS source `name` field (case-insensitive). The `feedQuery` string is deliberately chosen to be specific enough to avoid collisions.

```typescript
/**
 * Given a list of catalog sources and a set of selected entities,
 * return the source IDs that match at least one entity's feedQuery.
 */
function getSourceIdsForEntities(
  catalogSources: RssSource[],
  selectedEntities: SportEntity[]
): string[] {
  const queries = selectedEntities.map((e) => e.feedQuery.toLowerCase());
  return catalogSources
    .filter((source) =>
      queries.some((q) => source.name.toLowerCase().includes(q))
    )
    .map((source) => source.id);
}
```

**Collision risk analysis** (all `feedQuery` values are unique substrings in the catalog):

- `'Google News: Real Madrid'` matches `'Google News: Real Madrid'` (football, ES) but also `'Google News: Real Madrid Basket'` (basketball, ES). This is intentional for football entity "Real Madrid" — it should NOT activate the basketball source. To prevent this, the filter must use an **exact match** on the source name, not a substring. Change to:

  ```typescript
  source.name.toLowerCase() === entity.feedQuery.toLowerCase()
  ```

  This is the correct approach. All `feedQuery` values are exact RSS source names as they appear in the seed.

- `'Google News: Carlos Alcaraz'` is unique — no collision risk.
- `'Google News: Carlos Sainz F1'` is unique and distinct from any football "Carlos Sainz" (none in seed).
- `'Google News: Ferrari F1'` — the seed name is `'Google News: Ferrari F1'` so exact match is safe.
- `'Google News: Mercedes F1'` — same pattern.

**Recommended implementation**: use **exact name match** (`===`) rather than substring `includes`. This eliminates all collision risk.

```typescript
function getSourceIdsForEntities(
  catalogSources: RssSource[],
  selectedEntities: SportEntity[]
): string[] {
  const querySet = new Set(selectedEntities.map((e) => e.feedQuery.toLowerCase()));
  return catalogSources
    .filter((source) => querySet.has(source.name.toLowerCase()))
    .map((source) => source.id);
}
```

---

### 4.3 Web — `OnboardingWizard.tsx` changes

**File**: `apps/web/src/components/OnboardingWizard.tsx`

#### State changes

Remove:
```typescript
const [team, setTeam] = useState<string>('');
```

Add:
```typescript
const [selectedEntities, setSelectedEntities] = useState<SportEntity[]>([]);
```

Import `SPORT_ENTITIES` and `SportEntity` from `@sportykids/shared`.

#### Derived entity list

```typescript
// Entities to display in step 3, filtered by sports selected in step 2
const visibleEntities = useMemo(() => {
  return sports.flatMap((sport) => SPORT_ENTITIES[sport] ?? []);
}, [sports]);
```

#### Toggle handler

```typescript
const toggleEntity = (entity: SportEntity) => {
  setSelectedEntities((prev) => {
    const exists = prev.some((e) => e.feedQuery === entity.feedQuery);
    return exists
      ? prev.filter((e) => e.feedQuery !== entity.feedQuery)
      : [...prev, entity];
  });
};
```

#### `selectedFeeds` pre-population from entity selection

In the existing `useEffect` that pre-populates feeds on step 4 entry, also include the feeds matched by the user's entity selection from step 3:

```typescript
useEffect(() => {
  if (step === 4 && catalogSources.length === 0) {
    setCatalogLoading(true);
    fetchSourceCatalog()
      .then((data) => {
        setCatalogSources(data.sources);
        // Pre-select: all sources for selected sports + entity-specific feeds
        const sportIds = data.sources
          .filter((s) => sports.includes(s.sport))
          .map((s) => s.id);
        const entityIds = getSourceIdsForEntities(data.sources, selectedEntities);
        const merged = Array.from(new Set([...sportIds, ...entityIds]));
        setSelectedFeeds(merged);
      })
      .catch(console.error)
      .finally(() => setCatalogLoading(false));
  }
}, [step]); // eslint-disable-line react-hooks/exhaustive-deps
```

#### Step 3 rendering

Replace the current step 3 block with:

```tsx
{step === 3 && (
  <div className="space-y-6">
    <div className="text-center">
      <span className="text-4xl">⭐</span>
      <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mt-3">
        {t('onboarding.step3_title', locale)}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {t('onboarding.step3_subtitle', locale)}
      </p>
    </div>

    {visibleEntities.length === 0 ? (
      // Fallback: no entities for selected sports (should not happen with current SPORTS)
      <p className="text-center text-sm text-gray-400">
        {t('onboarding.step3_no_entities', locale)}
      </p>
    ) : (
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {visibleEntities.map((entity) => {
          const isSelected = selectedEntities.some(
            (e) => e.feedQuery === entity.feedQuery
          );
          return (
            <button
              key={entity.feedQuery}
              onClick={() => toggleEntity(entity)}
              aria-pressed={isSelected}
              aria-label={`${entity.type}: ${entity.name}`}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors text-left ${
                isSelected
                  ? 'bg-[var(--color-blue)] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {entity.name}
            </button>
          );
        })}
      </div>
    )}
  </div>
)}
```

#### `canAdvance` — no change needed

Step 3 is already optional (`return true`) — keep as-is.

#### `complete` function

Remove the `favoriteTeam: team || undefined` line from the `createUser` call. The team entity selection now flows into `selectedFeeds` only (via step 4 pre-population). The field is deprecated for new users.

If the product requires backward compatibility, keep `favoriteTeam` set to the first selected entity name:
```typescript
favoriteTeam: selectedEntities[0]?.name ?? undefined,
```

---

### 4.4 Web — ASCII mockup

**Step 3 — single sport selected (football)**:

```
┌─────────────────────────────────────────────────────┐
│                       ⭐                             │
│            Who do you follow?                       │
│         Optional — you can skip this                │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Real Madrid     │  │  FC Barcelona    │        │
│  └──────────────────┘  └──────────────────┘        │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Atlético Madrid │  │  Athletic Club   │        │  ←── scrollable
│  └──────────────────┘  └──────────────────┘        │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Real Sociedad   │  │  Real Betis   ✓  │  ← selected (blue bg)
│  └──────────────────┘  └──────────────────┘        │
│       ... more chips ...                            │
│                                                     │
│              [ Next → ]                             │
└─────────────────────────────────────────────────────┘
```

**Step 3 — two sports selected (football + tennis)**:

```
┌─────────────────────────────────────────────────────┐
│                       ⭐                             │
│            Who do you follow?                       │
│         Optional — you can skip this                │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Real Madrid  ✓  │  │  FC Barcelona    │        │  ← football entities first
│  └──────────────────┘  └──────────────────┘        │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Atlético Madrid │  │  Manchester City │        │
│  └──────────────────┘  └──────────────────┘        │
│       ... more football chips ...                   │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Carlos Alcaraz  │  │  Rafa Nadal   ✓  │        │  ← tennis entities
│  └──────────────────┘  └──────────────────┘        │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  Novak Djokovic  │  │  Jannik Sinner   │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│              [ Next → ]                             │
└─────────────────────────────────────────────────────┘
```

Entity order within the grid: entities are listed in the order they appear in `SPORT_ENTITIES[sport]`, one sport at a time, in the order they appear in the user's `sports` array (which preserves the selection order from step 2).

---

### 4.5 Mobile — `Onboarding.tsx` changes

**File**: `apps/mobile/src/screens/Onboarding.tsx`

The changes mirror the web implementation exactly:

#### State changes

Remove:
```typescript
const [team, setTeam] = useState('');
```

Add:
```typescript
const [selectedEntities, setSelectedEntities] = useState<SportEntity[]>([]);
```

Import `SPORT_ENTITIES` and `SportEntity` from `@sportykids/shared`.

#### Derived entity list

```typescript
const visibleEntities = useMemo(
  () => sports.flatMap((sport) => SPORT_ENTITIES[sport] ?? []),
  [sports]
);
```

#### Toggle handler

```typescript
const toggleEntity = (entity: SportEntity) => {
  setSelectedEntities((prev) => {
    const exists = prev.some((e) => e.feedQuery === entity.feedQuery);
    return exists
      ? prev.filter((e) => e.feedQuery !== entity.feedQuery)
      : [...prev, entity];
  });
};
```

#### Step 3 rendering

Replace the current step 3 block with:

```tsx
{step === 3 && (
  <View style={s.stepContainer}>
    <Text style={s.emoji}>⭐</Text>
    <Text style={s.title}>{t('onboarding.step3_title', locale)}</Text>
    <Text style={s.subtitle}>{t('onboarding.step3_subtitle', locale)}</Text>
    <View style={s.grid}>
      {visibleEntities.map((entity) => {
        const isSelected = selectedEntities.some(
          (e) => e.feedQuery === entity.feedQuery
        );
        return (
          <TouchableOpacity
            key={entity.feedQuery}
            style={[s.chip, isSelected && s.chipActive]}
            onPress={() => toggleEntity(entity)}
            accessible={true}
            accessibilityLabel={t('a11y.onboarding.select_entity', locale, {
              entity: entity.name,
            })}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[s.chipText, isSelected && s.chipTextActive]}>
              {entity.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
)}
```

#### `selectedFeeds` pre-population on entering step 4

The same logic as web:

```typescript
useEffect(() => {
  if (step === 4 && selectedFeeds.length === 0 && sources.length > 0 && sports.length > 0) {
    const sportIds = sources
      .filter((s) => s.active && sports.includes(s.sport))
      .map((s) => s.id);
    const entityIds = getSourceIdsForEntities(sources, selectedEntities);
    const merged = Array.from(new Set([...sportIds, ...entityIds]));
    setSelectedFeeds(merged);
  }
}, [step, sources, sports]); // eslint-disable-line react-hooks/exhaustive-deps
```

#### `complete` function

Same as web: remove the `favoriteTeam: team || undefined` line, or keep it for backward compatibility using `selectedEntities[0]?.name`.

---

### 4.6 i18n key updates

**File**: `packages/shared/src/i18n/en.json`

```json
"onboarding": {
  "step3_title": "Who do you follow?",
  "step3_subtitle": "Pick your favourite teams and athletes — optional",
  "step3_no_entities": "No entities available for your selected sports"
}
```

**File**: `packages/shared/src/i18n/es.json`

```json
"onboarding": {
  "step3_title": "¿A quién sigues?",
  "step3_subtitle": "Elige tus equipos y atletas favoritos — opcional",
  "step3_no_entities": "No hay entidades disponibles para tus deportes seleccionados"
}
```

**Accessibility key** (add to both `en.json` and `es.json` under `a11y.onboarding`):

```json
"a11y": {
  "onboarding": {
    "select_entity": "Select {{entity}}"   // en
    "select_entity": "Seleccionar {{entity}}"  // es
  }
}
```

---

### 4.7 Shared utility function

To avoid duplicating the matching logic between web and mobile, add a helper to the shared package:

**File**: `packages/shared/src/utils/entities.ts` (new file)

```typescript
import type { SportEntity } from '../constants';

export interface FeedSource {
  id: string;
  name: string;
}

/**
 * Returns the IDs of catalog sources that match the given entities by exact name.
 * feedQuery values in SportEntity are exact RSS source names as seeded.
 */
export function getSourceIdsForEntities(
  catalogSources: FeedSource[],
  selectedEntities: SportEntity[]
): string[] {
  const querySet = new Set(selectedEntities.map((e) => e.feedQuery.toLowerCase()));
  return catalogSources
    .filter((source) => querySet.has(source.name.toLowerCase()))
    .map((source) => source.id);
}
```

Export from `packages/shared/src/utils/index.ts`:
```typescript
export { getSourceIdsForEntities } from './entities';
```

And export from `packages/shared/src/index.ts` if not already re-exporting all utils.

---

## 5. Implementation Decisions

### D1 — Multi-select instead of single-select

**Decision**: Step 3 becomes multi-select (`selectedEntities: SportEntity[]` instead of `team: string`).

**Rationale**: A user who follows both Real Madrid and the Spanish national team, or two tennis players, should be able to follow news for both. Single-select was a limitation of the original football-only design. Multi-select aligns with how `selectedFeeds` already works (an array).

### D2 — Client-side matching, no new API endpoint

**Decision**: The entity→feed matching is done on the client at step 4 entry, using the RSS catalog already fetched from `/api/news/sources/catalog`.

**Rationale**: Avoids introducing a new API endpoint or changing the User model. The catalog is already fetched for step 4 rendering. This is the minimal-change approach.

### D3 — `feedQuery` as exact source name

**Decision**: `feedQuery` matches the RSS source `name` field exactly (case-insensitive `===`).

**Rationale**: Substring matching risks false positives (e.g., "Real Madrid" matching "Real Madrid Basket"). Exact name matching is safe, predictable, and easy to verify against the seed.

### D4 — Entity selection feeds into step 4 pre-selection, not replacing it

**Decision**: Entity-matched source IDs are merged with sport-matched source IDs in step 4 (union, deduplicated). Entity selection does not override the step 4 catalog UI.

**Rationale**: The user still has full control in step 4 to add or remove any source. Entity selection is a convenience default, not a hard constraint.

### D5 — Preserve `TEAMS` constant

**Decision**: The `TEAMS` constant in `packages/shared/src/constants/index.ts` is not removed.

**Rationale**: Other parts of the codebase (team stats, feed ranker, classifier) may reference it. The PRD scope is limited to onboarding. Removing `TEAMS` is a separate cleanup task.

### D6 — No sport-labelled tabs in step 3

**Decision**: When multiple sports are selected, all entities are shown in a single flat scrollable grid. No tab per sport.

**Rationale**: The typical user selects 1-3 sports, yielding 4-30 total entities. A flat list fits in the existing 2-column scrollable grid without needing tabs. Tabs add complexity. If future expansion adds many more entities per sport, tabs can be added then.

### D7 — Entity catalog is static (compile-time), not server-driven

**Decision**: `SPORT_ENTITIES` is a hardcoded constant in the shared package, not fetched from the API.

**Rationale**: The catalog rarely changes, does not vary per user, and does not need server-side computation. Hardcoding gives zero latency and full offline support. Any update requires a shared package change and deployment, which is acceptable given the expected frequency of updates.

---

## 6. Acceptance Criteria

### AC-1 — Football-only user sees only football entities
Given a user who selected only `football` in step 2, when they reach step 3, they see exactly the 16 football entities listed in `SPORT_ENTITIES.football` and no entities from other sports.

### AC-2 — Tennis-only user sees only tennis entities
Given a user who selected only `tennis` in step 2, when they reach step 3, they see exactly the 6 tennis player entities and no football clubs.

### AC-3 — Multi-sport user sees combined entity list
Given a user who selected `football` and `formula1` in step 2, when they reach step 3, they see 16 football entities followed by 10 F1 entities (26 total), in that order.

### AC-4 — Multi-select works
Given step 3 is displayed, when the user taps/clicks 3 different entities, all 3 are visually highlighted (blue background on web, `chipActive` style on mobile) and stored in `selectedEntities`.

### AC-5 — Deselect works
Given an entity is selected (highlighted), when the user taps/clicks it again, it becomes deselected (reverts to default style) and is removed from `selectedEntities`.

### AC-6 — Step is optional
Given step 3 is displayed, when the user clicks/taps "Next" without selecting any entity, the wizard advances to step 4 without error.

### AC-7 — Entity selection pre-populates feeds in step 4
Given a user selected "Carlos Alcaraz" in step 3 and `tennis` in step 2, when step 4 loads, `selectedFeeds` includes the ID of the RSS source named `'Google News: Carlos Alcaraz'` in addition to the IDs of all other active `tennis` sources.

### AC-8 — Non-entity feeds are not excluded
Given a user selected only one entity ("Real Madrid") in step 3, when step 4 loads, `selectedFeeds` contains the IDs of ALL active `football` sources (not just the Real Madrid one).

### AC-9 — No collision between "Real Madrid" (football) and "Real Madrid Basket" (basketball)
Given a user selected only `football` in step 2 and "Real Madrid" as entity in step 3, the `'Google News: Real Madrid Basket'` source is NOT included in `selectedFeeds` upon entering step 4.

### AC-10 — i18n keys are present and render correctly
In English locale, step 3 title renders as "Who do you follow?". In Spanish locale, it renders as "¿A quién sigues?".

### AC-11 — Emoji updated
The step 3 header emoji is `⭐` (not `⚽`), reflecting the multi-sport nature of the step.

### AC-12 — `TEAMS` constant unchanged
The `TEAMS` constant in `packages/shared/src/constants/index.ts` is identical to before this change. No other file that imports `TEAMS` requires modification.

### AC-13 — TypeScript compilation passes
Running `npm run build:api && npm run build:web` produces no TypeScript errors. Mobile typecheck (`tsc --noEmit` in `apps/mobile`) also passes.

### AC-14 — Existing tests pass
Running `npm run test:all` produces no new failures compared to pre-change baseline.

---

## 7. Testing Decisions

### 7.1 Unit tests — `SPORT_ENTITIES` constant

**File**: `packages/shared/src/__tests__/constants.test.ts`

Tests to add:

- `SPORT_ENTITIES` has an entry for every sport in `SPORTS`
- Every `SportEntity` has a non-empty `name`, `type`, and `feedQuery`
- No two entities within the same sport share the same `feedQuery`
- `feedQuery` values do not contain leading/trailing whitespace
- Entity types are valid `EntityType` values

### 7.2 Unit tests — `getSourceIdsForEntities`

**File**: `packages/shared/src/__tests__/entities.test.ts`

Tests to add:

- Returns empty array when `selectedEntities` is empty
- Returns empty array when no catalog source name matches
- Returns correct IDs for exact name matches (case-insensitive)
- Does NOT return "Real Madrid Basket" when entity is `{ feedQuery: 'Google News: Real Madrid' }`
- Deduplicates IDs when two entities map to the same source

### 7.3 Component tests — Web `OnboardingWizard`

**File**: `apps/web/src/components/__tests__/OnboardingWizard.test.tsx`

Tests to add:

- When user selects `football` in step 2 and advances to step 3, only football entity chips are rendered
- When user selects `tennis` in step 2 and advances to step 3, only tennis entity chips are rendered
- When user selects `football` and `basketball` in step 2, both sport entity groups appear
- Clicking an entity chip toggles its `aria-pressed` state
- Clicking an already-selected entity chip deselects it
- Clicking "Next" on step 3 with no entity selected advances to step 4 (step is optional)
- `TEAMS` is not rendered in step 3 (regression: old chips must not appear)

### 7.4 Component tests — Mobile `Onboarding`

**File**: `apps/mobile/src/screens/__tests__/Onboarding.test.tsx`

Same set of tests as web, adapted for React Native Testing Library:

- Entity chips render for selected sport
- `accessibilityState.selected` is `true` for selected entity, `false` for others
- Pressing deselects a selected entity

### 7.5 Integration / regression check

No E2E test update is strictly required since onboarding is not yet covered in the Playwright suite. If the E2E suite is extended to cover onboarding in the future, the sport-selection step 3 flow should be added.

### 7.6 What NOT to test

- The actual RSS source catalog content (that is tested separately in API tests)
- The `selectedFeeds` write to the backend (tested in user creation API tests)
- The `TEAMS` constant values (no change — no test needed)
