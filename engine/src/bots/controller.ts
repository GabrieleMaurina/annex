import { forceEndTurnImpl } from '../game/turns';
import { playersById } from '../session/players';
import { broadcastGameState, games } from '../session/store';
import { BotProfile, Game, Player } from '../types';
import { dispatchBotAction } from './dispatch';
import { planBotTurnAsync } from './planning/botPool';
import { BotAction, TurnPlanCache } from './planning/planBotTurn';
import { thinkDelayMs } from './thinkTime';

const pendingActs = new Map<string, NodeJS.Timeout>();
const inFlight = new Set<string>();
const turnPlanByGame = new Map<string, TurnPlanCache>();
const stalledSteps = new Map<string, { turnKey: string; count: number }>();
const MAX_STALLED_STEPS = 3;

function currentBot(game: Game): (Player & { botProfile: BotProfile }) | null {
  if (game.state !== 'playing' || game.paused) return null;
  const player = playersById.get(game.playerIds[game.turnPlayerIndex]);
  if (!player?.isBot || !player.botProfile) return null;
  return player as Player & { botProfile: BotProfile };
}

export function scheduleBotTurnIfNeeded(game: Game): void {
  const player = currentBot(game);
  if (!player) return;
  if (pendingActs.has(game.name) || inFlight.has(game.name)) return;

  const delay = thinkDelayMs(game.botSpeed);
  const timer = setTimeout(() => {
    pendingActs.delete(game.name);
    const currentGame = games.get(game.name);
    if (currentGame) act(currentGame);
  }, delay);
  pendingActs.set(game.name, timer);
}

function act(game: Game): void {
  const player = currentBot(game);
  if (!player) return;

  if (player.botProfile.difficulty === 'idle') {
    forceEndTurnImpl(game, true);
    broadcastGameState(game);
    return;
  }

  inFlight.add(game.name);
  performPhaseStep(game, player, player.botProfile);
}

function recover(player: Player): boolean {
  return dispatchBotAction(player.id, 'game:nextPhase', undefined).ok;
}

function dispatchActions(
  player: Player,
  actions: BotAction[],
  index = 0,
): boolean {
  if (index >= actions.length) return true;
  const { event, payload } = actions[index];
  const res = dispatchBotAction(player.id, event, payload);
  if (!res.ok) return recover(player);
  return dispatchActions(player, actions, index + 1);
}

function handleStall(gameName: string): void {
  const game = games.get(gameName);
  if (!game || !currentBot(game)) {
    stalledSteps.delete(gameName);
    return;
  }
  const turnKey = `${game.roundNumber}:${game.turnPlayerIndex}:${game.turnPhase}`;
  const previous = stalledSteps.get(gameName);
  const count = previous?.turnKey === turnKey ? previous.count + 1 : 1;
  if (count < MAX_STALLED_STEPS) {
    stalledSteps.set(gameName, { turnKey, count });
    scheduleBotTurnIfNeeded(game);
    return;
  }
  stalledSteps.delete(gameName);
  forceEndTurnImpl(game);
  broadcastGameState(game);
}

function performPhaseStep(
  game: Game,
  player: Player,
  botProfile: BotProfile,
): void {
  const gameName = game.name;
  const botId = player.id;
  const requestedRoundNumber = game.roundNumber;
  const requestedPhase = game.turnPhase;

  planBotTurnAsync(
    game,
    botId,
    botProfile,
    turnPlanByGame.get(gameName) ?? null,
    (res) => {
      inFlight.delete(gameName);
      if (!res.ok) {
        console.error('bot turn planning failed', res.error);
        handleStall(gameName);
        return;
      }
      const current = games.get(gameName);
      if (
        !current ||
        current.state !== 'playing' ||
        current.paused ||
        current.roundNumber !== requestedRoundNumber ||
        current.turnPhase !== requestedPhase ||
        current.playerIds[current.turnPlayerIndex] !== botId
      ) {
        if (current) scheduleBotTurnIfNeeded(current);
        return;
      }

      turnPlanByGame.set(gameName, res.result.plan);
      const { actions } = res.result;
      if (actions.length > 0 && dispatchActions(player, actions))
        stalledSteps.delete(gameName);
      else handleStall(gameName);
    },
  );
}
