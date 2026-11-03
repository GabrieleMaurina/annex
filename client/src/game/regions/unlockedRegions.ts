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

const latestByBase = new WeakMap<ClickableRegions, ClickableRegions>();

export function withUnlockedRegions(
  regions: ClickableRegions,
  tiles: LockedTile[],
  lineWidth: number,
): ClickableRegions {
  if (tiles.length === 0) return regions;
  const ids = new Set(tiles.map((tile) => tile.id));
  const latest = latestByBase.get(regions);
  const from =
    latest?.unlocked?.lineWidth === lineWidth &&
    latest.unlocked.tiles.every((tile) => ids.has(tile.id))
      ? latest
      : regions;
  const painted = new Set(from.unlocked?.tiles.map((tile) => tile.id));
  const labels = from.labels.slice();
  const fillLabels = from.fillLabels.slice();
  const splitLabels = from.splitLabels.slice();
  const shapes = new Map(from.shapes);
  for (const tile of tiles) {
    if (painted.has(tile.id)) continue;
    paintTile(labels, regions.width, tile);
    paintTile(splitLabels, regions.width, tile);
    const inset = insetPolygon(tile.points, lineWidth / 2);
    paintTile(fillLabels, regions.width, { ...tile, points: inset });
    const path = polygonPath(inset);
    shapes.set(tile.id, { fill: path, outline: path });
  }
  const merged = {
    ...regions,
    labels,
    fillLabels,
    splitLabels,
    shapes,
    unlocked: { tiles, lineWidth },
    base: regions,
  };
  latestByBase.set(regions, merged);
  return merged;
}
