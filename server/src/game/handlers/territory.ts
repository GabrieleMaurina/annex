import { Server, Socket } from 'socket.io';
import { maps } from '../../maps';
import { Player } from '../../types';
import { isInteger, isObject } from '../../validate';
import { gameState } from '../logic/state';
import { games } from '../logic/store';
import { advanceTerritoryPhase, claimTerritory } from '../logic/turns';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerTerritoryHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:claimTerritory',
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
      if (game.turnPhase !== 'territory')
        return callback({ ok: false, error: 'not territory phase' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });

      const territoryId = isObject(data) ? data.territoryId : undefined;
      const map = maps.get(game.mapName)!;
      if (
        !isInteger(territoryId) ||
        territoryId < 0 ||
        territoryId >= map.territories.length ||
        game.radiationTerritoryIds.has(territoryId)
      )
        return callback({ ok: false, error: 'invalid territory' });
      if (game.territoryOwners.has(territoryId))
        return callback({ ok: false, error: 'territory already claimed' });

      claimTerritory(game, io, player.id, territoryId);
      advanceTerritoryPhase(game, io, playersById);

      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
