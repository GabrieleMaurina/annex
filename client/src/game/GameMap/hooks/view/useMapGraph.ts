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
import {
  directionalGraph,
  useDirectionalConnections,
} from './useDirectionalConnections';
import { timedGraph, useTimedConnections } from './useTimedConnections';

export function unlockedMap(
  mapTerritories: Territory[],
  mapRegions: ClickableRegions | null,
  lockedTiles: LockedTile[],
  unlocked: Set<number>,
) {
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
}

function switchGraph(switching: MapSwitching, on: Set<number>) {
  const states = switching.switches.map((_, i) => on.has(i));
  return {
    switchOn: states,
    switched: switchedLinkStates(switching.switchedLinks, states),
    controls: new Map(
      switching.switchedLinks.map((link) => [linkKey(link.a, link.b), link]),
    ),
  };
}

export function mapGraphAt({
  openTerritories,
  timedConnections,
  directionalConnections,
  switching,
  switchesOn,
  round,
}: {
  openTerritories: Territory[];
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
  switching: MapSwitching;
  switchesOn: number[];
  round: number;
}) {
  const { switchOn, switched, controls } = switchGraph(
    switching,
    new Set(switchesOn),
  );
  const timed = timedGraph(
    openTerritories,
    timedConnections,
    round,
    switched,
    controls,
  );
  const directional = directionalGraph(
    timed.territories,
    directionalConnections,
    round,
    switched,
    controls,
  );
  return {
    territories: directional.territories,
    timedLinks: timed.timedLinks,
    directionalLinks: directional.directionalLinks,
    switchOn,
  };
}

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
    return unlockedMap(mapTerritories, mapRegions, lockedTiles, unlocked);
  }, [mapTerritories, mapRegions, lockedTiles, unlockedKey]);
  const onKey = switchesOn.join(',');
  const { switchOn, switched, controls } = useMemo(
    () =>
      switchGraph(
        switching,
        new Set(onKey.split(',').filter(Boolean).map(Number)),
      ),
    [switching, onKey],
  );
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
