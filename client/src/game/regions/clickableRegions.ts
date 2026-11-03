import type { LockedTile } from '../../lib/types';
import { loadGameMap } from '../mapData';
import { labelRegions, WALL_MAX_ALPHA, type RegionPoint } from './labelRegions';
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
const CHAMFER_STEP = 3;
const CHAMFER_DIAGONAL = 4;
const UNREACHED = 1 << 29;

function forEachNeighbor(
  p: number,
  width: number,
  size: number,
  visit: (q: number) => void,
) {
  const x = p % width;
  if (x > 0) visit(p - 1);
  if (x < width - 1) visit(p + 1);
  if (p >= width) visit(p - width);
  if (p + width < size) visit(p + width);
}

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

function borderDistance(
  border: (p: number) => boolean,
  width: number,
  size: number,
): Int32Array {
  const distance = new Int32Array(size);
  for (let p = 0; p < size; p++) if (border(p)) distance[p] = UNREACHED;
  const relax = (p: number, dx: number, dy: number, step: number) => {
    const x = (p % width) + dx;
    const q = p + dy * width + dx;
    if (x < 0 || x >= width || q < 0 || q >= size) return;
    distance[p] = Math.min(distance[p], distance[q] + step);
  };
  for (let p = 0; p < size; p++) {
    if (distance[p] === 0) continue;
    relax(p, -1, 0, CHAMFER_STEP);
    relax(p, 0, -1, CHAMFER_STEP);
    relax(p, -1, -1, CHAMFER_DIAGONAL);
    relax(p, 1, -1, CHAMFER_DIAGONAL);
  }
  for (let p = size - 1; p >= 0; p--) {
    if (distance[p] === 0) continue;
    relax(p, 1, 0, CHAMFER_STEP);
    relax(p, 0, 1, CHAMFER_STEP);
    relax(p, 1, 1, CHAMFER_DIAGONAL);
    relax(p, -1, 1, CHAMFER_DIAGONAL);
  }
  return distance;
}

function fillEnclosedGaps(labels: Int16Array, width: number) {
  const size = labels.length;
  const seen = new Uint8Array(size);
  for (let start = 0; start < size; start++) {
    if (labels[start] !== -1 || seen[start]) continue;
    seen[start] = 1;
    const gap = [start];
    const around = new Set<number>();
    let touchesEdge = false;
    for (let i = 0; i < gap.length; i++) {
      const p = gap[i];
      const x = p % width;
      if (x === 0 || x === width - 1 || p < width || p + width >= size)
        touchesEdge = true;
      forEachNeighbor(p, width, size, (q) => {
        if (labels[q] !== -1) around.add(labels[q]);
        else if (!seen[q]) {
          seen[q] = 1;
          gap.push(q);
        }
      });
    }
    const [label] = around;
    if (touchesEdge || around.size !== 1 || label < 0) continue;
    for (const p of gap) labels[p] = label;
  }
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

function decodeImage(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
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
      regions = decodeImage(map.imageSrc)
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
