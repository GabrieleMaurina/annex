import { callbacks } from '../../callbacks';
import { recordReplayFrame } from '../../game/replay';
import { advanceTurnPhase } from '../../game/turns';
import {
  connectedSeaTerritories,
  sailFullPath,
} from '../../game/world/connectivity';
import { fogFilterEmit } from '../../game/world/fog';
import {
  addSeaShips,
  isSeaTerritory,
  setSeaShips,
} from '../../game/world/seaShips';
import {
  pathRunsForViewer,
  shipMoveFields,
  visibleTerritoryIdsOrAll,
} from '../../game/world/visibility';
import { GameResponse, requireGame } from '../../session/context';
import { broadcastSelected, respondGameState } from '../../session/store';
import { isInteger, isNullableInteger } from '../../util/validate';

function requireSailTurn(playerId: number) {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing')
    return { ok: false as const, error: 'game not started' };
  if (game.paused) return { ok: false as const, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false as const, error: 'not your turn' };
  if (game.turnPhase !== 'sail')
    return { ok: false as const, error: 'not sail phase' };
  return ctx;
}

export function sailSelectStart(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireSailTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (!isNullableInteger(rawTerritoryId))
    return { ok: false, error: 'invalid sea' };
  const territoryId = rawTerritoryId;

  if (territoryId !== null) {
    if (!isSeaTerritory(game, territoryId))
      return { ok: false, error: 'invalid sea' };
    if ((game.seaShips.get(territoryId)?.get(playerId) ?? 0) < 1)
      return { ok: false, error: 'no ships there' };
  }

  game.sailStartTerritoryId = territoryId;
  game.sailEndTerritoryId = null;
  if (territoryId !== null) broadcastSelected(game, territoryId);
  return respondGameState(game, playerId);
}

export function sailSelectEnd(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireSailTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.sailStartTerritoryId === null)
    return { ok: false, error: 'no start sea selected' };
  if (!isInteger(rawTerritoryId)) return { ok: false, error: 'invalid sea' };
  const territoryId = rawTerritoryId;
  if (territoryId === game.sailStartTerritoryId)
    return { ok: false, error: 'invalid end sea' };
  if (
    !connectedSeaTerritories(game, [game.sailStartTerritoryId]).has(territoryId)
  )
    return { ok: false, error: 'invalid end sea' };

  game.sailEndTerritoryId = territoryId;
  broadcastSelected(game, territoryId);
  return respondGameState(game, playerId);
}

export function sail(playerId: number, rawShips: unknown): GameResponse {
  const ctx = requireSailTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.sailStartTerritoryId === null || game.sailEndTerritoryId === null)
    return { ok: false, error: 'no sail selection' };
  if (!isInteger(rawShips)) return { ok: false, error: 'invalid ships' };
  const ships = rawShips;

  const startId = game.sailStartTerritoryId;
  const endId = game.sailEndTerritoryId;
  const startShips = game.seaShips.get(startId)?.get(playerId) ?? 0;

  if (ships < 1 || ships > startShips)
    return { ok: false, error: 'invalid ships' };

  setSeaShips(game, startId, playerId, startShips - ships);
  addSeaShips(game, endId, playerId, ships);

  recordReplayFrame(game, {
    type: 'sail',
    fromSeaTerritoryId: startId,
    toSeaTerritoryId: endId,
    ships,
    playerId,
  });

  const fullPath = sailFullPath(game, startId, endId);
  fogFilterEmit(game, 'game:sailed', callbacks.onSailed, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(startId) && !visible.has(endId))
      return null;
    return {
      seaTerritoryId: endId,
      fromSeaTerritoryId: startId,
      playerId,
      path: pathRunsForViewer(fullPath, visible),
      ...shipMoveFields(visible, startId, endId, ships),
    };
  });
  advanceTurnPhase(game);

  return respondGameState(game, playerId);
}
