import { timeStep } from '../../core/bench';
import { Perlin2D } from '../../core/noise';
import {
  Fill,
  GridDimensions,
  MAP_SIZE_VALUES,
  MapSize,
  TERRITORY_COUNT_RANGES,
  TileShape,
} from '../../core/params';
import { randomFloat, randomInt, Rng } from '../../core/rng';
import {
  continentTileTone,
  TILE_SEA_COLOR,
  TILE_SEAM_COLOR,
  TILE_VOID_COLOR,
  TILE_WALL_COLOR,
} from '../../render/palette';
import { CellLayer } from '../maze/cellLayer';
import { buildMazeMap, MazeMap } from '../maze/mazeMap';
import {
  layTiles,
  Point,
  rasterizeTile,
  tileNeighbors,
  tileUnitArea,
} from './tiling';

const VOID_FRACTION: Record<Fill, number> = {
  full: 0.1,
  mixed: 0.35,
  sparse: 0.6,
};

const ISLAND_RANGES: Record<Exclude<Fill, 'full'>, [number, number]> = {
  mixed: [1, 3],
  sparse: [3, 5],
};

const MARGIN_FRACTION = 0.02;
const SCALE_STEPS = 60;
const MIN_SCALE_FACTOR = 0.85;
const COVERAGE_TOLERANCE = 0.97;
const PHASES: Point[] = [
  [0, 0],
  [0.5, 0],
  [0, 0.5],
  [0.5, 0.5],
];
const ISLAND_SPREAD = 0.5;
const LAKE_FREQUENCY = 0.35;
const LAKE_OCTAVES = 3;
const LAKE_PERSISTENCE = 0.5;
const LAKE_LACUNARITY = 2;
const ISLAND_WEIGHT_RANGE: [number, number] = [0.5, 1.5];

function layGrid(
  shape: TileShape,
  size: MapSize,
  fill: Fill,
  dims: GridDimensions,
  margin: number,
): Point[][] {
  const [min, max] = TERRITORY_COUNT_RANGES[size];
  const keptShare = 1 - VOID_FRACTION[fill];
  const slotMin = min / keptShare;
  const slotMax = max / keptShare;
  const slotTarget = (slotMin + slotMax) / 2;
  const usable = (dims.width - 2 * margin) * (dims.height - 2 * margin);
  const scaleFor = (slots: number) =>
    Math.sqrt(usable / (slots * tileUnitArea(shape)));
  const maxScale = scaleFor(slotMin);
  const minScale = scaleFor(slotMax) * MIN_SCALE_FACTOR;

  const layouts: Point[][][] = [];
  for (let k = 0; k <= SCALE_STEPS; k++) {
    const scale = maxScale + ((minScale - maxScale) * k) / SCALE_STEPS;
    for (const phase of PHASES) {
      layouts.push(
        layTiles(shape, scale, dims.width, dims.height, margin, phase),
      );
    }
  }
  const inRange = layouts.filter(
    (tiles) => tiles.length >= slotMin && tiles.length <= slotMax,
  );
  const candidates = (
    inRange.length > 0 ? inRange : layouts.filter((t) => t.length > 0)
  ).map((tiles) => ({ tiles, coverage: coverage(tiles, usable) }));
  const bestCoverage = Math.max(...candidates.map((c) => c.coverage));
  return candidates
    .filter((c) => c.coverage >= bestCoverage * COVERAGE_TOLERANCE)
    .reduce((best, c) =>
      Math.abs(c.tiles.length - slotTarget) <
      Math.abs(best.tiles.length - slotTarget)
        ? c
        : best,
    ).tiles;
}

function coverage(tiles: Point[][], usable: number): number {
  const points = tiles.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return (
    ((Math.max(...xs) - Math.min(...xs)) *
      (Math.max(...ys) - Math.min(...ys))) /
    usable
  );
}

