import { Fill } from '../../core/params';
import { randomInt, Rng } from '../../core/rng';
import { RIVER_VOID } from '../../render/gif';
import { findComponents } from '../connectivity';
import { enforceContiguity } from '../contiguity';
import { discOffsets, pairKey } from '../riverUtils';

const RIVER_SHARE: Record<Fill, number> = {
  full: 0.035,
  mixed: 0.03,
  sparse: 0.025,
};
const SOURCE_SHARE = 0.5;
const CANDIDATES = 40;
const MIN_EDGES = 4;
const MAX_EDGES = 12;
const MAX_TERRITORY_EDGES = 3;
const EDGE_BUDGET = 0.15;
const BRIDGE_CHANCE = 0.25;
const BRIDGE_SPACING = 3;
const BRIDGE_REACH = 1.5;
const BRIDGE_MIN_LENGTH = 16;
const TURN_WEIGHT = 0.3;
const MIN_KEPT_AREA = 0.5;
const RADIUS_PER_PIXEL = 1 / 400;
const SHORE_GAP = 3;
const SAMPLE_STRIDE = 3;
const SHORE_START_CHANCE = 0.25;
const OPEN_PULL = 0.3;
const OPEN_END_BONUS = 2;

interface Border {
  a: number;
  b: number;
  pixels: number[];
  x: number;
  y: number;
  height: number;
  open: boolean;
}

interface Carving {
  labelGrid: Int16Array;
  adjacency: Map<number, Set<number>>;
  borders: Map<number, Border>;
  blocked: Set<number>;
  bridges: Set<number>;
  carved: Uint8Array;
  areas: Int32Array;
  removed: Int32Array;
  offsets: [number, number][];
  radius: number;
  count: number;
  width: number;
  height: number;
}

function nearOpen(
  labelGrid: Int16Array,
  voidMask: Uint8Array,
  p: number,
  reach: number,
  width: number,
  height: number,
): boolean {
  const x = p % width;
  const y = (p - x) / width;
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      const q = ny * width + nx;
      if (labelGrid[q] < 0 && voidMask[q] === 0) return true;
    }
  return false;
}

function buildBorders(
  labelGrid: Int16Array,
  heights: Float32Array,
  voidMask: Uint8Array,
  reach: number,
  width: number,
  height: number,
): Map<number, Border> {
  const borders = new Map<number, Border>();
  const touch = (i: number, j: number) => {
    const a = labelGrid[i];
    const b = labelGrid[j];
    if (a < 0 || b < 0 || a === b) return;
    const key = pairKey(a, b);
    let border = borders.get(key);
    if (!border) {
      border = {
        a: Math.min(a, b),
        b: Math.max(a, b),
        pixels: [],
        x: 0,
        y: 0,
        height: 0,
        open: false,
      };
      borders.set(key, border);
    }
    border.pixels.push(i, j);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) touch(i, i + 1);
      if (y + 1 < height) touch(i, i + width);
    }
  for (const border of borders.values()) {
    const { pixels } = border;
    for (const p of pixels) {
      border.x += (p % width) / pixels.length;
      border.y += Math.floor(p / width) / pixels.length;
      border.height += heights[p] / pixels.length;
    }
    border.open = pixels.some(
      (p, k) =>
        k % SAMPLE_STRIDE === 0 &&
        nearOpen(labelGrid, voidMask, p, reach, width, height),
    );
  }
  return borders;
}

function commonNeighbours(
  adjacency: Map<number, Set<number>>,
  a: number,
  b: number,
): number[] {
  const others = adjacency.get(b);
  return [...(adjacency.get(a) ?? [])].filter((c) => c !== b && others?.has(c));
}

function straightness(
  previous: Border | null,
  current: Border,
  next: Border,
): number {
  if (!previous) return 0;
  const ax = current.x - previous.x;
  const ay = current.y - previous.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  return length === 0 ? 0 : (ax * bx + ay * by) / length;
}

