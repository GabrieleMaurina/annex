import { Game } from '../../types';
import { attackWinProbability, defenceDiceFor } from '../features/combat';
import {
  continentBreakCandidates,
  continentCompletionCandidates,
} from '../features/continents';
import { grudgeAgainst } from '../features/grudge';
import { seaBridgeTargets } from '../features/navy';
import { minWinProbability } from '../features/pressure';
import { Standing, targetPreference } from '../features/standing';
import { frontierTerritories, hostileNeighbors } from '../features/territory';
import { Weights } from '../types';
import { BotView, ownerOf } from '../view';

const PREF_WEIGHT = 0.25;

export interface AttackChoice {
  startId: number;
  endId: number;
  troops: number;
  type: 'regular' | 'blitz';
}

const REGULAR_ATTACK_MAX_TROOPS = 3;

export function attackOrder(
  game: Game,
  troops: number,
): { type: 'regular' | 'blitz'; troops: number } {
  if (game.blitz === 'Off')
    return {
      type: 'regular',
      troops: Math.min(troops, REGULAR_ATTACK_MAX_TROOPS),
    };
  return { type: 'blitz', troops };
}

export function chooseAttackMoveTroops(
  game: Game,
  moveMax: boolean,
  endShare: number,
): number {
  const startId = game.attackStartTerritoryId!;
  const startTroops = game.territoryTroops.get(startId) ?? 0;
  const min = game.attackConquestMinTroops ?? 1;
  const max = startTroops - 1;

  if (moveMax) return max;
  return min + Math.round((max - min) * endShare);
}

export function chooseAttack(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
  noise: number,
  standing: Standing,
  stackRisk: (startId: number, endId: number) => number,
): AttackChoice | null {
  const breakTargets = new Set(
    continentBreakCandidates(game, view, botId).map(
      (c) => c.weakestTerritoryId,
    ),
  );
  const completeTargets = new Set(
    continentCompletionCandidates(game, view, botId).flatMap(
      (c) => c.remainingTerritoryIds,
    ),
  );

  const minWin = minWinProbability(game);
  const frontier = frontierTerritories(game, view, botId);
  let best: AttackChoice | null = null;
  let bestScore = -Infinity;

  const consider = (
    startId: number,
    endId: number,
    defenderId: number | undefined,
  ) => {
    const attackingTroops = game.territoryTroops.get(startId) ?? 0;
    if (attackingTroops < 2) return;
    const defendingTroops = game.territoryTroops.get(endId) ?? 0;
    const winProb = attackWinProbability(
      game,
      attackingTroops - 1,
      defendingTroops,
      defenceDiceFor(game, endId),
    );
    if (winProb < minWin - noise * 0.3) return;

    let score = winProb;
    if (defenderId !== undefined)
      score +=
        weights.grudge *
        0.1 *
        Math.min(grudgeAgainst(game, botId, defenderId) / 10, 1);
    score += PREF_WEIGHT * targetPreference(standing, defenderId);
    if (completeTargets.has(endId)) score += weights.completeContinent * 0.1;
    if (breakTargets.has(endId)) score += weights.breakContinent * 0.1;
    score -= stackRisk(startId, endId);
    score += (Math.random() - 0.5) * noise;

    if (score > bestScore) {
      bestScore = score;
      const { type, troops } = attackOrder(game, attackingTroops - 1);
      best = { startId, endId, troops, type };
    }
  };

  for (const startId of frontier) {
    for (const endId of hostileNeighbors(game, view, botId, startId)) {
      consider(startId, endId, ownerOf(game, view, endId));
    }
  }
  for (const bridge of seaBridgeTargets(game, view, botId)) {
    consider(bridge.sourceTerritoryId, bridge.targetId, bridge.ownerId);
  }

  return best;
}
