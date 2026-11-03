import { OsmRiver, OsmWater } from '../types';
import { fillRings, strokeLine } from './rasterize';

const MAX_RIVERS = 2;
const MIN_RIVER_LENGTH_RATIO = 0.4;
const RIVER_RADIUS = 4;
const JOIN_RADIUS = 2 * RIVER_RADIUS;
const CORRIDOR_RATIO = 0.03;
const BRIDGE_SPACING_RATIO = 3;
const BRIDGE_HALF_WIDTH = 1;
const BRIDGE_OVERHANG = 2;
const BRIDGE_SEARCH = 3 * RIVER_RADIUS;
const MAX_CROSSING_RATIO = 0.05;
const PAIR_KEY_BASE = 65536;
const DIRECTIONS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

interface Crossing {
  a: number;
  b: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ahead: number;
  behind: number;
}

function visibleSegments(
  lines: number[][],
  width: number,
  height: number,
): number[][] {
  const segments: number[][] = [];
  for (const points of lines)
    for (let i = 0; i + 3 < points.length; i += 2) {
      const [ax, ay, bx, by] = points.slice(i, i + 4);
      if (
        Math.max(ax, bx) < -RIVER_RADIUS ||
        Math.max(ay, by) < -RIVER_RADIUS ||
        Math.min(ax, bx) > width + RIVER_RADIUS ||
        Math.min(ay, by) > height + RIVER_RADIUS
      )
        continue;
      segments.push([ax, ay, bx, by]);
    }
  return segments;
}

function landLength(
  segments: number[][],
  land: Uint8Array,
  width: number,
  height: number,
): number {
  let length = 0;
  for (const [ax, ay, bx, by] of segments) {
    const total = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(total));
    for (let s = 0; s < steps; s++) {
      const x = Math.floor(ax + ((bx - ax) * s) / steps);
      const y = Math.floor(ay + ((by - ay) * s) / steps);
      if (x >= 0 && y >= 0 && x < width && y < height && land[y * width + x])
        length += total / steps;
    }
  }
  return length;
}

function discOffsets(radius: number): [number, number][] {
  const offsets: [number, number][] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
  return offsets;
}

function widen(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const offsets = discOffsets(radius);
  const wide = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height)
        wide[ny * width + nx] = 1;
    }
  }
  return wide;
}

function areasTouching(
  areas: Uint8Array,
  corridor: Uint8Array,
  width: number,
): Uint8Array {
  const kept = new Uint8Array(areas.length);
  const seen = new Uint8Array(areas.length);
  for (let start = 0; start < areas.length; start++) {
    if (!areas[start] || seen[start]) continue;
    const cells = [start];
    seen[start] = 1;
    let touches = false;
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];
      touches ||= !!corridor[c];
      const x = c % width;
      for (const n of [
        x > 0 ? c - 1 : -1,
        x < width - 1 ? c + 1 : -1,
        c - width,
        c + width,
      ])
        if (n >= 0 && n < areas.length && areas[n] && !seen[n]) {
          seen[n] = 1;
          cells.push(n);
        }
    }
    if (touches) for (const c of cells) kept[c] = 1;
  }
  return kept;
}

function touches(
  segments: number[][],
  mask: Uint8Array,
  width: number,
  height: number,
): boolean {
  return segments.some((segment) =>
    [0, 2].some((k) => {
      const x = Math.floor(segment[k]);
      const y = Math.floor(segment[k + 1]);
      return (
        x >= 0 && y >= 0 && x < width && y < height && !!mask[y * width + x]
      );
    }),
  );
}

export function majorRiverMask(
  rivers: OsmRiver[],
  land: Uint8Array,
  width: number,
  height: number,
  riverAreas: OsmWater[],
): Uint8Array | null {
  const minLength = MIN_RIVER_LENGTH_RATIO * Math.sqrt(width * height);
  const visible = rivers
    .map(({ rank, lines }) => {
      const segments = visibleSegments(lines, width, height);
      return {
        rank,
        segments,
        length: landLength(segments, land, width, height),
      };
    })
    .filter(({ length }) => length > 0);
  const chosen = visible
    .filter(({ length }) => length >= minLength)
    .sort((a, b) => a.rank - b.rank || b.length - a.length)
    .slice(0, MAX_RIVERS);
  if (chosen.length === 0) return null;
  const line = new Uint8Array(width * height);
  const draw = (segments: number[][]) => {
    for (const segment of segments) strokeLine(line, width, height, segment, 1);
  };
  for (const { segments } of chosen) draw(segments);
  const lowestRank = Math.max(...chosen.map(({ rank }) => rank));
  let branches = visible.filter(
    ({ length, rank }) => length < minLength && rank <= lowestRank,
  );
  for (let grew = true; grew;) {
    const joined = widen(line, width, height, JOIN_RADIUS);
    const attached = branches.filter(({ segments }) =>
      touches(segments, joined, width, height),
    );
    for (const { segments } of attached) draw(segments);
    branches = branches.filter((branch) => !attached.includes(branch));
    grew = attached.length > 0;
  }
  let river = widen(line, width, height, RIVER_RADIUS);
  if (riverAreas.length > 0) {
    const areas = new Uint8Array(width * height);
    for (const area of riverAreas)
      fillRings(areas, width, height, area.rings, 1);
    const corridor = widen(
      line,
      width,
      height,
      Math.round(CORRIDOR_RATIO * Math.sqrt(width * height)),
    );
    const water = areasTouching(areas, corridor, width);
    if (water.includes(1)) river = water;
  }
  for (let i = 0; i < river.length; i++) river[i] &= land[i];
  return river.includes(1) ? river : null;
}

