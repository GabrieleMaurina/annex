import { SeaTerritory, Territory } from '../../../types';
import { timeStep } from '../../core/bench';
import {
  GridDimensions,
  MapSize,
  TERRITORY_COUNT_RANGES,
} from '../../core/params';
import { randomInt, Rng } from '../../core/rng';
import {
  computeWallSeamMasks,
  MazePalette,
  renderMazeImage,
} from '../../render/maze';
import { computeTerritoryCentroids } from '../centroid';
import {
  addRedundantBridges,
  addSeaShortcuts,
  ensureConnected,
  SpecialEdge,
} from '../connectivity';
import { clusterContinents, computeBonus } from '../continents';
import { buildSeaTerritories } from '../sea/build';
import {
  ensureGraphConnected,
  ensureSeaUsefulness,
  ensureSingleSeaHopReachability,
  MAX_LAND_NEIGHBORS_PER_SEA,
  pseudoEdgesFromSeaNeighbors,
} from '../sea/connectivity';
import { validateTerritoryGraph } from '../validate';
import { CellLayer } from './cellLayer';
import { partitionCells } from './partition';

export interface MazeMap {
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  imageSrc: string;
}

const SEA_DOOR_CHANCE = 0.5;

function filterSeaDoors(
  rng: Rng,
  landSeaAdjacency: Map<number, Set<number>>,
): Map<number, Set<number>> {
  const doors = new Map<number, Set<number>>();
  for (const [landId, seaIds] of landSeaAdjacency) {
    const kept = new Set<number>();
    for (const seaId of seaIds) {
      if (rng() < SEA_DOOR_CHANCE) kept.add(seaId);
    }
    if (kept.size > 0) doors.set(landId, kept);
  }
  return doors;
}

function findCellComponents(
  cellCount: number,
  cellNeighbors: number[][],
): number[][] {
  const componentOf = new Int32Array(cellCount).fill(-1);
  const components: number[][] = [];
  for (let start = 0; start < cellCount; start++) {
    if (componentOf[start] !== -1) continue;
    const id = components.length;
    const stack = [start];
    componentOf[start] = id;
    const members = [start];
    while (stack.length > 0) {
      const cell = stack.pop()!;
      for (const neighbor of cellNeighbors[cell]) {
        if (componentOf[neighbor] === -1) {
          componentOf[neighbor] = id;
          stack.push(neighbor);
          members.push(neighbor);
        }
      }
    }
    components.push(members);
  }
  return components;
}

const MIN_COMPONENT_FRACTION = 0.5;

