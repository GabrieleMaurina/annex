import { addEdge } from '../../connectivity';
import { neighborsOfPixel } from '../../sea/gridUtils';

const MAX_DEPTH_RATIO = 0.05;

function linkNeighbours(
  i: number,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  width: number,
  height: number,
): void {
  for (const n of neighborsOfPixel(i, width, height)) {
    const a = labelGrid[i];
    const b = labelGrid[n];
    if (b < 0 || a === b) continue;
    addEdge(adjacency, a, b);
  }
}

function riverPieces(
  river: Uint8Array,
  labelGrid: Int16Array,
  width: number,
  height: number,
): number[][] {
  const isRiver = (i: number) => river[i] === 1 && labelGrid[i] < 0;
  const seen = new Uint8Array(river.length);
  const pieces: number[][] = [];
  for (let start = 0; start < river.length; start++) {
    if (!isRiver(start) || seen[start]) continue;
    const piece = [start];
    seen[start] = 1;
    for (let k = 0; k < piece.length; k++)
      for (const n of neighborsOfPixel(piece[k], width, height))
        if (isRiver(n) && !seen[n]) {
          seen[n] = 1;
          piece.push(n);
        }
    pieces.push(piece);
  }
  return pieces;
}

function nearestLabels(
  piece: number[],
  labelGrid: Int16Array,
  width: number,
  height: number,
  maxDepth: number,
): Map<number, number> {
  const inPiece = new Set(piece);
  const filled = new Map<number, number>();
  const depth = new Map<number, number>();
  const queue: number[] = [];
  for (const p of piece)
    for (const n of neighborsOfPixel(p, width, height))
      if (labelGrid[n] >= 0) {
        filled.set(p, labelGrid[n]);
        depth.set(p, 1);
        queue.push(p);
        break;
      }
  for (let k = 0; k < queue.length; k++) {
    const p = queue[k];
    const next = depth.get(p)! + 1;
    if (next > maxDepth) continue;
    for (const n of neighborsOfPixel(p, width, height))
      if (inPiece.has(n) && !filled.has(n)) {
        filled.set(n, filled.get(p)!);
        depth.set(n, next);
        queue.push(n);
      }
  }
  return filled;
}

function createsEdge(
  filled: Map<number, number>,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  width: number,
  height: number,
): boolean {
  for (const [p, a] of filled)
    for (const n of neighborsOfPixel(p, width, height)) {
      const b = filled.get(n) ?? labelGrid[n];
      if (b >= 0 && b !== a && !adjacency.get(a)?.has(b)) return true;
    }
  return false;
}

export function dropIdleRivers(
  river: Uint8Array,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  width: number,
  height: number,
  minSize: number,
): number[] {
  const maxDepth = MAX_DEPTH_RATIO * Math.sqrt(width * height);
  const dropped: number[] = [];
  for (const piece of riverPieces(river, labelGrid, width, height)) {
    const filled = nearestLabels(piece, labelGrid, width, height, maxDepth);
    if (
      filled.size === 0 ||
      (piece.length >= minSize &&
        createsEdge(filled, labelGrid, adjacency, width, height))
    )
      continue;
    for (const [p, label] of filled) {
      labelGrid[p] = label;
      river[p] = 0;
      dropped.push(p);
    }
    for (const p of filled.keys())
      linkNeighbours(p, labelGrid, adjacency, width, height);
  }
  return dropped;
}
