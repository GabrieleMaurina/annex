import type { RefObject } from 'react';
import { useMemo } from 'react';
import type { LockedTile } from '../../../lib/types';
import type { ArrowPoint } from '../../animations';
import type { SeaTerritory, Territory } from '../../mapData';
import { isPortalHop } from '../../portals';

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

  const territoryPoints = (
    territoryIds: number[],
    shipOwnerId?: number,
    seas: Set<number> | null = shipOwnerId === undefined
      ? null
      : new Set(getSeaTerritories().map((s) => s.id)),
  ): ArrowPoint[] => {
    return territoryIds.flatMap((id) => {
      const position = findPosition(id);
      if (!position) return [];
      return seas?.has(id)
        ? [{ x: position.x, y: position.y, seaId: id, shipOwnerId }]
        : [position];
    });
  };

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

  const arrowRunsForPath = (
    territoryIds: number[],
    shipOwnerId?: number,
  ): ArrowPoint[][] => {
    const seas =
      shipOwnerId === undefined
        ? null
        : new Set(getSeaTerritories().map((s) => s.id));
    return idRunsForPath(territoryIds)
      .map((run) => territoryPoints(run, shipOwnerId, seas))
      .filter((points) => points.length > 1);
  };

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
