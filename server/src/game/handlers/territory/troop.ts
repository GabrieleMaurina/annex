import { Server, Socket } from 'socket.io';
import { Player } from '../../../types';
import { depositTroopsOnOwnedTerritory } from '../../logic/mechanics';
import { gameState } from '../../logic/state';
import { games, respondWithGameState } from '../../logic/store';
import { advanceTroopPhase } from '../../logic/turns';
import { fogFilterEmit, visibleTerritoryIdsOrAll } from '../../logic/world/fog';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerTroopHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:placeTroop',
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
      if (game.turnPhase !== 'troop')
        return callback({ ok: false, error: 'not troop phase' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });

      const result = depositTroopsOnOwnedTerritory(game, player.id, data);
      if ('error' in result)
        return callback({ ok: false, error: result.error });
      const { territoryId, troops } = result;

      const pool = game.placementTroopPools.get(player.id) ?? 0;
      game.placementTroopPools.set(player.id, pool - troops);
      fogFilterEmit(io, game, playersById, 'game:deployed', (viewerId) => {
        const visible = visibleTerritoryIdsOrAll(game, viewerId);
        if (visible !== null && !visible.has(territoryId)) return null;
        return { territoryId, troops, playerId: player.id };
      });
      if (game.troopsToDeploy <= 0) advanceTroopPhase(game, io, playersById);

      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );
}
