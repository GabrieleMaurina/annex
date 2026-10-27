import { CutLevels } from './cut';
import { Atoms } from './regions';

const MERGE_SHARE = 0.5;
const GROUP_SHARE = 0.25;
const EDGE_FRAGMENT_SHARE = 0.5;
const BALANCE_SPLIT_RATIO = 1.5;
export const GIANT_RATIO = 6;

interface RegionSet {
  regionOfAtom: Int32Array;
  atomsOf: Map<number, number[]>;
  area: Map<number, number>;
  borders: Map<number, Set<number>>;
  nextId: number;
}

export interface FittedRegions {
  grid: Int32Array;
  count: number;
  balance: boolean;
}

function rebuildBorders(set: RegionSet, atoms: Atoms): void {
  set.borders = new Map();
  for (const region of set.atomsOf.keys()) set.borders.set(region, new Set());
  for (const { a, b } of atoms.pairs) {
    const ra = set.regionOfAtom[a];
    const rb = set.regionOfAtom[b];
    if (ra === rb) continue;
    set.borders.get(ra)!.add(rb);
    set.borders.get(rb)!.add(ra);
  }
}

function buildRegionSet(atoms: Atoms, component: Int32Array): RegionSet {
  const set: RegionSet = {
    regionOfAtom: Int32Array.from(component),
    atomsOf: new Map(),
    area: new Map(),
    borders: new Map(),
    nextId: atoms.count,
  };
  for (let atom = 0; atom < atoms.count; atom++) {
    const region = component[atom];
    const list = set.atomsOf.get(region);
    if (list) list.push(atom);
    else set.atomsOf.set(region, [atom]);
    set.area.set(region, (set.area.get(region) ?? 0) + atoms.area[atom]);
  }
  rebuildBorders(set, atoms);
  return set;
}

function mergeInto(set: RegionSet, keep: number, gone: number): void {
  const keepAtoms = set.atomsOf.get(keep)!;
  for (const atom of set.atomsOf.get(gone)!) {
    set.regionOfAtom[atom] = keep;
    keepAtoms.push(atom);
  }
  set.area.set(keep, set.area.get(keep)! + set.area.get(gone)!);
  for (const neighbor of set.borders.get(gone)!) {
    set.borders.get(neighbor)!.delete(gone);
    if (neighbor === keep) continue;
    set.borders.get(keep)!.add(neighbor);
    set.borders.get(neighbor)!.add(keep);
  }
  set.atomsOf.delete(gone);
  set.area.delete(gone);
  set.borders.delete(gone);
}

function bestNeighbor(
  set: RegionSet,
  region: number,
  parentOf: (region: number) => number,
): number | null {
  const parent = parentOf(region);
  let best: number | null = null;
  let bestKey = [Infinity, Infinity];
  for (const neighbor of set.borders.get(region)!) {
    const key = [
      parentOf(neighbor) === parent ? 0 : 1,
      set.area.get(neighbor)!,
    ];
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = neighbor;
      bestKey = key;
    }
  }
  return best;
}

function heapPush(heap: [number, number][], item: [number, number]): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const up = (i - 1) >> 1;
    if (heap[up][0] <= heap[i][0]) break;
    [heap[up], heap[i]] = [heap[i], heap[up]];
    i = up;
  }
}

function heapPop(heap: [number, number][]): [number, number] {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}

function mergeDown(
  set: RegionSet,
  parentOf: (region: number) => number,
  minArea: number,
  max: number,
): void {
  const heap: [number, number][] = [];
  for (const [region, area] of set.area) heapPush(heap, [area, region]);
  while (heap.length > 0) {
    const [area, region] = heapPop(heap);
    if (set.area.get(region) !== area) continue;
    if (area >= minArea && set.atomsOf.size <= max) break;
    const neighbor = bestNeighbor(set, region, parentOf);
    if (neighbor === null) continue;
    mergeInto(set, neighbor, region);
    heapPush(heap, [set.area.get(neighbor)!, neighbor]);
  }
}

function edgeAtoms(atoms: Atoms, width: number): Set<number> {
  const height = atoms.atomOf.length / width;
  const edge = new Set<number>();
  const add = (x: number, y: number) => {
    const atom = atoms.atomOf[y * width + x];
    if (atom >= 0) edge.add(atom);
  };
  for (let x = 0; x < width; x++) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    add(0, y);
    add(width - 1, y);
  }
  return edge;
}

