import { computeIslands } from './islands';

interface Component {
  cells: number[];
  islandId: number;
}

function findLabelComponents(
  land: boolean[][],
  labelGrid: Int16Array,
  islandId: Int32Array,
): Component[][] {
  const height = land.length;
  const width = land[0]?.length ?? 0;
  const visited = new Uint8Array(width * height);
  const componentsByTerritory: Component[][] = [];

  for (let start = 0; start < labelGrid.length; start++) {
    const id = labelGrid[start];
    if (id < 0 || visited[start]) continue;

    const cells: number[] = [];
    const stack = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const cell = stack.pop()!;
      cells.push(cell);
      const cx = cell % width;
      const cy = Math.floor(cell / width);
      const neighbors: [number, number][] = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx] || labelGrid[nIdx] !== id) continue;
        visited[nIdx] = 1;
        stack.push(nIdx);
      }
    }

    if (!componentsByTerritory[id]) componentsByTerritory[id] = [];
    componentsByTerritory[id].push({ cells, islandId: islandId[start] });
  }

  return componentsByTerritory;
}

export function enforceContiguity(
  land: boolean[][],
  labelGrid: Int16Array,
  territoryCount: number,
): void {
  const height = land.length;
  const width = land[0]?.length ?? 0;
  const { islandId } = computeIslands(land);
  const componentsByTerritory = findLabelComponents(land, labelGrid, islandId);

  const toReassign = new Set<number>();
  for (let id = 0; id < territoryCount; id++) {
    const components = componentsByTerritory[id];
    if (!components || components.length <= 1) continue;

    components.sort((a, b) => b.cells.length - a.cells.length);
    for (let i = 1; i < components.length; i++) {
      for (const cell of components[i].cells) toReassign.add(cell);
    }
  }

  if (toReassign.size === 0) return;

  const working = labelGrid;
  for (const cell of toReassign) working[cell] = -2;

  const queue: number[] = [];
  for (let i = 0; i < working.length; i++) {
    if (working[i] >= 0) queue.push(i);
  }

  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++];
    const label = working[cell];
    const cx = cell % width;
    const cy = Math.floor(cell / width);
    const neighbors: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (working[nIdx] !== -2) continue;
      working[nIdx] = label;
      queue.push(nIdx);
    }
  }

  for (let i = 0; i < working.length; i++) {
    if (working[i] === -2) working[i] = -1;
  }
}
