import { callbacks } from '../callbacks';
import { recordReplayFrame } from '../game/replay';
import { advanceCapitalPlacement, assignCapital } from '../game/turns';
import { fogFilterEmit } from '../game/world/fog';
import { visibleTerritoryIdsOrAll } from '../game/world/visibility';
import { GameResponse, requireGame } from '../session/context';
import { respondGameState } from '../session/store';
import { isInteger } from '../util/validate';

export function selectCapital(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.turnPhase !== 'capital')
    return { ok: false, error: 'not capital phase' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };
  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;
  if (game.territoryOwners.get(territoryId) !== playerId)
    return { ok: false, error: 'territory not owned' };

  assignCapital(game, territoryId);
  recordReplayFrame(game, { type: 'deploy', territoryId, troops: 3, playerId });
  fogFilterEmit(game, 'game:deployed', callbacks.onDeployed, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(territoryId)) return null;
    return { territoryId, troops: 3, playerId };
  });
  advanceCapitalPlacement(game);

  return respondGameState(game, playerId);
}
