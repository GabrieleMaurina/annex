import {
  addTroopsCapped,
  deployTargetIds,
  ownedTerritoryIds,
} from '../../game/mechanics';
import { emitDeployedMany } from '../../game/progression/autoDeploy';
import { bumpStat } from '../../game/progression/stats';
import { recordReplayFrame } from '../../game/replay';
import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import {
  FIRST_GROWTH,
  FIRST_INFECTION_ROUND,
  infectionChance,
  isSurge,
  nextGrowthStep,
  troopsFor,
  ZOMBIE_THRESHOLD,
  zombieGrowth,
  ZombieGrowth,
  zombieShare,
} from './growth';
import { infectEveryone, infectOne } from './infect';

function infect(game: Game, firstTurn: boolean, share: number): number[] {
  if (firstTurn) return infectEveryone(game);
  const zombieCount = ownedTerritoryIds(game, game.zombieId!).length;
  const outbreak =
    game.roundNumber >= FIRST_INFECTION_ROUND &&
    share < ZOMBIE_THRESHOLD &&
    Math.random() <
      infectionChance(zombieCount, getGameMap(game).territories.length);
  if (zombieCount > 0 && !outbreak) return [];
  const territoryId = infectOne(game, zombieCount === 0);
  return territoryId === null ? [] : [territoryId];
}

export function deployZombies(game: Game): void {
  const zombieId = game.zombieId!;
  const firstTurn =
    game.roundNumber === 0 && ownedTerritoryIds(game, zombieId).length > 0;
  const share = zombieShare(game);
  const infected = infect(game, firstTurn, share);
  const growth: ZombieGrowth = firstTurn
    ? FIRST_GROWTH
    : zombieGrowth(share, game.zombieGrowthStep);
  const targets = deployTargetIds(game, zombieId);
  const recipients = firstTurn
    ? targets.filter((id) => infected.includes(id))
    : targets;
  const deposits = new Map<number, number>();
  for (const territoryId of recipients) {
    const added = addTroopsCapped(
      game,
      territoryId,
      troopsFor(growth, game.territoryTroops.get(territoryId) ?? 0),
    );
    if (added > 0) deposits.set(territoryId, added);
  }
  game.zombieGrowthStep = firstTurn
    ? 1
    : nextGrowthStep(growth, game.zombieGrowthStep);
  if (deposits.size === 0) return;
  bumpStat(
    game,
    zombieId,
    'troopsGained',
    [...deposits.values()].reduce((sum, troops) => sum + troops, 0),
  );
  const surge = isSurge(growth);
  recordReplayFrame(game, {
    type: 'deployMany',
    deposits: [...deposits].map(([territoryId, troops]) => ({
      territoryId,
      troops,
    })),
    playerId: zombieId,
    ...(surge ? { surge } : {}),
  });
  emitDeployedMany(game, zombieId, deposits, surge);
}
