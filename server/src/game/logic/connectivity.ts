import { maps } from '../../maps';
import { Game } from '../../types';
import { withPortalEdges } from './portals';

export function wouldSplitMap(
  game: Game,
  removedIds: Set<number>,
  candidateTerritoryId: number,
): boolean {
  const map = maps.get(game.mapName)!;
  const removed = new Set(removedIds);
  removed.add(candidateTerritoryId);
  const remaining = map.territories.filter((t) => !removed.has(t.id));
  if (remaining.length === 0) return false;

  const remainingIds = new Set(remaining.map((t) => t.id));
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  const visited = new Set<number>([remaining[0].id]);
  const stack = [remaining[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const territory = territoryById.get(id)!;
    const neighbors = withPortalEdges(
      territory.neighbors,
      id,
      game.portalTerritoryIds,
      game.portalsEnabled,
    );
    for (const n of neighbors) {
      if (!remainingIds.has(n) || visited.has(n)) continue;
      visited.add(n);
      stack.push(n);
    }
  }
  return visited.size !== remaining.length;
}
