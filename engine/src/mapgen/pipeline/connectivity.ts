import { GridDimensions } from '../core/params';
import { Rng } from '../core/rng';
import { GridPoint } from './placement';

const DEAD_END_ISLAND_CHANCE = 0.1;
const EXTRA_BRIDGE_CHANCE = 0.5;
const MAX_BRIDGES_PER_LANDMASS = 4;
const BRIDGE_DISTANCE_EXPONENT = 2.5;
const FRESH_ENDPOINT_BONUS = 2;
const NEW_CONTINENT_LINK_BONUS = 8;
const CONNECTED_CONTINENT_PENALTY = 0.25;
const CONNECTED_CONTINENT_SKIP_CHANCE = 0.5;
const MAX_BRIDGE_SPAN_RATIO = 3;
const MAX_BRIDGE_SPAN_FRACTION = 0.28;

const SEA_SHORTCUT_MIN_LAND_HOPS = 6;
const SEA_SHORTCUT_MAX_SPAN_FRACTION = 0.14;
const SEA_SHORTCUT_MAX_PER_LANDMASS = 2;

function findComponents(
  count: number,
  adjacency: Map<number, Set<number>>,
): number[] {
  const componentOf = new Array(count).fill(-1);
  let nextComponent = 0;
  for (let start = 0; start < count; start++) {
    if (componentOf[start] !== -1) continue;
    const stack = [start];
    componentOf[start] = nextComponent;
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const neighbor of adjacency.get(id) ?? []) {
        if (componentOf[neighbor] === -1) {
          componentOf[neighbor] = nextComponent;
          stack.push(neighbor);
        }
      }
    }
    nextComponent++;
  }
  return componentOf;
}

function addEdge(adjacency: Map<number, Set<number>>, a: number, b: number) {
  if (!adjacency.has(a)) adjacency.set(a, new Set());
  if (!adjacency.has(b)) adjacency.set(b, new Set());
  adjacency.get(a)!.add(b);
  adjacency.get(b)!.add(a);
}

export interface SpecialEdge {
  a: number;
  b: number;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function landmassOfTerritories(
  count: number,
  adjacency: Map<number, Set<number>>,
  specialEdges: SpecialEdge[],
): number[] {
  const special = new Set(
    specialEdges.flatMap(({ a, b }) => [`${a},${b}`, `${b},${a}`]),
  );
  const componentOf = new Array(count).fill(-1);
  let nextComponent = 0;
  for (let start = 0; start < count; start++) {
    if (componentOf[start] !== -1) continue;
    const stack = [start];
    componentOf[start] = nextComponent;
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const neighbor of adjacency.get(id) ?? []) {
        if (special.has(`${id},${neighbor}`)) continue;
        if (componentOf[neighbor] === -1) {
          componentOf[neighbor] = nextComponent;
          stack.push(neighbor);
        }
      }
    }
    nextComponent++;
  }
  return componentOf;
}

interface WaterLinkGeometry {
  crossesLand: boolean;
  waterSpan: number;
}

const BLOCKED_LINK: WaterLinkGeometry = {
  crossesLand: true,
  waterSpan: Infinity,
};

function waterLinkGeometry(
  from: GridPoint,
  to: GridPoint,
  labelGrid: Int16Array,
  dims: GridDimensions,
  territoryA: number,
  territoryB: number,
): WaterLinkGeometry {
  const dx = to.gx - from.gx;
  const dy = to.gy - from.gy;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.ceil(length * 3));

  let firstWater = -1;
  let lastWater = -1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = Math.round(from.gx + dx * t);
    const gy = Math.round(from.gy + dy * t);
    let territory = -1;
    if (gx >= 0 && gx < dims.width && gy >= 0 && gy < dims.height) {
      territory = labelGrid[gy * dims.width + gx];
    }
    if (territory < 0) {
      if (firstWater === -1) firstWater = i;
      lastWater = i;
      continue;
    }
    if (territory !== territoryA && territory !== territoryB) {
      return BLOCKED_LINK;
    }
  }

  if (firstWater === -1) return BLOCKED_LINK;

  return {
    crossesLand: false,
    waterSpan: ((lastWater - firstWater + 1) / steps) * length,
  };
}

