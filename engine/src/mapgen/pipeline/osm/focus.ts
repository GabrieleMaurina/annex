import { componentAreas, CutLevels } from './cut';
import { fillRings } from './raster/rasterize';
import { Atoms } from './regions';
import { OsmFocus, OsmPlace } from './types';

const FOCUS_LEVELS = [100, 90, 80, 70];
const MIN_INSIDE_SHARE = 0.5;
const MIN_OVERLAP = 0.2;
const CITY_TOP_LEVEL = 80;
const LABEL_CLASSES = [
  'country',
  'state',
  'province',
  'city',
  'town',
  'village',
];

export function matchComponents(
  atoms: Atoms,
  levels: CutLevels,
  inside: Uint8Array,
  thresholds: number[],
): Uint8Array | null {
  const insideArea = new Float64Array(atoms.count);
  let outlineArea = 0;
  for (let i = 0; i < inside.length; i++) {
    const atom = atoms.atomOf[i];
    if (!inside[i] || atom < 0) continue;
    insideArea[atom]++;
    outlineArea++;
  }
  if (outlineArea === 0) return null;
  let best: Uint8Array | null = null;
  let bestOverlap = MIN_OVERLAP;
  for (const threshold of thresholds) {
    const component = levels.components[levels.thresholds.indexOf(threshold)];
    const area = componentAreas(atoms, component);
    const within = new Map<number, number>();
    for (let atom = 0; atom < atoms.count; atom++)
      within.set(
        component[atom],
        (within.get(component[atom]) ?? 0) + insideArea[atom],
      );
    const kept = new Set<number>();
    let keptArea = 0;
    let keptInside = 0;
    for (const [c, total] of area)
      if (within.get(c)! >= total * MIN_INSIDE_SHARE) {
        kept.add(c);
        keptArea += total;
        keptInside += within.get(c)!;
      }
    const overlap = keptInside / (keptArea + outlineArea - keptInside);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = Uint8Array.from(component, (c) => (kept.has(c) ? 1 : 0));
    }
  }
  return best;
}

function byOutline(
  atoms: Atoms,
  levels: CutLevels,
  rings: number[][],
  width: number,
  height: number,
): Uint8Array | null {
  const inside = new Uint8Array(width * height);
  fillRings(inside, width, height, rings, 1);
  return matchComponents(atoms, levels, inside, FOCUS_LEVELS);
}

function byPoint(
  atoms: Atoms,
  levels: CutLevels,
  focus: OsmFocus,
  places: OsmPlace[],
  width: number,
  height: number,
): Uint8Array | null {
  const name = focus.name.toLowerCase();
  const label = places
    .filter(
      (p) =>
        p.layer === 'place' &&
        LABEL_CLASSES.includes(p.cls) &&
        p.name.toLowerCase() === name &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < width &&
        p.y < height,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - focus.x, a.y - focus.y) -
        Math.hypot(b.x - focus.x, b.y - focus.y),
    )[0];
  const x = Math.min(width - 1, Math.max(0, Math.floor(label?.x ?? focus.x)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(label?.y ?? focus.y)));
  const atom = atoms.atomOf[y * width + x];
  if (atom < 0) return null;
  const top = Math.max(focus.level, CITY_TOP_LEVEL);
  const indices = levels.thresholds
    .map((_, i) => i)
    .filter(
      (i) => levels.thresholds[i] >= focus.level && levels.thresholds[i] <= top,
    );
  const fitting = indices.find(
    (i) =>
      componentAreas(atoms, levels.components[i]).get(
        levels.components[i][atom],
      )! >= focus.minArea,
  );
  if (fitting === undefined) return null;
  const component = levels.components[fitting];
  return Uint8Array.from(component, (c) => (c === component[atom] ? 1 : 0));
}

export function focusAtoms(
  atoms: Atoms,
  levels: CutLevels,
  focus: OsmFocus[],
  places: OsmPlace[],
  width: number,
  height: number,
): Uint8Array | null {
  let union: Uint8Array | null = null;
  for (const one of focus) {
    const kept =
      one.rings.length > 0
        ? byOutline(atoms, levels, one.rings, width, height)
        : byPoint(atoms, levels, one, places, width, height);
    if (!kept) continue;
    if (!union) union = kept;
    else
      for (let atom = 0; atom < kept.length; atom++) union[atom] |= kept[atom];
  }
  return union;
}