function walk(
  start: Border,
  arrival: number,
  { adjacency, borders, blocked, bridges }: Carving,
): Border[] {
  const path = [start];
  const uses = new Map<number, number>([
    [start.a, 1],
    [start.b, 1],
  ]);
  let previous: Border | null = null;
  let current = start;
  let from = arrival;
  while (path.length < MAX_EDGES) {
    let best: Border | null = null;
    let bestFrom = -1;
    let bestCost = Infinity;
    for (const c of commonNeighbours(adjacency, current.a, current.b)) {
      if (c === from) continue;
      for (const [x, y] of [
        [current.a, current.b],
        [current.b, current.a],
      ]) {
        const edge = borders.get(pairKey(x, c));
        if (
          !edge ||
          blocked.has(pairKey(x, c)) ||
          bridges.has(pairKey(x, c)) ||
          path.includes(edge) ||
          (uses.get(edge.a) ?? 0) >= MAX_TERRITORY_EDGES ||
          (uses.get(edge.b) ?? 0) >= MAX_TERRITORY_EDGES
        )
          continue;
        const cost =
          edge.height -
          TURN_WEIGHT * straightness(previous, current, edge) -
          (edge.open ? OPEN_PULL : 0);
        if (cost < bestCost) {
          best = edge;
          bestFrom = y;
          bestCost = cost;
        }
      }
    }
    if (!best) break;
    for (const t of [best.a, best.b]) uses.set(t, (uses.get(t) ?? 0) + 1);
    path.push(best);
    previous = current;
    current = best;
    from = bestFrom;
    if (best.open) break;
  }
  return path;
}

function score(path: Border[]): number {
  const openEnds = Number(path[0].open) + Number(path[path.length - 1].open);
  return path.length + OPEN_END_BONUS * openEnds;
}

function longestRiver(
  rng: Rng,
  inland: Border[],
  shores: Border[],
  carving: Carving,
): Border[] {
  let best: Border[] = [];
  for (let n = 0; n < CANDIDATES; n++) {
    const pool =
      shores.length > 0 && (inland.length === 0 || rng() < SHORE_START_CHANCE)
        ? shores
        : inland;
    const start = pool[randomInt(rng, 0, pool.length - 1)];
    const key = pairKey(start.a, start.b);
    if (carving.blocked.has(key) || carving.bridges.has(key)) continue;
    const arrivals = start.open
      ? [-1]
      : commonNeighbours(carving.adjacency, start.a, start.b);
    for (const arrival of arrivals) {
      const path = walk(start, arrival, carving);
      if (
        path.length >= MIN_EDGES &&
        (best.length === 0 || score(path) > score(best))
      )
        best = path;
    }
  }
  return best;
}

function componentCount(
  adjacency: Map<number, Set<number>>,
  blocked: Set<number>,
  count: number,
): number {
  const passable = new Map<number, Set<number>>();
  for (const [t, neighbours] of adjacency)
    passable.set(
      t,
      new Set([...neighbours].filter((n) => !blocked.has(pairKey(t, n)))),
    );
  return new Set(findComponents(count, passable)).size;
}

function bridgeSite(border: Border, width: number): number {
  return border.pixels.reduce((best, p) => {
    const distance = (q: number) =>
      Math.hypot((q % width) - border.x, Math.floor(q / width) - border.y);
    return distance(p) < distance(best) ? p : best;
  });
}

function riverPixels(
  border: Border,
  carving: Carving,
  bridge: number | null,
): number[] {
  const { labelGrid, carved, offsets, radius, width, height } = carving;
  const found = new Set<number>();
  for (const p of border.pixels) {
    const x = p % width;
    const y = (p - x) / width;
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const q = ny * width + nx;
      const label = labelGrid[q];
      if ((label !== border.a && label !== border.b) || carved[q]) continue;
      if (
        bridge !== null &&
        Math.hypot(nx - (bridge % width), ny - Math.floor(bridge / width)) <=
          radius * BRIDGE_REACH
      )
        continue;
      found.add(q);
    }
  }
  return [...found];
}

