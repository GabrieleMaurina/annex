import type { LockedTile } from '../../lib/types';
import { loadGameMap } from '../mapData';
import { labelRegions, type RegionPoint } from './labelRegions';
import { traceRegionShapes, type RegionShape } from './traceRegions';

export interface ClickableRegions {
  width: number;
  height: number;
  labels: Int16Array;
  fillLabels: Int16Array;
  shapes: Map<number, RegionShape>;
  unlocked?: { tiles: LockedTile[]; lineWidth: number };
}

const BORDER_REACH = 8;
const PAIR_STRIDE = 1 << 15;
const VERTEX_DIAMETERS_PER_LONGEST_SIDE = 50;

function growIntoBorders(labels: Int16Array, wall: Uint8Array, width: number) {
  const size = labels.length;
  const neighbors = (p: number, visit: (q: number) => void) => {
    const x = p % width;
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p + width < size) visit(p + width);
  };
  const open = (q: number) => wall[q] === 1 && labels[q] < 0;
  let frontier: number[] = [];
  for (let p = 0; p < size; p++) {
    if (labels[p] < 0) continue;
    let touchesBorder = false;
    neighbors(p, (q) => {
      if (open(q)) touchesBorder = true;
    });
    if (touchesBorder) frontier.push(p);
  }
  for (let step = 0; step < BORDER_REACH; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      neighbors(p, (q) => {
        if (!open(q)) return;
        labels[q] = labels[p];
        next.push(q);
      });
    }
    frontier = next;
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
  growIntoBorders(labels, wall, width);
  return { width, height, labels, fillLabels, shapes };
}

interface ContinentTerritory {
  id: number;
  continentId: number;
}

const continentShapesByRegions = new WeakMap<
  ClickableRegions,
  { territories: ContinentTerritory[]; shapes: Map<number, RegionShape> }
>();

export function continentShapes(
  regions: ClickableRegions,
  territories: ContinentTerritory[],
): Map<number, RegionShape> {
  const cached = continentShapesByRegions.get(regions);
  if (cached?.territories === territories) return cached.shapes;
  const partial = new Set(
    territories
      .filter((t) => !regions.shapes.has(t.id))
      .map((t) => t.continentId),
  );
  const continentById = new Map(
    territories
      .filter((t) => t.continentId >= 0 && !partial.has(t.continentId))
      .map((t) => [t.id, t.continentId]),
  );
  const shapes = traceRegionShapes(
    regions.labels.map((id) => continentById.get(id) ?? -1),
    regions.width,
    regions.height,
    Infinity,
  );
  continentShapesByRegions.set(regions, { territories, shapes });
  return shapes;
}

export function sharedBorders(
  image: ImageData,
  points: RegionPoint[],
  borderColors: string[],
  reach: number,
): { a: number; b: number }[] {
  const { width, labels, wall, invalidIds } = labelRegions(
    image,
    points,
    borderColors,
  );
  const size = labels.length;
  for (let i = 0; i < size; i++) if (invalidIds.has(labels[i])) labels[i] = -1;
  const neighbors = (p: number, visit: (q: number) => void) => {
    const x = p % width;
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p + width < size) visit(p + width);
  };
  const around = (p: number, visit: (q: number) => void) => {
    neighbors(p, visit);
    const x = p % width;
    const up = p >= width;
    const down = p + width < size;
    if (x > 0 && up) visit(p - width - 1);
    if (x > 0 && down) visit(p + width - 1);
    if (x < width - 1 && up) visit(p - width + 1);
    if (x < width - 1 && down) visit(p + width + 1);
  };

  const edgesByLabel = new Map<number, number[]>();
  for (let p = 0; p < size; p++) {
    const label = labels[p];
    if (label < 0) continue;
    let touchesWall = false;
    neighbors(p, (q) => {
      if (wall[q]) touchesWall = true;
    });
    if (!touchesWall) continue;
    const list = edgesByLabel.get(label);
    if (list) list.push(p);
    else edgesByLabel.set(label, [p]);
  }

  const touching = new Set<number>();
  const seenBy = new Int32Array(size).fill(-1);
  for (const [label, edge] of edgesByLabel) {
    let frontier = edge;
    for (let step = 0; step <= reach && frontier.length > 0; step++) {
      const next: number[] = [];
      for (const p of frontier) {
        around(p, (q) => {
          const other = labels[q];
          if (other >= 0 && other !== label) {
            touching.add(
              label < other
                ? label * PAIR_STRIDE + other
                : other * PAIR_STRIDE + label,
            );
            return;
          }
          if (step === reach || !wall[q] || seenBy[q] === label) return;
          seenBy[q] = label;
          next.push(q);
        });
      }
      frontier = next;
    }
  }
  return [...touching].map((key) => ({
    a: Math.floor(key / PAIR_STRIDE),
    b: key % PAIR_STRIDE,
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