function segmentsCross(
  p1: GridPoint,
  p2: GridPoint,
  p3: GridPoint,
  p4: GridPoint,
): boolean {
  const side = (a: GridPoint, b: GridPoint, c: GridPoint) =>
    (b.gx - a.gx) * (c.gy - a.gy) - (b.gy - a.gy) * (c.gx - a.gx);
  const d1 = side(p3, p4, p1);
  const d2 = side(p3, p4, p2);
  const d3 = side(p1, p2, p3);
  const d4 = side(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

function crossesExistingLink(
  centroids: GridPoint[],
  a: number,
  b: number,
  edges: SpecialEdge[],
): boolean {
  for (const edge of edges) {
    if (edge.a === a || edge.a === b || edge.b === a || edge.b === b) continue;
    if (
      segmentsCross(
        centroids[a],
        centroids[b],
        centroids[edge.a],
        centroids[edge.b],
      )
    ) {
      return true;
    }
  }
  return false;
}

function landmassSizes(landmassOf: number[]): Map<number, number> {
  const sizes = new Map<number, number>();
  for (const landmass of landmassOf) {
    sizes.set(landmass, (sizes.get(landmass) ?? 0) + 1);
  }
  return sizes;
}

function canAddWaterLink(
  territory: number,
  waterLinked: Set<number>,
  landmassOf: number[],
  sizes: Map<number, number>,
): boolean {
  return !waterLinked.has(territory) || sizes.get(landmassOf[territory]) === 1;
}

function weightedPick(rng: Rng, weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;
  let threshold = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return i;
  }
  return weights.length - 1;
}

export function addRedundantBridges(
  rng: Rng,
  centroids: GridPoint[],
  adjacency: Map<number, Set<number>>,
  specialEdges: SpecialEdge[],
  continentIdByTerritory: number[],
  labelGrid: Int16Array,
  dims: GridDimensions,
): void {
  const count = centroids.length;
  const mapDiagonal = Math.hypot(dims.width, dims.height);
  const landmassOf = landmassOfTerritories(count, adjacency, specialEdges);
  const sizes = landmassSizes(landmassOf);

  const bridgeCountByLandmass = new Map<number, number>();
  const waterLinked = new Set<number>();
  const bridgePairs = new Set<string>();
  for (const { a, b } of specialEdges) {
    bridgeCountByLandmass.set(
      landmassOf[a],
      (bridgeCountByLandmass.get(landmassOf[a]) ?? 0) + 1,
    );
    bridgeCountByLandmass.set(
      landmassOf[b],
      (bridgeCountByLandmass.get(landmassOf[b]) ?? 0) + 1,
    );
    waterLinked.add(a);
    waterLinked.add(b);
    bridgePairs.add(pairKey(a, b));
  }

  const connectedContinents = new Set<string>();
  for (let t = 0; t < count; t++) {
    for (const neighbor of adjacency.get(t) ?? []) {
      connectedContinents.add(
        pairKey(continentIdByTerritory[t], continentIdByTerritory[neighbor]),
      );
    }
  }

  for (const landmass of new Set(landmassOf)) {
    while (
      (bridgeCountByLandmass.get(landmass) ?? 0) < MAX_BRIDGES_PER_LANDMASS
    ) {
      const existing = bridgeCountByLandmass.get(landmass) ?? 0;
      if (existing === 0) break;
      const chance =
        existing === 1 ? 1 - DEAD_END_ISLAND_CHANCE : EXTRA_BRIDGE_CHANCE;
      if (rng() >= chance) break;

      const nearExistingBridgehead = new Set<number>();
      for (const { a, b } of specialEdges) {
        const outside =
          landmassOf[a] === landmass && landmassOf[b] !== landmass
            ? b
            : landmassOf[b] === landmass && landmassOf[a] !== landmass
              ? a
              : -1;
        if (outside === -1) continue;
        nearExistingBridgehead.add(outside);
        for (const neighbor of adjacency.get(outside) ?? []) {
          nearExistingBridgehead.add(neighbor);
        }
      }

      const options: { u: number; v: number; waterSpan: number }[] = [];
      let minSpan = Infinity;
      for (let u = 0; u < count; u++) {
        if (landmassOf[u] !== landmass) continue;
        if (!canAddWaterLink(u, waterLinked, landmassOf, sizes)) continue;
        for (let v = 0; v < count; v++) {
          if (landmassOf[v] === landmass) continue;
          if (nearExistingBridgehead.has(v)) continue;
          if (!canAddWaterLink(v, waterLinked, landmassOf, sizes)) continue;
          if (bridgePairs.has(pairKey(u, v))) continue;
          const geom = waterLinkGeometry(
            centroids[u],
            centroids[v],
            labelGrid,
            dims,
            u,
            v,
          );
          if (geom.crossesLand) continue;
          if (crossesExistingLink(centroids, u, v, specialEdges)) continue;
          options.push({ u, v, waterSpan: geom.waterSpan });
          if (geom.waterSpan < minSpan) minSpan = geom.waterSpan;
        }
      }
      if (options.length === 0) break;

      if (minSpan > mapDiagonal * MAX_BRIDGE_SPAN_FRACTION) break;
      const spanCap = Math.min(
        minSpan * MAX_BRIDGE_SPAN_RATIO,
        mapDiagonal * MAX_BRIDGE_SPAN_FRACTION,
      );
      const viable = options.filter((o) => o.waterSpan <= spanCap);

      const weights = viable.map(({ u, v, waterSpan }) => {
        let weight = (minSpan / waterSpan) ** BRIDGE_DISTANCE_EXPONENT;
        if (!waterLinked.has(u)) weight *= FRESH_ENDPOINT_BONUS;
        if (!waterLinked.has(v)) weight *= FRESH_ENDPOINT_BONUS;
        const continentLink = pairKey(
          continentIdByTerritory[u],
          continentIdByTerritory[v],
        );
        weight *= connectedContinents.has(continentLink)
          ? CONNECTED_CONTINENT_PENALTY
          : NEW_CONTINENT_LINK_BONUS;
        return weight;
      });

      const chosen = viable[weightedPick(rng, weights)];
      const chosenLink = pairKey(
        continentIdByTerritory[chosen.u],
        continentIdByTerritory[chosen.v],
      );
      if (
        connectedContinents.has(chosenLink) &&
        rng() < CONNECTED_CONTINENT_SKIP_CHANCE
      ) {
        break;
      }
      addEdge(adjacency, chosen.u, chosen.v);
      specialEdges.push({ a: chosen.u, b: chosen.v });
      bridgePairs.add(pairKey(chosen.u, chosen.v));
      waterLinked.add(chosen.u);
      waterLinked.add(chosen.v);
      bridgeCountByLandmass.set(landmass, existing + 1);
      bridgeCountByLandmass.set(
        landmassOf[chosen.v],
        (bridgeCountByLandmass.get(landmassOf[chosen.v]) ?? 0) + 1,
      );
      connectedContinents.add(chosenLink);
    }
  }
}

function landHopDistances(
  source: number,
  adjacency: Map<number, Set<number>>,
  special: Set<string>,
): Map<number, number> {
  const distance = new Map<number, number>([[source, 0]]);
  const queue = [source];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const next = distance.get(id)! + 1;
    for (const neighbor of adjacency.get(id) ?? []) {
      if (special.has(`${id},${neighbor}`)) continue;
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, next);
      queue.push(neighbor);
    }
  }
  return distance;
}

