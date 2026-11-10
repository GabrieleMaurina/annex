import { DiceRules } from './dice';
import { expectedRollLosses, lossDistribution } from './lossDistribution';

export const EXACT_COMBAT_CAP = 200;

export interface ScaledTroops {
  attackingTroops: number;
  defendingTroops: number;
  lossRatio: number;
  spread: number;
}

export function scaledAttackers(
  attackingTroops: number,
  defendingTroops: number,
  scaled: ScaledTroops,
): number {
  return Math.round(
    scaled.lossRatio * scaled.defendingTroops +
      (attackingTroops - scaled.lossRatio * defendingTroops) / scaled.spread,
  );
}

export function unscaledAttackers(
  scaledTroops: number,
  defendingTroops: number,
  scaled: ScaledTroops,
): number {
  return (
    scaled.lossRatio * defendingTroops +
    (scaledTroops - scaled.lossRatio * scaled.defendingTroops) * scaled.spread
  );
}

export function unscaledDefenders(
  scaledTroops: number,
  attackingTroops: number,
  scaledAttackingTroops: number,
  scaled: ScaledTroops,
): number {
  return (
    (attackingTroops -
      (scaledAttackingTroops - scaled.lossRatio * scaledTroops) *
        scaled.spread) /
    scaled.lossRatio
  );
}

export function scaledTroops(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
  cap: number,
): ScaledTroops {
  if (
    (attackingTroops <= cap && defendingTroops <= cap) ||
    defendingTroops === 0
  )
    return { attackingTroops, defendingTroops, lossRatio: 1, spread: 1 };
  const { attackLosses, defenceLosses } = expectedRollLosses(dice);
  const lossRatio = attackLosses / defenceLosses;
  const lead =
    (attackingTroops - lossRatio * defendingTroops) /
    Math.sqrt(defendingTroops);
  const root =
    (Math.sqrt(lead * lead + 4 * lossRatio * cap) - lead) / (2 * lossRatio);
  const scaledDefenders = Math.max(
    1,
    Math.min(defendingTroops, cap, Math.floor(root * root)),
  );
  const scaled = {
    attackingTroops,
    defendingTroops: scaledDefenders,
    lossRatio,
    spread: Math.sqrt(defendingTroops / scaledDefenders),
  };
  return {
    ...scaled,
    attackingTroops: Math.min(
      cap,
      Math.max(1, scaledAttackers(attackingTroops, defendingTroops, scaled)),
    ),
  };
}

function winProbTable(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): number[][] {
  const table: number[][] = Array.from({ length: attackingTroops + 1 }, () =>
    new Array(defendingTroops + 1).fill(0),
  );
  for (let a = 0; a <= attackingTroops; a++) table[a][0] = 1;

  for (let a = 1; a <= attackingTroops; a++) {
    for (let d = 1; d <= defendingTroops; d++) {
      const attackerDiceCount = Math.min(a, dice.attack);
      const defenderDiceCount = Math.min(d, dice.defence);
      let probability = 0;
      for (const outcome of lossDistribution(
        attackerDiceCount,
        defenderDiceCount,
        dice,
      )) {
        probability +=
          outcome.probability *
          table[a - outcome.attackLosses][d - outcome.defenceLosses];
      }
      table[a][d] = probability;
    }
  }

  return table;
}

export function trueWinProb(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): number {
  const scaled = scaledTroops(
    attackingTroops,
    defendingTroops,
    dice,
    EXACT_COMBAT_CAP,
  );
  return winProbTable(scaled.attackingTroops, scaled.defendingTroops, dice)[
    scaled.attackingTroops
  ][scaled.defendingTroops];
}

export function trueWinProbs(
  maxAttackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): number[] {
  const scaled = scaledTroops(
    maxAttackingTroops,
    defendingTroops,
    dice,
    EXACT_COMBAT_CAP,
  );
  const table = winProbTable(
    scaled.attackingTroops,
    scaled.defendingTroops,
    dice,
  );
  if (scaled.spread === 1)
    return table.slice(1).map((row) => row[defendingTroops]);
  return Array.from({ length: maxAttackingTroops }, (_, i) => {
    const a = Math.max(
      1,
      Math.min(
        scaled.attackingTroops,
        scaledAttackers(i + 1, defendingTroops, scaled),
      ),
    );
    return table[a][scaled.defendingTroops];
  });
}

export function balancedWinProb(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): number {
  return distortProbability(
    trueWinProb(attackingTroops, defendingTroops, dice),
  );
}

export function balancedWinProbs(
  maxAttackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): number[] {
  return trueWinProbs(maxAttackingTroops, defendingTroops, dice).map(
    distortProbability,
  );
}

const winChanceCutoff = 0.05;
const winChancePower = 1.3;
export const outcomeCutoff = 0.1;
export const outcomePower = 1.8;
const winGuaranteedOdds = (1 / outcomeCutoff - 1) ** (1 / winChancePower);
const winGuaranteedProbability = winGuaranteedOdds / (1 + winGuaranteedOdds);

export interface BattleTables {
  winProbabilityTable: number[][];
  attackerWinSum: number[][];
  attackerWinSumSquares: number[][];
  defenderWinSum: number[][];
}

export interface BattleStatistics {
  winProbability: number;
  attackerTroopsNeeded: number;
  attackerMean: number;
  defenderMean: number;
  attackerMeanAtInput: number;
  attackerVarianceAtInput: number;
}

