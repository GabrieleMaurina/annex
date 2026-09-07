import { Game } from '../../types';
import { attackWinProbability, defenceDiceFor } from '../features/combat';
import {
  continentBreakCandidates,
  continentCompletionCandidates,
} from '../features/continents';
import { grudgeAgainst } from '../features/grudge';
import { frontierTerritories, hostileNeighbors } from '../features/territory';
import { Weights } from '../types';
import { BotView, ownerOf } from '../view';

export interface AttackChoice {
  startId: number;
  endId: number;
  troops: number;
  type: 'regular' | 'blitz';
}

const MIN_WIN_PROBABILITY = 0.55;

function blitzAllTroops(attackingTroops: number): {
  type: 'regular' | 'blitz';
  troops: number;
} {
  return { type: 'blitz', troops: attackingTroops - 1 };
}

export function chooseAttackMoveTroops(
  game: Game,
  view: BotView,
  botId: number,
  moveMax: boolean,
): number {
  const startId = game.attackStartTerritoryId!;
  const startTroops = game.territoryTroops.get(startId) ?? 0;
  const min = game.attackConquestMinTroops ?? 1;
  const max = startTroops - 1;

  if (moveMax) return max;
  if (hostileNeighbors(game, view, botId, startId).length > 0)
    return Math.max(min, Math.floor(max / 2));
  return max;
}

export function chooseAttack(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
  noise: number,
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

  const frontier = frontierTerritories(game, view, botId);
  let best: AttackChoice | null = null;
  let bestScore = -Infinity;
  for (const startId of frontier) {
    const attackingTroops = game.territoryTroops.get(startId) ?? 0;
    if (attackingTroops < 2) continue;
    for (const endId of hostileNeighbors(game, view, botId, startId)) {
      const defendingTroops = game.territoryTroops.get(endId) ?? 0;
      const winProb = attackWinProbability(
        game,
        attackingTroops - 1,
        defendingTroops,
        defenceDiceFor(game, endId),
      );
      if (winProb < MIN_WIN_PROBABILITY - noise * 0.3) continue;

      const defenderId = ownerOf(game, view, endId);
      let score = winProb;
      if (defenderId !== undefined)
        score +=
          weights.grudge *
          0.1 *
          Math.min(grudgeAgainst(game, botId, defenderId) / 10, 1);
      if (completeTargets.has(endId)) score += weights.completeContinent * 0.1;
      if (breakTargets.has(endId)) score += weights.breakContinent * 0.1;
      score += (Math.random() - 0.5) * noise;

      if (score > bestScore) {
        bestScore = score;
        const { type, troops } = blitzAllTroops(attackingTroops);
        best = { startId, endId, troops, type };
      }
    }
  }
  return best;
}
