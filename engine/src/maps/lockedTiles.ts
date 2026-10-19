import { LockedTile, Territory } from '../types';

export function withUnlockedTiles(
  territories: Territory[],
  lockedTiles: LockedTile[],
  unlockedIds: ReadonlySet<number>,
): Territory[] {
  const unlocked = lockedTiles.filter((tile) => unlockedIds.has(tile.id));
  if (unlocked.length === 0) return territories;
  const lockedIds = new Set(lockedTiles.map((tile) => tile.id));
  const isOpen = (id: number) => !lockedIds.has(id) || unlockedIds.has(id);
  const extra = new Map<number, number[]>();
  for (const tile of unlocked) {
    for (const n of tile.neighbors) {
      if (!lockedIds.has(n)) extra.set(n, [...(extra.get(n) ?? []), tile.id]);
    }
  }
  return [
    ...territories.map((t) => {
      const added = extra.get(t.id);
      return added ? { ...t, neighbors: [...t.neighbors, ...added] } : t;
    }),
    ...unlocked.map((tile) => ({
      id: tile.id,
      continentId: -1,
      x: tile.x,
      y: tile.y,
      neighbors: tile.neighbors.filter(isOpen),
    })),
  ];
}