function partitionCellsMultiComponent(
  rng: Rng,
  cellCount: number,
  cellNeighbors: number[][],
  targetCount: number,
  chambers: number[][],
  cellPixelCount: Int32Array,
): { territoryOfCell: Int32Array; territoryCount: number } {
  const components = findCellComponents(cellCount, cellNeighbors);
  const territoryOfCell = new Int32Array(cellCount).fill(-1);
  let territoryCount = 0;

  const navigableCellCount = cellPixelCount.filter((n) => n > 0).length;
  const largestComponentSize = Math.max(...components.map((c) => c.length));
  const minComponentCells = Math.min(
    largestComponentSize,
    Math.max(
      2,
      Math.round((navigableCellCount / targetCount) * MIN_COMPONENT_FRACTION),
    ),
  );

  const skipped: number[][] = [];
  for (const component of components) {
    if (component.length < minComponentCells) {
      skipped.push(component);
      continue;
    }
    const localIndex = new Map<number, number>();
    component.forEach((cell, i) => localIndex.set(cell, i));
    const localNeighbors = (i: number): number[] =>
      cellNeighbors[component[i]]
        .map((n) => localIndex.get(n))
        .filter((n): n is number => n !== undefined);
    const localChambers = chambers
      .map((group) =>
        group
          .map((c) => localIndex.get(c))
          .filter((c): c is number => c !== undefined),
      )
      .filter((group) => group.length >= 2);
    const componentTarget = Math.max(
      1,
      Math.round((targetCount * component.length) / navigableCellCount),
    );
    const {
      territoryOfCell: localTerritoryOfCell,
      territoryCount: localCount,
    } = partitionCells(
      rng,
      component.length,
      localNeighbors,
      componentTarget,
      localChambers,
    );
    component.forEach((cell, i) => {
      territoryOfCell[cell] = territoryCount + localTerritoryOfCell[i];
    });
    territoryCount += localCount;
  }

  if (territoryCount < targetCount) {
    skipped.sort((a, b) => b.length - a.length);
    for (const component of skipped) {
      if (territoryCount >= targetCount) break;
      if (!component.some((cell) => cellPixelCount[cell] > 0)) continue;
      for (const cell of component) territoryOfCell[cell] = territoryCount;
      territoryCount++;
    }
  }

  return { territoryOfCell, territoryCount };
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CROP_MARGIN_FRACTION = 0.025;
const CROP_THRESHOLD = 0.9;

function navigableCropBox(
  labelGrid: Int16Array,
  width: number,
  height: number,
): CropBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (labelGrid[i] < 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;

  const margin = Math.round(Math.min(width, height) * CROP_MARGIN_FRACTION);
  const x0 = Math.max(0, minX - margin);
  const y0 = Math.max(0, minY - margin);
  const x1 = Math.min(width, maxX + 1 + margin);
  const y1 = Math.min(height, maxY + 1 + margin);
  const boxWidth = x1 - x0;
  const boxHeight = y1 - y0;
  if (
    boxWidth >= width * CROP_THRESHOLD &&
    boxHeight >= height * CROP_THRESHOLD
  )
    return null;
  return { x: x0, y: y0, width: boxWidth, height: boxHeight };
}

function cropInt16(grid: Int16Array, width: number, box: CropBox): Int16Array {
  const out = new Int16Array(box.width * box.height);
  for (let y = 0; y < box.height; y++) {
    const src = (box.y + y) * width + box.x;
    out.set(grid.subarray(src, src + box.width), y * box.width);
  }
  return out;
}

function cropInt32(grid: Int32Array, width: number, box: CropBox): Int32Array {
  const out = new Int32Array(box.width * box.height);
  for (let y = 0; y < box.height; y++) {
    const src = (box.y + y) * width + box.x;
    out.set(grid.subarray(src, src + box.width), y * box.width);
  }
  return out;
}

function cropUint8(grid: Uint8Array, width: number, box: CropBox): Uint8Array {
  const out = new Uint8Array(box.width * box.height);
  for (let y = 0; y < box.height; y++) {
    const src = (box.y + y) * width + box.x;
    out.set(grid.subarray(src, src + box.width), y * box.width);
  }
  return out;
}

export function buildMazeMap(
  rng: Rng,
  layerInput: CellLayer,
  size: MapSize,
  palette: MazePalette,
  crop: boolean,
  seas: boolean,
): MazeMap {
  const source = layerInput;
  const { cellCount, cellNeighbors } = source;

  const [minCount, maxCount] = TERRITORY_COUNT_RANGES[size];
  const targetCount = Math.min(randomInt(rng, minCount, maxCount), cellCount);

  const {
    territoryCount,
    labelGrid,
    orphanMask,
    outsideMask,
    layer,
    dims,
    adjacency,
  } = timeStep('partition', () => {
    const cellPixelCount = new Int32Array(cellCount);
    for (const cell of source.pixelCell) {
      if (cell >= 0) cellPixelCount[cell]++;
    }
    const { territoryOfCell, territoryCount } = partitionCellsMultiComponent(
      rng,
      cellCount,
      cellNeighbors,
      targetCount,
      source.chambers,
      cellPixelCount,
    );

    const fullLabelGrid = new Int16Array(source.width * source.height).fill(-1);
    const fullOrphanMask = new Uint8Array(source.width * source.height);
    for (let i = 0; i < fullLabelGrid.length; i++) {
      const cell = source.pixelCell[i];
      if (cell < 0) continue;
      if (territoryOfCell[cell] === -1) {
        fullOrphanMask[i] = 1;
      } else {
        fullLabelGrid[i] = territoryOfCell[cell];
      }
    }

    const box = crop
      ? navigableCropBox(fullLabelGrid, source.width, source.height)
      : null;
    const labelGrid = box
      ? cropInt16(fullLabelGrid, source.width, box)
      : fullLabelGrid;
    const orphanMask = box
      ? cropUint8(fullOrphanMask, source.width, box)
      : fullOrphanMask;
    const outsideMask = source.outsideMask
      ? box
        ? cropUint8(source.outsideMask, source.width, box)
        : source.outsideMask
      : null;
    const layer: CellLayer = box
      ? {
          cellCount,
          cellNeighbors,
          chambers: source.chambers,
          width: box.width,
          height: box.height,
          pixelCell: cropInt32(source.pixelCell, source.width, box),
        }
      : source;
    const dims: GridDimensions = { width: layer.width, height: layer.height };

    const adjacency = new Map<number, Set<number>>();
    for (let t = 0; t < territoryCount; t++) adjacency.set(t, new Set());
    for (let cell = 0; cell < cellCount; cell++) {
      const a = territoryOfCell[cell];
      for (const neighbor of cellNeighbors[cell]) {
        const b = territoryOfCell[neighbor];
        if (a !== b) {
          adjacency.get(a)!.add(b);
          adjacency.get(b)!.add(a);
        }
      }
    }

    return {
      territoryOfCell,
      territoryCount,
      labelGrid,
      orphanMask,
      outsideMask,
      layer,
      dims,
      adjacency,
    };
  });

  const { seaBuild, hasSea, doors } = timeStep('connectivity', () => {
    let navigablePixelCount = 0;
    for (let i = 0; i < labelGrid.length; i++)
      if (labelGrid[i] >= 0) navigablePixelCount++;
    const expectedTerritoryArea = navigablePixelCount / territoryCount;
    const eligible = Uint8Array.from(
      orphanMask,
      (v, i) => (v || (outsideMask && outsideMask[i]) ? 0 : 1) as 0 | 1,
    );
    const seaBuild = seas
      ? buildSeaTerritories(
          rng,
          labelGrid,
          dims.width,
          dims.height,
          dims,
          expectedTerritoryArea,
          adjacency,
          eligible,
          false,
        )
      : null;
    const hasSea = !!seaBuild && seaBuild.seaCount > 0;
    const doors = hasSea
      ? filterSeaDoors(rng, seaBuild!.landSeaAdjacency)
      : null;
    if (hasSea) {
      ensureSeaUsefulness(doors!, seaBuild!.landSeaAdjacency, adjacency);
    }
    return { seaBuild, hasSea, doors };
  });

  const { wallMask } = timeStep('geometry', () =>
    computeWallSeamMasks(
      labelGrid,
      layer,
      palette.roundedWalls === true,
      hasSea
        ? {
            pixelSea: seaBuild!.seaLabelGrid,
            seaCount: seaBuild!.seaCount,
            doors: doors!,
          }
        : undefined,
    ),
  );
  const centroids = timeStep('geometry', () =>
    computeTerritoryCentroids(labelGrid, territoryCount, dims, wallMask),
  );

  const {
    combinedAdjacency,
    continentIdByTerritory,
    specialEdges,
    phantomSeaEdges,
    combinedCentroids,
  } = timeStep('connectivity', () => {
    let combinedAdjacency = adjacency;
    let continentIdByTerritory: number[];
    let specialEdges: SpecialEdge[] = [];
    let phantomSeaEdges: SpecialEdge[] = [];
    let combinedCentroids = centroids;

    if (hasSea) {
      const sea = seaBuild!;
      specialEdges = ensureSingleSeaHopReachability(
        centroids,
        adjacency,
        doors!,
        sea.landSeaAdjacency,
      );

      combinedAdjacency = new Map<number, Set<number>>();
      for (const [id, neighbors] of adjacency) {
        combinedAdjacency.set(id, new Set(neighbors));
      }
      for (const [seaId, neighbors] of sea.seaAdjacency) {
        const gid = territoryCount + seaId;
        const set = combinedAdjacency.get(gid) ?? new Set<number>();
        for (const neighbor of neighbors) set.add(territoryCount + neighbor);
        combinedAdjacency.set(gid, set);
      }
      for (const [landId, seaIds] of doors!) {
        const landSet = combinedAdjacency.get(landId) ?? new Set<number>();
        for (const seaId of seaIds) {
          const gid = territoryCount + seaId;
          landSet.add(gid);
          const seaSet = combinedAdjacency.get(gid) ?? new Set<number>();
          seaSet.add(landId);
          combinedAdjacency.set(gid, seaSet);
        }
        combinedAdjacency.set(landId, landSet);
      }

      combinedCentroids = [...centroids, ...sea.seaCentroids];
      ensureGraphConnected(combinedCentroids, combinedAdjacency, (a, b) => {
        if (a < territoryCount && b < territoryCount) return true;
        if (a >= territoryCount && b >= territoryCount) return false;
        const seaEnd = a >= territoryCount ? a : b;
        const landDegree = [...(combinedAdjacency.get(seaEnd) ?? [])].filter(
          (n) => n < territoryCount,
        ).length;
        return landDegree >= MAX_LAND_NEIGHBORS_PER_SEA;
      });

      for (const [id, neighbors] of combinedAdjacency) {
        if (id >= territoryCount) continue;
        for (const neighbor of neighbors) {
          if (neighbor < territoryCount) continue;
          const seaId = neighbor - territoryCount;
          const set = doors!.get(id) ?? new Set<number>();
          const wasDoor = set.has(seaId);
          set.add(seaId);
          doors!.set(id, set);
          if (!wasDoor && !sea.landSeaAdjacency.get(id)?.has(seaId)) {
            phantomSeaEdges.push({ a: id, b: neighbor });
          }
        }
      }

      continentIdByTerritory = clusterContinents(
        rng,
        territoryCount,
        adjacency,
        specialEdges,
        centroids,
        pseudoEdgesFromSeaNeighbors(doors!),
      );

      validateTerritoryGraph(territoryCount + sea.seaCount, combinedAdjacency);
    } else {
      specialEdges = ensureConnected(
        rng,
        centroids,
        adjacency,
        labelGrid,
        dims,
      );
      continentIdByTerritory = clusterContinents(
        rng,
        territoryCount,
        adjacency,
        specialEdges,
        centroids,
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
      validateTerritoryGraph(territoryCount, adjacency);
    }

    return {
      combinedAdjacency,
      continentIdByTerritory,
      specialEdges,
      phantomSeaEdges,
      combinedCentroids,
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

  const territories: Territory[] = [];
  for (let id = 0; id < territoryCount; id++) {
    territories.push({
      id,
      continentId: continentIdByTerritory[id],
      x: centroids[id].gx,
      y: centroids[id].gy,
      neighbors: [...(combinedAdjacency.get(id) ?? [])].sort((a, b) => a - b),
    });
  }

  const seaTerritories: SeaTerritory[] = [];
  if (hasSea) {
    const sea = seaBuild!;
    for (let seaId = 0; seaId < sea.seaCount; seaId++) {
      const gid = territoryCount + seaId;
      seaTerritories.push({
        id: gid,
        x: sea.seaCentroids[seaId].gx,
        y: sea.seaCentroids[seaId].gy,
        neighbors: [...(combinedAdjacency.get(gid) ?? [])].sort(
          (a, b) => a - b,
        ),
      });
    }
  }

  const renderEdges = [...specialEdges, ...phantomSeaEdges];
  const imageSrc = timeStep('render', () =>
    renderMazeImage(
      labelGrid,
      layer,
      continentIdByTerritory,
      palette,
      hasSea
        ? {
            pixelSea: seaBuild!.seaLabelGrid,
            seaCount: seaBuild!.seaCount,
            doors: doors!,
          }
        : undefined,
      renderEdges.length > 0
        ? { centroids: combinedCentroids, specialEdges: renderEdges }
        : undefined,
    ),
  );

  return { territories, seaTerritories, bonuses, imageSrc };
}
