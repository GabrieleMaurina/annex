import { BotProfile, Game, GameMap } from '../../types';
import { difficultyParams } from '../difficulty';
import { chooseAttack, chooseAttackMoveTroops } from '../heuristics/attack';
import { chooseCardSet } from '../heuristics/cards';
import { chooseDeploy } from '../heuristics/deploy';
import { chooseFortify } from '../heuristics/fortify';
import {
  chooseCapital,
  chooseEntrench,
  chooseTerritoryClaim,
  chooseTroopPlacement,
} from '../heuristics/misc';
import { getWeights } from '../personality/registry';
import { CampaignPlan, DifficultyParams, Weights } from '../types';
import { BotView, getBotView } from '../view';
import { chooseCampaign } from './campaigns';

export interface BotAction {
  event: string;
  payload: unknown;
}

export interface CampaignCache {
  plan: CampaignPlan | null;
  step: number;
  roundNumber: number;
  playerId: number;
}

export interface PlanBotTurnResult {
  actions: BotAction[];
  campaign: CampaignCache;
}

export interface PlanBotTurnInput {
  game: Game;
  map: GameMap;
  botId: number;
  botProfile: BotProfile;
  cachedCampaign: CampaignCache | null;
}

function resolveCampaign(
  game: Game,
  view: BotView,
  botId: number,
  botProfile: BotProfile,
  weights: Weights,
  params: DifficultyParams,
  cached: CampaignCache | null,
): CampaignCache {
  if (
    cached &&
    cached.roundNumber === game.roundNumber &&
    cached.playerId === botId
  )
    return cached;

  const plan = chooseCampaign(
    game,
    view,
    botId,
    botProfile.personality,
    weights,
    params,
  );
  return { plan, step: 0, roundNumber: game.roundNumber, playerId: botId };
}

export function planBotTurn(
  game: Game,
  botId: number,
  botProfile: BotProfile,
  cachedCampaign: CampaignCache | null,
): PlanBotTurnResult {
  const view = getBotView(game, botId);
  const weights = getWeights(botProfile.personality);
  const params = difficultyParams(botProfile.difficulty);
  const campaign = resolveCampaign(
    game,
    view,
    botId,
    botProfile,
    weights,
    params,
    cachedCampaign,
  );
  const actions: BotAction[] = [];

  switch (game.turnPhase) {
    case 'territory': {
      const territoryId = chooseTerritoryClaim(game);
      if (territoryId !== null)
        actions.push({
          event: 'game:claimTerritory',
          payload: { territoryId },
        });
      break;
    }
    case 'troop': {
      const territoryId = chooseTroopPlacement(game, botId);
      const pool = game.placementTroopPools.get(botId) ?? 0;
      const troops = Math.min(3, game.troopsToDeploy, pool);
      if (territoryId !== null && troops >= 1)
        actions.push({
          event: 'game:placeTroop',
          payload: { territoryId, troops },
        });
      break;
    }
    case 'capital': {
      const territoryId = chooseCapital(game, botId);
      if (territoryId !== null)
        actions.push({
          event: 'game:selectCapital',
          payload: { territoryId },
        });
      break;
    }
    case 'deploy': {
      if (game.troopsToDeploy <= 0) {
        const cards = chooseCardSet(game, botId);
        if (cards)
          actions.push({ event: 'game:playCardSet', payload: { cards } });
        else actions.push({ event: 'game:nextPhase', payload: undefined });
        break;
      }
      const choice = chooseDeploy(game, view, botId, weights, campaign.plan);
      if (choice) actions.push({ event: 'game:deploy', payload: choice });
      break;
    }
    case 'attack': {
      if (game.attackConquestMinTroops !== null) {
        const troops = chooseAttackMoveTroops(
          game,
          view,
          botId,
          campaign.plan,
          campaign.step,
        );
        actions.push({ event: 'game:attackMove', payload: { troops } });
        break;
      }
      const choice = chooseAttack(
        game,
        view,
        botId,
        weights,
        campaign.plan,
        campaign.step,
        params.noise,
      );
      if (!choice) {
        actions.push({ event: 'game:nextPhase', payload: undefined });
        break;
      }
      if (
        campaign.plan &&
        campaign.step < campaign.plan.orderedTargetIds.length &&
        campaign.plan.orderedTargetIds[campaign.step] === choice.endId
      )
        campaign.step++;

      actions.push(
        {
          event: 'game:attackSelectStart',
          payload: { territoryId: choice.startId },
        },
        {
          event: 'game:attackSelectEnd',
          payload: { territoryId: choice.endId },
        },
        {
          event: 'game:attack',
          payload: { type: choice.type, troops: choice.troops },
        },
      );
      break;
    }
    case 'fortify': {
      const choice = chooseFortify(game, view, botId, weights, campaign.plan);
      if (!choice) {
        actions.push({ event: 'game:nextPhase', payload: undefined });
        break;
      }
      actions.push(
        {
          event: 'game:fortifySelectStart',
          payload: { territoryId: choice.startId },
        },
        {
          event: 'game:fortifySelectEnd',
          payload: { territoryId: choice.endId },
        },
        { event: 'game:fortify', payload: { troops: choice.troops } },
      );
      break;
    }
    case 'entrench': {
      const choice = chooseEntrench(game, view, botId, weights);
      if (choice) actions.push({ event: 'game:entrench', payload: choice });
      else actions.push({ event: 'game:nextPhase', payload: undefined });
      break;
    }
    case 'toxins': {
      actions.push({ event: 'game:nextPhase', payload: undefined });
      break;
    }
  }

  return { actions, campaign };
}
