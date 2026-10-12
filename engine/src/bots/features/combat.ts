import {
  DiceRules,
  battleStatistics,
  defenceDiceFor,
  distortProbability,
  expectedRoundLosses,
  fairBlitz,
  gameDiceRules,
  trueWinProb,
} from '../../game/combat/dice';
import { Game } from '../../types';

const BASE_DICE: DiceRules = { attack: 3, defence: 2, ties: 'defence' };
const BASE_FORTIFIED_DICE: DiceRules = {
  attack: 3,
  defence: 3,
  ties: 'defence',
};
const BASE_TROOPS_PER_DEFENDER = 0.95;
const BASE_FORTIFIED_TROOPS_PER_DEFENDER = 1.4;

export function lossRatio(dice: DiceRules): number {
  const { attackLosses, defenceLosses } = expectedRoundLosses(dice);
  return attackLosses / defenceLosses;
}

const BASE_LOSS_RATIO = lossRatio(BASE_DICE);
const BASE_FORTIFIED_LOSS_RATIO = lossRatio(BASE_FORTIFIED_DICE);

export function troopsPerDefender(game: Game, defendingDice: number): number {
  const fortification =
    (lossRatio(gameDiceRules(game, defendingDice)) - BASE_LOSS_RATIO) /
    (BASE_FORTIFIED_LOSS_RATIO - BASE_LOSS_RATIO);
  return (
    BASE_TROOPS_PER_DEFENDER +
    fortification *
      (BASE_FORTIFIED_TROOPS_PER_DEFENDER - BASE_TROOPS_PER_DEFENDER)
  );
}

function diceKey(dice: DiceRules): string {
  return `${dice.attack},${dice.defence},${dice.ties}`;
}

const BOT_COMBAT_CAP = 60;
const MAX_SCALED_ATTACKERS = 200;
const MEMO_LIMIT = 50_000;
const winMemo = new Map<string, number>();
const statsMemo = new Map<string, ReturnType<typeof battleStatistics>>();
const fairMemo = new Map<string, ReturnType<typeof fairBlitz>>();

function memoized<T>(memo: Map<string, T>, key: string, compute: () => T): T {
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if (memo.size >= MEMO_LIMIT) memo.clear();
  const value = compute();
  memo.set(key, value);
  return value;
}

function cachedWinProb(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): number {
  return memoized(
    winMemo,
    `${attackingTroops},${defendingTroops},${diceKey(dice)}`,
    () => trueWinProb(attackingTroops, defendingTroops, dice),
  );
}

function cachedStatistics(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): ReturnType<typeof battleStatistics> {
  return memoized(
    statsMemo,
    `${attackingTroops},${defendingTroops},${diceKey(dice)}`,
    () => battleStatistics(attackingTroops, defendingTroops, dice),
  );
}

function cachedFairBlitz(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): ReturnType<typeof fairBlitz> {
  return memoized(
    fairMemo,
    `${attackingTroops},${defendingTroops},${diceKey(dice)}`,
    () => fairBlitz(attackingTroops, defendingTroops, dice),
  );
}

interface ScaledBattle {
  attackers: number;
  defenders: number;
  scale: number;
}

function scaledBattle(
  attackingTroops: number,
  defendingTroops: number,
  dice: DiceRules,
): ScaledBattle {
  const scale = Math.min(
    1,
    BOT_COMBAT_CAP / Math.max(attackingTroops, defendingTroops),
  );
  if (scale === 1)
    return { attackers: attackingTroops, defenders: defendingTroops, scale };
  const ratio = lossRatio(dice);
  const defenders = Math.max(1, Math.round(defendingTroops * scale));
  const margin = (attackingTroops - ratio * defendingTroops) * Math.sqrt(scale);
  const attackers = Math.min(
    MAX_SCALED_ATTACKERS,
    Math.max(1, Math.round(ratio * defenders + margin)),
  );
  return { attackers, defenders, scale };
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
  const dice = gameDiceRules(game, defendingDice);
  const battle = scaledBattle(attackingTroops, defendingTroops, dice);
  const trueProb = cachedWinProb(battle.attackers, battle.defenders, dice);
  if (game.blitz === 'fair') return trueProb >= 0.5 ? 1 : 0;
  if (game.blitz === 'balanced') return distortProbability(trueProb);
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
  const stats = cachedStatistics(
    attackingTroopsCeiling,
    defendingTroops,
    gameDiceRules(game, defendingDice),
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
  if (game.blitz === 'fair') {
    const outcome = cachedFairBlitz(
      attackingTroops,
      defendingTroops,
      gameDiceRules(game, defendingDice),
    );
    const win = outcome.defenceLosses >= defendingTroops;
    return {
      winProbability: win ? 1 : 0,
      attackerSurvivorsMean: win ? attackingTroops - outcome.attackLosses : 0,
    };
  }
  const stats = cachedStatistics(
    attackingTroops,
    defendingTroops,
    gameDiceRules(game, defendingDice),
  );
  return {
    winProbability:
      game.blitz === 'balanced'
        ? distortProbability(stats.winProbability)
        : stats.winProbability,
    attackerSurvivorsMean: stats.attackerMeanAtInput,
  };
}

export function scaledOutcome(
  game: Game,
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): ExpectedOutcome {
  const battle = scaledBattle(
    attackingTroops,
    defendingTroops,
    gameDiceRules(game, defendingDice),
  );
  const outcome = expectedOutcome(
    game,
    battle.attackers,
    battle.defenders,
    defendingDice,
  );
  if (battle.scale === 1) return outcome;
  const losses =
    ((battle.attackers - outcome.attackerSurvivorsMean) * defendingTroops) /
    battle.defenders;
  return {
    winProbability: outcome.winProbability,
    attackerSurvivorsMean: Math.max(1, attackingTroops - losses),
  };
}
