import { describe, it, expect } from 'vitest';
import { getSourceIdsForEntities } from '../utils/entities';
import type { SportEntity } from '../constants';

const mockSources = [
  { id: 'src-1', name: 'Google News: Real Madrid' },
  { id: 'src-2', name: 'Google News: Real Madrid Basket' },
  { id: 'src-3', name: 'Google News: Carlos Alcaraz' },
  { id: 'src-4', name: 'Google News: FC Barcelona' },
];

describe('getSourceIdsForEntities', () => {
  it('returns empty array when selectedEntities is empty', () => {
    expect(getSourceIdsForEntities(mockSources, [])).toEqual([]);
  });

  it('returns empty array when no catalog source name matches', () => {
    const entities: SportEntity[] = [{ name: 'Nonexistent', type: 'team', feedQuery: 'Nonexistent Source' }];
    expect(getSourceIdsForEntities(mockSources, entities)).toEqual([]);
  });

  it('returns correct IDs for exact name matches (case-insensitive)', () => {
    const entities: SportEntity[] = [
      { name: 'Carlos Alcaraz', type: 'athlete', feedQuery: 'Google News: Carlos Alcaraz' },
    ];
    expect(getSourceIdsForEntities(mockSources, entities)).toEqual(['src-3']);
  });

  it('does NOT return Real Madrid Basket when entity feedQuery is exactly Real Madrid', () => {
    const entities: SportEntity[] = [
      { name: 'Real Madrid', type: 'team', feedQuery: 'Google News: Real Madrid' },
    ];
    const result = getSourceIdsForEntities(mockSources, entities);
    expect(result).toContain('src-1');
    expect(result).not.toContain('src-2'); // must NOT include Real Madrid Basket
  });

  it('handles multiple entities and deduplicates', () => {
    const entities: SportEntity[] = [
      { name: 'Real Madrid', type: 'team', feedQuery: 'Google News: Real Madrid' },
      { name: 'FC Barcelona', type: 'team', feedQuery: 'Google News: FC Barcelona' },
    ];
    const result = getSourceIdsForEntities(mockSources, entities);
    expect(result).toHaveLength(2);
    expect(result).toContain('src-1');
    expect(result).toContain('src-4');
  });
});
