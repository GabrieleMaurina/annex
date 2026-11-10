import { DiceTies } from '../../types';
import { DiceLuck, DiceRules, MAX_DICE, MAX_SIDES, TIES_INDEX } from './dice';

export function outcomeLuck(
  outcomes: {
    attackLosses: number;
    defenceLosses: number;
    probability: number;
  }[],
  attackLosses: number,
  defenceLosses: number,
): DiceLuck {
  let total = 0;
  let swingSum = 0;
  let swingSquaresSum = 0;
  for (const outcome of outcomes) {
    const swing = outcome.defenceLosses - outcome.attackLosses;
    total += outcome.probability;
    swingSum += outcome.probability * swing;
    swingSquaresSum += outcome.probability * swing * swing;
  }
  const expectedSwing = swingSum / total;
  return {
    surplus: defenceLosses - attackLosses - expectedSwing,
    variance: swingSquaresSum / total - expectedSwing * expectedSwing,
  };
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

const faceOddsCache: number[][][] = [];

function faceOdds(face: number, trials: number): number[] {
  let byTrials = faceOddsCache[face];
  if (!byTrials) {
    byTrials = [];
    faceOddsCache[face] = byTrials;
  }
  let odds = byTrials[trials];
  if (!odds) {
    odds = face === 0 ? [1] : binomialProbabilities(trials, 1 / face);
    byTrials[trials] = odds;
  }
  return odds;
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
  dice: DiceRules,
): { attackLosses: number; defenceLosses: number; probability: number }[] {
  const { ties } = dice;
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

  const maxSides = Math.max(dice.attackSides, dice.defenceSides);
  for (let face = maxSides; face >= 1; face--) {
    const next = new Map<number, PlacementState>();
    for (const state of states) {
      const attackOdds = faceOdds(
        face <= dice.attackSides ? face : 0,
        attackerDiceCount - state.placedAttackDice,
      );
      const defenceOdds = faceOdds(
        face <= dice.defenceSides ? face : 0,
        defenderDiceCount - state.placedDefenceDice,
      );
      attackOdds.forEach((attackProbability, newAttackDice) => {
        if (attackProbability === 0) return;
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
          const key =
            ((placedAttackDice * (MAX_DICE + 1) + placedDefenceDice) *
              (MAX_DICE + 1) +
              losses.attackLosses) *
              (MAX_DICE + 1) +
            losses.defenceLosses;
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

type LossDistribution = ReturnType<typeof computeLossDistribution>;

const lossDistributionCache = new Map<number, LossDistribution[][]>();

export function lossDistribution(
  attackerDiceCount: number,
  defenderDiceCount: number,
  dice: DiceRules,
): LossDistribution {
  const key =
    (dice.attackSides * (MAX_SIDES + 1) + dice.defenceSides) * 3 +
    TIES_INDEX[dice.ties];
  let byAttackers = lossDistributionCache.get(key);
  if (!byAttackers) {
    byAttackers = [];
    lossDistributionCache.set(key, byAttackers);
  }
  let byDefenders = byAttackers[attackerDiceCount];
  if (!byDefenders) {
    byDefenders = [];
    byAttackers[attackerDiceCount] = byDefenders;
  }
  let cached = byDefenders[defenderDiceCount];
  if (!cached) {
    cached = computeLossDistribution(
      attackerDiceCount,
      defenderDiceCount,
      dice,
    );
    byDefenders[defenderDiceCount] = cached;
  }
  return cached;
}

export function expectedRollLosses(dice: DiceRules): {
  attackLosses: number;
  defenceLosses: number;
} {
  let attackLosses = 0;
  let defenceLosses = 0;
  for (const outcome of lossDistribution(dice.attack, dice.defence, dice)) {
    attackLosses += outcome.probability * outcome.attackLosses;
    defenceLosses += outcome.probability * outcome.defenceLosses;
  }
  return { attackLosses, defenceLosses };
}
