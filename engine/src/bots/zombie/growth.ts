import { Game } from '../../types';

export const ZOMBIE_THRESHOLD = 0.4;
const FIRST_PERCENT = 60;
const PERCENT_STEP = 15;
const MAX_PERCENT = 150;
const HALF_SHARE = 0.5;
const DOMINANT_SHARE = 0.55;
const MIN_INFECTION_CHANCE = 0.1;
export const FIRST_INFECTION_ROUND = 7;

export type ZombieGrowth =
  { type: 'percent'; percent: number } | { type: 'flat'; troops: number };

export const FIRST_GROWTH: ZombieGrowth = {
  type: 'percent',
  percent: FIRST_PERCENT,
};

export function zombieShare(game: Game): number {
  let zombieTroops = 0;
  let totalTroops = 0;
  for (const [territoryId, ownerId] of game.territoryOwners) {
    const troops = game.territoryTroops.get(territoryId) ?? 0;
    totalTroops += troops;
    if (ownerId === game.zombieId) zombieTroops += troops;
  }
  return totalTroops === 0 ? 0 : zombieTroops / totalTroops;
}

export function zombieGrowth(share: number, step: number): ZombieGrowth {
  if (share < ZOMBIE_THRESHOLD)
    return {
      type: 'percent',
      percent: Math.min(MAX_PERCENT, FIRST_PERCENT + PERCENT_STEP * step),
    };
  if (share < HALF_SHARE) return { type: 'flat', troops: 3 };
  if (share < DOMINANT_SHARE) return { type: 'flat', troops: 2 };
  return { type: 'flat', troops: 1 };
}

export function nextGrowthStep(growth: ZombieGrowth, step: number): number {
  if (growth.type === 'flat' || growth.percent >= MAX_PERCENT) return 0;
  return step + 1;
}

export function isSurge(growth: ZombieGrowth): boolean {
  return growth.type === 'percent' && growth.percent >= MAX_PERCENT;
}

export function troopsFor(growth: ZombieGrowth, current: number): number {
  return growth.type === 'flat'
    ? growth.troops
    : Math.ceil((current * growth.percent) / 100);
}

export function infectionChance(
  zombieTerritories: number,
  totalTerritories: number,
): number {
  return Math.min(
    1,
    Math.max(
      MIN_INFECTION_CHANCE,
      1 - (2 * zombieTerritories) / totalTerritories,
    ),
  );
}
