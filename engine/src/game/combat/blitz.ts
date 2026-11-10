import {
  BattleStatistics,
  battleStatistics,
  boostedWinChance,
  buildBattleTables,
  distortProbability,
  EXACT_COMBAT_CAP,
  extractBattleStatistics,
  outcomeCutoff,
  outcomePower,
  rescaleStatistics,
  scaledAttackers,
  scaledTroops,
  unscaledAttackers,
  unscaledDefenders,
} from './battleStats';
import { DiceLuck, DiceRules, NO_LUCK } from './dice';
import { lossDistribution, outcomeLuck } from './lossDistribution';
import { attack } from './roll';

function battleOutcomes(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): number[] {
  const width = defendingTroops + 1;
  const states = new Float64Array((attackingTroops + 1) * width);
  const outcomes = new Array<number>(attackingTroops + defendingTroops).fill(0);
  states[attackingTroops * width + defendingTroops] = 1;
  for (let a = attackingTroops; a >= 1; a--) {
    for (let d = defendingTroops; d >= 1; d--) {
      const probability = states[a * width + d];
      if (probability === 0) continue;
      for (const outcome of lossDistribution(
        Math.min(a, dice.attack),
        Math.min(d, dice.defence),
        dice,
      )) {
        const na = a - outcome.attackLosses;
        const nd = d - outcome.defenceLosses;
        const p = probability * outcome.probability;
        if (nd === 0) outcomes[attackingTroops - na] += p;
        else if (na === 0) outcomes[attackingTroops + nd - 1] += p;
        else states[na * width + nd] += p;
      }
    }
  }
  return outcomes;
}

function scaleRange(
  values: number[],
  start: number,
  end: number,
  target: number,
): void {
  let sum = 0;
  for (let i = start; i < end; i++) sum += values[i];
  for (let i = start; i < end; i++)
    values[i] = sum > 0 ? (values[i] / sum) * target : 0;
}

function trimOutcomes(outcomes: number[], from: number, step: number): void {
  let cut = 0;
  for (let i = from; i >= 0 && i < outcomes.length; i += step) {
    cut += outcomes[i];
    if (cut > outcomeCutoff) {
      outcomes[i] = cut - outcomeCutoff;
      return;
    }
    outcomes[i] = 0;
  }
}

function balanceOutcomes(outcomes: number[], wins: number): number[] {
  const balanced = [...outcomes];
  let winChance = 0;
  for (let i = 0; i < wins; i++) winChance += balanced[i];
  const boosted = boostedWinChance(winChance);
  scaleRange(balanced, 0, wins, boosted);
  scaleRange(balanced, wins, balanced.length, 1 - boosted);
  trimOutcomes(balanced, 0, 1);
  trimOutcomes(balanced, balanced.length - 1, -1);
  const balancedWinChance = distortProbability(winChance);
  for (let i = 0; i < balanced.length; i++)
    balanced[i] = balanced[i] ** outcomePower;
  scaleRange(balanced, 0, wins, balancedWinChance);
  scaleRange(balanced, wins, balanced.length, 1 - balancedWinChance);
  return balanced;
}

function balancedBlitzOutcomes(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number; probability: number }[] {
  const scaled = scaledTroops(
    attackingTroops,
    defendingTroops,
    dice,
    EXACT_COMBAT_CAP,
  );
  const wins = scaled.attackingTroops;
  const outcomes = balanceOutcomes(
    battleOutcomes(scaled.attackingTroops, scaled.defendingTroops, dice),
    wins,
  );
  return outcomes.map((probability, i) =>
    i < wins
      ? {
          attackLosses: Math.min(
            attackingTroops - 1,
            Math.max(
              0,
              Math.round(unscaledAttackers(i, defendingTroops, scaled)),
            ),
          ),
          defenceLosses: defendingTroops,
          probability,
        }
      : {
          attackLosses: attackingTroops,
          defenceLosses: Math.min(
            defendingTroops - 1,
            Math.max(
              0,
              Math.round(
                unscaledDefenders(
                  outcomes.length - 1 - i,
                  attackingTroops,
                  scaled.attackingTroops,
                  scaled,
                ),
              ),
            ),
          ),
          probability,
        },
  );
}

