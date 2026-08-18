import { Server, Socket } from 'socket.io';
import { Player } from '../types';
import { isInteger, isNullableInteger, isObject } from '../validate';
import { gameState } from './state';
import { gameRoomName, games } from './store';
import { advanceTurnPhase } from './turns';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerDeployHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:selectTerritory',
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

      const territoryId = isObject(data) ? data.territoryId : undefined;
      if (!isNullableInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });

      if (territoryId !== null) {
        if (!game.territoryOwners.has(territoryId))
          return callback({ ok: false, error: 'invalid territory' });
        if (
          game.turnPhase === 'deploy' &&
          game.territoryOwners.get(territoryId) !== player.id
        )
          return callback({ ok: false, error: 'territory not owned' });
      }

      game.selectedTerritoryId = territoryId;
      if (territoryId !== null)
        io.to(gameRoomName(game.name)).emit('game:selected', { territoryId });
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );

  socket.on(
    'game:deploy',
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
      if (game.turnPhase !== 'deploy')
        return callback({ ok: false, error: 'not deploy phase' });

      const { territoryId, troops } = isObject(data)
        ? data
        : ({} as Record<string, unknown>);
      if (!isInteger(territoryId))
        return callback({ ok: false, error: 'territory not owned' });
      if (game.territoryOwners.get(territoryId) !== player.id)
        return callback({ ok: false, error: 'territory not owned' });
      if (!isInteger(troops))
        return callback({ ok: false, error: 'invalid troops' });
      if (troops < 1 || troops > game.troopsToDeploy)
        return callback({ ok: false, error: 'invalid troops' });

      game.territoryTroops.set(
        territoryId,
        (game.territoryTroops.get(territoryId) ?? 0) + troops,
      );
      game.troopsToDeploy -= troops;
      game.selectedTerritoryId = null;
      if (game.troopsToDeploy <= 0) advanceTurnPhase(game);

      io.to(gameRoomName(game.name)).emit('game:deployed', {
        territoryId,
        troops,
      });
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
