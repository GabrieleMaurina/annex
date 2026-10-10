import { DiceTies, Game } from '../../types';

export const MAX_DICE = 10;

export interface DiceRules {
  attack: number;
  defence: number;
  ties: DiceTies;
}

export function defenceDiceFor(game: Game, territoryId: number): number {
  if (
    game.capitalTerritoryIds.has(territoryId) ||
    (game.territoryEntrenchment.get(territoryId) ?? 0) > 0
  )
    return Math.min(MAX_DICE, game.defenceDice + 1);
  return game.defenceDice;
}

export function gameDiceRules(game: Game, defence: number): DiceRules {
  return { attack: game.attackDice, defence, ties: game.diceTies };
}

export function roll(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function attack(
  attackingTroops: number,
  defendingTroops: number,
  ties: DiceTies,
): {
  attackDice: number[];
  defenceDice: number[];
  attackLosses: number;
  defenceLosses: number;
} {
  const attackDice = Array.from({ length: attackingTroops }, roll).sort(
    (a, b) => b - a,
  );
  const defenceDice = Array.from({ length: defendingTroops }, roll).sort(
    (a, b) => b - a,
  );

  let attackLosses = 0;
  let defenceLosses = 0;
  const pairs = Math.min(attackDice.length, defenceDice.length);
  for (let i = 0; i < pairs; i++) {
    if (attackDice[i] > defenceDice[i]) defenceLosses++;
    else if (attackDice[i] < defenceDice[i]) attackLosses++;
    else if (ties === 'defence') attackLosses++;
    else if (ties === 'attack') defenceLosses++;
  }

  return { attackDice, defenceDice, attackLosses, defenceLosses };
}

interface PlacementState {
  placedAttackDice: number;
  placedDefenceDice: number;
  attackLosses: number;
  defenceLosses: number;
  probability: number;
}

function binomialProbabilities(trials: number, p: number): number[] {
  const probabilities: number[] = [];
  let coefficient = 1;
  for (let k = 0; k <= trials; k++) {
    probabilities.push(coefficient * p ** k * (1 - p) ** (trials - k));
    coefficient = (coefficient * (trials - k)) / (k + 1);
  }
  return probabilities;
}

function placeFace(
  state: PlacementState,
  newAttackDice: number,
  newDefenceDice: number,
  pairs: number,
  ties: DiceTies,
): { attackLosses: number; defenceLosses: number } {
  const { placedAttackDice, placedDefenceDice } = state;
  let { attackLosses, defenceLosses } = state;
  const end = Math.min(
    placedAttackDice + newAttackDice,
    placedDefenceDice + newDefenceDice,
    pairs,
  );
  for (let i = Math.min(placedAttackDice, placedDefenceDice); i < end; i++) {
    if (i < placedAttackDice) defenceLosses++;
    else if (i < placedDefenceDice) attackLosses++;
    else if (ties === 'defence') attackLosses++;
    else if (ties === 'attack') defenceLosses++;
  }
  return { attackLosses, defenceLosses };
}

function computeLossDistribution(
  attackerDiceCount: number,
  defenderDiceCount: number,
  ties: DiceTies,
): { attackLosses: number; defenceLosses: number; probability: number }[] {
  const pairs = Math.min(attackerDiceCount, defenderDiceCount);
  let states: PlacementState[] = [
    {
      placedAttackDice: 0,
      placedDefenceDice: 0,
      attackLosses: 0,
      defenceLosses: 0,
      probability: 1,
    },
  ];

  for (let face = 6; face >= 1; face--) {
    const next = new Map<string, PlacementState>();
    for (const state of states) {
      const attackOdds = binomialProbabilities(
        attackerDiceCount - state.placedAttackDice,
        1 / face,
      );
      const defenceOdds = binomialProbabilities(
        defenderDiceCount - state.placedDefenceDice,
        1 / face,
      );
      attackOdds.forEach((attackProbability, newAttackDice) => {
        defenceOdds.forEach((defenceProbability, newDefenceDice) => {
          const probability =
            state.probability * attackProbability * defenceProbability;
          if (probability === 0) return;
          const losses = placeFace(
            state,
            newAttackDice,
            newDefenceDice,
            pairs,
            ties,
          );
          const placedAttackDice = state.placedAttackDice + newAttackDice;
          const placedDefenceDice = state.placedDefenceDice + newDefenceDice;
          const key = `${placedAttackDice},${placedDefenceDice},${losses.attackLosses},${losses.defenceLosses}`;
          const existing = next.get(key);
          if (existing) existing.probability += probability;
          else
            next.set(key, {
              placedAttackDice,
              placedDefenceDice,
              ...losses,
              probability,
            });
        });
      });
    }
    states = [...next.values()];
  }

  const outcomes = new Map<
    string,
    { attackLosses: number; defenceLosses: number; probability: number }
  >();
  let decisiveProbability = 0;
  for (const { attackLosses, defenceLosses, probability } of states) {
    if (attackLosses === 0 && defenceLosses === 0) continue;
    decisiveProbability += probability;
    const key = `${attackLosses},${defenceLosses}`;
    const existing = outcomes.get(key);
    if (existing) existing.probability += probability;
    else outcomes.set(key, { attackLosses, defenceLosses, probability });
  }

  return Array.from(outcomes.values(), (outcome) => ({
    ...outcome,
    probability: outcome.probability / decisiveProbability,
  }));
}

const lossDistributionCache = new Map<
  string,
  ReturnType<typeof computeLossDistribution>
>();

function lossDistribution(
  attackerDiceCount: number,
  defenderDiceCount: number,
  ties: DiceTies,
): ReturnType<typeof computeLossDistribution> {
  const key = `${attackerDiceCount},${defenderDiceCount},${ties}`;
  let cached = lossDistributionCache.get(key);
  if (!cached) {
    cached = computeLossDistribution(
      attackerDiceCount,
      defenderDiceCount,
      ties,
    );
    lossDistributionCache.set(key, cached);
  }
  return cached;
}

export function expectedRoundLosses(dice: DiceRules): {
  attackLosses: number;
  defenceLosses: number;
} {
  let attackLosses = 0;
  let defenceLosses = 0;
  for (const outcome of lossDistribution(
    dice.attack,
    dice.defence,
    dice.ties,
  )) {
    attackLosses += outcome.probability * outcome.attackLosses;
    defenceLosses += outcome.probability * outcome.defenceLosses;
  }
  return { attackLosses, defenceLosses };
}

const EXACT_COMBAT_CAP = 200;

function scaledTroops(
  attackingTroops: number,
  defendingTroops: number,
  cap: number,
): { scale: number; attackingTroops: number; defendingTroops: number } {
  if (attackingTroops <= cap && defendingTroops <= cap)
    return { scale: 1, attackingTroops, defendingTroops };
  const scale = cap / Math.max(attackingTroops, defendingTroops);
  return {
    scale,
    attackingTroops: Math.max(1, Math.round(attackingTroops * scale)),
    defendingTroops: Math.max(1, Math.round(defendingTroops * scale)),
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
        dice.ties,
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
    EXACT_COMBAT_CAP,
  );
  const table = winProbTable(
    scaled.attackingTroops,
    scaled.defendingTroops,
    dice,
  );
  if (scaled.scale === 1)
    return table.slice(1).map((row) => row[defendingTroops]);
  return Array.from({ length: maxAttackingTroops }, (_, i) => {
    const a = Math.max(
      1,
      Math.min(scaled.attackingTroops, Math.round((i + 1) * scaled.scale)),
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

const winGuaranteedProbability = 0.85;

interface BattleTables {
  winProbabilityTable: number[][];
  attackerWinSum: number[][];
  attackerWinSumSquares: number[][];
  defenderWinSum: number[][];
  defenderWinSumSquares: number[][];
}

interface BattleStatistics {
  winProbability: number;
  attackerTroopsNeeded: number;
  attackerMean: number;
  attackerVariance: number;
  defenderMean: number;
  defenderVariance: number;
  attackerMeanAtInput: number;
  attackerVarianceAtInput: number;
}

function buildBattleTables(
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
  const defenderWinSumSquares = makeTable();

  for (let a = 0; a <= attackingTroops; a++) {
    winProbabilityTable[a][0] = 1;
    attackerWinSum[a][0] = a;
    attackerWinSumSquares[a][0] = a * a;
  }
  for (let d = 0; d <= defendingTroops; d++) {
    defenderWinSum[0][d] = d;
    defenderWinSumSquares[0][d] = d * d;
  }

  for (let a = 1; a <= attackingTroops; a++) {
    for (let d = 1; d <= defendingTroops; d++) {
      const attackerDiceCount = Math.min(a, dice.attack);
      const defenderDiceCount = Math.min(d, dice.defence);
      let winProbability = 0;
      let attackerSum = 0;
      let attackerSumSquares = 0;
      let defenderSum = 0;
      let defenderSumSquares = 0;
      for (const outcome of lossDistribution(
        attackerDiceCount,
        defenderDiceCount,
        dice.ties,
      )) {
        const na = a - outcome.attackLosses;
        const nd = d - outcome.defenceLosses;
        winProbability += outcome.probability * winProbabilityTable[na][nd];
        attackerSum += outcome.probability * attackerWinSum[na][nd];
        attackerSumSquares +=
          outcome.probability * attackerWinSumSquares[na][nd];
        defenderSum += outcome.probability * defenderWinSum[na][nd];
        defenderSumSquares +=
          outcome.probability * defenderWinSumSquares[na][nd];
      }
      winProbabilityTable[a][d] = winProbability;
      attackerWinSum[a][d] = attackerSum;
      attackerWinSumSquares[a][d] = attackerSumSquares;
      defenderWinSum[a][d] = defenderSum;
      defenderWinSumSquares[a][d] = defenderSumSquares;
    }
  }

  return {
    winProbabilityTable,
    attackerWinSum,
    attackerWinSumSquares,
    defenderWinSum,
    defenderWinSumSquares,
  };
}

function extractBattleStatistics(
  tables: BattleTables,
  attackingTroops: number,
  defendingTroops: number,
): BattleStatistics {
  const {
    winProbabilityTable,
    attackerWinSum,
    attackerWinSumSquares,
    defenderWinSum,
    defenderWinSumSquares,
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
  const attackerMean =
    attackerWinSum[attackerTroopsNeeded][defendingTroops] /
    attackerWinProbability;
  const attackerVariance =
    attackerWinSumSquares[attackerTroopsNeeded][defendingTroops] /
      attackerWinProbability -
    attackerMean * attackerMean;
  const defenderMean =
    defenderWinSum[attackingTroops][defendingTroops] / (1 - winProbability);
  const defenderVariance =
    defenderWinSumSquares[attackingTroops][defendingTroops] /
      (1 - winProbability) -
    defenderMean * defenderMean;

  const attackerMeanAtInput =
    attackerWinSum[attackingTroops][defendingTroops] / winProbability;
  const attackerVarianceAtInput =
    attackerWinSumSquares[attackingTroops][defendingTroops] / winProbability -
    attackerMeanAtInput * attackerMeanAtInput;

  return {
    winProbability,
    attackerTroopsNeeded,
    attackerMean,
    attackerVariance,
    defenderMean,
    defenderVariance,
    attackerMeanAtInput,
    attackerVarianceAtInput,
  };
}

function rescaleStatistics(
  stats: BattleStatistics,
  scale: number,
  attackingTroops: number,
): BattleStatistics {
  if (scale === 1) return stats;
  return {
    winProbability: stats.winProbability,
    attackerTroopsNeeded: Math.min(
      attackingTroops,
      Math.max(1, Math.round(stats.attackerTroopsNeeded / scale)),
    ),
    attackerMean: stats.attackerMean / scale,
    attackerVariance: stats.attackerVariance / (scale * scale),
    defenderMean: stats.defenderMean / scale,
    defenderVariance: stats.defenderVariance / (scale * scale),
    attackerMeanAtInput: stats.attackerMeanAtInput / scale,
    attackerVarianceAtInput: stats.attackerVarianceAtInput / (scale * scale),
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
  return rescaleStatistics(stats, scaled.scale, attackingTroops);
}

export function distortProbability(probability: number): number {
  const lowSaturation = 0.1;
  const lowMid = 0.25;
  const highMid = 0.75;
  const highSaturation = winGuaranteedProbability;

  if (probability <= lowSaturation) return 0;
  if (probability >= highSaturation) return 1;
  if (probability < lowMid) {
    const t = (lowMid - probability) / (lowMid - lowSaturation);
    return lowMid - lowMid * Math.sqrt(t);
  }
  if (probability > highMid) {
    const t = (probability - highMid) / (highSaturation - highMid);
    return highMid + (1 - highMid) * Math.sqrt(t);
  }
  return probability;
}

function sampleRemainingTroops(
  mean: number,
  variance: number,
  maxTroops: number,
): number {
  const standardDeviation = Math.sqrt(Math.max(variance, 0));
  const u1 = 1 - Math.random();
  const u2 = Math.random();
  const standardNormal =
    Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const sample = Math.round(mean + standardNormal * standardDeviation);
  return Math.min(Math.max(sample, 1), maxTroops);
}

export function balancedBlitz(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number } {
  const stats = battleStatistics(attackingTroops, defendingTroops, dice);
  const balancedProbability = distortProbability(stats.winProbability);

  if (Math.random() < balancedProbability) {
    const remaining = sampleRemainingTroops(
      stats.attackerMean,
      stats.attackerVariance,
      stats.attackerTroopsNeeded,
    );
    return {
      attackLosses: stats.attackerTroopsNeeded - remaining,
      defenceLosses: defendingTroops,
    };
  }

  const remaining = sampleRemainingTroops(
    stats.defenderMean,
    stats.defenderVariance,
    defendingTroops,
  );
  return {
    attackLosses: attackingTroops,
    defenceLosses: defendingTroops - remaining,
  };
}

export function trueBlitz(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number } {
  let remainingAttackers = attackingTroops;
  let remainingDefenders = defendingTroops;

  while (remainingAttackers > 0 && remainingDefenders > 0) {
    const result = attack(
      Math.min(remainingAttackers, dice.attack),
      Math.min(remainingDefenders, dice.defence),
      dice.ties,
    );
    remainingAttackers -= result.attackLosses;
    remainingDefenders -= result.defenceLosses;
  }

  return {
    attackLosses: attackingTroops - remainingAttackers,
    defenceLosses: defendingTroops - remainingDefenders,
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
): { attackLosses: number; defenceLosses: number } {
  const stats = battleStatistics(attackingTroops, defendingTroops, dice);
  return fairBlitzFromStats(attackingTroops, defendingTroops, stats);
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
        Math.round(attackingTroops * scaled.scale),
      ),
    );
    const stats = extractBattleStatistics(
      tables,
      scaledAttackingTroops,
      scaled.defendingTroops,
    );
    const rescaled = rescaleStatistics(stats, scaled.scale, attackingTroops);
    return fairBlitzFromStats(attackingTroops, defendingTroops, rescaled);
  });
}
