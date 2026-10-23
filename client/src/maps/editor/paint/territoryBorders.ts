const NO_GAP = -2;
const MAX_GAPS_PER_BORDER = 3;

export function visitNeighbors(
  p: number,
  width: number,
  size: number,
  visit: (q: number) => void,
) {
  const x = p % width;
  if (x > 0) visit(p - 1);
  if (x < width - 1) visit(p + 1);
  if (p >= width) visit(p - width);
  if (p + width < size) visit(p + width);
}

export function onImageEdge(p: number, width: number, size: number): boolean {
  const x = p % width;
  return x === 0 || x === width - 1 || p < width || p + width >= size;
}

function brushStamp(
  free: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  brushSize: number,
): (x: number, y: number) => void {
  const radius = Math.max(0, Math.round((brushSize - 1) / 2));
  const offsets: number[] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dy * dy <= (radius + 0.5) * (radius + 0.5))
        offsets.push(dx, dy);
  return (x, y) => {
    for (let k = 0; k < offsets.length; k += 2) {
      const nx = x + offsets[k];
      const ny = y + offsets[k + 1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const q = ny * width + nx;
      if (free[q]) mask[q] = 1;
    }
  };
}

export function borderMask(
  free: Uint8Array,
  cells: Int16Array,
  width: number,
  height: number,
  brushSize: number,
): Uint8Array {
  const mask = new Uint8Array(cells.length);
  const stamp = brushStamp(free, mask, width, height, brushSize);
  const separates = (id: number, q: number) =>
    free[q] === 1 && cells[q] !== id && (id >= 0 || cells[q] >= 0);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!free[p]) continue;
      const id = cells[p];
      if (
        (x < width - 1 && separates(id, p + 1)) ||
        (y < height - 1 && separates(id, p + width))
      )
        stamp(x, y);
    }
  return mask;
}

function findGaps(
  labels: Int16Array,
  wall: Uint8Array,
  invalidIds: Set<number>,
  width: number,
  height: number,
): { border: string; pixels: number[] }[] {
  const size = labels.length;
  const regionOf = (q: number) =>
    labels[q] >= 0 && !invalidIds.has(labels[q]) ? labels[q] : -1;
  const across = new Int32Array(size).fill(NO_GAP);
  for (let p = 0; p < size; p++) {
    const region = regionOf(p);
    if (region < 0) continue;
    visitNeighbors(p, width, size, (q) => {
      if (!wall[q] && regionOf(q) < region) across[p] = regionOf(q);
    });
  }

  const gaps: { border: string; pixels: number[] }[] = [];
  for (let start = 0; start < size; start++) {
    const other = across[start];
    if (other === NO_GAP) continue;
    const region = labels[start];
    const pixels = [start];
    across[start] = NO_GAP;
    for (let i = 0; i < pixels.length; i++) {
      const x = pixels[i] % width;
      const y = Math.floor(pixels[i] / width);
      for (let ny = y - 1; ny <= y + 1; ny++)
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (across[q] !== other || labels[q] !== region) continue;
          across[q] = NO_GAP;
          pixels.push(q);
        }
    }
    gaps.push({ border: `${region}:${other}`, pixels });
  }
  return gaps;
}

export function gapMask(
  labels: Int16Array,
  wall: Uint8Array,
  invalidIds: Set<number>,
  width: number,
  height: number,
  brushSize: number,
): Uint8Array {
  const gaps = findGaps(labels, wall, invalidIds, width, height);
  const gapsPerBorder = new Map<string, number>();
  for (const { border } of gaps)
    gapsPerBorder.set(border, (gapsPerBorder.get(border) ?? 0) + 1);
  const mask = new Uint8Array(labels.length);
  const stamp = brushStamp(
    wall.map((w) => 1 - w),
    mask,
    width,
    height,
    brushSize,
  );
  for (const { border, pixels } of gaps)
    if (gapsPerBorder.get(border)! <= MAX_GAPS_PER_BORDER)
      for (const p of pixels) stamp(p % width, Math.floor(p / width));
  return mask;
}

export function paintMask(
  surface: ImageData,
  mask: Uint8Array,
  color: [number, number, number],
): boolean {
  const { data } = surface;
  let changed = false;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const o = p * 4;
    data[o] = color[0];
    data[o + 1] = color[1];
    data[o + 2] = color[2];
    data[o + 3] = 255;
    changed = true;
  }
  return changed;
}

interface Piece {
  pixels: number[];
  label: number;
  hasNode: boolean;
  touchesEdge: boolean;
}

function collectPieces(
  open: (q: number) => boolean,
  cells: Int16Array,
  width: number,
  nodePixels: Set<number>,
): { pieces: Piece[]; pieceOf: Int32Array } {
  const size = cells.length;
  const pieceOf = new Int32Array(size).fill(-1);
  const pieces: Piece[] = [];
  for (let start = 0; start < size; start++) {
    if (pieceOf[start] >= 0 || !open(start)) continue;
    const index = pieces.length;
    const piece: Piece = {
      pixels: [start],
      label: cells[start],
      hasNode: false,
      touchesEdge: false,
    };
    pieceOf[start] = index;
    for (let i = 0; i < piece.pixels.length; i++) {
      const p = piece.pixels[i];
      if (nodePixels.has(p)) piece.hasNode = true;
      if (onImageEdge(p, width, size)) piece.touchesEdge = true;
      visitNeighbors(p, width, size, (q) => {
        if (pieceOf[q] >= 0 || !open(q)) return;
        pieceOf[q] = index;
        piece.pixels.push(q);
      });
    }
    pieces.push(piece);
  }
  return { pieces, pieceOf };
}

export function mergeDetachedPieces(
  free: Uint8Array,
  wall: Uint8Array,
  cells: Int16Array,
  mask: Uint8Array,
  width: number,
  nodePixels: Set<number>,
  maxGap: number,
  reach: number,
): boolean {
  const size = cells.length;
  const open = (q: number) => free[q] === 1 && wall[q] === 0 && mask[q] === 0;
  const { pieces, pieceOf } = collectPieces(open, cells, width, nodePixels);
  const anchored = new Set(
    pieces.filter((p) => p.hasNode && p.label >= 0).map((p) => p.label),
  );
  const keep = pieces.map((piece) =>
    piece.label >= 0
      ? piece.hasNode || !anchored.has(piece.label)
      : piece.touchesEdge || piece.pixels.length >= maxGap,
  );

  let changed = false;
  const seen = new Int32Array(size).fill(-1);
  pieces.forEach((piece, index) => {
    if (keep[index]) return;
    const votes = new Map<number, number>();
    const band: number[] = [];
    for (const p of piece.pixels) seen[p] = index;
    let frontier = piece.pixels;
    for (let step = 0; step < reach && frontier.length > 0; step++) {
      const next: number[] = [];
      for (const p of frontier)
        visitNeighbors(p, width, size, (q) => {
          if (seen[q] === index || !free[q]) return;
          seen[q] = index;
          if (open(q)) {
            const other = cells[q];
            if (keep[pieceOf[q]] && other >= 0 && other !== piece.label)
              votes.set(other, (votes.get(other) ?? 0) + 1);
            return;
          }
          if (cells[q] === piece.label) band.push(q);
          next.push(q);
        });
      frontier = next;
    }
    let target = -1;
    let best = 0;
    for (const [label, count] of votes)
      if (count > best) {
        best = count;
        target = label;
      }
    if (target < 0) return;
    for (const p of piece.pixels) cells[p] = target;
    for (const p of band) cells[p] = target;
    changed = true;
  });
  return changed;
}
