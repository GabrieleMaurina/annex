import type { RefObject } from 'react';
import { useMemo } from 'react';
import type { LockedTile } from '../../../lib/types';
import type { SeaTerritory, Territory } from '../../mapData';
import { isPortalHop } from '../../portals';
import type { Point } from '../helpers';

export function createAnimationPathHelpers({
  getTerritories,
  getSeaTerritories,
  lockedTiles,
  portalTerritoryIds,
  portalsEnabled,
}: {
  getTerritories: () => Territory[];
  getSeaTerritories: () => SeaTerritory[];
  lockedTiles: LockedTile[];
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
}) {
  const findPosition = (id: number): { x: number; y: number } | undefined =>
    getTerritories().find((t) => t.id === id) ??
    getSeaTerritories().find((t) => t.id === id) ??
    lockedTiles.find((t) => t.id === id);

  const territoryPoints = (territoryIds: number[]): Point[] =>
    territoryIds
      .map(findPosition)
      .filter((t): t is { x: number; y: number } => !!t);

  const idRunsForPath = (territoryIds: number[]): number[][] => {
    const runs: number[][] = [];
    let current: number[] = [];
    for (let i = 0; i < territoryIds.length; i++) {
      if (
        i > 0 &&
        isPortalHop(
          territoryIds[i - 1],
          territoryIds[i],
          portalTerritoryIds,
          portalsEnabled,
        )
      ) {
        if (current.length > 1) runs.push(current);
        current = [];
      }
      current.push(territoryIds[i]);
    }
    if (current.length > 1) runs.push(current);
    return runs;
  };

  const arrowRunsForPath = (territoryIds: number[]): Point[][] =>
    idRunsForPath(territoryIds)
      .map((run) => territoryPoints(run))
      .filter((points) => points.length > 1);

  return { findPosition, territoryPoints, idRunsForPath, arrowRunsForPath };
}

const readRef = <T>(ref: RefObject<T>): T => ref.current;

export function useAnimationPathHelpers({
  territoriesRef,
  seaTerritoriesRef,
  lockedTiles,
  portalTerritoryIds,
  portalsEnabled,
}: {
  territoriesRef: RefObject<Territory[]>;
  seaTerritoriesRef: RefObject<SeaTerritory[]>;
  lockedTiles: LockedTile[];
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
}) {
  return useMemo(
    () =>
      createAnimationPathHelpers({
        getTerritories: () => readRef(territoriesRef),
        getSeaTerritories: () => readRef(seaTerritoriesRef),
        lockedTiles,
        portalTerritoryIds,
        portalsEnabled,
      }),
    [
      territoriesRef,
      seaTerritoriesRef,
      lockedTiles,
      portalTerritoryIds,
      portalsEnabled,
    ],
  );
}
