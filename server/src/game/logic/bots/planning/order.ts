import { Game } from '../../../../types';
import { estimatedConquestCost } from '../features/combat';
import { isTeammate } from '../features/mode';
import { isHazardTerritory, neighborsOf } from '../features/territory';
import { BotView, ownerOf, troopsAt } from '../view';

interface ReachInfo {
  cost: number;
  prev: number | null;
}

function isPassable(
  game: Game,
  view: BotView,
  botId: number,
  territoryId: number,
): boolean {
  const ownerId = ownerOf(game, view, territoryId);
  if (ownerId !== undefined && isTeammate(game, botId, ownerId)) return false;
  return !isHazardTerritory(game, view, territoryId);
}

// Multi-source Dijkstra from the bot's claimed territories to every
// reachable, passable territory. Edge weight is estimatedConquestCost, the
// expected troops sacrificed taking that territory (folding in its defender
// count, defence dice, capitals and entrenchment), so `cost` ends up being
// the cheapest total troop expenditure of any path into that territory
// (whether it's a goal or just a stepping stone toward one).
function reachCosts(
  game: Game,
  view: BotView,
  botId: number,
  claimed: Set<number>,
): Map<number, ReachInfo> {
  const info = new Map<number, ReachInfo>();
  const visited = new Set<number>();
  const frontier: number[] = [];
  for (const id of claimed) {
    info.set(id, { cost: 0, prev: null });
    frontier.push(id);
  }
  const costCache = new Map<number, number>();
  const costOf = (territoryId: number): number => {
    let cost = costCache.get(territoryId);
    if (cost === undefined) {
      cost = estimatedConquestCost(
        game,
        territoryId,
        troopsAt(game, view, territoryId),
      );
      costCache.set(territoryId, cost);
    }
    return cost;
  };

  while (frontier.length > 0) {
    frontier.sort(
      (a, b) =>
        (info.get(a)?.cost ?? Infinity) - (info.get(b)?.cost ?? Infinity),
    );
    const current = frontier.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const n of neighborsOf(game, current)) {
      if (claimed.has(n) || visited.has(n)) continue;
      if (!isPassable(game, view, botId, n)) continue;

      const cost = (info.get(current)?.cost ?? Infinity) + costOf(n);
      if (cost < (info.get(n)?.cost ?? Infinity)) {
        info.set(n, { cost, prev: current });
        frontier.push(n);
      }
    }
  }
  return info;
}

function pathTo(
  info: Map<number, ReachInfo>,
  claimed: Set<number>,
  targetId: number,
): number[] | null {
  if (!info.has(targetId)) return null;
  const path: number[] = [];
  let node: number | null = targetId;
  while (node !== null && !claimed.has(node)) {
    path.unshift(node);
    node = info.get(node)?.prev ?? null;
  }
  return path;
}

// Cheapest-path-first ordering: at every step, pathfind from the territory
// claimed so far to every remaining target, and commit to whichever target
// has the cheapest total troop-expenditure path (which may run through
// territory outside the goal itself, e.g. crossing a third player to reach
// a continent). Repeats until every target is claimed or none are
// reachable. Not an exhaustive search over full campaign orderings, but
// every individual step is a real shortest-path result, not a
// nearest-neighbor guess.
export function orderTargets(
  game: Game,
  view: BotView,
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
    const info = reachCosts(game, view, botId, claimed);

    let bestPath: number[] | null = null;
    let bestCost = Infinity;
    for (const targetId of remaining) {
      const cost = info.get(targetId)?.cost;
      if (cost === undefined || cost >= bestCost) continue;
      const path = pathTo(info, claimed, targetId);
      if (path === null || path.length === 0) continue;
      bestCost = cost;
      bestPath = path;
    }
    if (bestPath === null) break;

    for (const id of bestPath) {
      ordered.push(id);
      claimed.add(id);
      remaining.delete(id);
    }
  }
  return ordered;
}
