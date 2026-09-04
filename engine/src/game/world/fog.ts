import { Game } from '../../types';

export const SERVER_VIEW_ID = -1;

const LOGGED_EVENTS = new Set([
  'game:deployed',
  'game:fortified',
  'game:attackMoved',
  'game:deployedMany',
  'game:entrenched',
  'game:toxined',
  'game:radiationChanged',
  'game:attacked',
  'game:cardSetPlayed',
  'game:turnStarted',
  'game:allianceFormed',
  'game:allianceTerminated',
  'game:capitalPlacementStarted',
  'game:territoryClaimed',
]);

export function recordLog(
  game: Game,
  viewerId: number,
  type: string,
  payload: unknown,
): void {
  if (!LOGGED_EVENTS.has(type)) return;
  const entries = game.logs.get(viewerId);
  if (entries) entries.push({ type, payload });
  else game.logs.set(viewerId, [{ type, payload }]);
}

export function recordLogForAll(
  game: Game,
  type: string,
  payload: unknown,
): void {
  for (const viewerId of [
    ...game.playerIds,
    ...game.spectatorIds,
    SERVER_VIEW_ID,
  ]) {
    recordLog(game, viewerId, type, payload);
  }
}

export function fogFilterEmit<T>(
  game: Game,
  eventName: string,
  emit: (playerId: number, payload: T) => void,
  buildPayload: (viewerId: number) => T | null,
): void {
  for (const viewerId of [
    ...game.playerIds,
    ...game.spectatorIds,
    SERVER_VIEW_ID,
  ]) {
    const payload = buildPayload(viewerId);
    if (payload === null) continue;
    if (viewerId !== SERVER_VIEW_ID) emit(viewerId, payload);
    recordLog(game, viewerId, eventName, payload);
  }
}
