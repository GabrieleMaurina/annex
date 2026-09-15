import type { RefObject } from 'react';
import { useCallback } from 'react';
import type { SeaTerritory, Territory } from '../../mapData';
import { isPortalHop } from '../../portals';
import type { Point } from '../helpers';

export function useAnimationPathHelpers({
  territoriesRef,
  seaTerritoriesRef,
  portalTerritoryIds,
  portalsEnabled,
}: {
  territoriesRef: RefObject<Territory[]>;
  seaTerritoriesRef: RefObject<SeaTerritory[]>;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
}) {
  const findPosition = useCallback(
    (id: number): { x: number; y: number } | undefined =>
      territoriesRef.current.find((t) => t.id === id) ??
      seaTerritoriesRef.current.find((t) => t.id === id),
    [territoriesRef, seaTerritoriesRef],
  );

  const territoryPoints = useCallback(
    (territoryIds: number[]): Point[] =>
      territoryIds
        .map(findPosition)
        .filter((t): t is { x: number; y: number } => !!t),
    [findPosition],
  );

  const idRunsForPath = useCallback(
    (territoryIds: number[]): number[][] => {
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
    },
    [portalTerritoryIds, portalsEnabled],
  );

  const arrowRunsForPath = useCallback(
    (territoryIds: number[]): Point[][] =>
      idRunsForPath(territoryIds)
        .map((run) => territoryPoints(run))
        .filter((points) => points.length > 1),
    [idRunsForPath, territoryPoints],
  );

  return { findPosition, territoryPoints, idRunsForPath, arrowRunsForPath };
}
