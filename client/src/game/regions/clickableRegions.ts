import type { LockedTile } from '../../lib/types';
import { loadGameMap } from '../mapData';
import { polygonPath } from '../tiles/tileGeometry';
import {
  continentOutlineSvg,
  type ContinentOutlineInput,
} from './continentOutline';
import { labelRegions, WALL_MAX_ALPHA, type RegionPoint } from './labelRegions';
import {
  borderDistance,
  CHAMFER_STEP,
  fillEnclosedGaps,
  forEachNeighbor,
} from './regionPixels';
import { traceRegionShapes, type RegionShape } from './traceRegions';

export interface ClickableRegions {
  width: number;
  height: number;
  labels: Int16Array;
  fillLabels: Int16Array;
  splitLabels: Int16Array;
  borderWidth: number;
  shapes: Map<number, RegionShape>;
  unlocked?: { tiles: LockedTile[]; lineWidth: number };
  base?: ClickableRegions;
}

const BORDER_REACH = 8;
const PAIR_STRIDE = 1 << 15;
const VERTEX_DIAMETERS_PER_LONGEST_SIDE = 50;

function growIntoBorders(labels: Int16Array, wall: Uint8Array, width: number) {
  const size = labels.length;
  const open = (q: number) => wall[q] === 1 && labels[q] < 0;
  let frontier: number[] = [];
  for (let p = 0; p < size; p++) {
    if (labels[p] < 0) continue;
    let touchesBorder = false;
    forEachNeighbor(p, width, size, (q) => {
      if (open(q)) touchesBorder = true;
    });
    if (touchesBorder) frontier.push(p);
  }
  for (let step = 0; step < BORDER_REACH; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      forEachNeighbor(p, width, size, (q) => {
        if (!open(q)) return;
        labels[q] = labels[p];
        next.push(q);
      });
    }
    frontier = next;
  }
}

function splitWalls(
  fillLabels: Int16Array,
  image: ImageData,
  wall: Uint8Array,
  width: number,
): { splitLabels: Int16Array; borderWidth: number } {
  const size = fillLabels.length;
  const border = (p: number) =>
    wall[p] === 1 && image.data[p * 4 + 3] >= WALL_MAX_ALPHA;
  const splitLabels = fillLabels.slice();
  const depth = new Int32Array(size).fill(-1);
  let frontier: number[] = [];
  for (let p = 0; p < size; p++) {
    if (border(p)) continue;
    depth[p] = 0;
    frontier.push(p);
  }
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const p of frontier) {
      forEachNeighbor(p, width, size, (q) => {
        if (depth[q] >= 0) return;
        depth[q] = depth[p] + 1;
        splitLabels[q] = splitLabels[p];
        next.push(q);
      });
    }
    frontier = next;
  }
  const distance = borderDistance(border, width, size);
  const widthCounts = new Map<number, number>();
  for (let p = 0; p < size; p++) {
    if (depth[p] <= 0 || splitLabels[p] < 0) continue;
    forEachNeighbor(p, width, size, (q) => {
      if (splitLabels[q] < 0 || splitLabels[q] === splitLabels[p]) return;
      const w = Math.round((distance[p] + distance[q]) / CHAMFER_STEP);
      widthCounts.set(w, (widthCounts.get(w) ?? 0) + 1);
    });
  }
  let borderWidth = 0;
  for (const [w, count] of widthCounts)
    if (count > (widthCounts.get(borderWidth) ?? 0)) borderWidth = w;
  const reach = (Math.ceil(borderWidth / 2) + 1) * CHAMFER_STEP;
  for (let p = 0; p < size; p++) if (distance[p] > reach) splitLabels[p] = -1;
  return { splitLabels, borderWidth };
}

