import { Perlin2D } from '../core/noise';
import { GridDimensions, OUTPUT_SCALE } from '../core/params';
import { Rng } from '../core/rng';
import { SpecialEdge } from '../pipeline/connectivity';
import {
  continentEarthTone,
  TERRITORY_STROKE_COLOR,
  WATER_COLOR,
} from './palette';

type Point = [number, number];
interface Edge {
  from: Point;
  to: Point;
}

function pointKey(p: Point): string {
  return `${p[0]},${p[1]}`;
}

function collectTerritoryEdges(
  labelGrid: Int16Array,
  territoryCount: number,
  width: number,
  height: number,
): Edge[][] {
  const edgesByTerritory: Edge[][] = Array.from(
    { length: territoryCount },
    () => [],
  );
  const labelAt = (gx: number, gy: number): number =>
    gx < 0 || gx >= width || gy < 0 || gy >= height
      ? -1
      : labelGrid[gy * width + gx];

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const id = labelAt(gx, gy);
      if (id < 0) continue;
      const edges = edgesByTerritory[id];
      if (labelAt(gx, gy - 1) !== id)
        edges.push({ from: [gx, gy], to: [gx + 1, gy] });
      if (labelAt(gx + 1, gy) !== id)
        edges.push({ from: [gx + 1, gy], to: [gx + 1, gy + 1] });
      if (labelAt(gx, gy + 1) !== id)
        edges.push({ from: [gx + 1, gy + 1], to: [gx, gy + 1] });
      if (labelAt(gx - 1, gy) !== id)
        edges.push({ from: [gx, gy + 1], to: [gx, gy] });
    }
  }
  return edgesByTerritory;
}

function stitchLoops(edges: Edge[]): Point[][] {
  const byFrom = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = pointKey(edge.from);
    if (!byFrom.has(key)) byFrom.set(key, []);
    byFrom.get(key)!.push(edge);
  }

  const used = new Set<Edge>();
  const loops: Point[][] = [];
  for (const startEdge of edges) {
    if (used.has(startEdge)) continue;
    const loop: Point[] = [startEdge.from];
    let current = startEdge;
    while (true) {
      used.add(current);
      loop.push(current.to);
      if (pointKey(current.to) === pointKey(startEdge.from)) break;
      const candidates = byFrom.get(pointKey(current.to));
      const next = candidates?.find((c) => !used.has(c));
      if (!next) break;
      current = next;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

function decimatePositional(loop: Point[], step: number): Point[] {
  if (loop.length <= step * 6) return loop;
  return loop.filter(([gx, gy]) => (gx + gy) % step === 0);
}

function chaikinSmooth(loop: Point[], iterations: number): Point[] {
  let points = loop;
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    points = next;
  }
  return points;
}

const NOISE_FREQUENCY = 0.22;
const NOISE_AMPLITUDE = 2.2;

function isOnGridBoundary(p: Point, width: number, height: number): boolean {
  return p[0] <= 0 || p[0] >= width || p[1] <= 0 || p[1] >= height;
}

function buildDisplacementCache(
  loopsByTerritory: Point[][][],
  noise: Perlin2D,
  width: number,
  height: number,
): Map<string, Point> {
  const neighborKeysByPoint = new Map<string, Set<string>>();
  const coordByKey = new Map<string, Point>();

  for (const loops of loopsByTerritory) {
    for (const loop of loops) {
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % n];
        const ka = pointKey(a);
        const kb = pointKey(b);
        coordByKey.set(ka, a);
        coordByKey.set(kb, b);
        if (!neighborKeysByPoint.has(ka))
          neighborKeysByPoint.set(ka, new Set());
        if (!neighborKeysByPoint.has(kb))
          neighborKeysByPoint.set(kb, new Set());
        neighborKeysByPoint.get(ka)!.add(kb);
        neighborKeysByPoint.get(kb)!.add(ka);
      }
    }
  }

  const displacedByKey = new Map<string, Point>();
  for (const [key, neighborKeys] of neighborKeysByPoint) {
    if (neighborKeys.size !== 2) continue;
    const p = coordByKey.get(key)!;
    if (isOnGridBoundary(p, width, height)) continue;
    const [k1, k2] = [...neighborKeys].sort();
    const n1 = coordByKey.get(k1)!;
    const n2 = coordByKey.get(k2)!;
    const tangentX = n2[0] - n1[0];
    const tangentY = n2[1] - n1[1];
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;
    const displacement =
      noise.noise(p[0] * NOISE_FREQUENCY, p[1] * NOISE_FREQUENCY) *
      NOISE_AMPLITUDE;
    displacedByKey.set(key, [
      p[0] + normalX * displacement,
      p[1] + normalY * displacement,
    ]);
  }

  return displacedByKey;
}

