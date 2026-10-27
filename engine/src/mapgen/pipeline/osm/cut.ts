import { CUT_RANKS } from './ranks';
import { Atoms } from './regions';

export interface CutLevels {
  thresholds: number[];
  components: Int32Array[];
}

function find(parent: Int32Array, x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

export function buildCutLevels(atoms: Atoms): CutLevels {
  const parent = Int32Array.from({ length: atoms.count }, (_, i) => i);
  const pairs = [...atoms.pairs].sort((a, b) => a.strength - b.strength);
  const components: Int32Array[] = [];
  let next = 0;
  for (const threshold of CUT_RANKS) {
    while (next < pairs.length && pairs[next].strength < threshold) {
      const ra = find(parent, pairs[next].a);
      const rb = find(parent, pairs[next].b);
      if (ra !== rb) parent[rb] = ra;
      next++;
    }
    components.push(
      Int32Array.from({ length: atoms.count }, (_, i) => find(parent, i)),
    );
  }
  return { thresholds: CUT_RANKS, components };
}

export function componentAreas(
  atoms: Atoms,
  component: Int32Array,
): Map<number, number> {
  const areas = new Map<number, number>();
  for (let a = 0; a < atoms.count; a++)
    areas.set(component[a], (areas.get(component[a]) ?? 0) + atoms.area[a]);
  return areas;
}

function componentCount(
  atoms: Atoms,
  component: Int32Array,
  minArea: number,
): number {
  let count = 0;
  for (const value of componentAreas(atoms, component).values())
    if (value >= minArea) count++;
  return Math.max(1, count);
}

export function chooseCut(
  atoms: Atoms,
  levels: CutLevels,
  targetArea: number,
  forced: number | null,
): number {
  if (forced !== null) return levels.thresholds.indexOf(forced);
  let best = 0;
  let bestCost = Infinity;
  levels.components.forEach((component, index) => {
    let cost = 0;
    for (const value of componentAreas(atoms, component).values())
      cost += value * Math.abs(Math.log(value / targetArea));
    if (cost <= bestCost) {
      best = index;
      bestCost = cost;
    }
  });
  return best;
}

export function parentCutIndex(
  atoms: Atoms,
  levels: CutLevels,
  cutIndex: number,
  minArea: number,
): number {
  const count = componentCount(atoms, levels.components[cutIndex], minArea);
  for (let i = cutIndex + 1; i < levels.components.length; i++)
    if (componentCount(atoms, levels.components[i], minArea) < count) return i;
  return levels.components.length - 1;
}
