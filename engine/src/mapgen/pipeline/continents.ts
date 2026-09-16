import {
  CONTINENT_SIZE_MAX,
  CONTINENT_SIZE_MEAN,
  CONTINENT_SIZE_MIN,
  CONTINENT_SIZE_STD_DEV,
} from '../core/params';
import { gaussianRandom, randomInt, Rng } from '../core/rng';
import { SpecialEdge } from './connectivity';
import { GridPoint } from './placement';

const MIN_MAINLAND_CONTINENT_SIZE = 5;
const MAX_GROUPABLE_ISLAND_SIZE = 3;

function landAdjacency(
  adjacency: Map<number, Set<number>>,
  specialEdges: SpecialEdge[],
): Map<number, Set<number>> {
  const special = new Set(
    specialEdges.flatMap(({ a, b }) => [`${a},${b}`, `${b},${a}`]),
  );
  const land = new Map<number, Set<number>>();
  for (const [id, neighbors] of adjacency) {
    const filtered = new Set<number>();
    for (const neighbor of neighbors) {
      if (!special.has(`${id},${neighbor}`)) filtered.add(neighbor);
    }
    land.set(id, filtered);
  }
  return land;
}

function landComponents(
  territoryCount: number,
  land: Map<number, Set<number>>,
): number[][] {
  const componentOf = new Array(territoryCount).fill(-1);
  const components: number[][] = [];
  for (let start = 0; start < territoryCount; start++) {
    if (componentOf[start] !== -1) continue;
    const component: number[] = [];
    const stack = [start];
    componentOf[start] = components.length;
    while (stack.length > 0) {
      const id = stack.pop()!;
      component.push(id);
      for (const neighbor of land.get(id) ?? []) {
        if (componentOf[neighbor] === -1) {
          componentOf[neighbor] = components.length;
          stack.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function bfsDistances(
  source: number,
  land: Map<number, Set<number>>,
): Map<number, number> {
  const distance = new Map<number, number>([[source, 0]]);
  const queue = [source];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const next = distance.get(id)! + 1;
    for (const neighbor of land.get(id) ?? []) {
      if (!distance.has(neighbor)) {
        distance.set(neighbor, next);
        queue.push(neighbor);
      }
    }
  }
  return distance;
}

function pickSeeds(
  rng: Rng,
  component: number[],
  seedCount: number,
  land: Map<number, Set<number>>,
): number[] {
  const seeds = [component[randomInt(rng, 0, component.length - 1)]];
  const nearestSeedDistance = bfsDistances(seeds[0], land);

  while (seeds.length < seedCount) {
    let farthest = -1;
    let farthestDistance = 0;
    for (const id of component) {
      const distance = nearestSeedDistance.get(id) ?? Infinity;
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = id;
      }
    }
    if (farthest === -1) break;
    seeds.push(farthest);
    for (const [id, distance] of bfsDistances(farthest, land)) {
      if (distance < (nearestSeedDistance.get(id) ?? Infinity)) {
        nearestSeedDistance.set(id, distance);
      }
    }
  }
  return seeds;
}

function assignByNearestSeed(
  seeds: number[],
  land: Map<number, Set<number>>,
  territoryCount: number,
): number[] {
  const continentIdByTerritory = new Array(territoryCount).fill(-1);
  const queue: number[] = [];
  seeds.forEach((seedId, continentId) => {
    continentIdByTerritory[seedId] = continentId;
    queue.push(seedId);
  });

  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const continentId = continentIdByTerritory[id];
    for (const neighbor of land.get(id) ?? []) {
      if (continentIdByTerritory[neighbor] === -1) {
        continentIdByTerritory[neighbor] = continentId;
        queue.push(neighbor);
      }
    }
  }
  return continentIdByTerritory;
}

function buildPartnerMap(edges: SpecialEdge[]): Map<number, number[]> {
  const partners = new Map<number, number[]>();
  for (const { a, b } of edges) {
    if (!partners.has(a)) partners.set(a, []);
    if (!partners.has(b)) partners.set(b, []);
    partners.get(a)!.push(b);
    partners.get(b)!.push(a);
  }
  return partners;
}

function nearestPartner(
  component: number[],
  partners: Map<number, number[]>,
  centroids: GridPoint[],
  isValidTarget: (territory: number) => boolean,
): { targetTerritory: number; distance: number } | null {
  let best: { targetTerritory: number; distance: number } | null = null;
  for (const id of component) {
    for (const partner of partners.get(id) ?? []) {
      if (!isValidTarget(partner)) continue;
      const distance = Math.hypot(
        centroids[id].gx - centroids[partner].gx,
        centroids[id].gy - centroids[partner].gy,
      );
      if (!best || distance < best.distance) {
        best = { targetTerritory: partner, distance };
      }
    }
  }
  return best;
}

function groupTinyIslands(
  continentIdByTerritory: number[],
  smallComponents: number[][],
  absorptionPartners: SpecialEdge[],
  bridgeEdges: SpecialEdge[],
  centroids: GridPoint[],
): void {
  if (smallComponents.length < 2) return;

  const partners = buildPartnerMap([...absorptionPartners, ...bridgeEdges]);
  const componentIndexOfTerritory = new Map<number, number>();
  smallComponents.forEach((component, index) => {
    for (const id of component) componentIndexOfTerritory.set(id, index);
  });

  const parent = smallComponents.map((_, index) => index);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  smallComponents.forEach((component, index) => {
    const islandBest = nearestPartner(
      component,
      partners,
      centroids,
      (territory) => {
        const partnerIndex = componentIndexOfTerritory.get(territory);
        return partnerIndex !== undefined && partnerIndex !== index;
      },
    );
    if (!islandBest) return;

    const partnerIndex = componentIndexOfTerritory.get(
      islandBest.targetTerritory,
    )!;
    const rootA = find(index);
    const rootB = find(partnerIndex);
    if (rootA !== rootB) parent[rootA] = rootB;
  });

  const groupsByRoot = new Map<number, number[]>();
  smallComponents.forEach((_, index) => {
    const root = find(index);
    if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
    groupsByRoot.get(root)!.push(index);
  });

  let nextIslandContinentId = Math.max(0, ...continentIdByTerritory) + 1;
  for (const members of groupsByRoot.values()) {
    if (members.length < 2) continue;
    const islandContinentId = nextIslandContinentId++;
    for (const memberIndex of members) {
      for (const id of smallComponents[memberIndex]) {
        continentIdByTerritory[id] = islandContinentId;
      }
    }
  }
}

function absorbVia(
  continentIdByTerritory: number[],
  smallComponents: number[][],
  edges: SpecialEdge[],
  centroids: GridPoint[],
): void {
  const partners = buildPartnerMap(edges);

  const distance = (a: number, b: number): number =>
    Math.hypot(
      centroids[a].gx - centroids[b].gx,
      centroids[a].gy - centroids[b].gy,
    );

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const component of smallComponents) {
      if (continentIdByTerritory[component[0]] !== -1) continue;
      let target = -1;
      let targetDistance = Infinity;
      for (const id of component) {
        for (const partner of partners.get(id) ?? []) {
          if (continentIdByTerritory[partner] === -1) continue;
          const d = distance(id, partner);
          if (d < targetDistance) {
            targetDistance = d;
            target = continentIdByTerritory[partner];
          }
        }
      }
      if (target === -1) continue;
      for (const id of component) continentIdByTerritory[id] = target;
      progressed = true;
    }
  }
}

