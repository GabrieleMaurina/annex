import { Game } from '../../types';
import { neighborsOf } from '../features/territory';

interface ZombieAttack {
  startId: number;
  endId: number;
}

export function troopsOn(game: Game, territoryId: number): number {
  return game.territoryTroops.get(territoryId) ?? 0;
}

function bestTargets(
  game: Game,
  startId: number,
  neighbors: number[],
): number[] {
  const zombieId = game.zombieId;
  const stack = troopsOn(game, startId);
  let best: number[] = [];
  let bestTroops = -1;
  for (const id of neighbors) {
    const ownerId = game.territoryOwners.get(id);
    if (ownerId === undefined || ownerId === zombieId) continue;
    const troops = troopsOn(game, id);
    if (troops * 2 > stack) continue;
    if (troops > bestTroops) {
      best = [id];
      bestTroops = troops;
    } else if (troops === bestTroops) best.push(id);
  }
  return best;
}

export function pickZombieAttack(game: Game): ZombieAttack | null {
  const zombieId = game.zombieId;
  if (zombieId === null) return null;
  const starts = [...game.territoryOwners]
    .filter(([id, ownerId]) => ownerId === zombieId && troopsOn(game, id) >= 2)
    .map(([id]) => id)
    .sort((a, b) => troopsOn(game, b) - troopsOn(game, a) || a - b);
  for (const startId of starts) {
    const targets = bestTargets(game, startId, neighborsOf(game, startId));
    if (targets.length > 0)
      return {
        startId,
        endId: targets[Math.floor(Math.random() * targets.length)],
      };
  }
  return null;
}