function distancesFrom(sources: number[], neighbors: number[][]): Int32Array {
  const distance = new Int32Array(neighbors.length).fill(-1);
  for (const source of sources) distance[source] = 0;
  const queue = [...sources];
  let head = 0;
  while (head < queue.length) {
    const tile = queue[head++];
    for (const n of neighbors[tile]) {
      if (distance[n] !== -1) continue;
      distance[n] = distance[tile] + 1;
      queue.push(n);
    }
  }
  return distance;
}

function largestComponent(neighbors: number[][]): number[] {
  const seen = new Uint8Array(neighbors.length);
  let best: number[] = [];
  for (let start = 0; start < neighbors.length; start++) {
    if (seen[start]) continue;
    const distance = distancesFrom([start], neighbors);
    const members: number[] = [];
    distance.forEach((d, tile) => {
      if (d < 0) return;
      seen[tile] = 1;
      members.push(tile);
    });
    if (members.length > best.length) best = members;
  }
  return best.sort((a, b) => a - b);
}

function pickSeeds(rng: Rng, neighbors: number[][], count: number): number[] {
  const seeds = [randomInt(rng, 0, neighbors.length - 1)];
  while (seeds.length < count) {
    const distance = distancesFrom(seeds, neighbors);
    const farthest = Math.max(...distance);
    if (farthest <= 0) break;
    const candidates: number[] = [];
    distance.forEach((d, tile) => {
      if (d >= farthest * ISLAND_SPREAD && d > 0) candidates.push(tile);
    });
    seeds.push(candidates[randomInt(rng, 0, candidates.length - 1)]);
  }
  return seeds;
}