function bank(
  river: Uint8Array,
  labelGrid: Int16Array,
  width: number,
  height: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
): { label: number; steps: number } | null {
  const maxCrossing = MAX_CROSSING_RATIO * Math.sqrt(width * height);
  for (let steps = 1; steps <= maxCrossing; steps++) {
    const nx = x + dx * steps;
    const ny = y + dy * steps;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return null;
    const cell = ny * width + nx;
    if (labelGrid[cell] >= 0) return { label: labelGrid[cell], steps };
    if (!river[cell]) return null;
  }
  return null;
}

function riverCrossings(
  river: Uint8Array,
  labelGrid: Int16Array,
  width: number,
  height: number,
  adjacency: Map<number, Set<number>>,
): Crossing[][] {
  const pairs = new Map<number, Crossing[]>();
  for (let i = 0; i < river.length; i++) {
    if (!river[i] || labelGrid[i] >= 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of DIRECTIONS) {
      const ahead = bank(river, labelGrid, width, height, x, y, dx, dy);
      const behind = bank(river, labelGrid, width, height, x, y, -dx, -dy);
      if (!ahead || !behind || Math.abs(ahead.steps - behind.steps) > 1)
        continue;
      const a = Math.min(ahead.label, behind.label);
      const b = Math.max(ahead.label, behind.label);
      if (a === b || adjacency.get(a)?.has(b)) continue;
      const key = a * PAIR_KEY_BASE + b;
      const crossing = {
        a,
        b,
        x,
        y,
        dx,
        dy,
        ahead: ahead.steps,
        behind: behind.steps,
      };
      const list = pairs.get(key);
      if (list) list.push(crossing);
      else pairs.set(key, [crossing]);
    }
  }
  return [...pairs.values()].sort((p, q) => q.length - p.length);
}

function bestCrossing(crossings: Crossing[]): Crossing {
  const mx = crossings.reduce((sum, c) => sum + c.x, 0) / crossings.length;
  const my = crossings.reduce((sum, c) => sum + c.y, 0) / crossings.length;
  const middle = crossings.reduce((best, c) =>
    Math.hypot(c.x - mx, c.y - my) < Math.hypot(best.x - mx, best.y - my)
      ? c
      : best,
  );
  const span = (c: Crossing) => (c.ahead + c.behind) * Math.hypot(c.dx, c.dy);
  return crossings
    .filter((c) => Math.hypot(c.x - middle.x, c.y - middle.y) <= BRIDGE_SEARCH)
    .reduce((best, c) => (span(c) < span(best) ? c : best));
}

function bridgePixels(
  crossing: Crossing,
  width: number,
  height: number,
): number[] {
  const { x, y, dx, dy, ahead, behind } = crossing;
  const pixels: number[] = [];
  const offsets = discOffsets(BRIDGE_HALF_WIDTH);
  for (let t = -behind - BRIDGE_OVERHANG; t <= ahead + BRIDGE_OVERHANG; t++)
    for (const [ox, oy] of offsets) {
      const nx = x + dx * t + ox;
      const ny = y + dy * t + oy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height)
        pixels.push(ny * width + nx);
    }
  return pixels;
}

export function bridgeRivers(
  river: Uint8Array,
  labelGrid: Int16Array,
  width: number,
  height: number,
  adjacency: Map<number, Set<number>>,
  expectedTerritoryArea: number,
): number[] {
  const candidates = riverCrossings(
    river,
    labelGrid,
    width,
    height,
    adjacency,
  ).map(bestCrossing);
  const root = new Map<number, number>();
  const find = (t: number): number => {
    const parent = root.get(t) ?? t;
    if (parent === t) return t;
    const top = find(parent);
    root.set(t, top);
    return top;
  };
  for (const [t, neighbors] of adjacency)
    for (const n of neighbors) root.set(find(t), find(n));
  const chosen: Crossing[] = [];
  for (const crossing of candidates)
    if (find(crossing.a) !== find(crossing.b)) {
      root.set(find(crossing.a), find(crossing.b));
      chosen.push(crossing);
    }
  const spacing = BRIDGE_SPACING_RATIO * Math.sqrt(expectedTerritoryArea);
  for (const crossing of candidates)
    if (
      !chosen.includes(crossing) &&
      chosen.every(
        (other) =>
          Math.hypot(other.x - crossing.x, other.y - crossing.y) >= spacing,
      )
    )
      chosen.push(crossing);
  const pixels: number[] = [];
  for (const crossing of chosen) {
    adjacency.get(crossing.a)!.add(crossing.b);
    adjacency.get(crossing.b)!.add(crossing.a);
    pixels.push(...bridgePixels(crossing, width, height));
  }
  return pixels;
}