function applyDisplacement(
  loop: Point[],
  displacedByKey: Map<string, Point>,
): Point[] {
  return loop.map((p) => displacedByKey.get(pointKey(p)) ?? p);
}

function toPathData(points: Point[], close: boolean): string {
  const scaled = points.map(([x, y]) => [x * OUTPUT_SCALE, y * OUTPUT_SCALE]);
  const [first, ...rest] = scaled;
  const line = `M${first[0].toFixed(1)},${first[1].toFixed(1)} ${rest
    .map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')}`;
  return close ? `${line} Z` : line;
}

const BOUNDARY_EPSILON = 0.01;

function segmentOnGridBoundary(
  a: Point,
  b: Point,
  width: number,
  height: number,
): boolean {
  if (Math.abs(a[0] - b[0]) <= BOUNDARY_EPSILON) {
    const x = (a[0] + b[0]) / 2;
    if (x <= BOUNDARY_EPSILON || x >= width - BOUNDARY_EPSILON) return true;
  }
  if (Math.abs(a[1] - b[1]) <= BOUNDARY_EPSILON) {
    const y = (a[1] + b[1]) / 2;
    if (y <= BOUNDARY_EPSILON || y >= height - BOUNDARY_EPSILON) return true;
  }
  return false;
}

function strokePathForLoop(
  loop: Point[],
  width: number,
  height: number,
): string {
  const n = loop.length;
  const onBoundary = loop.map((_, i) =>
    segmentOnGridBoundary(loop[i], loop[(i + 1) % n], width, height),
  );
  if (!onBoundary.some(Boolean)) return toPathData(loop, true);

  let start = 0;
  for (let i = 0; i < n; i++) {
    if (onBoundary[i] && !onBoundary[(i + 1) % n]) {
      start = (i + 1) % n;
      break;
    }
  }

  const runs: string[] = [];
  let current: Point[] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (onBoundary[i]) {
      if (current.length > 1) runs.push(toPathData(current, false));
      current = [];
      continue;
    }
    if (current.length === 0) current.push(loop[i]);
    current.push(loop[(i + 1) % n]);
  }
  if (current.length > 1) runs.push(toPathData(current, false));
  return runs.join(' ');
}

export interface PixelPoint {
  x: number;
  y: number;
}

const TERRITORY_STROKE_WIDTH = 5;
const SPECIAL_EDGE_STROKE_WIDTH = 4;

function labelAtPixel(
  labelGrid: Int16Array,
  px: number,
  py: number,
  width: number,
  height: number,
): number {
  const gx = Math.floor(px / OUTPUT_SCALE);
  const gy = Math.floor(py / OUTPUT_SCALE);
  if (gx < 0 || gx >= width || gy < 0 || gy >= height) return -1;
  return labelGrid[gy * width + gx];
}

const SPECIAL_EDGE_CLIP_MARGIN = NOISE_AMPLITUDE * OUTPUT_SCALE * 1.5;

