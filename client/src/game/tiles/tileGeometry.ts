import type { LockedTile } from '../../lib/types';

type Point = [number, number];

export function polygonPath(points: Point[]): Path2D {
  const path = new Path2D();
  points.forEach(([x, y], k) =>
    k === 0 ? path.moveTo(x, y) : path.lineTo(x, y),
  );
  path.closePath();
  return path;
}

function polygonArea(points: Point[]): number {
  let twiceArea = 0;
  points.forEach(([x, y], k) => {
    const [nx, ny] = points[(k + 1) % points.length];
    twiceArea += x * ny - nx * y;
  });
  return Math.abs(twiceArea) / 2;
}

export function tileLineWidth(lockedTiles: LockedTile[]): number {
  if (lockedTiles.length === 0) return 0;
  const meanArea =
    lockedTiles.reduce((sum, tile) => sum + polygonArea(tile.points), 0) /
    lockedTiles.length;
  const radius = Math.round(Math.sqrt(meanArea) * 0.025);
  return 2 * Math.min(5, Math.max(2, radius)) + 2;
}

function inwardEdges(points: Point[]) {
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return points.map(([x, y], k) => {
    const [nx, ny] = points[(k + 1) % points.length];
    const dx = nx - x;
    const dy = ny - y;
    const length = Math.hypot(dx, dy);
    const flip =
      -dy * (cx - (x + nx) / 2) + dx * (cy - (y + ny) / 2) < 0 ? -1 : 1;
    return {
      x,
      y,
      dx,
      dy,
      inX: (-dy / length) * flip,
      inY: (dx / length) * flip,
    };
  });
}

export function insetPolygon(points: Point[], distance: number): Point[] {
  const lines = inwardEdges(points).map((e) => ({
    ...e,
    x: e.x + e.inX * distance,
    y: e.y + e.inY * distance,
  }));
  return lines.map((line, k): Point => {
    const prev = lines[(k + lines.length - 1) % lines.length];
    const t =
      ((line.x - prev.x) * line.dy - (line.y - prev.y) * line.dx) /
      (prev.dx * line.dy - prev.dy * line.dx);
    return [prev.x + prev.dx * t, prev.y + prev.dy * t];
  });
}

export function tileEdges(
  tile: LockedTile,
  distance: number,
): { from: Point; to: Point; outside: Point }[] {
  return inwardEdges(tile.points).map((e) => ({
    from: [e.x, e.y],
    to: [e.x + e.dx, e.y + e.dy],
    outside: [
      e.x + e.dx / 2 - e.inX * distance,
      e.y + e.dy / 2 - e.inY * distance,
    ],
  }));
}
