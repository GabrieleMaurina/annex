import { callbacks } from '../callbacks';
import { hasAnyEntrench } from '../game/combat/autoSkip';
import { recordReplayFrame } from '../game/replay';
import { advanceTurnPhase } from '../game/turns';
import { fogFilterEmit } from '../game/world/fog';
import { visibleTerritoryIdsOrAll } from '../game/world/visibility';
import { GameResponse, requireGame } from '../session/context';
import { respondGameState } from '../session/store';
import { isInteger } from '../util/validate';

export function entrench(
  playerId: number,
  rawTerritoryId: unknown,
  rawTroops: unknown,
): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };
  if (game.turnPhase !== 'entrench')
    return { ok: false, error: 'not entrench phase' };
  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;
  if (game.territoryOwners.get(territoryId) !== playerId)
    return { ok: false, error: 'territory not owned' };
  if (game.capitalTerritoryIds.has(territoryId))
    return { ok: false, error: 'capital cannot be entrenched' };

  const currentTroops = game.territoryTroops.get(territoryId) ?? 0;
  if (!isInteger(rawTroops)) return { ok: false, error: 'invalid troops' };
  const troops = rawTroops;
  if (troops < 1 || troops > currentTroops - 1)
    return { ok: false, error: 'invalid troops' };

  game.territoryTroops.set(territoryId, currentTroops - troops);
  const turnsRemaining =
    (game.territoryEntrenchment.get(territoryId) ?? 0) + troops;
  game.territoryEntrenchment.set(territoryId, turnsRemaining);
  game.selectedTerritoryId = null;
  recordReplayFrame(game, { type: 'entrench', territoryId, troops, playerId });

  fogFilterEmit(game, 'game:entrenched', callbacks.onEntrenched, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(territoryId)) return null;
    return { territoryId, troops, turnsRemaining, playerId };
  });

  if (!hasAnyEntrench(game, playerId)) advanceTurnPhase(game);

  return respondGameState(game, playerId);
}
