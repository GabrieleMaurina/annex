import { Server, Socket } from 'socket.io';
import { maps } from '../../maps';
import { Game, Player } from '../../types';
import { isInteger, isNullableInteger, isObject } from '../../validate';
import { gameState } from '../logic/state';
import { gameRoomName, games } from '../logic/store';
import { advanceTurnPhase } from '../logic/turns';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

function connectedOwnedTerritories(
  game: Game,
  playerId: number,
  startId: number,
): Set<number> {
  const map = maps.get(game.mapName)!;
  const neighborsById = new Map(
    map.territories.map((t) => [t.id, t.neighbors]),
  );
  const visited = new Set<number>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighborId of neighborsById.get(current) ?? []) {
      if (visited.has(neighborId)) continue;
      if (game.territoryOwners.get(neighborId) !== playerId) continue;
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }
  return visited;
}

function isFortifyStartCandidate(
  game: Game,
  playerId: number,
  territoryId: number,
): boolean {
  if ((game.territoryTroops.get(territoryId) ?? 0) < 2) return false;
  const map = maps.get(game.mapName)!;
  const territory = map.territories.find((t) => t.id === territoryId);
  return (
    territory?.neighbors.some(
      (n) => game.territoryOwners.get(n) === playerId,
    ) ?? false
  );
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
      callback({ ok: true, game: gameState(game, playersById) });
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

      const reachable = connectedOwnedTerritories(
        game,
        player.id,
        game.fortifyStartTerritoryId,
      );
      if (!reachable.has(territoryId))
        return callback({ ok: false, error: 'invalid end territory' });

      game.fortifyEndTerritoryId = territoryId;
      io.to(gameRoomName(game.name)).emit('game:selected', { territoryId });
      callback({ ok: true, game: gameState(game, playersById) });
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

      advanceTurnPhase(game);

      io.to(gameRoomName(game.name)).emit('game:fortified', {
        territoryId: endId,
        troops,
      });
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
