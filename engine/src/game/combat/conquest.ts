import { callbacks } from '../../callbacks';
import { Game } from '../../types';
import { addTroopsCapped } from '../mechanics';
import { recordReplayFrame } from '../replay';
import { fogFilterEmit } from '../world/fog';
import {
  pathRunsForViewer,
  troopMoveFields,
  visibleTerritoryIdsOrAll,
} from '../world/visibility';
import { attackFullPath } from './seaBridge';

export function snapshotCapitalRefunds(game: Game, playerId: number) {
  game.capitalRefunds = new Map(
    game.capitalRefund === 'on'
      ? [...game.capitalTerritoryIds]
          .filter((id) => game.territoryOwners.get(id) !== playerId)
          .map((id) => [id, game.territoryTroops.get(id) ?? 0])
      : [],
  );
}

export function refundCapital(game: Game, territoryId: number): number {
  const refunded = addTroopsCapped(
    game,
    territoryId,
    game.capitalRefunds.get(territoryId) ?? 0,
  );
  game.capitalRefunds.delete(territoryId);
  return refunded;
}

export function moveIntoConquest(
  game: Game,
  playerId: number,
  startId: number,
  endId: number,
  troops: number,
) {
  game.territoryTroops.set(
    startId,
    (game.territoryTroops.get(startId) ?? 0) - troops,
  );
  addTroopsCapped(game, endId, troops);
  const troopsRefunded = refundCapital(game, endId);
  recordReplayFrame(game, {
    type: 'fortify',
    fromTerritoryId: startId,
    toTerritoryId: endId,
    troops,
    ...(troopsRefunded > 0 ? { troopsRefunded } : {}),
    playerId,
  });

  const fullPath = attackFullPath(game, playerId, startId, endId);
  fogFilterEmit(
    game,
    'game:attackMoved',
    callbacks.onAttackMoved,
    (viewerId) => {
      const visible = visibleTerritoryIdsOrAll(game, viewerId);
      if (visible !== null && !visible.has(endId) && !visible.has(startId))
        return null;
      const endVisible = visible === null || visible.has(endId);
      return {
        territoryId: endId,
        fromTerritoryId: startId,
        path: pathRunsForViewer(fullPath, visible),
        ...troopMoveFields(visible, startId, endId, troops),
        ...(endVisible && troopsRefunded > 0 ? { troopsRefunded } : {}),
      };
    },
  );
}
