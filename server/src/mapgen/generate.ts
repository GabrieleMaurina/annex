import { Territory } from '../types';
import {
  generatedMapDisplayName,
  generatedMapName,
  GenerateMapParams,
  GRID_DIMENSIONS,
  OUTPUT_SCALE,
  TERRITORY_COUNT_RANGES,
} from './core/params';
import { createRng, randomInt } from './core/rng';
import { computeTerritoryCentroids } from './pipeline/centroid';
import { ensureConnected } from './pipeline/connectivity';
import { clusterContinents, computeBonus } from './pipeline/continents';
import { cleanLandMask } from './pipeline/islands';
import { placeTerritoryCenters } from './pipeline/placement';
import { buildLandMask } from './pipeline/terrain';
import { tessellate } from './pipeline/tessellate';
import { validateTerritoryGraph } from './pipeline/validate';
import { renderMapImage } from './render/render';

export interface GeneratedMap {
  name: string;
  displayName: string;
  territories: Territory[];
  bonuses: number[];
  imageSrc: string;
}

export function generateMap(params: GenerateMapParams): GeneratedMap {
  const rng = createRng(`${params.seed}::${params.size}::${params.water}`);
  const dims = GRID_DIMENSIONS[params.size];
  const land = buildLandMask(rng, params.water, dims);

  const [minCount, maxCount] = TERRITORY_COUNT_RANGES[params.size];
  const targetCount = randomInt(rng, minCount, maxCount);

  let landCellCount = 0;
  for (const row of land) for (const cell of row) if (cell) landCellCount++;
  const expectedTerritoryArea = landCellCount / targetCount;
  const cleanedLand = cleanLandMask(land, expectedTerritoryArea);

  const rawCenters = placeTerritoryCenters(rng, cleanedLand, targetCount);
  const { labelGrid, adjacency, centers } = tessellate(
    rng,
    cleanedLand,
    rawCenters,
  );

  const specialEdges = ensureConnected(centers, adjacency);
  validateTerritoryGraph(centers.length, adjacency);

  const centroids = computeTerritoryCentroids(labelGrid, centers.length, dims);

  const continentIdByTerritory = clusterContinents(
    rng,
    centers.length,
    adjacency,
  );

  const continentSizes = new Map<number, number>();
  for (const continentId of continentIdByTerritory) {
    continentSizes.set(continentId, (continentSizes.get(continentId) ?? 0) + 1);
  }
  const bonuses: number[] = [];
  for (let i = 0; i < continentSizes.size; i++) {
    bonuses.push(computeBonus(continentSizes.get(i) ?? 0));
  }

  const territoryCenters = centroids.map((c) => ({
    x: (c.gx + 0.5) * OUTPUT_SCALE,
    y: (c.gy + 0.5) * OUTPUT_SCALE,
  }));

  const territories: Territory[] = centers.map((_, id) => ({
    id,
    continentId: continentIdByTerritory[id],
    x: territoryCenters[id].x,
    y: territoryCenters[id].y,
    neighbors: [...(adjacency.get(id) ?? [])].sort((a, b) => a - b),
  }));

  const imageSrc = renderMapImage(
    labelGrid,
    continentIdByTerritory,
    territoryCenters,
    specialEdges,
    rng,
    dims,
  );

  return {
    name: generatedMapName(params),
    displayName: generatedMapDisplayName(params),
    territories,
    bonuses,
    imageSrc,
  };
}
