import {
  battleStatistics,
  distortProbability,
  fairBlitz,
  trueWinProb,
} from '../../game/combat/dice';
import { Game } from '../../types';

export function defenceDiceFor(game: Game, territoryId: number): number {
  if (game.capitalTerritoryIds.has(territoryId)) return 3;
  if ((game.territoryEntrenchment.get(territoryId) ?? 0) > 0) return 3;
  return game.defenceDice;
}

export function attackWinProbability(
  game: Game,
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number {
  if (attackingTroops <= 0) return 0;
  if (defendingTroops <= 0) return 1;
  if (attackingTroops > 80 && attackingTroops > defendingTroops * 3)
    return 0.99;
  const trueProb = trueWinProb(attackingTroops, defendingTroops, defendingDice);
  if (game.blitz === 'Fair') return trueProb >= 0.5 ? 1 : 0;
  if (game.blitz === 'Balanced') return distortProbability(trueProb);
  return trueProb;
}

const CONQUEST_TROOPS_MULTIPLIER = 4;
const CONQUEST_TROOPS_MARGIN = 5;

export function estimatedConquestCost(
  game: Game,
  territoryId: number,
  defendingTroops: number,
): number {
  if (defendingTroops <= 0) return 0;
  const defendingDice = defenceDiceFor(game, territoryId);
  const attackingTroopsCeiling =
    defendingTroops * CONQUEST_TROOPS_MULTIPLIER + CONQUEST_TROOPS_MARGIN;
  const stats = battleStatistics(
    attackingTroopsCeiling,
    defendingTroops,
    defendingDice,
  );
  return Math.max(0, stats.attackerTroopsNeeded - stats.attackerMean);
}

export interface ExpectedOutcome {
  winProbability: number;
  attackerSurvivorsMean: number;
}

export function expectedOutcome(
  game: Game,
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): ExpectedOutcome {
  if (attackingTroops <= 0)
    return { winProbability: 0, attackerSurvivorsMean: 0 };
  if (defendingTroops <= 0)
    return { winProbability: 1, attackerSurvivorsMean: attackingTroops };
  if (game.blitz === 'Fair') {
    const outcome = fairBlitz(attackingTroops, defendingTroops, defendingDice);
    const win = outcome.defenceLosses >= defendingTroops;
    return {
      winProbability: win ? 1 : 0,
      attackerSurvivorsMean: win ? attackingTroops - outcome.attackLosses : 0,
    };
  }
  const stats = battleStatistics(
    attackingTroops,
    defendingTroops,
    defendingDice,
  );
  return {
    winProbability:
      game.blitz === 'Balanced'
        ? distortProbability(stats.winProbability)
        : stats.winProbability,
    attackerSurvivorsMean: stats.attackerMeanAtInput,
  };
}
