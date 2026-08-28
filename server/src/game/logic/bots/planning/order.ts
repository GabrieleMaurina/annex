import { Game } from '../../../../types';
import { neighborsOf } from '../features/territory';
import { BotView } from '../view';

// Greedy reachable-cheapest-first ordering: repeatedly claim whichever
// remaining target is both reachable from the territories claimed so far and
// cheapest (fewest defenders) to take next. Not an exhaustive search over
// orderings.
export function orderTargets(
  game: Game,
  _view: BotView,
  botId: number,
  targetIds: number[],
): number[] {
  const remaining = new Set(targetIds);
  const claimed = new Set<number>();
  for (const [id, ownerId] of game.territoryOwners) {
    if (ownerId === botId) claimed.add(id);
  }

  const ordered: number[] = [];
  while (remaining.size > 0) {
    let best: number | null = null;
    let bestTroops = Infinity;
    for (const id of remaining) {
      const reachable = neighborsOf(game, id).some((n) => claimed.has(n));
      if (!reachable) continue;
      const troops = game.territoryTroops.get(id) ?? 0;
      if (troops < bestTroops) {
        bestTroops = troops;
        best = id;
      }
    }
    if (best === null) break;
    ordered.push(best);
    remaining.delete(best);
    claimed.add(best);
  }
  return ordered;
}
