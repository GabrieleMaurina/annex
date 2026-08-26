import { Server, Socket } from 'socket.io';
import { Player } from '../../../types';
import { isInteger, isObject } from '../../../validate';
import { hasAnyToxin } from '../../logic/combat/autoSkip';
import {
  filterGameStateForViewer,
  fogFilterEmit,
  visibleTerritoryIdsOrAll,
} from '../../logic/fog';
import { removePortalTerritory } from '../../logic/portals';
import { countTerritories } from '../../logic/progression/stats';
import { recordReplayFrame } from '../../logic/replay';
import { gameState } from '../../logic/state';
import { games } from '../../logic/store';
import { toxinsCost, wouldSplitMap } from '../../logic/toxins/toxins';
import { advanceTurnPhase } from '../../logic/turns';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerToxinsHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:toxins',
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
      if (game.turnPhase !== 'toxins')
        return callback({ ok: false, error: 'not toxins phase' });

      const { territoryId } = isObject(data)
        ? data
        : ({} as Record<string, unknown>);
      if (!isInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });
      if (game.territoryOwners.get(territoryId) !== player.id)
        return callback({ ok: false, error: 'territory not owned' });
      if (game.capitalTerritoryIds.has(territoryId))
        return callback({ ok: false, error: 'capital cannot be toxined' });
      if (countTerritories(game, player.id) <= 1)
        return callback({
          ok: false,
          error: 'cannot toxin your last territory',
        });

      const cost = toxinsCost(game, player.id);
      const currentTroops = game.territoryTroops.get(territoryId) ?? 0;
      if (currentTroops < cost)
        return callback({ ok: false, error: 'not enough troops' });
      if (wouldSplitMap(game, territoryId))
        return callback({ ok: false, error: 'would split the map' });

      game.territoryOwners.delete(territoryId);
      game.territoryTroops.delete(territoryId);
      game.territoryEntrenchment.delete(territoryId);
      const permanent = game.toxins === 'permanent';
      const turnsRemaining = permanent ? 0 : 3;
      game.territoryToxins.set(territoryId, { permanent, turnsRemaining });
      if (permanent) removePortalTerritory(game, territoryId);
      if (game.selectedTerritoryId === territoryId)
        game.selectedTerritoryId = null;

      recordReplayFrame(game, {
        type: 'toxins',
        territoryId,
        playerId: player.id,
      });

      fogFilterEmit(io, game, playersById, 'game:toxined', (viewerId) => {
        const visible = visibleTerritoryIdsOrAll(game, viewerId);
        if (
          viewerId !== player.id &&
          visible !== null &&
          !visible.has(territoryId)
        )
          return null;
        return { territoryId, permanent, turnsRemaining, playerId: player.id };
      });

      if (!hasAnyToxin(game, player.id))
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
