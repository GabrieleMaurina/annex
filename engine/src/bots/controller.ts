import { forceEndTurnImpl } from '../game/turns';
import { playersById } from '../session/players';
import { broadcastGameState, games } from '../session/store';
import { BotProfile, Game, Player } from '../types';
import { dispatchBotAction } from './dispatch';
import { planBotTurnAsync } from './planning/botPool';
import { BotAction, CampaignCache } from './planning/planBotTurn';
import { thinkDelayMs } from './thinkTime';

const pendingActs = new Map<string, NodeJS.Timeout>();
const inFlight = new Set<string>();
const campaignByGame = new Map<string, CampaignCache>();

export function scheduleBotTurnIfNeeded(game: Game): void {
  if (game.state !== 'playing' || game.paused) return;
  const playerId = game.playerIds[game.turnPlayerIndex];
  const player = playersById.get(playerId);
  if (!player?.isBot || !player.botProfile) return;
  if (pendingActs.has(game.name) || inFlight.has(game.name)) return;

  const delay = thinkDelayMs(player.botProfile.difficulty, game.turnPhase);
  const timer = setTimeout(() => {
    pendingActs.delete(game.name);
    const currentGame = games.get(game.name);
    if (currentGame) act(currentGame);
  }, delay);
  pendingActs.set(game.name, timer);
}

function act(game: Game): void {
  if (game.state !== 'playing' || game.paused) return;
  const playerId = game.playerIds[game.turnPlayerIndex];
  const player = playersById.get(playerId);
  if (!player?.isBot || !player.botProfile) return;

  if (player.botProfile.difficulty === 'idle') {
    forceEndTurnImpl(game, true);
    broadcastGameState(game);
    return;
  }

  inFlight.add(game.name);
  performPhaseStep(game, player, player.botProfile);
}

function recover(player: Player): void {
  dispatchBotAction(player.id, 'game:nextPhase', undefined);
}

function dispatchActions(
  game: Game,
  player: Player,
  actions: BotAction[],
  index = 0,
): void {
  if (index >= actions.length) return;
  const { event, payload } = actions[index];
  const res = dispatchBotAction(player.id, event, payload);
  if (!res.ok) return recover(player);
  dispatchActions(game, player, actions, index + 1);
}

function performPhaseStep(
  game: Game,
  player: Player,
  botProfile: BotProfile,
): void {
  const gameName = game.name;
  const botId = player.id;
  const requestedTurnNumber = game.turnNumber;
  const requestedPhase = game.turnPhase;

  planBotTurnAsync(
    game,
    botId,
    botProfile,
    campaignByGame.get(gameName) ?? null,
    (res) => {
      inFlight.delete(gameName);
      if (!res.ok) {
        console.error('bot turn planning failed', res.error);
        return;
      }
      const current = games.get(gameName);
      if (
        !current ||
        current.state !== 'playing' ||
        current.paused ||
        current.turnNumber !== requestedTurnNumber ||
        current.turnPhase !== requestedPhase ||
        current.playerIds[current.turnPlayerIndex] !== botId
      )
        return;

      campaignByGame.set(gameName, res.result.campaign);
      dispatchActions(current, player, res.result.actions);
    },
  );
}
