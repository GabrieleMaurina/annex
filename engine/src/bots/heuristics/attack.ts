import { Game } from '../../types';
import { attackWinProbability, defenceDiceFor } from '../features/combat';
import {
  continentBreakCandidates,
  continentCompletionCandidates,
} from '../features/continents';
import { grudgeAgainst } from '../features/grudge';
import {
  frontierTerritories,
  hostileNeighbors,
  neighborsOf,
} from '../features/territory';
import { CampaignPlan, Weights } from '../types';
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

function sourceForCampaignStep(
  game: Game,
  botId: number,
  endId: number,
): number | null {
  let best: number | null = null;
  let bestTroops = -1;
  for (const n of neighborsOf(game, endId)) {
    if (game.territoryOwners.get(n) !== botId) continue;
    const troops = game.territoryTroops.get(n) ?? 0;
    if (troops > bestTroops) {
      bestTroops = troops;
      best = n;
    }
  }
  return best;
}

export function chooseAttackMoveTroops(
  game: Game,
  view: BotView,
  botId: number,
  campaign: CampaignPlan | null,
  campaignStep: number,
): number {
  const startId = game.attackStartTerritoryId!;
  const startTroops = game.territoryTroops.get(startId) ?? 0;
  const min = game.attackConquestMinTroops ?? 1;
  const max = startTroops - 1;

  if (campaign && campaignStep < campaign.orderedTargetIds.length) return max;
  if (hostileNeighbors(game, view, botId, startId).length > 0)
    return Math.max(min, Math.floor(max / 2));
  return max;
}

export function chooseAttack(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
  campaign: CampaignPlan | null,
  campaignStep: number,
  noise: number,
): AttackChoice | null {
  if (campaign && campaignStep < campaign.orderedTargetIds.length) {
    const endId = campaign.orderedTargetIds[campaignStep];
    const startId = sourceForCampaignStep(game, botId, endId);
    if (startId !== null) {
      const attackingTroops = game.territoryTroops.get(startId) ?? 0;
      const defendingTroops = game.territoryTroops.get(endId) ?? 0;
      const winProb = attackWinProbability(
        attackingTroops - 1,
        defendingTroops,
        defenceDiceFor(game, endId),
      );
      if (attackingTroops >= 2 && winProb >= MIN_WIN_PROBABILITY) {
        const { type, troops } = blitzAllTroops(attackingTroops);
        return { startId, endId, troops, type };
      }
    }
  }

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
