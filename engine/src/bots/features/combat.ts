import { battleStatistics, trueWinProb } from '../../game/combat/dice';
import { Game } from '../../types';

export function defenceDiceFor(game: Game, territoryId: number): number {
  if (game.capitalTerritoryIds.has(territoryId)) return 3;
  if ((game.territoryEntrenchment.get(territoryId) ?? 0) > 0) return 3;
  return game.defenceDice;
}

export function attackWinProbability(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number {
  if (attackingTroops <= 0) return 0;
  if (defendingTroops <= 0) return 1;
  return trueWinProb(attackingTroops, defendingTroops, defendingDice);
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
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): ExpectedOutcome {
  if (attackingTroops <= 0)
    return { winProbability: 0, attackerSurvivorsMean: 0 };
  if (defendingTroops <= 0)
    return { winProbability: 1, attackerSurvivorsMean: attackingTroops };
  const stats = battleStatistics(
    attackingTroops,
    defendingTroops,
    defendingDice,
  );
  return {
    winProbability: stats.winProbability,
    attackerSurvivorsMean: stats.attackerMeanAtInput,
  };
}
