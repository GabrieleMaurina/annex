import type { LockedTile } from '../../lib/types';
import { insetPolygon, polygonPath } from '../tiles/tileGeometry';
import { tileAt } from '../tiles/unlock';
import type { ClickableRegions } from './clickableRegions';

function paintTile(labels: Int16Array, width: number, tile: LockedTile) {
  const xs = tile.points.map((p) => p[0]);
  const ys = tile.points.map((p) => p[1]);
  const height = labels.length / width;
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (tileAt([tile], x + 0.5, y + 0.5)) labels[y * width + x] = tile.id;
}

export function withUnlockedRegions(
  regions: ClickableRegions,
  tiles: LockedTile[],
  lineWidth: number,
): ClickableRegions {
  if (tiles.length === 0) return regions;
  const labels = regions.labels.slice();
  const shapes = new Map(regions.shapes);
  for (const tile of tiles) {
    paintTile(labels, regions.width, tile);
    const path = polygonPath(insetPolygon(tile.points, lineWidth / 2));
    shapes.set(tile.id, { fill: path, outline: path });
  }
  return { ...regions, labels, shapes, unlocked: { tiles, lineWidth } };
}
