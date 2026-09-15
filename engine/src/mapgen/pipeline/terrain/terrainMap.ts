import { SeaTerritory, Territory } from '../../../types';
import { timeStep } from '../../core/bench';
import {
  Fill,
  GridDimensions,
  MapSize,
  TERRAIN_MAX_LAND_NEIGHBORS_PER_SEA,
  TERRITORY_COUNT_RANGES,
  TERRITORY_MERGE_COUNTS,
} from '../../core/params';
import { randomInt, Rng } from '../../core/rng';
import { renderTerrainImage } from '../../render/gif';
import { computeTerritoryCentroids } from '../centroid';
import {
  addRedundantBridges,
  addSeaShortcuts,
  ensureConnected,
  SpecialEdge,
} from '../connectivity';
import { clusterContinents, computeBonus } from '../continents';
import { cleanLandMask } from '../islands';
import { mergeTerritories } from '../merge';
import { placeTerritoryCenters } from '../placement';
import { buildSeaTerritories } from '../sea/build';
import {
  ensureGraphConnected,
  ensureSingleSeaHopReachability,
  pseudoEdgesFromSeaNeighbors,
} from '../sea/connectivity';
import { buildLandMask } from '../terrain';
import { tessellate } from '../tessellate';
import { validateTerritoryGraph } from '../validate';

export interface TerrainMap {
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  imageSrc: string;
}

const TERRAIN_SEA_AREA_MULTIPLIER = 16;

export function generateTerrain(
  rng: Rng,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
  seas: boolean,
): TerrainMap {
  const { width, height } = dims;

  const mergeCount = TERRITORY_MERGE_COUNTS[size];
  const [minCount, maxCount] = TERRITORY_COUNT_RANGES[size];
  const targetCount = randomInt(rng, minCount, maxCount) + mergeCount;
  const maxLandNeighborsPerSea = TERRAIN_MAX_LAND_NEIGHBORS_PER_SEA[size];

  const { cleanedLand, expectedTerritoryArea } = timeStep('shape', () => {
    const land = buildLandMask(rng, fill, dims);
    let landCellCount = 0;
    for (let i = 0; i < land.length; i++) landCellCount += land[i];
    const expectedTerritoryArea = landCellCount / targetCount;
    return {
      cleanedLand: cleanLandMask(land, width, height, expectedTerritoryArea),
      expectedTerritoryArea,
    };
  });

  const { labelGrid, adjacency, centers } = timeStep('partition', () => {
    const rawCenters = placeTerritoryCenters(
      rng,
      cleanedLand,
      width,
      height,
      targetCount,
    );
    const tessellation = tessellate(
      rng,
      cleanedLand,
      width,
      height,
      rawCenters,
      expectedTerritoryArea,
    );
    const labelGrid = tessellation.labelGrid;
    const { adjacency, centers } = mergeTerritories(
      rng,
      labelGrid,
      {
        adjacency: tessellation.adjacency,
        borderLength: tessellation.borderLength,
      },
      tessellation.centers,
      mergeCount,
    );
    return { labelGrid, adjacency, centers };
  });

  const centroids = timeStep('geometry', () =>
    computeTerritoryCentroids(labelGrid, centers.length, dims),
  );
  const landCount = centers.length;

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
          undefined,
          true,
          TERRAIN_SEA_AREA_MULTIPLIER,
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
      validateTerritoryGraph(centers.length, adjacency);
    }

    const continentIdByTerritory =
      seaBuild && hasSea
        ? clusterContinents(
            rng,
            centers.length,
            adjacency,
            specialEdges,
            centroids,
            pseudoEdgesFromSeaNeighbors(seaBuild.landSeaAdjacency),
          )
        : clusterContinents(
            rng,
            centers.length,
            adjacency,
            specialEdges,
            centroids,
          );

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

  const territories: Territory[] = centers.map((_, id) => ({
    id,
    continentId: continentIdByTerritory[id],
    x: centroids[id].gx,
    y: centroids[id].gy,
    neighbors: [...(combinedAdjacency.get(id) ?? [])].sort((a, b) => a - b),
  }));

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
    ),
  );

  return { territories, seaTerritories, bonuses, imageSrc };
}
