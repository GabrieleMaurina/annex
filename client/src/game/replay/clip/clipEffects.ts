import { playerColor } from '../../../lib/palette';
import type {
  GameState,
  LockedTile,
  ReplayAnimation,
} from '../../../lib/types';
import {
  getAnimationDuration,
  startAnimation,
  startNukeAnimation,
  startUnlockAnimation,
} from '../../animations';
import { createAnimationPathHelpers } from '../../GameMap/hooks/useAnimationPathHelpers';
import { getAttackPath } from '../../logic/attack';
import { formatTroops } from '../../logic/formatTroops';
import { getFortifyPath } from '../../logic/fortify';
import { getSailPath } from '../../logic/sail';
import type { SeaTerritory, Territory } from '../../mapData';
import { insetPolygon, tileLineWidth } from '../../tiles/tileGeometry';

interface EffectWorld {
  game: GameState;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  seas: GameState['seas'];
  ownerById: Map<number, GameState['territories'][number]>;
  lockedTiles: LockedTile[];
}

type ScheduleEffect = (delayMs: number, run: () => void) => void;

export function startFrameEffects(
  animation: ReplayAnimation,
  partOfConquestPair: boolean,
  world: EffectWorld,
  schedule: ScheduleEffect,
) {
  const { game, territories, seaTerritories, seas, ownerById, lockedTiles } =
    world;
  const { findPosition, arrowRunsForPath } = createAnimationPathHelpers({
    getTerritories: () => territories,
    getSeaTerritories: () => seaTerritories,
    lockedTiles,
    portalTerritoryIds: game.portalTerritoryIds,
    portalsEnabled: game.portalsEnabled,
  });
  const colorByPlayerId = new Map(game.players.map((p) => [p.id, p.color]));

  function colorFor(playerId: number | undefined): string {
    const color =
      playerId === undefined ? undefined : colorByPlayerId.get(playerId);
    return color === undefined ? '#ffffff' : playerColor(color);
  }

  function troopChange(
    kind: 'add' | 'remove',
    payload: { territoryId: number; troops: number; playerId?: number },
    arrowPath?: { x: number; y: number }[][],
  ) {
    const position = findPosition(payload.territoryId);
    if (!position) return;
    const ownerId =
      payload.playerId ?? ownerById.get(payload.territoryId)?.ownerId;
    startAnimation(
      kind,
      position.x,
      position.y,
      `${kind === 'add' ? '+' : '-'}${formatTroops(payload.troops)}`,
      colorFor(ownerId),
      arrowPath,
    );
  }

  function explode(territoryId: number) {
    const position = findPosition(territoryId);
    if (position) startAnimation('explosion', position.x, position.y);
  }

  function attackEffects(
    attackingTerritoryId: number,
    defendingTerritoryId: number,
    attackerId: number,
    defenderId: number | undefined,
    attackLosses: number,
    defenceLosses: number,
    arrowPath?: { x: number; y: number }[][],
  ) {
    if (defenceLosses > 0) {
      explode(defendingTerritoryId);
      troopChange(
        'remove',
        {
          territoryId: defendingTerritoryId,
          troops: defenceLosses,
          playerId: defenderId,
        },
        arrowPath,
      );
      if (attackLosses > 0) {
        explode(attackingTerritoryId);
        troopChange('remove', {
          territoryId: attackingTerritoryId,
          troops: attackLosses,
          playerId: attackerId,
        });
      }
    } else if (attackLosses > 0) {
      explode(attackingTerritoryId);
      troopChange(
        'remove',
        {
          territoryId: attackingTerritoryId,
          troops: attackLosses,
          playerId: attackerId,
        },
        arrowPath,
      );
    }
  }

  switch (animation.type) {
    case 'deploy':
      troopChange('add', animation);
      break;
    case 'fortify': {
      let arrowPath: { x: number; y: number }[][] | undefined;
      if (!partOfConquestPair) {
        const pathIds = getFortifyPath(
          territories,
          seaTerritories,
          seas,
          ownerById,
          animation.playerId,
          animation.fromTerritoryId,
          animation.toTerritoryId,
          game.fortification,
          game.portalTerritoryIds,
          game.portalsEnabled,
        );
        arrowPath = arrowRunsForPath(
          pathIds.length > 1
            ? pathIds
            : [animation.fromTerritoryId, animation.toTerritoryId],
        );
      }
      troopChange('remove', {
        territoryId: animation.fromTerritoryId,
        troops: animation.troops,
        playerId: animation.playerId,
      });
      troopChange(
        'add',
        {
          territoryId: animation.toTerritoryId,
          troops: animation.troops + (animation.troopsRefunded ?? 0),
          playerId: animation.playerId,
        },
        arrowPath,
      );
      break;
    }
    case 'entrench': {
      const position = findPosition(animation.territoryId);
      if (position) startAnimation('entrench', position.x, position.y);
      troopChange('remove', animation);
      break;
    }
    case 'starve': {
      const position = findPosition(animation.territoryId);
      if (position)
        startAnimation(
          'starve',
          position.x,
          position.y,
          `-${formatTroops(animation.troops)}`,
          colorFor(ownerById.get(animation.territoryId)?.ownerId),
        );
      break;
    }
    case 'nuke': {
      const target = findPosition(animation.targetTerritoryId);
      if (!target) break;
      const from = findPosition(animation.fromTerritoryId) ?? target;
      const interceptFrom =
        animation.interceptFromTerritoryId !== null
          ? findPosition(animation.interceptFromTerritoryId)
          : undefined;
      startNukeAnimation(
        { x: from.x, y: from.y },
        { x: target.x, y: target.y },
        animation.intercepted,
        interceptFrom ? { x: interceptFrom.x, y: interceptFrom.y } : null,
      );
      break;
    }
    case 'unlock': {
      const tile = lockedTiles.find((t) => t.id === animation.tileId);
      if (tile)
        startUnlockAnimation({
          ...tile,
          points: insetPolygon(tile.points, tileLineWidth(lockedTiles) / 2),
        });
      explode(animation.tileId);
      troopChange('remove', {
        territoryId: animation.fromTerritoryId,
        troops: animation.cost,
        playerId: animation.playerId,
      });
      break;
    }
    case 'switch':
      troopChange('remove', {
        territoryId: animation.fromTerritoryId,
        troops: animation.cost,
        playerId: animation.playerId,
      });
      break;
    case 'buyShips':
      troopChange('add', {
        territoryId: animation.seaTerritoryId,
        troops: animation.ships,
        playerId: animation.playerId,
      });
      break;
    case 'sail': {
      const pathIds = getSailPath(
        seaTerritories,
        animation.fromSeaTerritoryId,
        animation.toSeaTerritoryId,
      );
      const arrowPath = arrowRunsForPath(
        pathIds.length > 1
          ? pathIds
          : [animation.fromSeaTerritoryId, animation.toSeaTerritoryId],
      );
      troopChange('remove', {
        territoryId: animation.fromSeaTerritoryId,
        troops: animation.ships,
        playerId: animation.playerId,
      });
      troopChange(
        'add',
        {
          territoryId: animation.toSeaTerritoryId,
          troops: animation.ships,
          playerId: animation.playerId,
        },
        arrowPath,
      );
      break;
    }
    case 'attackSea':
      if (animation.attackLosses > 0 || animation.defenceLosses > 0)
        explode(animation.seaTerritoryId);
      if (animation.attackLosses > 0)
        troopChange('remove', {
          territoryId: animation.seaTerritoryId,
          troops: animation.attackLosses,
          playerId: animation.attackerId,
        });
      if (animation.defenceLosses > 0)
        troopChange('remove', {
          territoryId: animation.seaTerritoryId,
          troops: animation.defenceLosses,
          playerId: animation.defenderId,
        });
      break;
    case 'attack': {
      const arrowPath = partOfConquestPair
        ? undefined
        : arrowRunsForPath(
            getAttackPath(
              territories,
              seaTerritories,
              animation.attackingTerritoryId,
              animation.defendingTerritoryId,
              game.portalTerritoryIds,
              game.portalsEnabled,
            ),
          );
      attackEffects(
        animation.attackingTerritoryId,
        animation.defendingTerritoryId,
        animation.attackerId,
        animation.defenderId,
        animation.attackLosses,
        animation.defenceLosses,
        arrowPath,
      );
      const refunded = animation.troopsRefunded;
      if (refunded)
        schedule(getAnimationDuration('remove'), () =>
          troopChange('add', {
            territoryId: animation.defendingTerritoryId,
            troops: refunded,
          }),
        );
      break;
    }
    default:
      break;
  }
}
