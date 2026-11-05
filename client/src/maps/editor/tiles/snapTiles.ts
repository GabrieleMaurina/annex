import { tileVariants } from 'engine';
import {
  EDGE_TOLERANCE,
  tileCenter,
  tileRadius,
  type EditorTile,
  type TileKind,
  type TilePoint,
} from './editorTiles';

const OVERLAP_TOLERANCE = 0.5;
const SNAP_REACH = 0.7;

export function kindPolygon(kind: TileKind, side: number): TilePoint[] {
  return tileVariants(kind)[0].map(([x, y]): TilePoint => [x * side, y * side]);
}

function rotateTile(points: TilePoint[], angle: number): TilePoint[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(([x, y]): TilePoint => [
    x * cos - y * sin,
    x * sin + y * cos,
  ]);
}

function translateTile(points: TilePoint[], [dx, dy]: TilePoint): TilePoint[] {
  return points.map(([x, y]): TilePoint => [x + dx, y + dy]);
}

export function centeredTile(points: TilePoint[]): TilePoint[] {
  const [cx, cy] = tileCenter(points);
  return translateTile(points, [-cx, -cy]);
}

function span(points: TilePoint[], nx: number, ny: number): [number, number] {
  const dots = points.map(([x, y]) => x * nx + y * ny);
  return [Math.min(...dots), Math.max(...dots)];
}

function separated(a: TilePoint[], b: TilePoint[], axes: TilePoint[]) {
  return axes.some((p, i) => {
    const q = axes[(i + 1) % axes.length];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const nx = -(q[1] - p[1]) / length;
    const ny = (q[0] - p[0]) / length;
    const [aMin, aMax] = span(a, nx, ny);
    const [bMin, bMax] = span(b, nx, ny);
    return aMax - bMin < OVERLAP_TOLERANCE || bMax - aMin < OVERLAP_TOLERANCE;
  });
}

function overlaps(a: TilePoint[], b: TilePoint[]): boolean {
  const [ax, ay] = tileCenter(a);
  const [bx, by] = tileCenter(b);
  if (Math.hypot(ax - bx, ay - by) >= tileRadius(a) + tileRadius(b))
    return false;
  return !separated(a, b, a) && !separated(a, b, b);
}

function contains(points: TilePoint[], [x, y]: TilePoint): boolean {
  let inside = false;
  points.forEach(([px, py], i) => {
    const [qx, qy] = points[(i + 1) % points.length];
    if (py > y !== qy > y && x < px + ((y - py) * (qx - px)) / (qy - py))
      inside = !inside;
  });
  return inside;
}

export function tileAt(tiles: EditorTile[], p: TilePoint): number | null {
  for (let k = tiles.length - 1; k >= 0; k--)
    if (contains(tiles[k].points, p)) return k;
  return null;
}

function snapSlots(
  others: TilePoint[][],
  base: TilePoint[],
  at: TilePoint,
  reach: number,
): TilePoint[][] {
  const slots: TilePoint[][] = [];
  others.forEach((points) => {
    const [cx, cy] = tileCenter(points);
    if (
      Math.hypot(cx - at[0], cy - at[1]) >
      tileRadius(points) + tileRadius(base) + reach
    )
      return;
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length];
      const target = Math.atan2(p[1] - q[1], p[0] - q[0]);
      const targetLength = Math.hypot(p[0] - q[0], p[1] - q[1]);
      base.forEach((a, j) => {
        const b = base[(j + 1) % base.length];
        if (
          Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - targetLength) >=
          EDGE_TOLERANCE
        )
          return;
        const turned = rotateTile(
          base,
          target - Math.atan2(b[1] - a[1], b[0] - a[0]),
        );
        const anchor = turned[j];
        slots.push(translateTile(turned, [q[0] - anchor[0], q[1] - anchor[1]]));
      });
    });
  });
  return slots;
}

export function placeTile(
  tiles: EditorTile[],
  guides: TilePoint[][],
  base: TilePoint[],
  at: TilePoint,
  skip: number | null,
): TilePoint[] {
  const others = [
    ...tiles.flatMap((tile, k) => (k === skip ? [] : [tile.points])),
    ...guides,
  ];
  const reach = tileRadius(base) * SNAP_REACH;
  const distance = (points: TilePoint[]) => {
    const [cx, cy] = tileCenter(points);
    return Math.hypot(cx - at[0], cy - at[1]);
  };
  const slots = snapSlots(others, base, at, reach)
    .map((points) => ({ points, distance: distance(points) }))
    .filter((slot) => slot.distance <= reach)
    .sort((a, b) => a.distance - b.distance);
  const free = slots.find(
    (slot) => !others.some((points) => overlaps(points, slot.points)),
  );
  return free ? free.points : translateTile(base, at);
}
