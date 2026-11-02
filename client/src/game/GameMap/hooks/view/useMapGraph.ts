import { withUnlockedTiles } from 'engine';
import { useMemo } from 'react';
import type {
  DirectionalConnection,
  LockedTile,
  TimedConnection,
} from '../../../../lib/types';
import type { Territory } from '../../../mapData';
import type { ClickableRegions } from '../../../regions/clickableRegions';
import { withUnlockedRegions } from '../../../regions/unlockedRegions';
import { tileLineWidth } from '../../../tiles/tileGeometry';
import { useDirectionalConnections } from './useDirectionalConnections';
import { useTimedConnections } from './useTimedConnections';

export function useMapGraph({
  mapTerritories,
  mapRegions,
  timedConnections,
  directionalConnections,
  lockedTiles,
  unlockedTileIds,
  round,
}: {
  mapTerritories: Territory[];
  mapRegions: ClickableRegions | null;
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
  lockedTiles: LockedTile[];
  unlockedTileIds: number[];
  round: number;
}) {
  const unlockedKey = unlockedTileIds.join(',');
  const { openTerritories, regions, closedTiles } = useMemo(() => {
    const unlocked = new Set(
      unlockedKey.split(',').filter(Boolean).map(Number),
    );
    return {
      openTerritories: withUnlockedTiles(mapTerritories, lockedTiles, unlocked),
      regions:
        mapRegions &&
        withUnlockedRegions(
          mapRegions,
          lockedTiles.filter((tile) => unlocked.has(tile.id)),
          tileLineWidth(lockedTiles),
        ),
      closedTiles: lockedTiles.filter((tile) => !unlocked.has(tile.id)),
    };
  }, [mapTerritories, mapRegions, lockedTiles, unlockedKey]);
  const timed = useTimedConnections(openTerritories, timedConnections, round);
  const { territories, directionalLinks } = useDirectionalConnections(
    timed.territories,
    directionalConnections,
    round,
  );
  return {
    territories,
    openTerritories,
    regions,
    closedTiles,
    timedLinks: timed.timedLinks,
    directionalLinks,
  };
}
