import { callbacks } from '../callbacks';
import { recordReplayFrame } from '../game/replay';
import { advanceTurnPhase } from '../game/turns';
import {
  connectedOwnedTerritories,
  fortifyFullPath,
} from '../game/world/connectivity';
import { fogFilterEmit } from '../game/world/fog';
import { withPortalEdges } from '../game/world/portals';
import {
  pathRunsForViewer,
  troopMoveFields,
  visibleTerritoryIdsOrAll,
} from '../game/world/visibility';
import { getGameMap } from '../maps/maps';
import { GameResponse, requireGame } from '../session/context';
import { broadcastSelected, respondGameState } from '../session/store';
import { Game } from '../types';
import { isInteger, isNullableInteger } from '../util/validate';

function ownsOtherTerritory(
  game: Game,
  playerId: number,
  territoryId: number,
): boolean {
  for (const [id, ownerId] of game.territoryOwners) {
    if (id !== territoryId && ownerId === playerId) return true;
  }
  return false;
}

function isFortifyStartCandidate(
  game: Game,
  playerId: number,
  territoryId: number,
): boolean {
  if ((game.territoryTroops.get(territoryId) ?? 0) < 2) return false;
  if (game.fortification === 'Unrestricted')
    return ownsOtherTerritory(game, playerId, territoryId);
  const map = getGameMap(game);
  const territory = map.territories.find((t) => t.id === territoryId);
  const neighbors = withPortalEdges(
    territory?.neighbors ?? [],
    territoryId,
    game.portalTerritoryIds,
    game.portalsEnabled,
  );
  return neighbors.some((n) => game.territoryOwners.get(n) === playerId);
}

function isValidFortifyEnd(
  game: Game,
  playerId: number,
  startId: number,
  endId: number,
): boolean {
  if (game.fortification === 'Unrestricted') return true;
  if (game.fortification === 'Neighboring') {
    const map = getGameMap(game);
    const territory = map.territories.find((t) => t.id === startId);
    const neighbors = withPortalEdges(
      territory?.neighbors ?? [],
      startId,
      game.portalTerritoryIds,
      game.portalsEnabled,
    );
    return neighbors.includes(endId);
  }
  return connectedOwnedTerritories(game, playerId, [startId]).has(endId);
}

function requireFortifyTurn(playerId: number) {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing')
    return { ok: false as const, error: 'game not started' };
  if (game.paused) return { ok: false as const, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false as const, error: 'not your turn' };
  if (game.turnPhase !== 'fortify')
    return { ok: false as const, error: 'not fortify phase' };
  return ctx;
}

export function fortifySelectStart(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireFortifyTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (!isNullableInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;

  if (territoryId !== null) {
    if (!game.territoryOwners.has(territoryId))
      return { ok: false, error: 'invalid territory' };
    if (game.territoryOwners.get(territoryId) !== playerId)
      return { ok: false, error: 'territory not owned' };
    if (!isFortifyStartCandidate(game, playerId, territoryId))
      return { ok: false, error: 'invalid start territory' };
  }

  game.fortifyStartTerritoryId = territoryId;
  game.fortifyEndTerritoryId = null;
  if (territoryId !== null) broadcastSelected(game, territoryId);
  return respondGameState(game, playerId);
}

export function fortifySelectEnd(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireFortifyTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.fortifyStartTerritoryId === null)
    return { ok: false, error: 'no start territory selected' };
  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;
  if (!game.territoryOwners.has(territoryId))
    return { ok: false, error: 'invalid territory' };
  if (game.territoryOwners.get(territoryId) !== playerId)
    return { ok: false, error: 'territory not owned' };
  if (territoryId === game.fortifyStartTerritoryId)
    return { ok: false, error: 'invalid end territory' };
  if (
    !isValidFortifyEnd(
      game,
      playerId,
      game.fortifyStartTerritoryId,
      territoryId,
    )
  )
    return { ok: false, error: 'invalid end territory' };

  game.fortifyEndTerritoryId = territoryId;
  broadcastSelected(game, territoryId);
  return respondGameState(game, playerId);
}

export function fortify(playerId: number, rawTroops: unknown): GameResponse {
  const ctx = requireFortifyTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (
    game.fortifyStartTerritoryId === null ||
    game.fortifyEndTerritoryId === null
  )
    return { ok: false, error: 'no fortify selection' };
  if (!isInteger(rawTroops)) return { ok: false, error: 'invalid troops' };
  const troops = rawTroops;

  const startId = game.fortifyStartTerritoryId;
  const endId = game.fortifyEndTerritoryId;
  const startTroops = game.territoryTroops.get(startId) ?? 0;

  if (troops < 1 || troops > startTroops - 1)
    return { ok: false, error: 'invalid troops' };

  game.territoryTroops.set(startId, startTroops - troops);
  game.territoryTroops.set(
    endId,
    (game.territoryTroops.get(endId) ?? 0) + troops,
  );
  recordReplayFrame(game, {
    type: 'fortify',
    fromTerritoryId: startId,
    toTerritoryId: endId,
    troops,
    playerId,
  });

  const fullPath = fortifyFullPath(game, playerId, startId, endId);
  fogFilterEmit(game, 'game:fortified', callbacks.onFortified, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(endId) && !visible.has(startId))
      return null;
    return {
      territoryId: endId,
      fromTerritoryId: startId,
      playerId,
      path: pathRunsForViewer(fullPath, visible),
      ...troopMoveFields(visible, startId, endId, troops),
    };
  });
  advanceTurnPhase(game);

  return respondGameState(game, playerId);
}
