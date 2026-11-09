import { ClaimContinent, Proximity } from './model';

const DISTANCE_FALLOFF = 2;

const linkCaches = new WeakMap<Map<number, number[]>, Map<number, number[]>>();

export function landSeaLinks(
  neighbors: Map<number, number[]>,
  seaLinks: Map<number, number[]>,
): Map<number, number[]> {
  const cached = linkCaches.get(neighbors);
  if (cached) return cached;
  const links = new Map<number, number[]>();
  for (const [id, ids] of neighbors) {
    const linked = new Set(ids);
    for (const seaId of seaLinks.get(id) ?? [])
      for (const other of seaLinks.get(seaId) ?? [])
        if (other !== id && neighbors.has(other)) linked.add(other);
    links.set(id, [...linked]);
  }
  linkCaches.set(neighbors, links);
  return links;
}

function distancesFrom(
  links: Map<number, number[]>,
  starts: number[],
): Map<number, number> {
  const distance = new Map<number, number>();
  const queue: number[] = [];
  for (const id of starts) {
    distance.set(id, 0);
    queue.push(id);
  }
  for (let i = 0; i < queue.length; i++) {
    const next = distance.get(queue[i])! + 1;
    for (const n of links.get(queue[i]) ?? [])
      if (!distance.has(n)) {
        distance.set(n, next);
        queue.push(n);
      }
  }
  return distance;
}

export function proximityOf(
  continents: ClaimContinent[],
  links: Map<number, number[]>,
  anchors: Map<number, number[]>,
): Proximity {
  const weights: Proximity = new Map();
  for (const [playerId, starts] of anchors) {
    const distance = distancesFrom(links, starts);
    for (const continent of continents) {
      let nearest = Infinity;
      for (const id of continent.ids)
        nearest = Math.min(nearest, distance.get(id) ?? Infinity);
      if (nearest === Infinity) continue;
      const byPlayer = weights.get(continent.id) ?? new Map<number, number>();
      byPlayer.set(playerId, 1 / (1 + nearest) ** DISTANCE_FALLOFF);
      weights.set(continent.id, byPlayer);
    }
  }
  for (const byPlayer of weights.values()) {
    let total = 0;
    for (const weight of byPlayer.values()) total += weight;
    for (const [playerId, weight] of byPlayer)
      byPlayer.set(playerId, weight / total);
  }
  return weights;
}
