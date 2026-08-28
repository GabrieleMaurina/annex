import { Server, Socket } from 'socket.io';
import { getGameMap } from '../../maps';
import { Game, Player } from '../../types';
import { isInteger, isNullableInteger, isObject } from '../../validate';
import { recordReplayFrame } from '../logic/replay';
import { gameState } from '../logic/state';
import { gameRoomName, games, respondWithGameState } from '../logic/store';
import { advanceTurnPhase } from '../logic/turns';
import {
  connectedOwnedTerritories,
  fortifyFullPath,
} from '../logic/world/connectivity';
import {
  fogFilterEmit,
  pathRunsForViewer,
  troopMoveFields,
  visibleTerritoryIdsOrAll,
} from '../logic/world/fog';
import { withPortalEdges } from '../logic/world/portals';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

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

export function registerFortifyHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:fortifySelectStart',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.paused) return callback({ ok: false, error: 'game paused' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'fortify')
        return callback({ ok: false, error: 'not fortify phase' });

      const territoryId = isObject(data) ? data.territoryId : undefined;
      if (!isNullableInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });

      if (territoryId !== null) {
        if (!game.territoryOwners.has(territoryId))
          return callback({ ok: false, error: 'invalid territory' });
        if (game.territoryOwners.get(territoryId) !== player.id)
          return callback({ ok: false, error: 'territory not owned' });
        if (!isFortifyStartCandidate(game, player.id, territoryId))
          return callback({ ok: false, error: 'invalid start territory' });
      }

      game.fortifyStartTerritoryId = territoryId;
      game.fortifyEndTerritoryId = null;
      if (territoryId !== null)
        io.to(gameRoomName(game.name)).emit('game:selected', { territoryId });
      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );

  socket.on(
    'game:fortifySelectEnd',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.paused) return callback({ ok: false, error: 'game paused' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'fortify')
        return callback({ ok: false, error: 'not fortify phase' });
      if (game.fortifyStartTerritoryId === null)
        return callback({ ok: false, error: 'no start territory selected' });

      const territoryId = isObject(data) ? data.territoryId : undefined;
      if (!isInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });
      if (!game.territoryOwners.has(territoryId))
        return callback({ ok: false, error: 'invalid territory' });
      if (game.territoryOwners.get(territoryId) !== player.id)
        return callback({ ok: false, error: 'territory not owned' });
      if (territoryId === game.fortifyStartTerritoryId)
        return callback({ ok: false, error: 'invalid end territory' });

      if (
        !isValidFortifyEnd(
          game,
          player.id,
          game.fortifyStartTerritoryId,
          territoryId,
        )
      )
        return callback({ ok: false, error: 'invalid end territory' });

      game.fortifyEndTerritoryId = territoryId;
      io.to(gameRoomName(game.name)).emit('game:selected', { territoryId });
      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );

  socket.on(
    'game:fortify',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.paused) return callback({ ok: false, error: 'game paused' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'fortify')
        return callback({ ok: false, error: 'not fortify phase' });
      if (
        game.fortifyStartTerritoryId === null ||
        game.fortifyEndTerritoryId === null
      )
        return callback({ ok: false, error: 'no fortify selection' });

      const startId = game.fortifyStartTerritoryId;
      const endId = game.fortifyEndTerritoryId;
      const startTroops = game.territoryTroops.get(startId) ?? 0;

      const troops = isObject(data) ? data.troops : undefined;
      if (!isInteger(troops))
        return callback({ ok: false, error: 'invalid troops' });
      if (troops < 1 || troops > startTroops - 1)
        return callback({ ok: false, error: 'invalid troops' });

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
        playerId: player.id,
      });

      const fullPath = fortifyFullPath(game, player.id, startId, endId);
      fogFilterEmit(io, game, playersById, 'game:fortified', (viewerId) => {
        const visible = visibleTerritoryIdsOrAll(game, viewerId);
        if (visible !== null && !visible.has(endId) && !visible.has(startId))
          return null;
        return {
          territoryId: endId,
          fromTerritoryId: startId,
          playerId: player.id,
          path: pathRunsForViewer(fullPath, visible),
          ...troopMoveFields(visible, startId, endId, troops),
        };
      });
      advanceTurnPhase(game, io, playersById);

      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );
}
