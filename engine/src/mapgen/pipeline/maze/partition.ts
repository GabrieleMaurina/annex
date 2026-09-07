import { randomInt, Rng } from '../../core/rng';

export type CellNeighbors = (cell: number) => Iterable<number>;

function bfsFrom(
  source: number,
  nodeCount: number,
  neighborsOf: CellNeighbors,
): Int32Array {
  const distance = new Int32Array(nodeCount).fill(-1);
  distance[source] = 0;
  const queue = [source];
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    const next = distance[node] + 1;
    for (const neighbor of neighborsOf(node)) {
      if (distance[neighbor] === -1) {
        distance[neighbor] = next;
        queue.push(neighbor);
      }
    }
  }
  return distance;
}

function pickSpreadSeeds(
  rng: Rng,
  nodeCount: number,
  neighborsOf: CellNeighbors,
  count: number,
): number[] {
  const seeds = [randomInt(rng, 0, nodeCount - 1)];
  const nearest = bfsFrom(seeds[0], nodeCount, neighborsOf);

  while (seeds.length < count) {
    let farthest = -1;
    let farthestDistance = 0;
    for (let node = 0; node < nodeCount; node++) {
      if (nearest[node] > farthestDistance) {
        farthestDistance = nearest[node];
        farthest = node;
      }
    }
    if (farthest === -1) break;
    seeds.push(farthest);
    const fromNew = bfsFrom(farthest, nodeCount, neighborsOf);
    for (let node = 0; node < nodeCount; node++) {
      if (fromNew[node] !== -1 && fromNew[node] < nearest[node]) {
        nearest[node] = fromNew[node];
      }
    }
  }
  return seeds;
}

function contract(
  cellCount: number,
  neighborsOf: CellNeighbors,
  groups: number[][],
): { repOfCell: Int32Array; repCount: number; repNeighbors: number[][] } {
  const parent = new Int32Array(cellCount);
  for (let i = 0; i < cellCount; i++) parent[i] = i;
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    while (parent[x] !== root) {
      const next = parent[x];
      parent[x] = root;
      x = next;
    }
    return root;
  };
  for (const group of groups) {
    for (let i = 1; i < group.length; i++) {
      const a = find(group[0]);
      const b = find(group[i]);
      if (a !== b) parent[a] = b;
    }
  }

  const repIndex = new Int32Array(cellCount).fill(-1);
  let repCount = 0;
  const repOfCell = new Int32Array(cellCount);
  for (let c = 0; c < cellCount; c++) {
    const root = find(c);
    if (repIndex[root] === -1) repIndex[root] = repCount++;
    repOfCell[c] = repIndex[root];
  }

  const repSets: Set<number>[] = Array.from(
    { length: repCount },
    () => new Set(),
  );
  for (let c = 0; c < cellCount; c++) {
    const ra = repOfCell[c];
    for (const n of neighborsOf(c)) {
      const rb = repOfCell[n];
      if (ra !== rb) {
        repSets[ra].add(rb);
        repSets[rb].add(ra);
      }
    }
  }

  return {
    repOfCell,
    repCount,
    repNeighbors: repSets.map((s) => [...s]),
  };
}

export function partitionCells(
  rng: Rng,
  cellCount: number,
  neighborsOf: CellNeighbors,
  targetCount: number,
  groups: number[][] = [],
): { territoryOfCell: Int32Array; territoryCount: number } {
  const territoryOfCell = new Int32Array(cellCount).fill(-1);
  if (cellCount === 0) return { territoryOfCell, territoryCount: 0 };

  const { repOfCell, repCount, repNeighbors } = contract(
    cellCount,
    neighborsOf,
    groups,
  );

  const seeds = pickSpreadSeeds(
    rng,
    repCount,
    (rep) => repNeighbors[rep],
    Math.max(1, Math.min(targetCount, repCount)),
  );

  const repTerritory = new Int32Array(repCount).fill(-1);
  const queue: number[] = [];
  seeds.forEach((rep, territory) => {
    repTerritory[rep] = territory;
    queue.push(rep);
  });

  let head = 0;
  while (head < queue.length) {
    const rep = queue[head++];
    const territory = repTerritory[rep];
    for (const neighbor of repNeighbors[rep]) {
      if (repTerritory[neighbor] === -1) {
        repTerritory[neighbor] = territory;
        queue.push(neighbor);
      }
    }
  }
  for (let rep = 0; rep < repCount; rep++) {
    if (repTerritory[rep] === -1) repTerritory[rep] = 0;
  }

  for (let c = 0; c < cellCount; c++) {
    territoryOfCell[c] = repTerritory[repOfCell[c]];
  }

  return { territoryOfCell, territoryCount: seeds.length };
}
