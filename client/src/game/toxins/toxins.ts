import type { GameState } from '../../lib/types';
import type { Territory } from '../mapData';
import { withPortalEdges } from '../portals';

type OwnerById = Map<number, GameState['territories'][number]>;

export function toxinsCost(
  toxinsSetting: GameState['toxins'],
  cards: GameState['cards'],
  nextSetBaseValues: GameState['nextSetBaseValues'],
): number {
  if (toxinsSetting === 'off') return Infinity;
  if (cards === 'Constant') return toxinsSetting === 'temporary' ? 5 : 10;
  return Math.ceil(
    nextSetBaseValues.mixed * (toxinsSetting === 'temporary' ? 0.25 : 0.5),
  );
}

export function wouldSplitMap(
  territories: Territory[],
  blockedById: Set<number>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  candidateTerritoryId: number,
): boolean {
  const removed = new Set(blockedById);
  removed.add(candidateTerritoryId);
  const remaining = territories.filter((t) => !removed.has(t.id));
  if (remaining.length === 0) return false;

  const remainingIds = new Set(remaining.map((t) => t.id));
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const visited = new Set<number>([remaining[0].id]);
  const stack = [remaining[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const territory = territoryById.get(id)!;
    const neighbors = withPortalEdges(
      territory.neighbors,
      id,
      portalTerritoryIds,
      portalsEnabled,
    );
    for (const n of neighbors) {
      if (!remainingIds.has(n) || visited.has(n)) continue;
      visited.add(n);
      stack.push(n);
    }
  }
  return visited.size !== remaining.length;
}

export function getToxinsCandidates(
  territories: Territory[],
  ownerById: OwnerById,
  selfId: number | null,
  cost: number,
  blockedById: Set<number>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
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
      wouldSplitMap(
        territories,
        blockedById,
        portalTerritoryIds,
        portalsEnabled,
        t.id,
      )
    )
      continue;
    candidates.add(t.id);
  }
  return candidates;
}