function absorbSmallLandmasses(
  continentIdByTerritory: number[],
  smallComponents: number[][],
  absorptionPartners: SpecialEdge[],
  bridgeEdges: SpecialEdge[],
  centroids: GridPoint[],
): void {
  if (smallComponents.length === 0) return;

  groupTinyIslands(
    continentIdByTerritory,
    smallComponents,
    absorptionPartners,
    bridgeEdges,
    centroids,
  );

  let nextStandaloneIslandId = Math.max(0, ...continentIdByTerritory) + 1;
  const remaining: number[][] = [];
  for (const component of smallComponents) {
    if (continentIdByTerritory[component[0]] !== -1) continue;
    if (component.length > 1) {
      const islandId = nextStandaloneIslandId++;
      for (const id of component) continentIdByTerritory[id] = islandId;
    } else {
      remaining.push(component);
    }
  }

  absorbVia(continentIdByTerritory, remaining, absorptionPartners, centroids);
  absorbVia(continentIdByTerritory, remaining, bridgeEdges, centroids);
}

function enforceMainlandMinContinent(
  continentIdByTerritory: number[],
  bigComponents: number[][],
  land: Map<number, Set<number>>,
): void {
  for (const component of bigComponents) {
    while (true) {
      const sizeByContinent = new Map<number, number>();
      for (const id of component) {
        const continentId = continentIdByTerritory[id];
        sizeByContinent.set(
          continentId,
          (sizeByContinent.get(continentId) ?? 0) + 1,
        );
      }
      if (sizeByContinent.size < 2) break;

      let victim = -1;
      let victimSize = MIN_MAINLAND_CONTINENT_SIZE;
      for (const [continentId, size] of sizeByContinent) {
        if (size < victimSize) {
          victimSize = size;
          victim = continentId;
        }
      }
      if (victim === -1) break;

      const adjacentSize = new Map<number, number>();
      for (const id of component) {
        if (continentIdByTerritory[id] !== victim) continue;
        for (const neighbor of land.get(id) ?? []) {
          const neighborContinent = continentIdByTerritory[neighbor];
          if (neighborContinent === victim || neighborContinent === -1)
            continue;
          adjacentSize.set(
            neighborContinent,
            sizeByContinent.get(neighborContinent) ?? 0,
          );
        }
      }

      let target = -1;
      let targetSize = Infinity;
      for (const [continentId, size] of adjacentSize) {
        if (size < targetSize) {
          targetSize = size;
          target = continentId;
        }
      }
      if (target === -1) break;

      for (let i = 0; i < continentIdByTerritory.length; i++) {
        if (continentIdByTerritory[i] === victim) {
          continentIdByTerritory[i] = target;
        }
      }
    }
  }
}

