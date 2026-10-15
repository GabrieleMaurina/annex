import type { CallbackPayload } from '../../callbacks';
import { Game } from '../../types';

export const SERVER_VIEW_ID = 0;

export interface FogEventPayloads {
  'game:deployed': CallbackPayload<'onDeployed'>;
  'game:deployedMany': CallbackPayload<'onDeployedMany'>;
  'game:fortified': CallbackPayload<'onFortified'>;
  'game:attackMoved': CallbackPayload<'onAttackMoved'>;
  'game:attacked': CallbackPayload<'onAttacked'>;
  'game:entrenched': CallbackPayload<'onEntrenched'>;
  'game:toxined': CallbackPayload<'onToxined'>;
  'game:toxinExpired': CallbackPayload<'onToxinExpired'>;
  'game:radiationUpcoming': CallbackPayload<'onRadiationUpcoming'>;
  'game:radiationChanged': CallbackPayload<'onRadiationChanged'>;
  'game:starved': CallbackPayload<'onStarved'>;
  'game:sailed': CallbackPayload<'onSailed'>;
  'game:shipsBought': CallbackPayload<'onShipsBought'>;
  'game:seaAttacked': CallbackPayload<'onSeaAttacked'>;
}

export interface LogPayloads {
  'game:deployed': CallbackPayload<'onDeployed'>;
  'game:deployedMany': CallbackPayload<'onDeployedMany'>;
  'game:fortified': CallbackPayload<'onFortified'>;
  'game:attackMoved': CallbackPayload<'onAttackMoved'>;
  'game:attacked': CallbackPayload<'onAttacked'>;
  'game:entrenched': CallbackPayload<'onEntrenched'>;
  'game:toxined': CallbackPayload<'onToxined'>;
  'game:radiationChanged': CallbackPayload<'onRadiationChanged'>;
  'game:nukeLaunched': CallbackPayload<'onNukeLaunched'>;
  'game:cardSetPlayed': CallbackPayload<'onCardSetPlayed'>;
  'game:turnStarted': CallbackPayload<'onTurnStarted'>;
  'game:allianceFormed': { withId: number; playerId?: number };
  'game:allianceTerminated': { withId: number; playerId?: number };
  'game:capitalPlacementStarted': Record<string, never>;
  'game:territoryClaimed': CallbackPayload<'onTerritoryClaimed'>;
}

const LOGGED_EVENTS: Set<string> = new Set<keyof LogPayloads>([
  'game:deployed',
  'game:fortified',
  'game:attackMoved',
  'game:deployedMany',
  'game:entrenched',
  'game:toxined',
  'game:radiationChanged',
  'game:nukeLaunched',
  'game:attacked',
  'game:cardSetPlayed',
  'game:turnStarted',
  'game:allianceFormed',
  'game:allianceTerminated',
  'game:capitalPlacementStarted',
  'game:territoryClaimed',
]);

function appendLog(
  game: Game,
  viewerId: number,
  type: string,
  payload: unknown,
): void {
  if (!LOGGED_EVENTS.has(type)) return;
  if (viewerId === SERVER_VIEW_ID) {
    game.replayLog.push({
      afterFrame: game.replayFrames.length,
      type,
      payload,
    });
    return;
  }
  const entries = game.logs.get(viewerId);
  if (entries) entries.push({ type, payload });
  else game.logs.set(viewerId, [{ type, payload }]);
}

export function recordLog<E extends keyof LogPayloads>(
  game: Game,
  viewerId: number,
  type: E,
  payload: LogPayloads[E],
): void {
  appendLog(game, viewerId, type, payload);
}

export function recordLogForAll<E extends keyof LogPayloads>(
  game: Game,
  type: E,
  payload: LogPayloads[E],
): void {
  for (const viewerId of [
    ...game.playerIds,
    ...game.spectatorIds,
    SERVER_VIEW_ID,
  ]) {
    appendLog(game, viewerId, type, payload);
  }
}

export function fogFilterEmit<E extends keyof FogEventPayloads>(
  game: Game,
  eventName: E,
  emit: (
    playerId: number,
    payload: FogEventPayloads[E],
    gameName: string,
  ) => void,
  buildPayload: (viewerId: number) => FogEventPayloads[E] | null,
): void {
  for (const viewerId of [
    ...game.playerIds,
    ...game.spectatorIds,
    SERVER_VIEW_ID,
  ]) {
    const payload = buildPayload(viewerId);
    if (payload === null) continue;
    if (viewerId !== SERVER_VIEW_ID) emit(viewerId, payload, game.name);
    appendLog(game, viewerId, eventName, payload);
  }
}
