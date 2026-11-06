import { insetPolygon } from '../../../game/tiles/tileGeometry';
import { tileCenter, type TilePoint } from './editorTiles';
import { contains } from './snapTiles';

const LINE_INSET_SIDES = 0.1;
const RANGE_EPSILON = 0.5;
const LATTICE_PADDING = 2;

interface Lattice {
  a: TilePoint;
  b: TilePoint;
  motif: TilePoint[][];
}

function difference(p: TilePoint, q: TilePoint): TilePoint {
  return [p[0] - q[0], p[1] - q[1]];
}

function reflectAcross(
  points: TilePoint[],
  [px, py]: TilePoint,
  [qx, qy]: TilePoint,
): TilePoint[] {
  const length = Math.hypot(qx - px, qy - py);
  const dx = (qx - px) / length;
  const dy = (qy - py) / length;
  return points.map(([x, y]): TilePoint => {
    const along = (x - px) * dx + (y - py) * dy;
    return [2 * (px + along * dx) - x, 2 * (py + along * dy) - y];
  });
}

function latticeOf(seed: TilePoint[]): Lattice {
  const [p0, p1, p2] = seed;
  if (seed.length === 3)
    return {
      a: difference(p1, p0),
      b: difference(p2, p0),
      motif: [seed, reflectAcross(seed, p1, p2)],
    };
  if (seed.length === 4)
    return {
      a: difference(p1, p0),
      b: difference(seed[3], p0),
      motif: [seed],
    };
  const [cx, cy] = tileCenter(seed);
  return {
    a: [p0[0] + p1[0] - 2 * cx, p0[1] + p1[1] - 2 * cy],
    b: [p1[0] + p2[0] - 2 * cx, p1[1] + p2[1] - 2 * cy],
    motif: [seed],
  };
}

function placements(
  seed: TilePoint[],
  { a, b, motif }: Lattice,
  corners: TilePoint[],
): TilePoint[][] {
  const [cx, cy] = tileCenter(seed);
  const det = a[0] * b[1] - a[1] * b[0];
  const cells = corners.map(([x, y]) => {
    const ux = x - cx;
    const uy = y - cy;
    return [(ux * b[1] - uy * b[0]) / det, (uy * a[0] - ux * a[1]) / det];
  });
  const iMin =
    Math.floor(Math.min(...cells.map((c) => c[0]))) - LATTICE_PADDING;
  const iMax = Math.ceil(Math.max(...cells.map((c) => c[0]))) + LATTICE_PADDING;
  const jMin =
    Math.floor(Math.min(...cells.map((c) => c[1]))) - LATTICE_PADDING;
  const jMax = Math.ceil(Math.max(...cells.map((c) => c[1]))) + LATTICE_PADDING;
  const placed: TilePoint[][] = [];
  for (let j = jMin; j <= jMax; j++)
    for (let i = iMin; i <= iMax; i++) {
      const dx = i * a[0] + j * b[0];
      const dy = i * a[1] + j * b[1];
      for (const tile of motif)
        placed.push(tile.map(([x, y]): TilePoint => [x + dx, y + dy]));
    }
  return placed;
}

function cross(o: TilePoint, p: TilePoint, q: TilePoint): number {
  return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
}

function segmentsCross(a: TilePoint, b: TilePoint, c: TilePoint, d: TilePoint) {
  return (
    cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
  );
}

function crossesPolygon(
  points: TilePoint[],
  from: TilePoint,
  to: TilePoint,
): boolean {
  return (
    contains(points, from) ||
    contains(points, to) ||
    points.some((p, i) =>
      segmentsCross(from, to, p, points[(i + 1) % points.length]),
    )
  );
}

export function gridTiles(
  seed: TilePoint[],
  to: TilePoint,
  line: boolean,
): TilePoint[][] {
  const from = tileCenter(seed);
  const side = Math.hypot(seed[1][0] - seed[0][0], seed[1][1] - seed[0][1]);
  const minX = Math.min(from[0], to[0]) - RANGE_EPSILON;
  const maxX = Math.max(from[0], to[0]) + RANGE_EPSILON;
  const minY = Math.min(from[1], to[1]) - RANGE_EPSILON;
  const maxY = Math.max(from[1], to[1]) + RANGE_EPSILON;
  const corners: TilePoint[] = [
    [minX, minY],
    [minX, maxY],
    [maxX, minY],
    [maxX, maxY],
  ];
  return placements(seed, latticeOf(seed), corners).filter((points) => {
    if (line)
      return crossesPolygon(
        insetPolygon(points, side * LINE_INSET_SIDES),
        from,
        to,
      );
    const [x, y] = tileCenter(points);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });
}
