import { SeaTerritory, Territory, TimedConnection } from '../../../types';
import { timeStep } from '../../core/bench';
import { GridDimensions } from '../../core/params';
import { Rng } from '../../core/rng';
import { renderTerrainImage } from '../../render/gif';
import { extractTimedConnections } from '../../timed';
import { computeTerritoryCentroids } from '../centroid';
import {
  addRedundantBridges,
  addSeaShortcuts,
  ensureConnected,
  SpecialEdge,
} from '../connectivity';
import { computeBonus } from '../continents';
import { GridPoint } from '../placement';
import { buildSeaTerritories } from '../sea/build';
import {
  ensureGraphConnected,
  ensureSingleSeaHopReachability,
  pseudoEdgesFromSeaNeighbors,
} from '../sea/connectivity';
import { validateTerritoryGraph } from '../validate';

export interface TerrainMap {
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  timedConnections: TimedConnection[];
  imageSrc: string;
}

type GroupContinents = (
  specialEdges: SpecialEdge[],
  centroids: GridPoint[],
  absorptionPartners?: SpecialEdge[],
) => number[];

interface TerrainGraphInput {
  rng: Rng;
  labelGrid: Int16Array;
  adjacency: Map<number, Set<number>>;
  landCount: number;
  dims: GridDimensions;
  seas: boolean;
  timedRng: Rng | null;
  expectedTerritoryArea: number;
  maxLandNeighborsPerSea: number;
  seaAreaMultiplier: number;
  voidMask: Uint8Array | null;
  riverPairs: [number, number][];
  bridges: number[];
  groupContinents: GroupContinents;
}

