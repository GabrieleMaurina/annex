import { Server, Socket } from 'socket.io';
import { Player } from '../../types';
import { isInteger, isObject } from '../../validate';
import { recordReplayFrame } from '../logic/replay';
import { gameState } from '../logic/state';
import { gameRoomName, games } from '../logic/store';
import { advanceCapitalPlacement, assignCapital } from '../logic/turns';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerCapitalHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:selectCapital',
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
      if (game.turnPhase !== 'capital')
        return callback({ ok: false, error: 'not capital phase' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });

      const territoryId = isObject(data) ? data.territoryId : undefined;
      if (!isInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });
      if (game.territoryOwners.get(territoryId) !== player.id)
        return callback({ ok: false, error: 'territory not owned' });

      assignCapital(game, territoryId);
      recordReplayFrame(game, {
        type: 'deploy',
        territoryId,
        troops: 3,
        playerId: player.id,
      });
      io.to(gameRoomName(game.name)).emit('game:deployed', {
        territoryId,
        troops: 3,
      });
      advanceCapitalPlacement(game, io);

      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