function carveEdges(
  rng: Rng,
  path: Border[],
  carving: Carving,
  base: number,
): number[] {
  const {
    labelGrid,
    blocked,
    bridges,
    carved,
    areas,
    removed,
    adjacency,
    count,
  } = carving;
  const pixels: number[] = [];
  let kept = 0;
  let sinceBridge = 0;
  for (const edge of path) {
    const bridge =
      sinceBridge >= BRIDGE_SPACING &&
      !edge.open &&
      edge.pixels.length >= BRIDGE_MIN_LENGTH * carving.radius &&
      rng() < BRIDGE_CHANCE;
    const edgePixels = riverPixels(
      edge,
      carving,
      bridge ? bridgeSite(edge, carving.width) : null,
    );
    const lost = [edge.a, edge.b].map(
      (t) => edgePixels.filter((q) => labelGrid[q] === t).length,
    );
    if (
      removed[edge.a] + lost[0] > (1 - MIN_KEPT_AREA) * areas[edge.a] ||
      removed[edge.b] + lost[1] > (1 - MIN_KEPT_AREA) * areas[edge.b]
    )
      break;
    const key = pairKey(edge.a, edge.b);
    if (!bridge) {
      blocked.add(key);
      if (componentCount(adjacency, blocked, count) > base) {
        blocked.delete(key);
        break;
      }
    }
    sinceBridge = bridge ? 0 : sinceBridge + 1;
    if (bridge) bridges.add(key);
    removed[edge.a] += lost[0];
    removed[edge.b] += lost[1];
    for (const q of edgePixels) carved[q] = 1;
    pixels.push(...edgePixels);
    kept++;
  }
  if (kept >= MIN_EDGES) return pixels;
  for (const q of pixels) {
    carved[q] = 0;
    removed[labelGrid[q]]--;
  }
  for (const edge of path.slice(0, kept)) {
    blocked.delete(pairKey(edge.a, edge.b));
    bridges.delete(pairKey(edge.a, edge.b));
  }
  return [];
}

export function carveRivers(
  rng: Rng,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  heights: Float32Array,
  voidMask: Uint8Array,
  count: number,
  fill: Fill,
  width: number,
  height: number,
): void {
  const radius = Math.max(2, Math.round(width * RADIUS_PER_PIXEL));
  const borders = buildBorders(
    labelGrid,
    heights,
    voidMask,
    radius + SHORE_GAP,
    width,
    height,
  );
  const all = [...borders.values()];
  const dry = all
    .filter(({ open }) => !open)
    .sort((p, q) => q.height - p.height);
  const inland = dry.slice(0, Math.ceil(dry.length * SOURCE_SHARE));
  const shores = all.filter(({ open }) => open);
  if (inland.length === 0 && shores.length === 0) return;
  const areas = new Int32Array(count);
  for (const label of labelGrid) if (label >= 0) areas[label]++;
  const carving: Carving = {
    labelGrid,
    adjacency,
    borders,
    blocked: new Set(),
    bridges: new Set(),
    carved: new Uint8Array(labelGrid.length),
    areas,
    removed: new Int32Array(count),
    offsets: discOffsets(radius),
    radius,
    count,
    width,
    height,
  };
  const base = componentCount(adjacency, carving.blocked, count);
  const budget = Math.floor(EDGE_BUDGET * borders.size);
  const pixels: number[] = [];
  for (
    let n = 0;
    n < Math.round(count * RIVER_SHARE[fill]) && carving.blocked.size < budget;
    n++
  ) {
    const path = longestRiver(rng, inland, shores, carving);
    if (path.length === 0) break;
    pixels.push(...carveEdges(rng, path, carving, base));
  }
  for (const q of pixels) {
    labelGrid[q] = -1;
    voidMask[q] = RIVER_VOID;
  }
  enforceContiguity(labelGrid, width, height);
}
