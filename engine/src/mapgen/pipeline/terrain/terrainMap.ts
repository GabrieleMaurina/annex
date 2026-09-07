import { Territory } from '../../../types';
import {
  Fill,
  GridDimensions,
  MapSize,
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
} from '../connectivity';
import { clusterContinents, computeBonus } from '../continents';
import { cleanLandMask } from '../islands';
import { mergeTerritories } from '../merge';
import { placeTerritoryCenters } from '../placement';
import { buildLandMask } from '../terrain';
import { tessellate } from '../tessellate';
import { validateTerritoryGraph } from '../validate';

export interface TerrainMap {
  territories: Territory[];
  bonuses: number[];
  imageSrc: string;
}

export function generateTerrain(
  rng: Rng,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
): TerrainMap {
  const { width, height } = dims;

  const land = buildLandMask(rng, fill, dims);

  const mergeCount = TERRITORY_MERGE_COUNTS[size];
  const [minCount, maxCount] = TERRITORY_COUNT_RANGES[size];
  const targetCount = randomInt(rng, minCount, maxCount) + mergeCount;

  let landCellCount = 0;
  for (let i = 0; i < land.length; i++) landCellCount += land[i];
  const expectedTerritoryArea = landCellCount / targetCount;
  const cleanedLand = cleanLandMask(land, width, height, expectedTerritoryArea);

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

  const centroids = computeTerritoryCentroids(labelGrid, centers.length, dims);

  const specialEdges = ensureConnected(
    rng,
    centroids,
    adjacency,
    labelGrid,
    dims,
  );
  validateTerritoryGraph(centers.length, adjacency);

  const continentIdByTerritory = clusterContinents(
    rng,
    centers.length,
    adjacency,
    specialEdges,
  );

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
    neighbors: [...(adjacency.get(id) ?? [])].sort((a, b) => a - b),
  }));

  const imageSrc = renderTerrainImage(
    labelGrid,
    width,
    height,
    continentIdByTerritory,
    centroids,
    specialEdges,
  );

  return { territories, bonuses, imageSrc };
}
