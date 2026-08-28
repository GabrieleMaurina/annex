import { Game } from '../../../../types';
import { battleStatistics, trueWinProb } from '../../combat/dice';

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

export interface ExpectedOutcome {
  winProbability: number;
  attackerSurvivorsMean: number;
}

// Expected attacker survivors when attacking with exactly attackingTroops and
// winning, using the same analytical DP the client's win-odds display and
// balancedBlitz already rely on (no simulation).
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
