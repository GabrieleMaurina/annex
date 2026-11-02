import { sharedBorders } from '../../../game/regions/clickableRegions';
import { findUnmarkedRegions } from '../../../game/regions/labelRegions';
import { segmentsProperlyIntersect } from '../mapCanvasGeometry';
import {
  newTerritory,
  nextTerritoryId,
  SEA_BRUSH,
  type EditorTerritory as Territory,
} from '../model/editorTypes';
import { getVertexRadius } from './canvasGeometry';

const MIN_LINK_REACH = 16;

export function linkReach(brushSize: number): number {
  return Math.max(MIN_LINK_REACH, 2 * brushSize + 2);
}

export function findTerritories(
  surface: ImageData,
  territories: Territory[],
  borderColors: string[],
  brushId: number,
  continentCount: number,
): Territory[] {
  const radius = getVertexRadius(surface.width, surface.height);
  const firstId = nextTerritoryId(territories);
  const found = findUnmarkedRegions(
    surface,
    territories,
    borderColors,
    brushId === SEA_BRUSH,
    Math.PI * radius * radius,
  );
  return [
    ...territories,
    ...found.map((point, i) =>
      newTerritory(firstId + i, point.x, point.y, brushId, continentCount),
    ),
  ];
}

export function linkTerritories(
  surface: ImageData,
  territories: Territory[],
  borderColors: string[],
  brushSize: number,
): Territory[] {
  const all = territories.map((t) => ({ ...t, neighbors: [...t.neighbors] }));
  const byId = new Map(all.map((t) => [t.id, t]));
  const borders = sharedBorders(
    surface,
    all,
    borderColors,
    linkReach(brushSize),
  );
  const added: [Territory, Territory][] = [];
  for (const { a, b } of borders.sort((x, y) => y.length - x.length)) {
    const from = byId.get(a)!;
    const to = byId.get(b)!;
    if (
      from.neighbors.includes(b) ||
      from.timed.some((m) => m.id === b) ||
      from.directional.some((m) => m.id === b)
    )
      continue;
    if (added.some(([p, q]) => segmentsProperlyIntersect(from, to, p, q)))
      continue;
    added.push([from, to]);
    from.neighbors.push(b);
    to.neighbors.push(a);
  }
  return all;
}
