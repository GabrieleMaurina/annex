import { expectedTerritoryArea } from 'engine';
import {
  closedRegions,
  closingGap,
  MAX_LAND_AREA_FRACTION,
  maxAreaOf,
  wallMask,
} from '../../../game/regions/labelRegions';
import type { EditorTerritory as Territory } from '../model/editorTypes';
import { growCells, seedSkeletons } from './drawTerritories';
import { visitNeighbors } from './territoryBorders';

const PREVIEW_CELLS = 60_000;
const PREVIEW_RGBA = [128, 128, 128, 160];

export interface PreviewGrid {
  scale: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  region: Int32Array;
  regionArea: number[];
  closed: Int32Array;
  closedArea: number[];
}

export function previewGrid(
  surface: ImageData,
  borderColors: string[],
): PreviewGrid {
  const { width: imageWidth, height: imageHeight } = surface;
  const scale = Math.max(
    1,
    Math.ceil(Math.sqrt((imageWidth * imageHeight) / PREVIEW_CELLS)),
  );
  const width = Math.ceil(imageWidth / scale);
  const height = Math.ceil(imageHeight / scale);
  const wall = wallMask(surface, borderColors);
  const coarseWall = new Uint8Array(width * height);
  for (let y = 0; y < imageHeight; y++) {
    const row = Math.floor(y / scale) * width;
    for (let x = 0; x < imageWidth; x++)
      if (wall[y * imageWidth + x]) coarseWall[row + Math.floor(x / scale)] = 1;
  }

  const region = new Int32Array(width * height).fill(-1);
  const regionArea: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < region.length; start++) {
    if (coarseWall[start] || region[start] >= 0) continue;
    const id = regionArea.length;
    let cells = 0;
    region[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const p = stack.pop()!;
      cells++;
      visitNeighbors(p, width, region.length, (q) => {
        if (coarseWall[q] || region[q] >= 0) return;
        region[q] = id;
        stack.push(q);
      });
    }
    regionArea.push(cells * scale * scale);
  }

  const { closed, count } = closedRegions(
    coarseWall,
    width,
    height,
    new Int32Array(region.length),
    closingGap(imageWidth, imageHeight) / scale,
  );
  const closedArea = new Array<number>(count).fill(0);
  for (const c of closed) if (c >= 0) closedArea[c] += scale * scale;
  return {
    scale,
    width,
    height,
    imageWidth,
    imageHeight,
    region,
    regionArea,
    closed,
    closedArea,
  };
}

export function previewBorders(
  grid: PreviewGrid,
  territories: Territory[],
  cellScale: number,
): HTMLCanvasElement {
  const {
    scale,
    width,
    height,
    imageWidth,
    imageHeight,
    region,
    regionArea,
    closed,
    closedArea,
  } = grid;
  const bordered = new Set<number>();
  const enclose = (labels: Int32Array, area: number[], points: Territory[]) => {
    const labelOf = (t: Territory) => {
      const x = Math.floor(t.x / scale);
      const y = Math.floor(t.y / scale);
      return x < 0 || y < 0 || x >= width || y >= height
        ? -1
        : labels[y * width + x];
    };
    const claims = new Map<number, number>();
    for (const t of points) {
      const r = labelOf(t);
      if (r >= 0) claims.set(r, (claims.get(r) ?? 0) + 1);
    }
    const enclosed = new Set<number>();
    const leaked: Territory[] = [];
    for (const t of points) {
      const r = labelOf(t);
      if (r < 0) continue;
      if (
        claims.get(r) === 1 &&
        area[r] <= maxAreaOf(t, imageWidth, imageHeight)
      ) {
        enclosed.add(r);
        bordered.add(t.id);
      } else leaked.push(t);
    }
    return { enclosed, leaked };
  };
  const plain = enclose(region, regionArea, territories);
  const gapClosed = enclose(closed, closedArea, plain.leaked);

  const free = new Uint8Array(region.length);
  for (let p = 0; p < region.length; p++)
    if (
      region[p] >= 0 &&
      !plain.enclosed.has(region[p]) &&
      !gapClosed.enclosed.has(closed[p])
    )
      free[p] = 1;
  const scaled = territories.map((t) => ({
    ...t,
    x: t.x / scale,
    y: t.y / scale,
  }));
  const sites = scaled.filter((t) => !bordered.has(t.id));
  const byId = new Map(scaled.map((t) => [t.id, t]));
  const dist = new Int32Array(region.length).fill(0x7fffffff);
  const owner = new Int32Array(region.length).fill(-1);
  const seeds = seedSkeletons(sites, byId, free, width, height, dist, owner);
  const maxArea = Math.min(
    cellScale * expectedTerritoryArea(imageWidth, imageHeight),
    MAX_LAND_AREA_FRACTION * imageWidth * imageHeight,
  );
  growCells(free, width, dist, owner, seeds, maxArea / (scale * scale));

  const image = new ImageData(width, height);
  const claimed = (q: number) => free[q] === 1 && owner[q] >= 0;
  const otherOwner = (p: number, q: number) =>
    claimed(q) && owner[q] !== owner[p];
  const touchesClaimed = (p: number) => {
    let touches = false;
    visitNeighbors(p, width, region.length, (q) => {
      if (claimed(q)) touches = true;
    });
    return touches;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!free[p]) continue;
      const border =
        owner[p] >= 0
          ? (x < width - 1 && otherOwner(p, p + 1)) ||
            (y < height - 1 && otherOwner(p, p + width))
          : touchesClaimed(p);
      if (border) image.data.set(PREVIEW_RGBA, p * 4);
    }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas;
}