export function addSeaShortcuts(
  centroids: GridPoint[],
  adjacency: Map<number, Set<number>>,
  specialEdges: SpecialEdge[],
  labelGrid: Int16Array,
  dims: GridDimensions,
): void {
  const count = centroids.length;
  const maxSpan =
    Math.hypot(dims.width, dims.height) * SEA_SHORTCUT_MAX_SPAN_FRACTION;
  const special = new Set(
    specialEdges.flatMap(({ a, b }) => [`${a},${b}`, `${b},${a}`]),
  );
  const landmassOf = landmassOfTerritories(count, adjacency, specialEdges);
  const waterLinked = new Set<number>();
  for (const { a, b } of specialEdges) {
    waterLinked.add(a);
    waterLinked.add(b);
  }

  const membersByLandmass = new Map<number, number[]>();
  for (let t = 0; t < count; t++) {
    const list = membersByLandmass.get(landmassOf[t]) ?? [];
    list.push(t);
    membersByLandmass.set(landmassOf[t], list);
  }

  for (const members of membersByLandmass.values()) {
    if (members.length < SEA_SHORTCUT_MIN_LAND_HOPS + 2) continue;

    const candidates: { a: number; b: number; score: number }[] = [];
    for (const a of members) {
      if (waterLinked.has(a)) continue;
      const hops = landHopDistances(a, adjacency, special);
      for (const b of members) {
        if (b <= a || waterLinked.has(b)) continue;
        const landHops = hops.get(b);
        if (landHops === undefined || landHops < SEA_SHORTCUT_MIN_LAND_HOPS) {
          continue;
        }
        const geom = waterLinkGeometry(
          centroids[a],
          centroids[b],
          labelGrid,
          dims,
          a,
          b,
        );
        if (geom.crossesLand || geom.waterSpan > maxSpan) continue;
        if (crossesExistingLink(centroids, a, b, specialEdges)) continue;
        candidates.push({ a, b, score: landHops / geom.waterSpan });
      }
    }
    candidates.sort((x, y) => y.score - x.score);

    let added = 0;
    for (const { a, b } of candidates) {
      if (added >= SEA_SHORTCUT_MAX_PER_LANDMASS) break;
      if (waterLinked.has(a) || waterLinked.has(b)) continue;
      if (crossesExistingLink(centroids, a, b, specialEdges)) continue;
      addEdge(adjacency, a, b);
      specialEdges.push({ a, b });
      waterLinked.add(a);
      waterLinked.add(b);
      added++;
    }
  }
}

