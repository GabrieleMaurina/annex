import { callbacks } from '../../callbacks';
import { hasPlayableSet } from '../../game/progression/cards';
import { recordReplayFrame } from '../../game/replay';
import { advanceTurnPhase } from '../../game/turns';
import { fogFilterEmit } from '../../game/world/fog';
import { addSeaShips, isSeaTerritory } from '../../game/world/seaShips';
import { visibleTerritoryIdsOrAll } from '../../game/world/visibility';
import { getGameMap } from '../../maps/maps';
import { GameResponse, requireGame } from '../../session/context';
import { respondGameState } from '../../session/store';
import { Game } from '../../types';
import { isInteger } from '../../util/validate';

const SHIP_COST = 3;

function requireDeployTurn(playerId: number) {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing')
    return { ok: false as const, error: 'game not started' };
  if (game.paused) return { ok: false as const, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false as const, error: 'not your turn' };
  if (game.turnPhase !== 'deploy')
    return { ok: false as const, error: 'not deploy phase' };
  return ctx;
}

function isSourceAdjacentToSea(
  game: Game,
  sourceTerritoryId: number,
  seaTerritoryId: number,
): boolean {
  const territory = getGameMap(game).territories.find(
    (t) => t.id === sourceTerritoryId,
  );
  return territory?.neighbors.includes(seaTerritoryId) ?? false;
}

export function buyShips(
  playerId: number,
  rawSourceTerritoryId: unknown,
  rawSeaTerritoryId: unknown,
  rawShips: unknown,
  rawFromPool: unknown,
): GameResponse {
  const ctx = requireDeployTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;

  if (!isInteger(rawSourceTerritoryId))
    return { ok: false, error: 'invalid territory' };
  if (!isInteger(rawSeaTerritoryId)) return { ok: false, error: 'invalid sea' };
  if (!isInteger(rawShips) || rawShips < 1)
    return { ok: false, error: 'invalid ships' };
  if (typeof rawFromPool !== 'boolean')
    return { ok: false, error: 'invalid payment' };

  const sourceTerritoryId = rawSourceTerritoryId;
  const seaTerritoryId = rawSeaTerritoryId;
  const ships = rawShips;
  const fromPool = rawFromPool;

  if (game.territoryOwners.get(sourceTerritoryId) !== playerId)
    return { ok: false, error: 'territory not owned' };
  if (!isSeaTerritory(game, seaTerritoryId))
    return { ok: false, error: 'invalid sea' };
  if (!isSourceAdjacentToSea(game, sourceTerritoryId, seaTerritoryId))
    return { ok: false, error: 'sea not connected to source' };

  const cost = ships * SHIP_COST;
  if (fromPool) {
    if (game.troopsToDeploy < cost)
      return { ok: false, error: 'not enough troops' };
    game.troopsToDeploy -= cost;
  } else {
    const sourceTroops = game.territoryTroops.get(sourceTerritoryId) ?? 0;
    if (sourceTroops - cost < 1)
      return { ok: false, error: 'not enough troops' };
    game.territoryTroops.set(sourceTerritoryId, sourceTroops - cost);
  }

  addSeaShips(game, seaTerritoryId, playerId, ships);

  recordReplayFrame(game, {
    type: 'buyShips',
    sourceTerritoryId,
    seaTerritoryId,
    ships,
    fromPool,
    playerId,
  });

  fogFilterEmit(
    game,
    'game:shipsBought',
    callbacks.onShipsBought,
    (viewerId) => {
      const visible = visibleTerritoryIdsOrAll(game, viewerId);
      if (
        visible !== null &&
        !visible.has(sourceTerritoryId) &&
        !visible.has(seaTerritoryId)
      )
        return null;
      return { sourceTerritoryId, seaTerritoryId, ships, fromPool, playerId };
    },
  );

  if (fromPool) {
    const hand = game.playerCards.get(playerId) ?? [];
    if (
      game.troopsToDeploy <= 0 &&
      hand.length < 5 &&
      (game.deployCardMandate || !hasPlayableSet(hand))
    )
      advanceTurnPhase(game);
  }

  return respondGameState(game, playerId);
}