function mergeEdgeFragments(
  set: RegionSet,
  parentOf: (region: number) => number,
  edge: Set<number>,
  maxArea: number,
): void {
  const stuck = new Set<number>();
  for (;;) {
    let fragment: number | null = null;
    for (const [region, area] of set.area)
      if (
        area < maxArea &&
        !stuck.has(region) &&
        (fragment === null || area < set.area.get(fragment)!) &&
        set.atomsOf.get(region)!.some((atom) => edge.has(atom))
      )
        fragment = region;
    if (fragment === null) return;
    const neighbor = bestNeighbor(set, fragment, parentOf);
    if (neighbor === null) stuck.add(fragment);
    else mergeInto(set, neighbor, fragment);
  }
}

function groupAdjacency(
  atoms: Atoms,
  groupOfAtom: Map<number, number>,
): Map<number, Map<number, number>> {
  const adjacency = new Map<number, Map<number, number>>();
  for (const { a, b, length } of atoms.pairs) {
    const ga = groupOfAtom.get(a);
    const gb = groupOfAtom.get(b);
    if (ga === undefined || gb === undefined || ga === gb) continue;
    for (const [from, to] of [
      [ga, gb],
      [gb, ga],
    ]) {
      if (!adjacency.has(from)) adjacency.set(from, new Map());
      const map = adjacency.get(from)!;
      map.set(to, (map.get(to) ?? 0) + length);
    }
  }
  return adjacency;
}

function groupArea(atoms: Atoms, group: number[]): number {
  return group.reduce((sum, atom) => sum + atoms.area[atom], 0);
}

function groupCenter(atoms: Atoms, group: number[]): [number, number] {
  let x = 0;
  let y = 0;
  let area = 0;
  for (const atom of group) {
    x += atoms.sumX[atom];
    y += atoms.sumY[atom];
    area += atoms.area[atom];
  }
  return [x / area, y / area];
}

function absorbSmallGroups(
  atoms: Atoms,
  groups: Map<number, number[]>,
  minArea: number,
): void {
  for (;;) {
    const small = [...groups.entries()]
      .map(([key, group]) => ({ key, area: groupArea(atoms, group) }))
      .filter((g) => g.area < minArea)
      .sort((a, b) => a.area - b.area)[0];
    if (!small || groups.size < 2) return;
    const groupOfAtom = new Map<number, number>();
    for (const [key, group] of groups)
      for (const atom of group) groupOfAtom.set(atom, key);
    const neighbors = groupAdjacency(atoms, groupOfAtom).get(small.key);
    let target: number | undefined;
    if (neighbors && neighbors.size > 0)
      target = [...neighbors.entries()].sort((a, b) => b[1] - a[1])[0][0];
    else {
      const [sx, sy] = groupCenter(atoms, groups.get(small.key)!);
      let bestDistance = Infinity;
      for (const [key, group] of groups) {
        if (key === small.key) continue;
        const [x, y] = groupCenter(atoms, group);
        const distance = Math.hypot(x - sx, y - sy);
        if (distance < bestDistance) {
          bestDistance = distance;
          target = key;
        }
      }
    }
    const merged = groups.get(target!)!;
    for (const atom of groups.get(small.key)!) merged.push(atom);
    groups.delete(small.key);
  }
}

function finerGroups(
  set: RegionSet,
  atoms: Atoms,
  levels: CutLevels,
  cutIndex: number,
  region: number,
  parts: number,
  minGroupArea: number,
): number[][] | null {
  const regionAtoms = set.atomsOf.get(region)!;
  for (let level = cutIndex - 1; level >= 0; level--) {
    const component = levels.components[level];
    const groups = new Map<number, number[]>();
    for (const atom of regionAtoms) {
      const list = groups.get(component[atom]);
      if (list) list.push(atom);
      else groups.set(component[atom], [atom]);
    }
    const big = [...groups.values()].filter(
      (group) => groupArea(atoms, group) >= minGroupArea,
    );
    if (big.length < parts) continue;
    absorbSmallGroups(atoms, groups, minGroupArea);
    return [...groups.values()];
  }
  return null;
}

