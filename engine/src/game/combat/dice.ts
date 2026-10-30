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

export function expectedRollLosses(dice: DiceRules): {
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

interface ScaledTroops {
  attackingTroops: number;
  defendingTroops: number;
  lossRatio: number;
  spread: number;
}

function scaledAttackers(
  attackingTroops: number,
  defendingTroops: number,
  scaled: ScaledTroops,
): number {
  return Math.round(
    scaled.lossRatio * scaled.defendingTroops +
      (attackingTroops - scaled.lossRatio * defendingTroops) / scaled.spread,
  );
}

function unscaledAttackers(
  scaledTroops: number,
  defendingTroops: number,
  scaled: ScaledTroops,
): number {
  return (
    scaled.lossRatio * defendingTroops +
    (scaledTroops - scaled.lossRatio * scaled.defendingTroops) * scaled.spread
  );
}

function unscaledDefenders(
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

function scaledTroops(
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
const outcomeCutoff = 0.1;
const outcomePower = 1.8;
const winGuaranteedOdds = (1 / outcomeCutoff - 1) ** (1 / winChancePower);
const winGuaranteedProbability = winGuaranteedOdds / (1 + winGuaranteedOdds);

interface BattleTables {
  winProbabilityTable: number[][];
  attackerWinSum: number[][];
  attackerWinSumSquares: number[][];
  defenderWinSum: number[][];
}

interface BattleStatistics {
  winProbability: number;
  attackerTroopsNeeded: number;
  attackerMean: number;
  defenderMean: number;
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
        dice.ties,
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
  const defenderMean =
    defenderWinSum[attackingTroops][defendingTroops] / (1 - winProbability);

  const attackerMeanAtInput =
    attackerWinSum[attackingTroops][defendingTroops] / winProbability;
  const attackerVarianceAtInput =
    attackerWinSumSquares[attackingTroops][defendingTroops] / winProbability -
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

function rescaleStatistics(
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

function boostedWinChance(probability: number): number {
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
        dice.ties,
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
): { attackLosses: number; defenceLosses: number } {
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
