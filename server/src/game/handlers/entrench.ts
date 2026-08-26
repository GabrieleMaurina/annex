import { Server, Socket } from 'socket.io';
import { Player } from '../../types';
import { isInteger, isObject } from '../../validate';
import { hasAnyEntrench } from '../logic/combat/autoSkip';
import {
  filterGameStateForViewer,
  fogFilterEmit,
  visibleTerritoryIdsOrAll,
} from '../logic/fog';
import { recordReplayFrame } from '../logic/replay';
import { gameState } from '../logic/state';
import { games } from '../logic/store';
import { advanceTurnPhase } from '../logic/turns';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerEntrenchHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:entrench',
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
      if (game.turnPhase !== 'entrench')
        return callback({ ok: false, error: 'not entrench phase' });

      const { territoryId, troops } = isObject(data)
        ? data
        : ({} as Record<string, unknown>);
      if (!isInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });
      if (game.territoryOwners.get(territoryId) !== player.id)
        return callback({ ok: false, error: 'territory not owned' });
      if (game.capitalTerritoryIds.has(territoryId))
        return callback({ ok: false, error: 'capital cannot be entrenched' });

      const currentTroops = game.territoryTroops.get(territoryId) ?? 0;
      if (!isInteger(troops))
        return callback({ ok: false, error: 'invalid troops' });
      if (troops < 1 || troops > currentTroops - 1)
        return callback({ ok: false, error: 'invalid troops' });

      game.territoryTroops.set(territoryId, currentTroops - troops);
      const turnsRemaining =
        (game.territoryEntrenchment.get(territoryId) ?? 0) + troops;
      game.territoryEntrenchment.set(territoryId, turnsRemaining);
      game.selectedTerritoryId = null;
      recordReplayFrame(game, {
        type: 'entrench',
        territoryId,
        troops,
        playerId: player.id,
      });

      fogFilterEmit(io, game, playersById, 'game:entrenched', (viewerId) => {
        const visible = visibleTerritoryIdsOrAll(game, viewerId);
        if (visible !== null && !visible.has(territoryId)) return null;
        return { territoryId, troops, turnsRemaining };
      });

      if (!hasAnyEntrench(game, player.id))
        advanceTurnPhase(game, io, playersById);

      callback({
        ok: true,
        game: filterGameStateForViewer(
          gameState(game, playersById),
          game,
          player.id,
        ),
      });
    },
  );
}
