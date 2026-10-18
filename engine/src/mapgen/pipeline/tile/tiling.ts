import { TileShape } from '../../core/params';

export type Point = [number, number];

interface Tiling {
  a: Point;
  b: Point;
  tiles: Point[][];
}

const H = Math.sqrt(3) / 2;
const OCTARE_SQUARE_EDGE = 1.8;
const OCTARE_SPACING = 1 + OCTARE_SQUARE_EDGE * Math.SQRT2;
const OCTARE_CENTER = OCTARE_SPACING / 2;
const OCTARE_SQUARE_RADIUS = OCTARE_SQUARE_EDGE / Math.SQRT2;
const SQUAGLE_SPACING = 1 + Math.sqrt(3);

function regular(sides: number, startAngle: number): Point[] {
  const radius = 1 / (2 * Math.sin(Math.PI / sides));
  return Array.from({ length: sides }, (_, k) => {
    const angle = startAngle + (2 * Math.PI * k) / sides;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
}

const TILINGS: Record<TileShape, Tiling> = {
  triangles: {
    a: [1, 0],
    b: [0.5, H],
    tiles: [
      [
        [0, 0],
        [1, 0],
        [0.5, H],
      ],
      [
        [1, 0],
        [1.5, H],
        [0.5, H],
      ],
    ],
  },
  squares: {
    a: [1, 0],
    b: [0, 1],
    tiles: [regular(4, Math.PI / 4)],
  },
  hexagons: {
    a: [Math.sqrt(3), 0],
    b: [Math.sqrt(3) / 2, 1.5],
    tiles: [regular(6, Math.PI / 6)],
  },
  octares: {
    a: [OCTARE_SPACING, 0],
    b: [0, OCTARE_SPACING],
    tiles: [
      [
        [OCTARE_CENTER, -0.5],
        [OCTARE_CENTER, 0.5],
        [0.5, OCTARE_CENTER],
        [-0.5, OCTARE_CENTER],
        [-OCTARE_CENTER, 0.5],
        [-OCTARE_CENTER, -0.5],
        [-0.5, -OCTARE_CENTER],
        [0.5, -OCTARE_CENTER],
      ],
      [
        [OCTARE_CENTER - OCTARE_SQUARE_RADIUS, OCTARE_CENTER],
        [OCTARE_CENTER, OCTARE_CENTER - OCTARE_SQUARE_RADIUS],
        [OCTARE_CENTER + OCTARE_SQUARE_RADIUS, OCTARE_CENTER],
        [OCTARE_CENTER, OCTARE_CENTER + OCTARE_SQUARE_RADIUS],
      ],
    ],
  },
  hexgles: {
    a: [2, 0],
    b: [1, 2 * H],
    tiles: [
      regular(6, 0),
      [
        [1, 0],
        [1.5, H],
        [0.5, H],
      ],
      [
        [1.5, H],
        [2.5, H],
        [2, 2 * H],
      ],
    ],
  },
  squagles: {
    a: [SQUAGLE_SPACING, 0],
    b: [SQUAGLE_SPACING / 2, SQUAGLE_SPACING * H],
    tiles: [
      [
        [H, -0.5],
        [H + 1, -0.5],
        [H + 1, 0.5],
        [H, 0.5],
      ],
      [
        [H, 0.5],
        [0, 1],
        [0.5, 1 + H],
        [H + 0.5, 0.5 + H],
      ],
      [
        [0, 1],
        [-H, 0.5],
        [-H - 0.5, 0.5 + H],
        [-0.5, 1 + H],
      ],
      [
        [H, 0.5],
        [H + 1, 0.5],
        [H + 0.5, 0.5 + H],
      ],
      [
        [0, 1],
        [0.5, 1 + H],
        [-0.5, 1 + H],
      ],
    ],
  },
};

export function tileUnitArea(shape: TileShape): number {
  const { a, b, tiles } = TILINGS[shape];
  return Math.abs(a[0] * b[1] - a[1] * b[0]) / tiles.length;
}

const SNAP = 1024;

function snap(value: number): number {
  return Math.round(value * SNAP) / SNAP;
}

export function layTiles(
  shape: TileShape,
  scale: number,
  width: number,
  height: number,
  margin: number,
  phase: Point,
): Point[][] {
  const { a, b, tiles } = TILINGS[shape];
  const cx = width / 2;
  const cy = height / 2;
  const det = a[0] * b[1] - a[1] * b[0];
  const latticeOf = (x: number, y: number): Point => {
    const ux = (x - cx) / scale;
    const uy = (y - cy) / scale;
    return [(ux * b[1] - uy * b[0]) / det, (uy * a[0] - ux * a[1]) / det];
  };
  const corners = [
    latticeOf(0, 0),
    latticeOf(width, 0),
    latticeOf(0, height),
    latticeOf(width, height),
  ];
  const iMin = Math.floor(Math.min(...corners.map((c) => c[0]))) - 2;
  const iMax = Math.ceil(Math.max(...corners.map((c) => c[0]))) + 2;
  const jMin = Math.floor(Math.min(...corners.map((c) => c[1]))) - 2;
  const jMax = Math.ceil(Math.max(...corners.map((c) => c[1]))) + 2;

  const inside = (p: Point) =>
    p[0] >= margin &&
    p[0] <= width - margin &&
    p[1] >= margin &&
    p[1] <= height - margin;

  const placed: Point[][] = [];
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      const ox = (i + phase[0]) * a[0] + (j + phase[1]) * b[0];
      const oy = (i + phase[0]) * a[1] + (j + phase[1]) * b[1];
      for (const tile of tiles) {
        const points = tile.map(([x, y]): Point => [
          cx + (ox + x) * scale,
          cy + (oy + y) * scale,
        ]);
        if (points.every(inside)) placed.push(points);
      }
    }
  }
  return placed.map((t) => t.map(([x, y]): Point => [snap(x), snap(y)]));
}

export function tileNeighbors(placed: Point[][]): number[][] {
  const byEdge = new Map<string, number>();
  const neighbors: number[][] = placed.map(() => []);
  placed.forEach((points, tile) => {
    points.forEach((p, k) => {
      const q = points[(k + 1) % points.length];
      const key = `${p[0] + q[0]},${p[1] + q[1]}`;
      const other = byEdge.get(key);
      if (other === undefined) {
        byEdge.set(key, tile);
        return;
      }
      neighbors[tile].push(other);
      neighbors[other].push(tile);
    });
  });
  return neighbors;
}

export function rasterizeTile(
  points: Point[],
  width: number,
  paint: (pixel: number) => void,
): void {
  const ys = points.map((p) => p[1]);
  const yStart = Math.ceil(Math.min(...ys) - 0.5);
  const yEnd = Math.ceil(Math.max(...ys) - 0.5);
  for (let py = yStart; py < yEnd; py++) {
    const yc = py + 0.5;
    const crossings: number[] = [];
    points.forEach((p, k) => {
      const q = points[(k + 1) % points.length];
      const [lo, hi] = p[1] <= q[1] ? [p, q] : [q, p];
      if (yc < lo[1] || yc >= hi[1]) return;
      crossings.push(
        lo[0] + ((yc - lo[1]) * (hi[0] - lo[0])) / (hi[1] - lo[1]),
      );
    });
    const xStart = Math.ceil(Math.min(...crossings) - 0.5);
    const xEnd = Math.ceil(Math.max(...crossings) - 0.5);
    for (let px = xStart; px < xEnd; px++) paint(py * width + px);
  }
}
