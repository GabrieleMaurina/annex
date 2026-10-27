import { CONTINENT_SIZE_MAX, CONTINENT_SIZE_MIN } from '../../core/params';
import { Rng } from '../../core/rng';
import { SpecialEdge } from '../connectivity';
import { clusterContinents } from '../continents';
import { GridPoint } from '../placement';

function linkCounts(
  territory: number,
  adjacency: Map<number, Set<number>>,
  specialEdges: SpecialEdge[],
  groupOf: number[],
): Map<number, number> {
  const counts = new Map<number, number>();
  const count = (other: number) => {
    const group = groupOf[other];
    if (group !== groupOf[territory])
      counts.set(group, (counts.get(group) ?? 0) + 1);
  };
  for (const neighbor of adjacency.get(territory) ?? []) count(neighbor);
  for (const { a, b } of specialEdges) {
    if (a === territory) count(b);
    if (b === territory) count(a);
  }
  return counts;
}

function nearestOtherGroup(
  members: number[],
  centroids: GridPoint[],
  groupOf: number[],
): number {
  let best = -1;
  let bestDistance = Infinity;
  for (const t of members)
    for (let other = 0; other < groupOf.length; other++) {
      if (groupOf[other] === groupOf[t]) continue;
      const d = Math.hypot(
        centroids[t].gx - centroids[other].gx,
        centroids[t].gy - centroids[other].gy,
      );
      if (d < bestDistance) {
        bestDistance = d;
        best = groupOf[other];
      }
    }
  return best;
}

function absorbSmallGroups(
  groupOf: number[],
  adjacency: Map<number, Set<number>>,
  specialEdges: SpecialEdge[],
  centroids: GridPoint[],
): void {
  for (;;) {
    const members = new Map<number, number[]>();
    groupOf.forEach((g, t) => members.set(g, [...(members.get(g) ?? []), t]));
    if (members.size < 2) return;
    const small = [...members.entries()]
      .filter(([, list]) => list.length < CONTINENT_SIZE_MIN)
      .sort((a, b) => a[1].length - b[1].length)[0];
    if (!small) return;
    const [group, list] = small;
    const counts = new Map<number, number>();
    for (const t of list)
      for (const [other, n] of linkCounts(t, adjacency, specialEdges, groupOf))
        counts.set(other, (counts.get(other) ?? 0) + n);
    const target =
      counts.size > 0
        ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : nearestOtherGroup(list, centroids, groupOf);
    groupOf.forEach((g, t) => {
      if (g === group) groupOf[t] = target;
    });
  }
}

function splitLargeGroups(
  rng: Rng,
  groupOf: number[],
  adjacency: Map<number, Set<number>>,
  centroids: GridPoint[],
): string[] {
  const keys = groupOf.map((g) => `${g}`);
  const members = new Map<number, number[]>();
  groupOf.forEach((g, t) => members.set(g, [...(members.get(g) ?? []), t]));
  for (const [group, list] of members) {
    if (list.length <= CONTINENT_SIZE_MAX) continue;
    const local = new Map(list.map((t, i) => [t, i]));
    const subAdjacency = new Map<number, Set<number>>();
    list.forEach((t, i) =>
      subAdjacency.set(
        i,
        new Set(
          [...(adjacency.get(t) ?? [])]
            .filter((n) => local.has(n))
            .map((n) => local.get(n)!),
        ),
      ),
    );
    const sub = clusterContinents(
      rng,
      list.length,
      subAdjacency,
      [],
      list.map((t) => centroids[t]),
    );
    list.forEach((t, i) => (keys[t] = `${group}:${sub[i]}`));
  }
  return keys;
}

export function groupByParent(
  rng: Rng,
  landCount: number,
  adjacency: Map<number, Set<number>>,
  parentOf: number[],
  specialEdges: SpecialEdge[],
  centroids: GridPoint[],
  absorptionPartners?: SpecialEdge[],
): number[] {
  if (new Set(parentOf).size < 2)
    return clusterContinents(
      rng,
      landCount,
      adjacency,
      specialEdges,
      centroids,
      absorptionPartners,
    );
  const groupOf = parentOf.slice();
  absorbSmallGroups(groupOf, adjacency, specialEdges, centroids);
  const keys = splitLargeGroups(rng, groupOf, adjacency, centroids);
  const dense = new Map<string, number>();
  return keys.map((key) => {
    if (!dense.has(key)) dense.set(key, dense.size);
    return dense.get(key)!;
  });
}
