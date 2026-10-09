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

const BOT_COMBAT_CAP = 60;
const MEMO_LIMIT = 50_000;
const winMemo = new Map<string, number>();
const statsMemo = new Map<string, ReturnType<typeof battleStatistics>>();

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
  defendingDice: number,
): number {
  return memoized(
    winMemo,
    `${attackingTroops},${defendingTroops},${defendingDice}`,
    () => trueWinProb(attackingTroops, defendingTroops, defendingDice),
  );
}

function cachedStatistics(
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): ReturnType<typeof battleStatistics> {
  return memoized(
    statsMemo,
    `${attackingTroops},${defendingTroops},${defendingDice}`,
    () => battleStatistics(attackingTroops, defendingTroops, defendingDice),
  );
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
  const scale = Math.min(
    1,
    BOT_COMBAT_CAP / Math.max(attackingTroops, defendingTroops),
  );
  const trueProb = cachedWinProb(
    Math.max(1, Math.round(attackingTroops * scale)),
    Math.max(1, Math.round(defendingTroops * scale)),
    defendingDice,
  );
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
  if (game.blitz === 'fair') {
    const outcome = fairBlitz(attackingTroops, defendingTroops, defendingDice);
    const win = outcome.defenceLosses >= defendingTroops;
    return {
      winProbability: win ? 1 : 0,
      attackerSurvivorsMean: win ? attackingTroops - outcome.attackLosses : 0,
    };
  }
  const stats = cachedStatistics(
    attackingTroops,
    defendingTroops,
    defendingDice,
  );
  return {
    winProbability:
      game.blitz === 'balanced'
        ? distortProbability(stats.winProbability)
        : stats.winProbability,
    attackerSurvivorsMean: stats.attackerMeanAtInput,
  };
}
