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
import { clusterContinents } from '../continents';
import { cleanLandMask } from '../islands';
import { mergeTerritories } from '../merge';
import { placeTerritoryCenters } from '../placement';
import { buildLandMask } from '../terrain';
import { tessellate } from '../tessellate';
import { finishTerrainMap, TerrainMap } from './terrainGraph';

const TERRAIN_SEA_AREA_MULTIPLIER = 16;

export function generateTerrain(
  rng: Rng,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
  seas: boolean,
  timedRng: Rng | null,
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

  return finishTerrainMap({
    rng,
    labelGrid,
    adjacency,
    landCount: centers.length,
    dims,
    seas,
    timedRng,
    expectedTerritoryArea,
    maxLandNeighborsPerSea,
    seaAreaMultiplier: TERRAIN_SEA_AREA_MULTIPLIER,
    voidMask: null,
    riverPairs: [],
    bridges: [],
    groupContinents: (specialEdges, centroids, absorptionPartners) =>
      clusterContinents(
        rng,
        centers.length,
        adjacency,
        specialEdges,
        centroids,
        absorptionPartners,
      ),
  });
}