function renumberDense(continentIdByTerritory: number[]): number[] {
  const remap = new Map<number, number>();
  for (const continentId of continentIdByTerritory) {
    if (!remap.has(continentId)) remap.set(continentId, remap.size);
  }
  return continentIdByTerritory.map((continentId) => remap.get(continentId)!);
}

export function clusterContinents(
  rng: Rng,
  territoryCount: number,
  adjacency: Map<number, Set<number>>,
  specialEdges: SpecialEdge[],
  centroids: GridPoint[],
  absorptionPartners: SpecialEdge[] = specialEdges,
): number[] {
  if (territoryCount === 0) return [];

  const land = landAdjacency(adjacency, specialEdges);
  const components = landComponents(territoryCount, land);

  let bigComponents = components.filter(
    (component) => component.length > MAX_GROUPABLE_ISLAND_SIZE,
  );
  if (bigComponents.length === 0) {
    bigComponents = [
      components.reduce((a, b) => (b.length > a.length ? b : a)),
    ];
  }
  const bigComponentSet = new Set(bigComponents);

  const seeds: number[] = [];
  for (const component of bigComponents) {
    const perContinentTarget = Math.min(
      CONTINENT_SIZE_MAX,
      Math.max(
        CONTINENT_SIZE_MIN,
        Math.round(
          gaussianRandom(rng, CONTINENT_SIZE_MEAN, CONTINENT_SIZE_STD_DEV),
        ),
      ),
    );
    const seedCount = Math.max(
      1,
      Math.min(
        Math.round(component.length / perContinentTarget),
        Math.floor(component.length / MIN_MAINLAND_CONTINENT_SIZE),
      ),
    );
    for (const seed of pickSeeds(rng, component, seedCount, land)) {
      seeds.push(seed);
    }
  }

  const continentIdByTerritory = assignByNearestSeed(
    seeds,
    land,
    territoryCount,
  );

  absorbSmallLandmasses(
    continentIdByTerritory,
    components.filter((component) => !bigComponentSet.has(component)),
    absorptionPartners,
    specialEdges,
    centroids,
  );

  enforceMainlandMinContinent(continentIdByTerritory, bigComponents, land);

  let nextStandaloneId = Math.max(0, ...continentIdByTerritory) + 1;
  for (let i = 0; i < continentIdByTerritory.length; i++) {
    if (continentIdByTerritory[i] === -1) {
      continentIdByTerritory[i] = nextStandaloneId++;
    }
  }

  return renumberDense(continentIdByTerritory);
}

export function computeBonus(continentSize: number): number {
  return Math.floor(continentSize / 2) + 1;
}
