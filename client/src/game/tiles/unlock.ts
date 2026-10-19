import type { GameState, LockedTile } from '../../lib/types';

type OwnerById = Map<number, GameState['territories'][number]>;

export function unlockCost(
  cards: GameState['cards'],
  nextSetBaseValues: GameState['nextSetBaseValues'],
): number {
  if (cards === 'constant' || cards === 'off') return 5;
  return Math.ceil(nextSetBaseValues.mixed * 0.25);
}

export function unlockSources(
  closedTiles: LockedTile[],
  ownerById: OwnerById,
  selfId: number | null,
  cost: number,
): Set<number> {
  return new Set(
    closedTiles
      .flatMap((tile) => tile.neighbors)
      .filter((id) => {
        const owner = ownerById.get(id);
        return owner?.ownerId === selfId && owner.troops >= cost + 1;
      }),
  );
}

export function unlockTargets(
  closedTiles: LockedTile[],
  sources: Set<number>,
  startId: number | null,
): LockedTile[] {
  return closedTiles.filter((tile) =>
    startId === null
      ? tile.neighbors.some((id) => sources.has(id))
      : sources.has(startId) && tile.neighbors.includes(startId),
  );
}

export function tileAt(
  tiles: LockedTile[],
  x: number,
  y: number,
): LockedTile | null {
  return (
    tiles.find(({ points }) => {
      let inside = false;
      points.forEach(([ax, ay], k) => {
        const [bx, by] = points[(k + 1) % points.length];
        if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay))
          inside = !inside;
      });
      return inside;
    }) ?? null
  );
}
