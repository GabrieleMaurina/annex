import { BotPersonality, Game } from '../../../../types';
import { defenceDiceFor } from '../features/combat';
import {
  continentBreakCandidates,
  continentCompletionCandidates,
} from '../features/continents';
import { grudgeAgainst } from '../features/grudge';
import { isTeammate } from '../features/mode';
import { neighborsOf, ownedTerritoryIds } from '../features/territory';
import { killerWeaknessThreshold } from '../personality/killer';
import {
  CampaignPlan,
  CampaignType,
  DifficultyParams,
  Weights,
} from '../types';
import { BotView, ownerOf, troopsAt } from '../view';
import { evaluateCampaign } from './evaluate';
import { orderTargets } from './order';

const SCORE_BAR = 0.15;
const DEFAULT_WEAKNESS_THRESHOLD = 0.15;

function countTerritories(game: Game, playerId: number): number {
  let n = 0;
  for (const ownerId of game.territoryOwners.values())
    if (ownerId === playerId) n++;
  return n;
}

function territoriesOwnedBy(
  game: Game,
  view: BotView,
  ownerId: number,
): number[] {
  const ids: number[] = [];
  for (const [id] of game.territoryOwners) {
    if (ownerOf(game, view, id) === ownerId) ids.push(id);
  }
  return ids;
}

function stagingTerritoryFor(
  game: Game,
  botId: number,
  orderedTargetIds: number[],
): number | null {
  if (orderedTargetIds.length === 0) return null;
  const first = orderedTargetIds[0];
  let best: number | null = null;
  let bestTroops = -1;
  for (const n of neighborsOf(game, first)) {
    if (game.territoryOwners.get(n) !== botId) continue;
    const troops = game.territoryTroops.get(n) ?? 0;
    if (troops > bestTroops) {
      bestTroops = troops;
      best = n;
    }
  }
  if (best !== null) return best;
  const owned = ownedTerritoryIds(game, botId);
  return owned.length > 0 ? owned[0] : null;
}

// When bonus is given (continent completion/break), a higher
// bonus-per-troop-spent ratio scores better: the bonus recurs every turn the
// continent is held (or denied), so even a costly campaign can pay for
// itself over time, plus the fighting itself inflicts losses and takes
// territory from whoever's in the way. Left undefined for campaign types
// with no continent bonus to weigh against (eliminate), which keeps the
// plain probability-weighted score.
function buildPlan(
  game: Game,
  view: BotView,
  botId: number,
  type: CampaignType,
  targetPlayerId: number | null,
  continentId: number | null,
  targetIds: number[],
  weightForType: number,
  bonus?: number,
): CampaignPlan | null {
  const ordered = orderTargets(game, view, botId, targetIds);
  if (ordered.length === 0) return null;
  const staging = stagingTerritoryFor(game, botId, ordered);
  if (staging === null) return null;

  const startingTroops = game.territoryTroops.get(staging) ?? 0;
  const evaluation = evaluateCampaign(
    startingTroops,
    ordered,
    (id) => troopsAt(game, view, id),
    (id) => defenceDiceFor(game, id),
  );
  if (!evaluation.feasible) return null;

  let returnFactor = 1;
  if (bonus !== undefined) {
    const expectedCost = Math.max(
      0,
      startingTroops - evaluation.expectedTroopsRemaining,
    );
    returnFactor = bonus / Math.max(expectedCost, 1);
  }

  return {
    type,
    targetPlayerId,
    continentId,
    orderedTargetIds: ordered,
    stagingTerritoryId: staging,
    probability: evaluation.probability,
    expectedTroopsRemaining: evaluation.expectedTroopsRemaining,
    score: weightForType * evaluation.probability * returnFactor,
  };
}

export function chooseCampaign(
  game: Game,
  view: BotView,
  botId: number,
  personality: BotPersonality,
  weights: Weights,
  params: DifficultyParams,
): CampaignPlan | null {
  const candidates: CampaignPlan[] = [];

  for (const c of continentCompletionCandidates(game, view, botId)) {
    const plan = buildPlan(
      game,
      view,
      botId,
      'complete',
      null,
      c.continentId,
      c.remainingTerritoryIds,
      weights.completeContinent,
      c.bonus,
    );
    if (plan) candidates.push(plan);
  }

  for (const c of continentBreakCandidates(game, view, botId)) {
    const plan = buildPlan(
      game,
      view,
      botId,
      'break',
      c.ownerId,
      c.continentId,
      [c.weakestTerritoryId],
      weights.breakContinent,
      c.bonus,
    );
    if (plan) candidates.push(plan);
  }

  const weaknessThreshold =
    personality === 'killer'
      ? killerWeaknessThreshold
      : DEFAULT_WEAKNESS_THRESHOLD;
  const totalTerritories = game.territoryOwners.size || 1;
  const opponentIds = new Set<number>();
  for (const ownerId of game.territoryOwners.values())
    if (ownerId !== botId && !isTeammate(game, botId, ownerId))
      opponentIds.add(ownerId);

  for (const opponentId of opponentIds) {
    const share = countTerritories(game, opponentId) / totalTerritories;
    if (share > weaknessThreshold) continue;
    const grudge = grudgeAgainst(game, botId, opponentId);
    const eliminateWeight =
      weights.eliminate + weights.grudge * Math.min(grudge / 10, 1);
    const plan = buildPlan(
      game,
      view,
      botId,
      'eliminate',
      opponentId,
      null,
      territoriesOwnedBy(game, view, opponentId),
      eliminateWeight,
    );
    if (plan) candidates.push(plan);
  }

  let best: CampaignPlan | null = null;
  let bestGatedScore = SCORE_BAR;
  for (const candidate of candidates) {
    const gatedScore = candidate.score * params.planningConfidence;
    if (gatedScore >= bestGatedScore) {
      bestGatedScore = gatedScore;
      best = candidate;
    }
  }
  return best;
}
