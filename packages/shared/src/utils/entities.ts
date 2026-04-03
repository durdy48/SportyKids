import type { SportEntity } from '../constants';

export interface FeedSource {
  id: string;
  name: string;
}

/**
 * Returns the IDs of catalog sources that exactly match the given entities by name.
 * feedQuery values are exact RSS source names (case-insensitive ===).
 */
export function getSourceIdsForEntities(
  catalogSources: FeedSource[],
  selectedEntities: SportEntity[]
): string[] {
  if (selectedEntities.length === 0) return [];
  const querySet = new Set(selectedEntities.map((e) => e.feedQuery.toLowerCase()));
  return catalogSources
    .filter((source) => querySet.has(source.name.toLowerCase()))
    .map((source) => source.id);
}