export function buildBattleTables(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): BattleTables {
  const makeTable = () =>
    Array.from({ length: attackingTroops + 1 }, () =>
      new Array(defendingTroops + 1).fill(0),
    );
  const winProbabilityTable = makeTable();
  const attackerWinSum = makeTable();
  const attackerWinSumSquares = makeTable();
  const defenderWinSum = makeTable();

  for (let a = 0; a <= attackingTroops; a++) {
    winProbabilityTable[a][0] = 1;
    attackerWinSum[a][0] = a;
    attackerWinSumSquares[a][0] = a * a;
  }
  for (let d = 0; d <= defendingTroops; d++) defenderWinSum[0][d] = d;

  for (let a = 1; a <= attackingTroops; a++) {
    for (let d = 1; d <= defendingTroops; d++) {
      const attackerDiceCount = Math.min(a, dice.attack);
      const defenderDiceCount = Math.min(d, dice.defence);
      let winProbability = 0;
      let attackerSum = 0;
      let attackerSumSquares = 0;
      let defenderSum = 0;
      for (const outcome of lossDistribution(
        attackerDiceCount,
        defenderDiceCount,
        dice,
      )) {
        const na = a - outcome.attackLosses;
        const nd = d - outcome.defenceLosses;
        winProbability += outcome.probability * winProbabilityTable[na][nd];
        attackerSum += outcome.probability * attackerWinSum[na][nd];
        attackerSumSquares +=
          outcome.probability * attackerWinSumSquares[na][nd];
        defenderSum += outcome.probability * defenderWinSum[na][nd];
      }
      winProbabilityTable[a][d] = winProbability;
      attackerWinSum[a][d] = attackerSum;
      attackerWinSumSquares[a][d] = attackerSumSquares;
      defenderWinSum[a][d] = defenderSum;
    }
  }

  return {
    winProbabilityTable,
    attackerWinSum,
    attackerWinSumSquares,
    defenderWinSum,
  };
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function extractBattleStatistics(
  tables: BattleTables,
  attackingTroops: number,
  defendingTroops: number,
): BattleStatistics {
  const {
    winProbabilityTable,
    attackerWinSum,
    attackerWinSumSquares,
    defenderWinSum,
  } = tables;
  const winProbability = winProbabilityTable[attackingTroops][defendingTroops];

  let attackerTroopsNeeded = attackingTroops;
  for (let a = 1; a <= attackingTroops; a++) {
    if (winProbabilityTable[a][defendingTroops] >= winGuaranteedProbability) {
      attackerTroopsNeeded = a;
      break;
    }
  }

  const attackerWinProbability =
    winProbabilityTable[attackerTroopsNeeded][defendingTroops];
  const attackerMean = safeDivide(
    attackerWinSum[attackerTroopsNeeded][defendingTroops],
    attackerWinProbability,
  );
  const defenderMean =
    defenderWinSum[attackingTroops][defendingTroops] / (1 - winProbability);

  const attackerMeanAtInput = safeDivide(
    attackerWinSum[attackingTroops][defendingTroops],
    winProbability,
  );
  const attackerVarianceAtInput =
    winProbability === 0
      ? 0
      : attackerWinSumSquares[attackingTroops][defendingTroops] /
          winProbability -
        attackerMeanAtInput * attackerMeanAtInput;

  return {
    winProbability,
    attackerTroopsNeeded,
    attackerMean,
    defenderMean,
    attackerMeanAtInput,
    attackerVarianceAtInput,
  };
}

export function rescaleStatistics(
  stats: BattleStatistics,
  scaled: ScaledTroops,
  attackingTroops: number,
  scaledAttackingTroops: number,
  defendingTroops: number,
): BattleStatistics {
  if (scaled.spread === 1) return stats;
  const attackerTroopsNeeded = Math.min(
    attackingTroops,
    Math.max(
      1,
      Math.round(
        unscaledAttackers(stats.attackerTroopsNeeded, defendingTroops, scaled),
      ),
    ),
  );
  return {
    winProbability: stats.winProbability,
    attackerTroopsNeeded,
    attackerMean:
      attackerTroopsNeeded -
      unscaledAttackers(
        stats.attackerTroopsNeeded - stats.attackerMean,
        defendingTroops,
        scaled,
      ),
    defenderMean:
      defendingTroops -
      unscaledDefenders(
        scaled.defendingTroops - stats.defenderMean,
        attackingTroops,
        scaledAttackingTroops,
        scaled,
      ),
    attackerMeanAtInput:
      attackingTroops -
      unscaledAttackers(
        scaledAttackingTroops - stats.attackerMeanAtInput,
        defendingTroops,
        scaled,
      ),
    attackerVarianceAtInput:
      stats.attackerVarianceAtInput * scaled.spread * scaled.spread,
  };
}

export function battleStatistics(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): BattleStatistics {
  const scaled = scaledTroops(
    attackingTroops,
    defendingTroops,
    dice,
    EXACT_COMBAT_CAP,
  );
  const tables = buildBattleTables(
    scaled.attackingTroops,
    scaled.defendingTroops,
    dice,
  );
  const stats = extractBattleStatistics(
    tables,
    scaled.attackingTroops,
    scaled.defendingTroops,
  );
  return rescaleStatistics(
    stats,
    scaled,
    attackingTroops,
    scaled.attackingTroops,
    defendingTroops,
  );
}

export function boostedWinChance(probability: number): number {
  if (probability <= winChanceCutoff) return 0;
  if (probability >= 1 - winChanceCutoff) return 1;
  return 1 / (1 + ((1 - probability) / probability) ** winChancePower);
}

export function distortProbability(probability: number): number {
  if (probability >= winGuaranteedProbability) return 1;
  if (probability <= 1 - winGuaranteedProbability) return 0;
  return Math.min(
    1,
    Math.max(
      0,
      (boostedWinChance(probability) - outcomeCutoff) / (1 - 2 * outcomeCutoff),
    ),
  );
}