function longestWaterRun(
  labelGrid: Int16Array,
  from: PixelPoint,
  dx: number,
  dy: number,
  steps: number,
  width: number,
  height: number,
): { startStep: number; endStep: number } | null {
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;

  for (let i = 0; i <= steps + 1; i++) {
    const isWater =
      i <= steps &&
      labelAtPixel(
        labelGrid,
        from.x + dx * (i / steps),
        from.y + dy * (i / steps),
        width,
        height,
      ) === -1;
    if (isWater) {
      if (runStart === -1) runStart = i;
      continue;
    }
    if (runStart !== -1) {
      const length = i - runStart;
      if (length > bestLength) {
        bestLength = length;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }

  if (bestLength === 0) return null;
  return { startStep: bestStart, endStep: bestStart + bestLength - 1 };
}

function clipSpecialEdge(
  labelGrid: Int16Array,
  from: PixelPoint,
  to: PixelPoint,
  width: number,
  height: number,
): { from: PixelPoint; to: PixelPoint } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(20, Math.ceil(length / (OUTPUT_SCALE / 2)));

  const run = longestWaterRun(labelGrid, from, dx, dy, steps, width, height);
  if (!run) return { from, to: from };

  const fromT = run.startStep / steps;
  const toT = run.endStep / steps;

  const marginT = length > 0 ? SPECIAL_EDGE_CLIP_MARGIN / length : 0;
  let clippedFromT = fromT + marginT;
  let clippedToT = toT - marginT;
  if (clippedFromT >= clippedToT) {
    clippedFromT = fromT;
    clippedToT = toT;
  }
  if (clippedFromT >= clippedToT) return { from, to: from };

  return {
    from: { x: from.x + dx * clippedFromT, y: from.y + dy * clippedFromT },
    to: { x: from.x + dx * clippedToT, y: from.y + dy * clippedToT },
  };
}

export function renderMapImage(
  labelGrid: Int16Array,
  continentIdByTerritory: number[],
  territoryCenters: PixelPoint[],
  specialEdges: SpecialEdge[],
  rng: Rng,
  dims: GridDimensions,
): string {
  const { width, height } = dims;
  const imageWidth = width * OUTPUT_SCALE;
  const imageHeight = height * OUTPUT_SCALE;

  const edgesByTerritory = collectTerritoryEdges(
    labelGrid,
    continentIdByTerritory.length,
    width,
    height,
  );

  const smoothedLoopsByTerritory = edgesByTerritory.map((edges) =>
    stitchLoops(edges).map((loop) =>
      chaikinSmooth(decimatePositional(loop, 2), 3),
    ),
  );

  const noise = new Perlin2D(rng);
  const displacedByKey = buildDisplacementCache(
    smoothedLoopsByTerritory,
    noise,
    width,
    height,
  );

  const paths: string[] = [];
  for (
    let territoryId = 0;
    territoryId < continentIdByTerritory.length;
    territoryId++
  ) {
    const loops = smoothedLoopsByTerritory[territoryId].map((loop) =>
      applyDisplacement(loop, displacedByKey),
    );
    if (loops.length === 0) continue;
    const fillPath = loops.map((loop) => toPathData(loop, true)).join(' ');
    const color = continentEarthTone(continentIdByTerritory[territoryId]);
    paths.push(`<path d="${fillPath}" fill="${color}"/>`);

    const strokePath = loops
      .map((loop) => strokePathForLoop(loop, width, height))
      .filter(Boolean)
      .join(' ');
    if (strokePath) {
      paths.push(
        `<path d="${strokePath}" fill="none" stroke="${TERRITORY_STROKE_COLOR}" stroke-width="${TERRITORY_STROKE_WIDTH}" stroke-linejoin="round"/>`,
      );
    }
  }

  const specialEdgeLines = specialEdges
    .map(({ a, b }) => {
      const centerA = territoryCenters[a];
      const centerB = territoryCenters[b];
      if (!centerA || !centerB) return '';
      const { from, to } = clipSpecialEdge(
        labelGrid,
        centerA,
        centerB,
        width,
        height,
      );
      if (from.x === to.x && from.y === to.y) return '';
      return (
        `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" ` +
        `x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" ` +
        `stroke="${TERRITORY_STROKE_COLOR}" stroke-width="${SPECIAL_EDGE_STROKE_WIDTH}" ` +
        `stroke-dasharray="16,12" stroke-linecap="round"/>`
      );
    })
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" ` +
    `viewBox="0 0 ${imageWidth} ${imageHeight}">` +
    `<rect width="${imageWidth}" height="${imageHeight}" fill="${WATER_COLOR}"/>` +
    paths.join('') +
    specialEdgeLines +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