function keptConnected(neighbors: number[][], kept: Uint8Array): boolean {
  const start = kept.indexOf(1);
  const seen = new Uint8Array(kept.length);
  seen[start] = 1;
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    for (const n of neighbors[queue[head++]]) {
      if (!kept[n] || seen[n]) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return queue.length === kept.reduce((sum, k) => sum + k, 0);
}

function carveLakes(
  rng: Rng,
  tiles: Point[][],
  neighbors: number[][],
  lakeTiles: number,
): Uint8Array {
  const kept = new Uint8Array(tiles.length).fill(1);
  const perlin = new Perlin2D(rng);
  const tileSize = Math.sqrt(
    tiles.reduce((sum, points) => sum + polygonArea(points), 0) / tiles.length,
  );
  const depth = tiles.map((points) => {
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    return perlin.fbm(
      (cx / tileSize) * LAKE_FREQUENCY,
      (cy / tileSize) * LAKE_FREQUENCY,
      LAKE_OCTAVES,
      LAKE_PERSISTENCE,
      LAKE_LACUNARITY,
    );
  });
  const order = tiles
    .map((_, tile) => tile)
    .sort((a, b) => depth[a] - depth[b]);
  let carved = 0;
  for (const tile of order) {
    if (carved >= lakeTiles) break;
    kept[tile] = 0;
    if (keptConnected(neighbors, kept)) carved++;
    else kept[tile] = 1;
  }
  return kept;
}

function polygonArea(points: Point[]): number {
  let twice = 0;
  points.forEach(([x, y], k) => {
    const [nx, ny] = points[(k + 1) % points.length];
    twice += x * ny - nx * y;
  });
  return Math.abs(twice) / 2;
}

function growIslands(
  rng: Rng,
  neighbors: number[][],
  keepCount: number,
  islandCount: number,
): Uint8Array {
  const kept = new Uint8Array(neighbors.length);
  const seeds = pickSeeds(rng, neighbors, islandCount);
  const frontiers: number[][] = seeds.map(() => []);
  const weights = seeds.map(() => randomFloat(rng, ...ISLAND_WEIGHT_RANGE));
  let keptCount = 0;
  const keep = (tile: number, island: number) => {
    kept[tile] = 1;
    keptCount++;
    for (const n of neighbors[tile]) if (!kept[n]) frontiers[island].push(n);
  };
  seeds.forEach((seed, island) => keep(seed, island));

  while (keptCount < keepCount) {
    const open = seeds
      .map((_, island) => island)
      .filter((island) => frontiers[island].length > 0);
    if (open.length === 0) break;
    let pick = rng() * open.reduce((sum, island) => sum + weights[island], 0);
    let island = open[open.length - 1];
    for (const candidate of open) {
      pick -= weights[candidate];
      if (pick < 0) {
        island = candidate;
        break;
      }
    }
    const frontier = frontiers[island];
    const index = randomInt(rng, 0, frontier.length - 1);
    const tile = frontier[index];
    frontier[index] = frontier[frontier.length - 1];
    frontier.pop();
    if (!kept[tile]) keep(tile, island);
  }
  return kept;
}

function cropToKept(
  tiles: Point[][],
  kept: Uint8Array,
  margin: number,
): { tiles: Point[][]; dims: GridDimensions } {
  const points = tiles.filter((_, tile) => kept[tile]).flat();
  const x0 = Math.floor(Math.min(...points.map((p) => p[0]))) - margin;
  const y0 = Math.floor(Math.min(...points.map((p) => p[1]))) - margin;
  const x1 = Math.ceil(Math.max(...points.map((p) => p[0]))) + margin;
  const y1 = Math.ceil(Math.max(...points.map((p) => p[1]))) + margin;
  return {
    tiles: tiles.map((t) => t.map(([x, y]): Point => [x - x0, y - y0])),
    dims: { width: x1 - x0, height: y1 - y0 },
  };
}

function toCellLayer(
  tiles: Point[][],
  neighbors: number[][],
  kept: Uint8Array,
  dims: GridDimensions,
): CellLayer {
  const { width, height } = dims;
  const cellId = new Int32Array(tiles.length).fill(-1);
  let cellCount = 0;
  for (let tile = 0; tile < tiles.length; tile++) {
    if (kept[tile]) cellId[tile] = cellCount++;
  }

  const cellNeighbors: number[][] = Array.from({ length: cellCount }, () => []);
  neighbors.forEach((list, tile) => {
    if (cellId[tile] < 0) return;
    for (const n of list) {
      if (cellId[n] >= 0) cellNeighbors[cellId[tile]].push(cellId[n]);
    }
  });

  const pixelCell = new Int32Array(width * height).fill(-1);
  tiles.forEach((points, tile) => {
    if (cellId[tile] < 0) return;
    rasterizeTile(points, width, (i) => {
      pixelCell[i] = cellId[tile];
    });
  });

  return {
    width,
    height,
    cellCount,
    cellNeighbors,
    pixelCell,
    chambers: [],
    cellTerritories: true,
  };
}

export function generateTile(
  rng: Rng,
  shape: TileShape,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
  seas: boolean,
  timedRng: Rng | null,
): MazeMap {
  const layer = timeStep('shape', () => {
    const margin = Math.round(
      Math.min(dims.width, dims.height) * MARGIN_FRACTION,
    );
    const laid = layGrid(shape, size, fill, dims, margin);
    const tiles = largestComponent(tileNeighbors(laid)).map((t) => laid[t]);
    const neighbors = tileNeighbors(tiles);
    const keepCount = Math.round(tiles.length * (1 - VOID_FRACTION[fill]));
    const kept =
      fill === 'full'
        ? carveLakes(rng, tiles, neighbors, tiles.length - keepCount)
        : growIslands(
            rng,
            neighbors,
            keepCount,
            randomInt(rng, ...ISLAND_RANGES[fill]) +
              MAP_SIZE_VALUES.indexOf(size),
          );
    const cropped = cropToKept(tiles, kept, margin);
    return toCellLayer(cropped.tiles, neighbors, kept, cropped.dims);
  });
  return buildMazeMap(
    rng,
    layer,
    size,
    {
      voidColor: TILE_VOID_COLOR,
      wallColor: TILE_WALL_COLOR,
      seamColor: TILE_SEAM_COLOR,
      tone: continentTileTone,
      roundedWalls: true,
      uniformLines: true,
      continentWalls: true,
      voidSeas: true,
      seaColor: TILE_SEA_COLOR,
    },
    false,
    seas,
    timedRng,
  );
}