function bipartition(
  atoms: Atoms,
  groups: number[][],
  share: number,
): [number[][], number[][]] {
  const centers = groups.map((group) => groupCenter(atoms, group));
  let seeds: [number, number] = [0, 1];
  let farthest = -1;
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) {
      const d = Math.hypot(
        centers[i][0] - centers[j][0],
        centers[i][1] - centers[j][1],
      );
      if (d > farthest) {
        farthest = d;
        seeds = [i, j];
      }
    }
  const groupOfAtom = new Map<number, number>();
  groups.forEach((group, index) => {
    for (const atom of group) groupOfAtom.set(atom, index);
  });
  const adjacency = groupAdjacency(atoms, groupOfAtom);
  const shares = [share, 1 - share];
  const side = new Array(groups.length).fill(-1);
  const sideArea = [0, 0];
  seeds.forEach((seed, s) => {
    side[seed] = s;
    sideArea[s] += groupArea(atoms, groups[seed]);
  });
  for (;;) {
    const order =
      sideArea[0] / shares[0] <= sideArea[1] / shares[1] ? [0, 1] : [1, 0];
    let grown = false;
    for (const s of order) {
      let pick = -1;
      for (let g = 0; g < groups.length && pick < 0; g++) {
        if (side[g] !== s) continue;
        for (const neighbor of adjacency.get(g)?.keys() ?? [])
          if (side[neighbor] < 0) {
            pick = neighbor;
            break;
          }
      }
      if (pick < 0) continue;
      side[pick] = s;
      sideArea[s] += groupArea(atoms, groups[pick]);
      grown = true;
      break;
    }
    if (!grown) break;
  }
  const parts: [number[][], number[][]] = [[], []];
  groups.forEach((group, g) => {
    let s = side[g];
    if (s < 0) {
      const [x, y] = centers[g];
      const d = seeds.map((seed) =>
        Math.hypot(centers[seed][0] - x, centers[seed][1] - y),
      );
      s = d[0] <= d[1] ? 0 : 1;
    }
    parts[s].push(group);
  });
  return parts;
}

function partition(
  atoms: Atoms,
  groups: number[][],
  parts: number,
): number[][] {
  if (parts <= 1 || groups.length <= 1) return [groups.flat()];
  const first = Math.floor(parts / 2);
  const [a, b] = bipartition(atoms, groups, first / parts);
  return [...partition(atoms, a, first), ...partition(atoms, b, parts - first)];
}

function splitByFinerLevels(
  set: RegionSet,
  atoms: Atoms,
  levels: CutLevels,
  cutIndex: number,
  targetArea: number,
  max: number,
  minRatio: number,
): void {
  const done = new Set<number>();
  for (;;) {
    let target: number | null = null;
    for (const [region, area] of set.area)
      if (
        !done.has(region) &&
        area / targetArea >= minRatio &&
        (target === null || area > set.area.get(target)!)
      )
        target = region;
    if (target === null || set.atomsOf.size >= max) return;
    done.add(target);
    const parts = Math.min(
      Math.round(set.area.get(target)! / targetArea),
      max - set.atomsOf.size + 1,
    );
    const groups = finerGroups(
      set,
      atoms,
      levels,
      cutIndex,
      target,
      parts,
      targetArea * GROUP_SHARE,
    );
    if (!groups) continue;
    set.atomsOf.delete(target);
    set.area.delete(target);
    for (const part of partition(atoms, groups, parts)) {
      const id = set.nextId++;
      done.add(id);
      set.atomsOf.set(id, part);
      set.area.set(id, groupArea(atoms, part));
      for (const atom of part) set.regionOfAtom[atom] = id;
    }
    rebuildBorders(set, atoms);
  }
}

export function fitRegions(
  atoms: Atoms,
  levels: CutLevels,
  cutIndex: number,
  parentIndex: number,
  minArea: number,
  targetArea: number,
  [min, max]: [number, number],
  width: number,
): FittedRegions {
  const set = buildRegionSet(atoms, levels.components[cutIndex]);
  const parentComponent = levels.components[parentIndex];
  const parentOf = (region: number) =>
    parentComponent[set.atomsOf.get(region)![0]];
  mergeDown(set, parentOf, minArea, max);
  mergeEdgeFragments(
    set,
    parentOf,
    edgeAtoms(atoms, width),
    targetArea * EDGE_FRAGMENT_SHARE,
  );
  const balance = set.atomsOf.size < min;
  if (balance) mergeDown(set, parentOf, targetArea * MERGE_SHARE, max);
  splitByFinerLevels(
    set,
    atoms,
    levels,
    cutIndex,
    targetArea,
    max,
    balance ? BALANCE_SPLIT_RATIO : GIANT_RATIO,
  );
  const dense = new Map<number, number>();
  for (const region of set.atomsOf.keys()) dense.set(region, dense.size);
  const grid = new Int32Array(atoms.atomOf.length).fill(-1);
  for (let i = 0; i < grid.length; i++) {
    const atom = atoms.atomOf[i];
    if (atom >= 0) grid[i] = dense.get(set.regionOfAtom[atom])!;
  }
  return { grid, count: dense.size, balance };
}