export function finishTerrainMap({
  rng,
  labelGrid,
  adjacency,
  landCount,
  dims,
  seas,
  timedRng,
  expectedTerritoryArea,
  maxLandNeighborsPerSea,
  seaAreaMultiplier,
  voidMask,
  riverPairs,
  bridges,
  groupContinents,
}: TerrainGraphInput): TerrainMap {
  const { width, height } = dims;

  const centroids = timeStep('geometry', () =>
    computeTerritoryCentroids(labelGrid, landCount, dims),
  );

  const {
    seaBuild,
    hasSea,
    specialEdges,
    combinedAdjacency,
    phantomSeaEdges,
    combinedCentroids,
    continentIdByTerritory,
  } = timeStep('connectivity', () => {
    let specialEdges: SpecialEdge[] = [];
    const seaBuild = seas
      ? buildSeaTerritories(
          rng,
          labelGrid,
          width,
          height,
          dims,
          expectedTerritoryArea,
          adjacency,
          voidMask ? Uint8Array.from(voidMask, (v) => (v ? 0 : 1)) : undefined,
          true,
          seaAreaMultiplier,
          maxLandNeighborsPerSea,
        )
      : null;
    const hasSea = !!seaBuild && seaBuild.seaCount > 0;

    let combinedAdjacency = adjacency;
    let phantomSeaEdges: SpecialEdge[] = [];
    let combinedCentroids = centroids;

    if (seaBuild && hasSea) {
      specialEdges = ensureSingleSeaHopReachability(
        centroids,
        adjacency,
        seaBuild.landSeaAdjacency,
        seaBuild.landSeaAdjacency,
      );

      combinedAdjacency = new Map<number, Set<number>>();
      for (const [id, neighbors] of adjacency) {
        combinedAdjacency.set(id, new Set(neighbors));
      }
      for (const [seaId, neighbors] of seaBuild.seaAdjacency) {
        const gid = landCount + seaId;
        const set = combinedAdjacency.get(gid) ?? new Set<number>();
        for (const neighbor of neighbors) set.add(landCount + neighbor);
        combinedAdjacency.set(gid, set);
      }
      for (const [landId, seaIds] of seaBuild.landSeaAdjacency) {
        const landSet = combinedAdjacency.get(landId) ?? new Set<number>();
        for (const seaId of seaIds) {
          const gid = landCount + seaId;
          landSet.add(gid);
          const seaSet = combinedAdjacency.get(gid) ?? new Set<number>();
          seaSet.add(landId);
          combinedAdjacency.set(gid, seaSet);
        }
        combinedAdjacency.set(landId, landSet);
      }

      combinedCentroids = [...centroids, ...seaBuild.seaCentroids];
      ensureGraphConnected(combinedCentroids, combinedAdjacency, (a, b) => {
        if (a < landCount && b < landCount) return true;
        if (a >= landCount && b >= landCount) return false;
        const seaEnd = a >= landCount ? a : b;
        const landDegree = [...(combinedAdjacency.get(seaEnd) ?? [])].filter(
          (n) => n < landCount,
        ).length;
        return landDegree >= maxLandNeighborsPerSea;
      });

      for (const [id, neighbors] of combinedAdjacency) {
        if (id >= landCount) continue;
        for (const neighbor of neighbors) {
          if (neighbor < landCount) continue;
          const seaId = neighbor - landCount;
          if (!seaBuild.landSeaAdjacency.get(id)?.has(seaId)) {
            phantomSeaEdges.push({ a: id, b: neighbor });
          }
        }
      }

      validateTerritoryGraph(landCount + seaBuild.seaCount, combinedAdjacency);
    } else {
      specialEdges = ensureConnected(
        rng,
        centroids,
        adjacency,
        labelGrid,
        dims,
      );
      validateTerritoryGraph(landCount, adjacency);
    }

    const continentIdByTerritory =
      seaBuild && hasSea
        ? groupContinents(
            specialEdges,
            centroids,
            pseudoEdgesFromSeaNeighbors(seaBuild.landSeaAdjacency),
          )
        : groupContinents(specialEdges, centroids);

    if (!hasSea) {
      addRedundantBridges(
        rng,
        centroids,
        adjacency,
        specialEdges,
        continentIdByTerritory,
        labelGrid,
        dims,
      );
      addSeaShortcuts(centroids, adjacency, specialEdges, labelGrid, dims);
    }

    return {
      seaBuild,
      hasSea,
      specialEdges,
      combinedAdjacency,
      phantomSeaEdges,
      combinedCentroids,
      continentIdByTerritory,
    };
  });

  const continentSizes = new Map<number, number>();
  for (const continentId of continentIdByTerritory) {
    continentSizes.set(continentId, (continentSizes.get(continentId) ?? 0) + 1);
  }
  const bonuses: number[] = [];
  for (let i = 0; i < continentSizes.size; i++) {
    bonuses.push(computeBonus(continentSizes.get(i) ?? 0));
  }

  const timedConnections = extractTimedConnections(
    timedRng,
    specialEdges,
    combinedAdjacency,
  );

  const territories: Territory[] = Array.from(
    { length: landCount },
    (_, id) => ({
      id,
      continentId: continentIdByTerritory[id],
      x: centroids[id].gx,
      y: centroids[id].gy,
      neighbors: [...(combinedAdjacency.get(id) ?? [])].sort((a, b) => a - b),
    }),
  );

  const seaTerritories: SeaTerritory[] =
    seaBuild && hasSea
      ? Array.from({ length: seaBuild.seaCount }, (_, seaId) => {
          const gid = landCount + seaId;
          return {
            id: gid,
            x: seaBuild.seaCentroids[seaId].gx,
            y: seaBuild.seaCentroids[seaId].gy,
            neighbors: [...(combinedAdjacency.get(gid) ?? [])].sort(
              (a, b) => a - b,
            ),
          };
        })
      : [];

  const imageSrc = timeStep('render', () =>
    renderTerrainImage(
      labelGrid,
      width,
      height,
      continentIdByTerritory,
      combinedCentroids,
      [...specialEdges, ...phantomSeaEdges],
      seaBuild && hasSea
        ? { seaLabelGrid: seaBuild.seaLabelGrid, landCount }
        : undefined,
      voidMask ?? undefined,
      riverPairs,
      bridges,
    ),
  );

  return { territories, seaTerritories, bonuses, timedConnections, imageSrc };
}
