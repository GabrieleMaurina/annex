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
import {
  settleRivers,
  terrainFeatures,
  TerrainToggles,
  trimRivers,
} from './features';
import { finishTerrainMap, TerrainMap } from './terrainGraph';

const TERRAIN_SEA_AREA_MULTIPLIER = 16;

function countCells(mask: Uint8Array): number {
  let cells = 0;
  for (let i = 0; i < mask.length; i++) cells += mask[i];
  return cells;
}

export function generateTerrain(
  rng: Rng,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
  seas: boolean,
  timedRng: Rng | null,
  toggles: TerrainToggles,
): TerrainMap {
  const { width, height } = dims;

  const mergeCount = TERRITORY_MERGE_COUNTS[size];
  const [minCount, maxCount] = TERRITORY_COUNT_RANGES[size];
  const targetCount = randomInt(rng, minCount, maxCount) + mergeCount;
  const maxLandNeighborsPerSea = TERRAIN_MAX_LAND_NEIGHBORS_PER_SEA[size];

  const { cleanedLand, expectedTerritoryArea, voidMask } = timeStep(
    'shape',
    () => {
      const { land, heights } = buildLandMask(rng, fill, dims);
      const voidMask = terrainFeatures(
        rng,
        land,
        heights,
        fill,
        width,
        height,
        countCells(land) / targetCount,
        toggles,
      );
      for (let i = 0; i < land.length; i++) if (voidMask[i]) land[i] = 0;
      const expectedTerritoryArea = countCells(land) / targetCount;
      const cleanedLand = cleanLandMask(
        land,
        width,
        height,
        expectedTerritoryArea,
      );
      for (let i = 0; i < land.length; i++) if (voidMask[i]) cleanedLand[i] = 0;
      if (toggles.rivers) trimRivers(voidMask, cleanedLand, width, height);
      return { cleanedLand, expectedTerritoryArea, voidMask };
    },
  );

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
    if (toggles.rivers)
      settleRivers(voidMask, labelGrid, adjacency, width, height);
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
    voidMask: voidMask.some((value) => value > 0) ? voidMask : null,
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
