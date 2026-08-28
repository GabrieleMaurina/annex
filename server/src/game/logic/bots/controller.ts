import { Server } from 'socket.io';
import { BotProfile, Game, Player } from '../../../types';
import { broadcastGameState, games } from '../store';
import { forceEndTurnImpl } from '../turns';
import { difficultyParams } from './difficulty';
import { chooseAttack } from './heuristics/attack';
import { chooseCardSet } from './heuristics/cards';
import { chooseDeploy } from './heuristics/deploy';
import { chooseFortify } from './heuristics/fortify';
import {
  chooseCapital,
  chooseEntrench,
  chooseTerritoryClaim,
  chooseTroopPlacement,
} from './heuristics/misc';
import { getWeights } from './personality/registry';
import { chooseCampaign } from './planning/campaigns';
import { dispatch } from './socket';
import { thinkDelayMs } from './thinkTime';
import { CampaignPlan } from './types';
import { getBotView } from './view';

const pendingActs = new Map<string, NodeJS.Timeout>();

interface CampaignEntry {
  plan: CampaignPlan | null;
  step: number;
  turnNumber: number;
  playerId: number;
}
const campaignByGame = new Map<string, CampaignEntry>();

export function scheduleBotTurnIfNeeded(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
): void {
  if (game.state !== 'playing' || game.paused) return;
  const playerId = game.playerIds[game.turnPlayerIndex];
  const player = playersById.get(playerId);
  if (!player?.isBot || !player.botProfile) return;
  if (pendingActs.has(game.name)) return;

  const delay = thinkDelayMs(player.botProfile.difficulty, game.turnPhase);
  const timer = setTimeout(() => {
    pendingActs.delete(game.name);
    const currentGame = games.get(game.name);
    if (currentGame) act(currentGame, io, playersById);
  }, delay);
  pendingActs.set(game.name, timer);
}

function act(game: Game, io: Server, playersById: Map<number, Player>): void {
  if (game.state !== 'playing' || game.paused) return;
  const playerId = game.playerIds[game.turnPlayerIndex];
  const player = playersById.get(playerId);
  if (!player?.isBot || !player.botProfile) return;

  if (player.botProfile.difficulty === 'idle') {
    forceEndTurnImpl(game, io, playersById, true);
    broadcastGameState(io, game, playersById);
    return;
  }

  performPhaseStep(game, io, playersById, player, player.botProfile);
}

function recover(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
  player: Player,
): void {
  dispatch(player.socketId, 'game:nextPhase', undefined);
}

function currentCampaign(
  game: Game,
  player: Player,
  botProfile: BotProfile,
): CampaignEntry {
  const cached = campaignByGame.get(game.name);
  if (
    cached &&
    cached.turnNumber === game.turnNumber &&
    cached.playerId === player.id
  )
    return cached;

  const view = getBotView(game, player.id);
  const weights = getWeights(botProfile.personality);
  const params = difficultyParams(botProfile.difficulty);
  const plan = chooseCampaign(
    game,
    view,
    player.id,
    botProfile.personality,
    weights,
    params,
  );
  const entry: CampaignEntry = {
    plan,
    step: 0,
    turnNumber: game.turnNumber,
    playerId: player.id,
  };
  campaignByGame.set(game.name, entry);
  return entry;
}

function performPhaseStep(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
  player: Player,
  botProfile: BotProfile,
): void {
  const botId = player.id;
  const socketId = player.socketId;
  const view = getBotView(game, botId);
  const weights = getWeights(botProfile.personality);
  const params = difficultyParams(botProfile.difficulty);
  const respond = (res: { ok: boolean }) => {
    if (!res.ok) recover(game, io, playersById, player);
  };

  switch (game.turnPhase) {
    case 'territory': {
      const territoryId = chooseTerritoryClaim(game);
      if (territoryId !== null)
        dispatch(socketId, 'game:claimTerritory', { territoryId }, respond);
      return;
    }
    case 'troop': {
      const territoryId = chooseTroopPlacement(game, botId);
      const pool = game.placementTroopPools.get(botId) ?? 0;
      const troops = Math.min(3, game.troopsToDeploy, pool);
      if (territoryId !== null && troops >= 1)
        dispatch(socketId, 'game:placeTroop', { territoryId, troops }, respond);
      return;
    }
    case 'capital': {
      const territoryId = chooseCapital(game, botId);
      if (territoryId !== null)
        dispatch(socketId, 'game:selectCapital', { territoryId }, respond);
      return;
    }
    case 'deploy': {
      if (game.troopsToDeploy <= 0) {
        const cards = chooseCardSet(game, botId);
        if (cards) dispatch(socketId, 'game:playCardSet', { cards }, respond);
        else dispatch(socketId, 'game:nextPhase', undefined, respond);
        return;
      }
      const campaign = currentCampaign(game, player, botProfile);
      const choice = chooseDeploy(game, view, botId, weights, campaign.plan);
      if (choice) dispatch(socketId, 'game:deploy', choice, respond);
      return;
    }
    case 'attack': {
      if (game.attackConquestMinTroops !== null) {
        dispatch(
          socketId,
          'game:attackMove',
          { troops: game.attackConquestMinTroops },
          respond,
        );
        return;
      }
      const campaign = currentCampaign(game, player, botProfile);
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
        dispatch(socketId, 'game:nextPhase', undefined, respond);
        return;
      }
      if (
        campaign.plan &&
        campaign.step < campaign.plan.orderedTargetIds.length &&
        campaign.plan.orderedTargetIds[campaign.step] === choice.endId
      )
        campaign.step++;

      dispatch(
        socketId,
        'game:attackSelectStart',
        { territoryId: choice.startId },
        (res) => {
          if (!res.ok) return recover(game, io, playersById, player);
          dispatch(
            socketId,
            'game:attackSelectEnd',
            { territoryId: choice.endId },
            (res2) => {
              if (!res2.ok) return recover(game, io, playersById, player);
              dispatch(
                socketId,
                'game:attack',
                { type: choice.type, troops: choice.troops },
                respond,
              );
            },
          );
        },
      );
      return;
    }
    case 'fortify': {
      const campaign = currentCampaign(game, player, botProfile);
      const choice = chooseFortify(game, view, botId, weights, campaign.plan);
      if (!choice) {
        dispatch(socketId, 'game:nextPhase', undefined, respond);
        return;
      }
      dispatch(
        socketId,
        'game:fortifySelectStart',
        { territoryId: choice.startId },
        (res) => {
          if (!res.ok) return recover(game, io, playersById, player);
          dispatch(
            socketId,
            'game:fortifySelectEnd',
            { territoryId: choice.endId },
            (res2) => {
              if (!res2.ok) return recover(game, io, playersById, player);
              dispatch(
                socketId,
                'game:fortify',
                { troops: choice.troops },
                respond,
              );
            },
          );
        },
      );
      return;
    }
    case 'entrench': {
      const choice = chooseEntrench(game, view, botId, weights);
      if (choice) dispatch(socketId, 'game:entrench', choice, respond);
      else dispatch(socketId, 'game:nextPhase', undefined, respond);
      return;
    }
    case 'toxins': {
      dispatch(socketId, 'game:nextPhase', undefined, respond);
      return;
    }
  }
}
