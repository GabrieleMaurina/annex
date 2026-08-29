import {
  advanceTerritoryPhase,
  claimTerritory as claimTerritoryImpl,
} from '../game/turns';
import { getGameMap } from '../maps/maps';
import { GameResponse, requireGame } from '../session/context';
import { respondGameState } from '../session/store';

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

export function claimTerritory(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.turnPhase !== 'territory')
    return { ok: false, error: 'not territory phase' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };

  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;
  const map = getGameMap(game);
  if (
    territoryId < 0 ||
    territoryId >= map.territories.length ||
    game.radiationTerritoryIds.has(territoryId)
  )
    return { ok: false, error: 'invalid territory' };
  if (game.territoryOwners.has(territoryId))
    return { ok: false, error: 'territory already claimed' };

  claimTerritoryImpl(game, playerId, territoryId);
  advanceTerritoryPhase(game);

  return respondGameState(game, playerId);
}
