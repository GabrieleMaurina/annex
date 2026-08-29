import { GridPoint } from './placement';

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

export function ensureConnected(
  centers: GridPoint[],
  adjacency: Map<number, Set<number>>,
): SpecialEdge[] {
  const addedEdges: SpecialEdge[] = [];
  if (centers.length <= 1) return addedEdges;

  let componentOf = findComponents(centers.length, adjacency);
  let componentCount = new Set(componentOf).size;

  while (componentCount > 1) {
    let bestA = -1;
    let bestB = -1;
    let bestDist = Infinity;
    for (let a = 0; a < centers.length; a++) {
      for (let b = a + 1; b < centers.length; b++) {
        if (componentOf[a] === componentOf[b]) continue;
        const dist = Math.hypot(
          centers[a].gx - centers[b].gx,
          centers[a].gy - centers[b].gy,
        );
        if (dist < bestDist) {
          bestDist = dist;
          bestA = a;
          bestB = b;
        }
      }
    }
    if (bestA === -1) break;
    addEdge(adjacency, bestA, bestB);
    addedEdges.push({ a: bestA, b: bestB });
    componentOf = findComponents(centers.length, adjacency);
    componentCount = new Set(componentOf).size;
  }

  return addedEdges;
}