export function ensureConnected(
  rng: Rng,
  centroids: GridPoint[],
  adjacency: Map<number, Set<number>>,
  labelGrid: Int16Array,
  dims: GridDimensions,
): SpecialEdge[] {
  const addedEdges: SpecialEdge[] = [];
  if (centroids.length <= 1) return addedEdges;

  const landmassOf = findComponents(centroids.length, adjacency);
  const sizes = landmassSizes(landmassOf);
  const linked = new Set<number>();
  let componentOf = landmassOf.slice();
  let componentCount = new Set(componentOf).size;

  while (componentCount > 1) {
    const crossPairs: { a: number; b: number; dist: number }[] = [];
    for (let a = 0; a < centroids.length; a++) {
      for (let b = a + 1; b < centroids.length; b++) {
        if (componentOf[a] === componentOf[b]) continue;
        crossPairs.push({
          a,
          b,
          dist: Math.hypot(
            centroids[a].gx - centroids[b].gx,
            centroids[a].gy - centroids[b].gy,
          ),
        });
      }
    }
    crossPairs.sort((x, y) => x.dist - y.dist);
    if (crossPairs.length === 0) break;

    let clean: SpecialEdge | null = null;
    let overLink: SpecialEdge | null = null;
    let overLand: SpecialEdge | null = null;
    for (const { a, b } of crossPairs) {
      if (
        !canAddWaterLink(a, linked, landmassOf, sizes) ||
        !canAddWaterLink(b, linked, landmassOf, sizes)
      ) {
        continue;
      }
      if (
        waterLinkGeometry(centroids[a], centroids[b], labelGrid, dims, a, b)
          .crossesLand
      ) {
        overLand ??= { a, b };
        continue;
      }
      if (crossesExistingLink(centroids, a, b, addedEdges)) {
        overLink ??= { a, b };
        continue;
      }
      clean = { a, b };
      break;
    }

    const picked = clean ??
      overLink ??
      overLand ?? { a: crossPairs[0].a, b: crossPairs[0].b };
    addEdge(adjacency, picked.a, picked.b);
    addedEdges.push(picked);
    linked.add(picked.a);
    linked.add(picked.b);
    componentOf = findComponents(centroids.length, adjacency);
    componentCount = new Set(componentOf).size;
  }

  return addedEdges;
}
