import { isStronglyConnected, withSeaHops } from 'engine';
import type { EditorTerritory as Territory } from './model/editorTypes';

const MIN_CONTINENT_SIZE = 2;
const MAX_CONTINENT_SIZE = 40;

function isStronglyLinked(territories: Territory[]): boolean {
  if (territories.length === 0) return true;
  const nodes = territories.map((t) => ({
    id: t.id,
    neighbors: [
      ...t.neighbors,
      ...t.timed.map((m) => m.id),
      ...t.directional.filter((m) => m.out || m.backward > 0).map((m) => m.id),
    ],
  }));
  const seaIds = new Set(territories.filter((t) => t.isSea).map((t) => t.id));
  const edges = new Map(
    withSeaHops(nodes, seaIds).map((n) => [n.id, n.neighbors]),
  );
  return isStronglyConnected(
    territories.filter((t) => !t.isSea && !t.locked).map((t) => t.id),
    edges,
  );
}

function invalidContinentSizes(
  territories: Territory[],
  continentCount: number,
): boolean {
  const size = new Map<number, number>();
  for (const t of territories)
    if (!t.isSea && !t.locked)
      size.set(t.continentId, (size.get(t.continentId) ?? 0) + 1);
  for (let i = 0; i < continentCount; i++) {
    const n = size.get(i) ?? 0;
    if (n < MIN_CONTINENT_SIZE || n > MAX_CONTINENT_SIZE) return true;
  }
  return false;
}

export function graphError(
  territories: Territory[],
  continentCount: number,
): string | null {
  const seaIds = new Set(territories.filter((t) => t.isSea).map((t) => t.id));
  if (
    territories.some(
      (t) =>
        t.locked &&
        (t.timed.length > 0 ||
          t.directional.length > 0 ||
          t.wraps.length > 0 ||
          t.neighbors.some((n) => seaIds.has(n))),
    )
  )
    return 'Unlockable tiles can only have normal links to land territories and other unlockable tiles.';
  if (!isStronglyLinked(territories))
    return 'Every territory must be able to reach every other territory.';
  if (territories.some((t) => t.isSea && t.timed.length > 0))
    return 'Timed links can only connect two land territories.';
  if (territories.some((t) => t.isSea && t.directional.length > 0))
    return 'Directional links can only connect two land territories.';
  const landIds = new Set(territories.filter((t) => !t.isSea).map((t) => t.id));
  if (
    territories.some((t) => t.isSea && !t.neighbors.some((n) => landIds.has(n)))
  )
    return 'Every sea must border a land territory.';
  if (invalidContinentSizes(territories, continentCount))
    return `Each continent must have ${MIN_CONTINENT_SIZE}-${MAX_CONTINENT_SIZE} territories.`;
  return null;
}
