import { callbacks } from '../callbacks';
import { depositTroopsOnOwnedTerritory } from '../game/mechanics';
import { advanceTroopPhase } from '../game/turns';
import { fogFilterEmit } from '../game/world/fog';
import { visibleTerritoryIdsOrAll } from '../game/world/visibility';
import { GameResponse, requireGame } from '../session/context';
import { respondGameState } from '../session/store';

export function placeTroop(
  playerId: number,
  territoryId: unknown,
  troops: unknown,
): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.turnPhase !== 'troop')
    return { ok: false, error: 'not troop phase' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };

  const result = depositTroopsOnOwnedTerritory(
    game,
    playerId,
    territoryId,
    troops,
  );
  if ('error' in result) return { ok: false, error: result.error };

  const pool = game.placementTroopPools.get(playerId) ?? 0;
  game.placementTroopPools.set(playerId, pool - result.troops);
  fogFilterEmit(game, 'game:deployed', callbacks.onDeployed, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(result.territoryId)) return null;
    return { territoryId: result.territoryId, troops: result.troops, playerId };
  });
  if (game.troopsToDeploy <= 0) advanceTroopPhase(game);

  return respondGameState(game, playerId);
}
