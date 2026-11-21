import { Game } from '../../types';
import { troopsFor, zombieGrowth, ZombieGrowth, zombieShare } from './growth';

interface CachedGrowth {
  roundNumber: number;
  turnPlayerIndex: number;
  growth: ZombieGrowth;
}

const growthCaches = new WeakMap<Game, CachedGrowth>();

function upcomingGrowth(game: Game): ZombieGrowth {
  const cached = growthCaches.get(game);
  if (
    cached &&
    cached.roundNumber === game.roundNumber &&
    cached.turnPlayerIndex === game.turnPlayerIndex
  )
    return cached.growth;
  const growth = zombieGrowth(zombieShare(game), game.zombieGrowthStep);
  growthCaches.set(game, {
    roundNumber: game.roundNumber,
    turnPlayerIndex: game.turnPlayerIndex,
    growth,
  });
  return growth;
}

export function grownStack(game: Game, stack: number): number {
  return stack + troopsFor(upcomingGrowth(game), stack);
}

export function zombieThreat(game: Game, stack: number): number {
  return Math.floor(grownStack(game, stack) / 2) + 1;
}
