import { linkKey, switchedLinkStates, withUnlockedTiles } from 'engine';
import { useMemo } from 'react';
import type {
  DirectionalConnection,
  LockedTile,
  TimedConnection,
} from '../../../../lib/types';
import type { Territory } from '../../../mapData';
import type { ClickableRegions } from '../../../regions/clickableRegions';
import { withUnlockedRegions } from '../../../regions/unlockedRegions';
import type { MapSwitching } from '../../../switches/switches';
import { tileLineWidth } from '../../../tiles/tileGeometry';
import { useDirectionalConnections } from './useDirectionalConnections';
import { useTimedConnections } from './useTimedConnections';

export function useMapGraph({
  mapTerritories,
  mapRegions,
  timedConnections,
  directionalConnections,
  switching,
  switchesOn,
  lockedTiles,
  unlockedTileIds,
  round,
}: {
  mapTerritories: Territory[];
  mapRegions: ClickableRegions | null;
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
  switching: MapSwitching;
  switchesOn: number[];
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
  const onKey = switchesOn.join(',');
  const { switchOn, switched, controls } = useMemo(() => {
    const on = new Set(onKey.split(',').filter(Boolean).map(Number));
    const states = switching.switches.map((_, i) => on.has(i));
    return {
      switchOn: states,
      switched: switchedLinkStates(switching.switchedLinks, states),
      controls: new Map(
        switching.switchedLinks.map((link) => [linkKey(link.a, link.b), link]),
      ),
    };
  }, [switching, onKey]);
  const timed = useTimedConnections(
    openTerritories,
    timedConnections,
    round,
    switched,
    controls,
  );
  const { territories, directionalLinks } = useDirectionalConnections(
    timed.territories,
    directionalConnections,
    round,
    switched,
    controls,
  );
  return {
    territories,
    openTerritories,
    regions,
    closedTiles,
    timedLinks: timed.timedLinks,
    directionalLinks,
    switchOn,
  };
}