export function buildClickableRegions(
  image: ImageData,
  points: RegionPoint[],
  borderColors: string[],
): ClickableRegions {
  const { width, height, labels, wall, invalidIds } = labelRegions(
    image,
    points,
    borderColors,
  );
  if (invalidIds.size > 0) {
    for (let i = 0; i < labels.length; i++)
      if (invalidIds.has(labels[i])) labels[i] = -1;
  }
  const vertexRadius =
    Math.max(width, height) / (VERTEX_DIAMETERS_PER_LONGEST_SIDE * 2);
  const shapes = traceRegionShapes(
    labels,
    width,
    height,
    Math.PI * vertexRadius * vertexRadius,
  );
  const fillLabels = labels.slice();
  const { splitLabels, borderWidth } = splitWalls(
    fillLabels,
    image,
    wall,
    width,
  );
  growIntoBorders(labels, wall, width);
  return {
    width,
    height,
    labels,
    fillLabels,
    splitLabels,
    borderWidth,
    shapes,
  };
}

interface ContinentTerritory {
  id: number;
  continentId: number;
}

const continentShapesByRegions = new WeakMap<
  ClickableRegions,
  {
    territories: ContinentTerritory[];
    key: string;
    shapes: Map<number, RegionShape>;
  }
>();

export function continentShapes(
  unlockedRegions: ClickableRegions,
  allTerritories: ContinentTerritory[],
): Map<number, RegionShape> {
  const regions = unlockedRegions.base ?? unlockedRegions;
  const cached = continentShapesByRegions.get(regions);
  if (cached?.territories === allTerritories) return cached.shapes;
  const territories = allTerritories.filter(
    (t) => t.continentId >= 0 || regions.shapes.has(t.id),
  );
  const key = territories.map((t) => `${t.id}:${t.continentId}`).join(',');
  if (cached?.key === key) {
    cached.territories = allTerritories;
    return cached.shapes;
  }
  const partial = new Set(
    territories
      .filter((t) => !regions.shapes.has(t.id))
      .map((t) => t.continentId),
  );
  const continentById = new Map(
    territories.map((t) => [
      t.id,
      t.continentId >= 0 && !partial.has(t.continentId) ? t.continentId : -2,
    ]),
  );
  const labels = regions.splitLabels.map((id) => continentById.get(id) ?? -1);
  fillEnclosedGaps(labels, regions.width);
  const shapes = traceRegionShapes(
    labels,
    regions.width,
    regions.height,
    Infinity,
  );
  continentShapesByRegions.set(regions, {
    territories: allTerritories,
    key,
    shapes,
  });
  return shapes;
}

function continentReach(regions: ClickableRegions): number {
  return Math.ceil(regions.borderWidth / 2) + 1;
}

export interface ContinentLand {
  outline: Path2D;
  land: Path2D;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Box = [number, number, number, number];

type LandEntry = ContinentLand | undefined | null;

const continentLandByRegions = new WeakMap<
  ClickableRegions,
  Map<string, LandEntry>
>();
const boxesByRegions = new WeakMap<ClickableRegions, Box[]>();
const MAX_LABELS = 32768;
const landJobs = new Map<number, (svg: string | null) => void>();
let landWorker: Worker | null = null;
let lastLandJobId = 0;

export function regionBoxes(regions: ClickableRegions): Box[] {
  const cached = boxesByRegions.get(regions);
  if (cached) return cached;
  const { fillLabels, width, height } = regions;
  const lefts = new Int32Array(MAX_LABELS).fill(width);
  const tops = new Int32Array(MAX_LABELS).fill(height);
  const rights = new Int32Array(MAX_LABELS);
  const bottoms = new Int32Array(MAX_LABELS);
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      const id = fillLabels[i];
      if (id < 0) continue;
      if (x < lefts[id]) lefts[id] = x;
      if (y < tops[id]) tops[id] = y;
      if (x >= rights[id]) rights[id] = x + 1;
      bottoms[id] = y + 1;
    }
  }
  const boxes: Box[] = [];
  for (let id = 0; id < MAX_LABELS; id++)
    if (rights[id] > 0)
      boxes[id] = [lefts[id], tops[id], rights[id], bottoms[id]];
  boxesByRegions.set(regions, boxes);
  return boxes;
}