export function balancedBlitz(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number; luck: DiceLuck } {
  const outcomes = balancedBlitzOutcomes(
    attackingTroops,
    defendingTroops,
    dice,
  );
  let remaining =
    Math.random() *
    outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  let chosen = outcomes[0];
  for (const outcome of outcomes) {
    if (outcome.probability === 0) continue;
    chosen = outcome;
    remaining -= outcome.probability;
    if (remaining < 0) break;
  }
  return {
    attackLosses: chosen.attackLosses,
    defenceLosses: chosen.defenceLosses,
    luck: outcomeLuck(outcomes, chosen.attackLosses, chosen.defenceLosses),
  };
}

export function trueBlitz(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number; luck: DiceLuck } {
  let remainingAttackers = attackingTroops;
  let remainingDefenders = defendingTroops;
  let surplus = 0;
  let variance = 0;

  while (remainingAttackers > 0 && remainingDefenders > 0) {
    const result = attack(
      Math.min(remainingAttackers, dice.attack),
      Math.min(remainingDefenders, dice.defence),
      dice,
    );
    remainingAttackers -= result.attackLosses;
    remainingDefenders -= result.defenceLosses;
    surplus += result.luck.surplus;
    variance += result.luck.variance;
  }

  return {
    attackLosses: attackingTroops - remainingAttackers,
    defenceLosses: defendingTroops - remainingDefenders,
    luck: { surplus, variance },
  };
}

function fairBlitzFromStats(
  attackingTroops: number,
  defendingTroops: number,
  stats: BattleStatistics,
): { attackLosses: number; defenceLosses: number } {
  const winProbability = stats.winProbability;
  if (winProbability >= 0.5) {
    const expectedAttackLosses =
      winProbability * (attackingTroops - stats.attackerMeanAtInput) +
      (1 - winProbability) * attackingTroops;
    return {
      attackLosses: Math.min(
        Math.round(expectedAttackLosses),
        attackingTroops - 1,
      ),
      defenceLosses: defendingTroops,
    };
  }
  const expectedDefenceLosses =
    winProbability * defendingTroops +
    (1 - winProbability) * (defendingTroops - stats.defenderMean);
  return {
    attackLosses: attackingTroops,
    defenceLosses: Math.min(
      Math.round(expectedDefenceLosses),
      defendingTroops - 1,
    ),
  };
}

export function fairBlitz(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number; luck: DiceLuck } {
  const stats = battleStatistics(attackingTroops, defendingTroops, dice);
  return {
    ...fairBlitzFromStats(attackingTroops, defendingTroops, stats),
    luck: NO_LUCK,
  };
}

export function fairBlitzOutcomes(
  maxAttackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number }[] {
  if (maxAttackingTroops <= 0) return [];
  const scaled = scaledTroops(
    maxAttackingTroops,
    defendingTroops,
    dice,
    EXACT_COMBAT_CAP,
  );
  const tables = buildBattleTables(
    scaled.attackingTroops,
    scaled.defendingTroops,
    dice,
  );
  return Array.from({ length: maxAttackingTroops }, (_, i) => {
    const attackingTroops = i + 1;
    const scaledAttackingTroops = Math.max(
      1,
      Math.min(
        scaled.attackingTroops,
        scaledAttackers(attackingTroops, defendingTroops, scaled),
      ),
    );
    const stats = extractBattleStatistics(
      tables,
      scaledAttackingTroops,
      scaled.defendingTroops,
    );
    const rescaled = rescaleStatistics(
      stats,
      scaled,
      attackingTroops,
      scaledAttackingTroops,
      defendingTroops,
    );
    return fairBlitzFromStats(attackingTroops, defendingTroops, rescaled);
  });
}
