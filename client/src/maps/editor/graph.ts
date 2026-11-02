import { isStronglyConnected, withSeaHops } from 'engine';
import type { EditorTerritory as Territory } from './model/editorTypes';
import type { EditorLockedTile } from './model/lockedTiles';

const MIN_CONTINENT_SIZE = 2;
const MAX_CONTINENT_SIZE = 40;

function isStronglyLinked(
  territories: Territory[],
  lockedTiles: EditorLockedTile[],
): boolean {
  if (territories.length === 0) return true;
  const byId = new Map(territories.map((t) => [t.id, t]));
  const tileLinks = new Map<number, number[]>();
  const link = (a: number, b: number) =>
    tileLinks.set(a, [...(tileLinks.get(a) ?? []), b]);
  lockedTiles.forEach((tile, k) => {
    for (const n of tile.land) {
      if (!byId.has(n) || byId.get(n)!.isSea) continue;
      link(-1 - k, n);
      link(n, -1 - k);
    }
    for (const other of tile.tiles) link(-1 - k, -1 - other);
  });
  const nodes = territories.map((t) => ({
    id: t.id,
    neighbors: [
      ...t.neighbors,
      ...t.timed.map((m) => m.id),
      ...t.directional.filter((m) => m.out || m.backward > 0).map((m) => m.id),
      ...(tileLinks.get(t.id) ?? []),
    ],
  }));
  const seaIds = new Set(territories.filter((t) => t.isSea).map((t) => t.id));
  const edges = new Map(tileLinks);
  for (const n of withSeaHops(nodes, seaIds)) edges.set(n.id, n.neighbors);
  return isStronglyConnected(
    territories.filter((t) => !t.isSea).map((t) => t.id),
    edges,
  );
}

function invalidContinentSizes(
  territories: Territory[],
  continentCount: number,
): boolean {
  const size = new Map<number, number>();
  for (const t of territories)
    if (!t.isSea) size.set(t.continentId, (size.get(t.continentId) ?? 0) + 1);
  for (let i = 0; i < continentCount; i++) {
    const n = size.get(i) ?? 0;
    if (n < MIN_CONTINENT_SIZE || n > MAX_CONTINENT_SIZE) return true;
  }
  return false;
}

export function graphError(
  territories: Territory[],
  lockedTiles: EditorLockedTile[],
  continentCount: number,
): string | null {
  if (!isStronglyLinked(territories, lockedTiles))
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
