import { Territory } from '../types';
import {
  generatedMapName,
  GenerateMapParams,
  GRID_DIMENSIONS,
  OUTPUT_SCALE,
  TERRITORY_COUNT_RANGES,
  TERRITORY_MERGE_COUNTS,
} from './core/params';
import { createRng, randomInt } from './core/rng';
import { computeTerritoryCentroids } from './pipeline/centroid';
import {
  addRedundantBridges,
  addSeaShortcuts,
  ensureConnected,
} from './pipeline/connectivity';
import { clusterContinents, computeBonus } from './pipeline/continents';
import { cleanLandMask } from './pipeline/islands';
import { mergeTerritories } from './pipeline/merge';
import { placeTerritoryCenters } from './pipeline/placement';
import { buildLandMask } from './pipeline/terrain';
import { tessellate } from './pipeline/tessellate';
import { validateTerritoryGraph } from './pipeline/validate';
import { renderMapImage } from './render/gif';

export interface GeneratedMap {
  name: string;
  territories: Territory[];
  bonuses: number[];
  imageSrc: string;
}

export function generateMap(params: GenerateMapParams): GeneratedMap {
  const rng = createRng(`${params.seed}::${params.size}::${params.water}`);
  const grid = GRID_DIMENSIONS[params.size];
  const width = grid.width * OUTPUT_SCALE;
  const height = grid.height * OUTPUT_SCALE;
  const dims = { width, height };

  const land = buildLandMask(rng, params.water, dims);

  const mergeCount = TERRITORY_MERGE_COUNTS[params.size];
  const [minCount, maxCount] = TERRITORY_COUNT_RANGES[params.size];
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

  const imageSrc = renderMapImage(
    labelGrid,
    width,
    height,
    continentIdByTerritory,
    centroids,
    specialEdges,
  );

  return {
    name: generatedMapName(params),
    territories,
    bonuses,
    imageSrc,
  };
}