function memberBounds(
  regions: ClickableRegions,
  group: ContinentTerritory[],
  margin: number,
): Bounds | null {
  const boxes = regionBoxes(regions);
  let left = regions.width;
  let top = regions.height;
  let right = -1;
  let bottom = -1;
  for (const { id } of group) {
    const box = boxes[id];
    if (!box) continue;
    left = Math.min(left, box[0]);
    top = Math.min(top, box[1]);
    right = Math.max(right, box[2] - 1);
    bottom = Math.max(bottom, box[3] - 1);
  }
  if (right < 0) return null;
  return {
    x: left - margin,
    y: top - margin,
    width: right - left + 1 + 2 * margin,
    height: bottom - top + 1 + 2 * margin,
  };
}

function copyWindow(regions: ClickableRegions, bounds: Bounds): Int16Array {
  const { x, y, width, height } = bounds;
  const copy = new Int16Array(width * height).fill(-1);
  const from = Math.max(0, x);
  const to = Math.min(regions.width, x + width);
  for (let row = 0; row < height; row++) {
    const sourceY = y + row;
    if (sourceY < 0 || sourceY >= regions.height) continue;
    const source = sourceY * regions.width;
    copy.set(
      regions.fillLabels.subarray(source + from, source + to),
      row * width + from - x,
    );
  }
  return copy;
}

function continentJob(
  regions: ClickableRegions,
  group: ContinentTerritory[],
  allTerritories: ContinentTerritory[],
): { bounds: Bounds; input: ContinentOutlineInput } | null {
  const bounds = memberBounds(regions, group, continentReach(regions) + 2);
  if (!bounds) return null;
  const isMember = new Uint8Array(1 << 15);
  for (const t of group) isMember[t.id] = 1;
  const isLand = new Uint8Array(1 << 15);
  for (const t of allTerritories) isLand[t.id] = 1;
  return {
    bounds,
    input: {
      fills: copyWindow(regions, bounds),
      width: bounds.width,
      height: bounds.height,
      isMember,
      isLand,
      reach: continentReach(regions) * CHAMFER_STEP,
    },
  };
}

function assembleContinentLand(
  regions: ClickableRegions,
  group: ContinentTerritory[],
  bounds: Bounds,
  svg: string,
): ContinentLand {
  const outline = new Path2D();
  outline.addPath(
    new Path2D(svg),
    new DOMMatrix().translate(bounds.x, bounds.y),
  );
  const land = new Path2D();
  for (const t of group) land.addPath(regions.shapes.get(t.id)!.fill);
  return { outline, land };
}

function startLandJob(
  input: ContinentOutlineInput,
  done: (svg: string | null) => void,
) {
  if (!landWorker) {
    const worker = new Worker(
      new URL('./continentWorker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (
      event: MessageEvent<{ id: number; svg: string | null }>,
    ) => {
      const finish = landJobs.get(event.data.id);
      landJobs.delete(event.data.id);
      finish?.(event.data.svg);
    };
    worker.onerror = () => {
      worker.terminate();
      const unfinished = [...landJobs.values()];
      landJobs.clear();
      landWorker = null;
      for (const finish of unfinished) finish(null);
    };
    landWorker = worker;
  }
  lastLandJobId += 1;
  landJobs.set(lastLandJobId, done);
  landWorker.postMessage({ id: lastLandJobId, ...input }, [
    input.fills.buffer as ArrayBuffer,
  ]);
}

export function continentLandsPending(): boolean {
  return landJobs.size > 0;
}

export function continentLand(
  unlockedRegions: ClickableRegions,
  group: ContinentTerritory[],
  allTerritories: ContinentTerritory[],
  background: boolean,
): LandEntry {
  const regions = unlockedRegions.base ?? unlockedRegions;
  let cache = continentLandByRegions.get(regions);
  if (!cache) {
    cache = new Map();
    continentLandByRegions.set(regions, cache);
  }
  const key = group.map((t) => t.id).join(',');
  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached !== null || background) return cached;
  }
  const job = group.every((t) => regions.shapes.has(t.id))
    ? continentJob(regions, group, allTerritories)
    : null;
  if (!job) {
    cache.set(key, undefined);
    return undefined;
  }
  const finish = (svg: string | null) =>
    cache.set(
      key,
      svg ? assembleContinentLand(regions, group, job.bounds, svg) : undefined,
    );
  if (!background) {
    finish(continentOutlineSvg(job.input));
    return cache.get(key);
  }
  cache.set(key, null);
  startLandJob(job.input, finish);
  return null;
}

