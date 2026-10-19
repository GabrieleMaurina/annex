import { withUnlockedTiles } from 'engine';
import type { GameState, LockedTile } from '../../lib/types';
import type { SeaTerritory, Territory } from '../mapData';
import { withPortalEdges } from '../portals';

type OwnerById = Map<number, GameState['territories'][number]>;

export function toxinsCost(
  toxinsSetting: GameState['toxins'],
  cards: GameState['cards'],
  nextSetBaseValues: GameState['nextSetBaseValues'],
): number {
  if (toxinsSetting === 'off') return Infinity;
  if (cards === 'constant' || cards === 'off')
    return toxinsSetting === 'temporary' ? 5 : 10;
  return Math.ceil(
    nextSetBaseValues.mixed * (toxinsSetting === 'temporary' ? 0.25 : 0.5),
  );
}

export function wouldSplitMap(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  blockedById: Set<number>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  closedTiles: LockedTile[],
  candidateTerritoryId: number,
): boolean {
  const removed = new Set(blockedById);
  removed.add(candidateTerritoryId);
  const remaining = territories.filter((t) => !removed.has(t.id));
  if (remaining.length === 0) return false;

  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const shoresBySea = new Map(
    seaTerritories.map((t) => [
      t.id,
      t.neighbors.filter((n) => !seaIds.has(n)),
    ]),
  );
  const neighborsById = new Map(
    withUnlockedTiles(
      territories,
      closedTiles,
      new Set(closedTiles.map((tile) => tile.id)),
    ).map((t) => [t.id, t.neighbors]),
  );
  const visited = new Set<number>([remaining[0].id]);
  const stack = [remaining[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const neighbors = withPortalEdges(
      neighborsById.get(id)!,
      id,
      portalTerritoryIds,
      portalsEnabled,
    ).flatMap((n) => shoresBySea.get(n) ?? [n]);
    for (const n of neighbors) {
      if (removed.has(n) || visited.has(n)) continue;
      visited.add(n);
      stack.push(n);
    }
  }
  return remaining.some((t) => !visited.has(t.id));
}

export function getToxinsCandidates(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  ownerById: OwnerById,
  selfId: number | null,
  cost: number,
  blockedById: Set<number>,
  upcomingBlockedById: Set<number>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  closedTiles: LockedTile[],
): Set<number> {
  const candidates = new Set<number>();
  const ownedCount = territories.filter(
    (t) => ownerById.get(t.id)?.ownerId === selfId,
  ).length;
  if (ownedCount <= 1) return candidates;
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId) continue;
    if (owner.isCapital) continue;
    if (owner.troops < cost) continue;
    if (
      [blockedById, upcomingBlockedById].some((blocked) =>
        wouldSplitMap(
          territories,
          seaTerritories,
          blocked,
          portalTerritoryIds,
          portalsEnabled,
          closedTiles,
          t.id,
        ),
      )
    )
      continue;
    candidates.add(t.id);
  }
  return candidates;
}
