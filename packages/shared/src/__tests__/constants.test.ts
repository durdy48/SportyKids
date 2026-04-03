import { describe, it, expect } from 'vitest';
import { SPORT_ENTITIES, SPORTS } from '../constants';

const VALID_ENTITY_TYPES = ['team', 'athlete', 'driver', 'cyclist', 'swimmer', 'padel_player'];

describe('SPORT_ENTITIES', () => {
  it('has an entry for every sport in SPORTS', () => {
    for (const sport of SPORTS) {
      expect(SPORT_ENTITIES).toHaveProperty(sport);
      expect(Array.isArray(SPORT_ENTITIES[sport])).toBe(true);
      expect(SPORT_ENTITIES[sport].length).toBeGreaterThan(0);
    }
  });

  it('every entity has non-empty name, type, and feedQuery', () => {
    for (const [sport, entities] of Object.entries(SPORT_ENTITIES)) {
      for (const entity of entities) {
        expect(entity.name.trim(), `${sport} entity name`).not.toBe('');
        expect(entity.feedQuery.trim(), `${sport}/${entity.name} feedQuery`).not.toBe('');
        expect(VALID_ENTITY_TYPES, `${sport}/${entity.name} type`).toContain(entity.type);
      }
    }
  });

  // Cross-sport feedQuery uniqueness is intentionally NOT required: different sports can
  // track the same topic from different angles (e.g. "Real Madrid" in football and
  // "Real Madrid Basket" in basketball have *different* feedQuery values by design).
  // Exact-match was chosen over substring match precisely to prevent "Real Madrid" from
  // accidentally matching "Real Madrid Basket". Only per-sport uniqueness is enforced here.
  it('no two entities within the same sport share the same feedQuery', () => {
    for (const [sport, entities] of Object.entries(SPORT_ENTITIES)) {
      const queries = entities.map((e) => e.feedQuery.toLowerCase());
      const unique = new Set(queries);
      expect(unique.size, `${sport} has duplicate feedQuery`).toBe(queries.length);
    }
  });

  it('feedQuery values have no leading or trailing whitespace', () => {
    for (const [sport, entities] of Object.entries(SPORT_ENTITIES)) {
      for (const entity of entities) {
        expect(entity.feedQuery, `${sport}/${entity.name}`).toBe(entity.feedQuery.trim());
      }
    }
  });
});