export function sharedBorders(
  image: ImageData,
  points: RegionPoint[],
  borderColors: string[],
  reach: number,
): { a: number; b: number; length: number }[] {
  const { width, labels, wall, invalidIds } = labelRegions(
    image,
    points,
    borderColors,
  );
  const size = labels.length;
  for (let i = 0; i < size; i++) if (invalidIds.has(labels[i])) labels[i] = -1;

  let frontier: number[] = [];
  for (let p = 0; p < size; p++) {
    if (labels[p] < 0) continue;
    let touchesWall = false;
    forEachNeighbor(p, width, size, (q) => {
      if (wall[q]) touchesWall = true;
    });
    if (touchesWall) frontier.push(p);
  }

  const distance = new Int32Array(size);
  for (let step = 1; step <= reach && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      forEachNeighbor(p, width, size, (q) => {
        if (!wall[q] || labels[q] >= 0) return;
        labels[q] = labels[p];
        distance[q] = step;
        next.push(q);
      });
    }
    frontier = next;
  }

  const contacts = new Map<number, { length: number; gap: number }>();
  const touch = (p: number, q: number) => {
    const a = labels[p];
    const b = labels[q];
    if (a < 0 || b < 0 || a === b) return;
    const key = a < b ? a * PAIR_STRIDE + b : b * PAIR_STRIDE + a;
    const gap = distance[p] + distance[q] + 1;
    const contact = contacts.get(key);
    if (contact) {
      contact.length++;
      contact.gap = Math.min(contact.gap, gap);
    } else contacts.set(key, { length: 1, gap });
  };
  for (let p = 0; p < size; p++) {
    if (p % width < width - 1) touch(p, p + 1);
    if (p + width < size) touch(p, p + width);
  }

  return [...contacts]
    .filter(([, { length, gap }]) => length >= gap)
    .map(([key, { length }]) => ({
      a: Math.floor(key / PAIR_STRIDE),
      b: key % PAIR_STRIDE,
      length,
    }));
}

export function regionAt(
  regions: ClickableRegions,
  x: number,
  y: number,
): number | null {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= regions.width || py >= regions.height)
    return null;
  const id = regions.labels[py * regions.width + px];
  return id >= 0 ? id : null;
}

function decodeImage(
  src: string,
  closedTiles: LockedTile[],
  wallColor: string,
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = wallColor;
      for (const tile of closedTiles) ctx.fill(polygonPath(tile.points));
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = reject;
    img.src = src;
  });
}

const regionsByMap = new WeakMap<object, Promise<ClickableRegions | null>>();

export function loadClickableRegions(
  mapName: string,
  playerMapId?: string | null,
): Promise<ClickableRegions | null> {
  return loadGameMap(mapName, playerMapId).then((map) => {
    if (!map.imageSrc) return null;
    let regions = regionsByMap.get(map);
    if (!regions) {
      regions = decodeImage(map.imageSrc, map.lockedTiles, map.borderColors[0])
        .then((image) =>
          buildClickableRegions(
            image,
            [
              ...map.territories,
              ...map.seaTerritories.map((s) => ({ ...s, isSea: true })),
            ],
            map.borderColors,
          ),
        )
        .then((built) => (built.shapes.size > 0 ? built : null))
        .catch(() => null);
      regionsByMap.set(map, regions);
    }
    return regions;
  });
}
