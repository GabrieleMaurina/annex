import { Territory } from '../../../types';
import {
  GridDimensions,
  MapSize,
  TERRITORY_COUNT_RANGES,
} from '../../core/params';
import { randomInt, Rng } from '../../core/rng';
import { MazePalette, renderMazeImage } from '../../render/maze';
import { computeTerritoryCentroids } from '../centroid';
import { clusterContinents, computeBonus } from '../continents';
import { validateTerritoryGraph } from '../validate';
import { CellLayer } from './cellLayer';
import { partitionCells } from './partition';

export interface MazeMap {
  territories: Territory[];
  bonuses: number[];
  imageSrc: string;
}

function largestComponent(layer: CellLayer): CellLayer {
  const { cellCount, cellNeighbors } = layer;
  const componentOf = new Int32Array(cellCount).fill(-1);
  let best: number[] = [];
  let componentId = 0;
  for (let start = 0; start < cellCount; start++) {
    if (componentOf[start] !== -1) continue;
    const stack = [start];
    componentOf[start] = componentId;
    const members: number[] = [];
    while (stack.length > 0) {
      const cell = stack.pop()!;
      members.push(cell);
      for (const neighbor of cellNeighbors[cell]) {
        if (componentOf[neighbor] === -1) {
          componentOf[neighbor] = componentId;
          stack.push(neighbor);
        }
      }
    }
    if (members.length > best.length) best = members;
    componentId++;
  }

  if (best.length === cellCount) return layer;

  const remap = new Int32Array(cellCount).fill(-1);
  best.forEach((oldId, newId) => {
    remap[oldId] = newId;
  });
  const pixelCell = layer.pixelCell.slice();
  for (let i = 0; i < pixelCell.length; i++) {
    pixelCell[i] = pixelCell[i] < 0 ? -1 : remap[pixelCell[i]];
  }
  const cellNeighborsNext = best.map((oldId) =>
    cellNeighbors[oldId].map((n) => remap[n]).filter((n) => n !== -1),
  );
  const chambersNext = layer.chambers
    .map((group) => group.map((c) => remap[c]).filter((c) => c !== -1))
    .filter((group) => group.length >= 2);
  return {
    width: layer.width,
    height: layer.height,
    cellCount: best.length,
    cellNeighbors: cellNeighborsNext,
    pixelCell,
    chambers: chambersNext,
  };
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
      if (labelGrid[y * width + x] < 0) continue;
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

export function buildMazeMap(
  rng: Rng,
  layerInput: CellLayer,
  size: MapSize,
  palette: MazePalette,
  crop: boolean,
): MazeMap {
  const source = largestComponent(layerInput);
  const { cellCount, cellNeighbors } = source;

  const [minCount, maxCount] = TERRITORY_COUNT_RANGES[size];
  const targetCount = Math.min(randomInt(rng, minCount, maxCount), cellCount);

  const { territoryOfCell, territoryCount } = partitionCells(
    rng,
    cellCount,
    (cell) => cellNeighbors[cell],
    targetCount,
    source.chambers,
  );

  const fullLabelGrid = new Int16Array(source.width * source.height).fill(-1);
  for (let i = 0; i < fullLabelGrid.length; i++) {
    if (source.pixelCell[i] >= 0)
      fullLabelGrid[i] = territoryOfCell[source.pixelCell[i]];
  }

  const box = crop
    ? navigableCropBox(fullLabelGrid, source.width, source.height)
    : null;
  const labelGrid = box
    ? cropInt16(fullLabelGrid, source.width, box)
    : fullLabelGrid;
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

  const centroids = computeTerritoryCentroids(labelGrid, territoryCount, dims);
  const continentIdByTerritory = clusterContinents(
    rng,
    territoryCount,
    adjacency,
    [],
  );

  const continentSizes = new Map<number, number>();
  for (const continentId of continentIdByTerritory) {
    continentSizes.set(continentId, (continentSizes.get(continentId) ?? 0) + 1);
  }
  const bonuses: number[] = [];
  for (let i = 0; i < continentSizes.size; i++) {
    bonuses.push(computeBonus(continentSizes.get(i) ?? 0));
  }

  validateTerritoryGraph(territoryCount, adjacency);

  const territories: Territory[] = [];
  for (let id = 0; id < territoryCount; id++) {
    territories.push({
      id,
      continentId: continentIdByTerritory[id],
      x: centroids[id].gx,
      y: centroids[id].gy,
      neighbors: [...(adjacency.get(id) ?? [])].sort((a, b) => a - b),
    });
  }

  const imageSrc = renderMazeImage(
    labelGrid,
    layer,
    continentIdByTerritory,
    palette,
  );

  return { territories, bonuses, imageSrc };
}
