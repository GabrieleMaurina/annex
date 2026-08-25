import { maps } from '../../../maps';
import { Game } from '../../../types';
import { withPortalEdges } from '../portals';
import { nextSetBaseValues } from '../progression/cards';

export function toxinsCost(game: Game, playerId: number): number {
  if (game.toxins === 'off') return Infinity;
  if (game.cards === 'Constant') return game.toxins === 'temporary' ? 5 : 10;
  const base = nextSetBaseValues(game, playerId).mixed;
  return Math.ceil(base * (game.toxins === 'temporary' ? 0.25 : 0.5));
}

export function isFreeConquestTarget(game: Game, territoryId: number): boolean {
  return (
    !game.territoryOwners.has(territoryId) &&
    !game.territoryToxins.has(territoryId)
  );
}

export function wouldSplitMap(
  game: Game,
  candidateTerritoryId: number,
): boolean {
  const map = maps.get(game.mapName)!;
  const removed = new Set(game.territoryToxins.keys());
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

export function decrementToxinsGlobally(game: Game): number[] {
  const expired: number[] = [];
  for (const [territoryId, toxin] of [...game.territoryToxins]) {
    if (toxin.permanent) continue;
    if (toxin.turnsRemaining <= 1) {
      game.territoryToxins.delete(territoryId);
      expired.push(territoryId);
    } else {
      game.territoryToxins.set(territoryId, {
        ...toxin,
        turnsRemaining: toxin.turnsRemaining - 1,
      });
    }
  }
  return expired;
}
