import { Server, Socket } from 'socket.io';
import { Player } from '../../types';
import { isNullableInteger, isObject } from '../../validate';
import { connectedOwnedTerritories } from '../logic/connectivity';
import {
  depositTroopsOnOwnedTerritory,
  supplyHubTerritoryIds,
} from '../logic/mechanics';
import { hasPlayableSet } from '../logic/progression/cards';
import { bumpStat } from '../logic/progression/stats';
import { gameState } from '../logic/state';
import { gameRoomName, games } from '../logic/store';
import { advanceTurnPhase } from '../logic/turns';

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
      if (game.paused) return callback({ ok: false, error: 'game paused' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });

      const territoryId = isObject(data) ? data.territoryId : undefined;
      if (!isNullableInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });

      if (territoryId !== null) {
        if (!game.territoryOwners.has(territoryId))
          return callback({ ok: false, error: 'invalid territory' });
        if (
          (game.turnPhase === 'deploy' ||
            game.turnPhase === 'troop' ||
            game.turnPhase === 'entrench' ||
            game.turnPhase === 'toxins') &&
          game.territoryOwners.get(territoryId) !== player.id
        )
          return callback({ ok: false, error: 'territory not owned' });
        if (
          (game.turnPhase === 'deploy' || game.turnPhase === 'troop') &&
          game.supplyLines === 'on' &&
          !connectedOwnedTerritories(
            game,
            player.id,
            supplyHubTerritoryIds(game, player.id),
          ).has(territoryId)
        )
          return callback({
            ok: false,
            error: 'territory not connected to supply hub',
          });
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
      if (game.paused) return callback({ ok: false, error: 'game paused' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'deploy')
        return callback({ ok: false, error: 'not deploy phase' });

      const result = depositTroopsOnOwnedTerritory(game, player.id, data);
      if ('error' in result)
        return callback({ ok: false, error: result.error });
      const { territoryId, troops } = result;

      bumpStat(game, player.id, 'troopsGained', troops);
      io.to(gameRoomName(game.name)).emit('game:deployed', {
        territoryId,
        troops,
      });
      if (
        game.troopsToDeploy <= 0 &&
        !hasPlayableSet(game.playerCards.get(player.id) ?? [])
      )
        advanceTurnPhase(game, io, playersById);

      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
