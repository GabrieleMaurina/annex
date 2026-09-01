import { callbacks } from '../callbacks';
import { hasAnyToxin } from '../game/combat/autoSkip';
import { countTerritories } from '../game/progression/stats';
import { recordReplayFrame } from '../game/replay';
import { toxinsCost, wouldSplitMap } from '../game/toxins/toxins';
import { advanceTurnPhase } from '../game/turns';
import { fogFilterEmit } from '../game/world/fog';
import { removePortalTerritory } from '../game/world/portals';
import { visibleTerritoryIdsOrAll } from '../game/world/visibility';
import { GameResponse, requireGame } from '../session/context';
import { respondGameState } from '../session/store';
import { isInteger } from '../util/validate';

export function toxin(playerId: number, rawTerritoryId: unknown): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };
  if (game.turnPhase !== 'toxins')
    return { ok: false, error: 'not toxins phase' };
  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;
  if (game.territoryOwners.get(territoryId) !== playerId)
    return { ok: false, error: 'territory not owned' };
  if (game.capitalTerritoryIds.has(territoryId))
    return { ok: false, error: 'capital cannot be toxined' };
  if (countTerritories(game, playerId) <= 1)
    return { ok: false, error: 'cannot toxin your last territory' };

  const cost = toxinsCost(game, playerId);
  const currentTroops = game.territoryTroops.get(territoryId) ?? 0;
  if (currentTroops < cost) return { ok: false, error: 'not enough troops' };
  if (wouldSplitMap(game, territoryId))
    return { ok: false, error: 'would split the map' };

  game.territoryOwners.delete(territoryId);
  game.territoryTroops.delete(territoryId);
  game.territoryEntrenchment.delete(territoryId);
  const permanent = game.toxins === 'permanent';
  const roundsRemaining = permanent ? 0 : 3;
  game.territoryToxins.set(territoryId, { permanent, roundsRemaining });
  if (permanent) removePortalTerritory(game, territoryId);
  if (game.selectedTerritoryId === territoryId) game.selectedTerritoryId = null;

  recordReplayFrame(game, { type: 'toxins', territoryId, playerId });

  fogFilterEmit(game, 'game:toxined', callbacks.onToxined, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (viewerId !== playerId && visible !== null && !visible.has(territoryId))
      return null;
    return { territoryId, permanent, roundsRemaining, playerId };
  });

  if (!hasAnyToxin(game, playerId)) advanceTurnPhase(game);

  return respondGameState(game, playerId);
}
