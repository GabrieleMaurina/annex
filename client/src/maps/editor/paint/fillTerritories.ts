import { EARTH_TONES, SEA_COLOR } from 'engine';
import { sharedBorders } from '../../../game/regions/clickableRegions';
import { labelRegions, rgbOf } from '../../../game/regions/labelRegions';
import { linkReach } from '../canvas/findTerritories';
import type { EditorTerritory as Territory } from '../model/editorTypes';

function landClusters(
  surface: ImageData,
  territories: Territory[],
  land: Territory[],
  borderColors: string[],
  brushSize: number,
): Map<number, number> {
  const parent = new Map(land.map((t) => [t.id, t.id]));
  const root = (id: number): number => {
    const up = parent.get(id)!;
    if (up === id) return id;
    const top = root(up);
    parent.set(id, top);
    return top;
  };
  const borders = sharedBorders(
    surface,
    territories,
    borderColors,
    linkReach(brushSize),
  );
  for (const { a, b } of borders)
    if (parent.has(a) && parent.has(b)) parent.set(root(a), root(b));

  const clusterIndex = new Map<number, number>();
  const clusterOf = new Map<number, number>();
  for (const t of land) {
    const top = root(t.id);
    if (!clusterIndex.has(top)) clusterIndex.set(top, clusterIndex.size);
    clusterOf.set(t.id, clusterIndex.get(top)!);
  }
  return clusterOf;
}

export function fillTerritories(
  surface: ImageData,
  territories: Territory[],
  borderColors: string[],
  brushSize: number,
): boolean {
  const { labels, invalidIds } = labelRegions(
    surface,
    territories,
    borderColors,
  );
  const valid = territories.filter((t) => !invalidIds.has(t.id));
  if (valid.length === 0) return false;
  const land = valid.filter((t) => !t.isSea);
  const clusterOf = landClusters(
    surface,
    territories,
    land,
    borderColors,
    brushSize,
  );
  const colorById = new Map(
    valid.map((t) => [
      t.id,
      rgbOf(
        t.isSea
          ? SEA_COLOR
          : EARTH_TONES[clusterOf.get(t.id)! % EARTH_TONES.length],
      ),
    ]),
  );

  const { data } = surface;
  let changed = false;
  for (let p = 0; p < labels.length; p++) {
    const color = colorById.get(labels[p]);
    if (!color) continue;
    const o = p * 4;
    if (
      data[o] === color[0] &&
      data[o + 1] === color[1] &&
      data[o + 2] === color[2] &&
      data[o + 3] === 255
    )
      continue;
    data[o] = color[0];
    data[o + 1] = color[1];
    data[o + 2] = color[2];
    data[o + 3] = 255;
    changed = true;
  }
  return changed;
}
