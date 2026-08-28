import { Game } from '../../../../types';
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

const MIN_WIN_PROBABILITY = 0.35;

// Always blitz with the full committable stack: it resolves the whole
// battle in one call instead of one 3v3 exchange at a time, matches how
// most human players actually attack, and gives a cleaner win-probability
// read than a partial commit would.
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

function completionBonus(
  game: Game,
  view: BotView,
  botId: number,
  endId: number,
): number {
  return continentCompletionCandidates(game, view, botId).some((c) =>
    c.remainingTerritoryIds.includes(endId),
  )
    ? 1
    : 0;
}

function breakBonus(
  game: Game,
  view: BotView,
  botId: number,
  endId: number,
): number {
  return continentBreakCandidates(game, view, botId).some(
    (c) => c.weakestTerritoryId === endId,
  )
    ? 1
    : 0;
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
      // Real dice results since the plan was built may have made this step
      // worse than expected; re-check before committing rather than
      // executing blind, and fall through to per-move scoring if it's gone
      // bad (the campaign is simply abandoned for this call, not mutated).
      if (attackingTroops >= 2 && winProb >= MIN_WIN_PROBABILITY) {
        const { type, troops } = blitzAllTroops(attackingTroops);
        return { startId, endId, troops, type };
      }
    }
  }

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
      score +=
        weights.completeContinent *
        0.1 *
        completionBonus(game, view, botId, endId);
      score +=
        weights.breakContinent * 0.1 * breakBonus(game, view, botId, endId);
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
