import {
  mapImageSize,
  type MapAspect,
  type MapSize,
  type OsmDetail,
} from 'engine';

export interface WorldFrame {
  x0: number;
  y0: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
}

export interface TileCover {
  zoom: number;
  tiles: [number, number][];
}

const MAX_ZOOM = 14;
const TILE_PIXELS = 512;
const TILE_BUDGET = 192;
const STREET_ZOOM = 13;
const STREET_TILE_BUDGET = 48;
const UNLOCK_ZOOMS = [9, 11, 12, 13, 14];
const DETAIL_ZOOMS: [OsmDetail, number][] = [
  ['countries', 0],
  ['states', 1],
  ['counties', 9],
  ['municipalities', 11],
  ['districts', 12],
  ['neighbourhoods', 12],
  ['blocks', 13],
];

export function mercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

export function frameCorners(frame: WorldFrame): [number, number][] {
  const { x0, y0, ux, uy, vx, vy } = frame;
  return [
    [x0, y0],
    [x0 + ux, y0 + uy],
    [x0 + vx, y0 + vy],
    [x0 + ux + vx, y0 + uy + vy],
  ];
}

export function frameWidth(frame: WorldFrame): number {
  return Math.hypot(frame.ux, frame.uy);
}

export function frameBounds(frame: WorldFrame) {
  const corners = frameCorners(frame);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

function tileRange(frame: WorldFrame, zoom: number) {
  const n = 2 ** zoom;
  const bounds = frameBounds(frame);
  const x0 = Math.floor(bounds.x0 * n);
  const x1 = Math.floor(bounds.x1 * n - 1e-9);
  const y0 = Math.max(0, Math.floor(bounds.y0 * n));
  const y1 = Math.min(n - 1, Math.floor(bounds.y1 * n - 1e-9));
  return { x0, x1, y0, y1, count: (x1 - x0 + 1) * (y1 - y0 + 1) };
}

export function dataZoom(
  frame: WorldFrame,
  size: MapSize,
  aspect: MapAspect,
): number {
  const { width } = mapImageSize(size, aspect);
  let zoom = Math.max(
    0,
    Math.min(
      MAX_ZOOM,
      Math.round(Math.log2(width / (frameWidth(frame) * TILE_PIXELS))),
    ),
  );
  for (const unlock of UNLOCK_ZOOMS) {
    const budget = unlock >= STREET_ZOOM ? STREET_TILE_BUDGET : TILE_BUDGET;
    if (unlock > zoom && tileRange(frame, unlock).count <= budget)
      zoom = unlock;
  }
  return zoom;
}

export function tileCover(
  frame: WorldFrame,
  size: MapSize,
  aspect: MapAspect,
): TileCover {
  const zoom = dataZoom(frame, size, aspect);
  const { x0, x1, y0, y1 } = tileRange(frame, zoom);
  const tiles: [number, number][] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) tiles.push([x, y]);
  return { zoom, tiles };
}

export function availableDetails(
  frame: WorldFrame,
  size: MapSize,
  aspect: MapAspect,
): OsmDetail[] {
  const zoom = dataZoom(frame, size, aspect);
  return DETAIL_ZOOMS.filter(([, min]) => zoom >= min).map(
    ([detail]) => detail,
  );
}
