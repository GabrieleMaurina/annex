import { forceEndTurnImpl } from '../game/turns';
import { playersById } from '../session/players';
import { broadcastGameState, games } from '../session/store';
import { BotProfile, Game, Player } from '../types';
import { dispatchBotAction } from './dispatch';
import { planBotTurnAsync } from './planning/botPool';
import { BotAction, TurnPlanCache } from './planning/planBotTurn';
import { clickDelayMs, thinkDelayMs } from './thinkTime';

type Payload = Record<string, unknown>;

const pendingActs = new Map<string, NodeJS.Timeout>();
const inFlight = new Set<string>();
const turnPlanByGame = new Map<string, TurnPlanCache>();
const stalledSteps = new Map<string, { turnKey: string; count: number }>();
const MAX_STALLED_STEPS = 3;

const SELECTED_TERRITORY_EVENTS = [
  'game:deploy',
  'game:placeTroop',
  'game:entrench',
];

const RESELECTIONS: Record<string, { field: keyof Game; key: string }> = {
  'game:attackSelectStart': {
    field: 'attackStartTerritoryId',
    key: 'territoryId',
  },
  'game:attackSelectEnd': { field: 'attackEndTerritoryId', key: 'territoryId' },
  'game:attackSeaSelectStart': {
    field: 'attackSeaTerritoryId',
    key: 'territoryId',
  },
  'game:attackSeaSelectDefender': {
    field: 'attackSeaDefenderId',
    key: 'defenderId',
  },
};

function currentBot(game: Game): (Player & { botProfile: BotProfile }) | null {
  if (game.state !== 'playing' || game.paused) return null;
  const player = playersById.get(game.playerIds[game.turnPlayerIndex]);
  if (!player?.isBot || !player.botProfile) return null;
  return player as Player & { botProfile: BotProfile };
}

function turnKeyOf(game: Game): string {
  return `${game.roundNumber}:${game.turnPlayerIndex}:${game.turnPhase}`;
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

function selectTerritoryAction(territoryId: unknown): BotAction {
  return { event: 'game:selectTerritory', payload: { territoryId } };
}

function withSelections(actions: BotAction[]): BotAction[] {
  return actions.flatMap((action) => {
    const payload = action.payload as Payload;
    if (SELECTED_TERRITORY_EVENTS.includes(action.event))
      return [selectTerritoryAction(payload.territoryId), action];
    if (action.event === 'game:buyShips' && !payload.fromPool)
      return [
        selectTerritoryAction(payload.sourceTerritoryId),
        action,
        selectTerritoryAction(null),
      ];
    return [action];
  });
}

function isAutomatic(game: Game, { event, payload }: BotAction): boolean {
  const p = payload as Payload;
  if (event === 'game:selectTerritory') return p.territoryId === null;
  const reselection = RESELECTIONS[event];
  return !!reselection && game[reselection.field] === p[reselection.key];
}

function pausesBefore(game: Game, actions: BotAction[]): boolean[] {
  const automatic = actions.map((action) => isAutomatic(game, action));
  return automatic.map(
    (auto, index) => index > 0 && !auto && !automatic[index - 1],
  );
}

function dispatchActions(
  game: Game,
  player: Player,
  actions: BotAction[],
  pauses: boolean[],
  done: (ok: boolean) => void,
  index = 0,
): void {
  if (index >= actions.length) return done(true);
  const dispatchNext = () => {
    const { event, payload } = actions[index];
    const res = dispatchBotAction(player.id, event, payload);
    if (!res.ok && event !== 'game:selectTerritory')
      return done(recover(player));
    dispatchActions(game, player, actions, pauses, done, index + 1);
  };
  if (!pauses[index]) return dispatchNext();

  const turnKey = turnKeyOf(game);
  setTimeout(() => {
    const stillActing =
      games.get(game.name) === game &&
      currentBot(game)?.id === player.id &&
      turnKeyOf(game) === turnKey;
    if (stillActing) dispatchNext();
    else done(true);
  }, clickDelayMs(game.botSpeed));
}

function handleStall(gameName: string): void {
  const game = games.get(gameName);
  if (!game || !currentBot(game)) {
    stalledSteps.delete(gameName);
    return;
  }
  const turnKey = turnKeyOf(game);
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
      if (!res.ok) {
        inFlight.delete(gameName);
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
        inFlight.delete(gameName);
        if (current) scheduleBotTurnIfNeeded(current);
        return;
      }

      turnPlanByGame.set(gameName, res.result.plan);
      const clicking = current.botSpeed !== 'fast';
      const actions = clicking
        ? withSelections(res.result.actions)
        : res.result.actions;
      if (actions.length === 0) {
        inFlight.delete(gameName);
        handleStall(gameName);
        return;
      }
      dispatchActions(
        current,
        player,
        actions,
        clicking ? pausesBefore(current, actions) : actions.map(() => false),
        (ok) => {
          inFlight.delete(gameName);
          if (!ok) {
            handleStall(gameName);
            return;
          }
          stalledSteps.delete(gameName);
          scheduleBotTurnIfNeeded(current);
        },
      );
    },
  );
}
