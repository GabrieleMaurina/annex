const RADIUS_RATIO = 0.1;
const MIN_RADIUS = 3;
const MIN_CORE_SHARE = 0.6;
const LOBE_RATIO = 0.4;
const FAR = 1e9;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function labelBoxes(labelGrid: Int16Array, width: number): Map<number, Box> {
  const boxes = new Map<number, Box>();
  for (let i = 0; i < labelGrid.length; i++) {
    const label = labelGrid[i];
    if (label < 0) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    const box = boxes.get(label);
    if (!box) boxes.set(label, { x0: x, y0: y, x1: x, y1: y });
    else {
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y > box.y1) box.y1 = y;
    }
  }
  return boxes;
}

function distanceLine(
  values: Float64Array,
  length: number,
  parabola: Int32Array,
  bounds: Float64Array,
  out: Float64Array,
): void {
  let k = 0;
  parabola[0] = 0;
  bounds[0] = -Infinity;
  bounds[1] = Infinity;
  for (let q = 1; q < length; q++) {
    let cross = 0;
    for (;;) {
      const p = parabola[k];
      cross = (values[q] + q * q - values[p] - p * p) / (2 * q - 2 * p);
      if (cross > bounds[k]) break;
      k--;
    }
    k++;
    parabola[k] = q;
    bounds[k] = cross;
    bounds[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < length; q++) {
    while (bounds[k + 1] < q) k++;
    out[q] = (q - parabola[k]) ** 2 + values[parabola[k]];
  }
}

function squaredDistance(
  source: Uint8Array,
  width: number,
  height: number,
): Float64Array {
  const longest = Math.max(width, height);
  const parabola = new Int32Array(longest);
  const bounds = new Float64Array(longest + 1);
  const field = Float64Array.from(source, (s) => (s ? 0 : FAR));
  const column = new Float64Array(height);
  const columnOut = new Float64Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) column[y] = field[y * width + x];
    distanceLine(column, height, parabola, bounds, columnOut);
    for (let y = 0; y < height; y++) field[y * width + x] = columnOut[y];
  }
  const row = new Float64Array(width);
  const rowOut = new Float64Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) row[x] = field[y * width + x];
    distanceLine(row, width, parabola, bounds, rowOut);
    for (let x = 0; x < width; x++) field[y * width + x] = rowOut[x];
  }
  return field;
}

function components(mask: Uint8Array, width: number): number[][] {
  const seen = new Uint8Array(mask.length);
  const found: number[][] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const cells = [start];
    seen[start] = 1;
    for (let head = 0; head < cells.length; head++) {
      const c = cells[head];
      const x = c % width;
      const neighbors = [
        x > 0 ? c - 1 : -1,
        x < width - 1 ? c + 1 : -1,
        c >= width ? c - width : -1,
        c + width < mask.length ? c + width : -1,
      ];
      for (const n of neighbors)
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1;
          cells.push(n);
        }
    }
    found.push(cells);
  }
  return found;
}

function coreOf(
  inside: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array | null {
  const outside = Uint8Array.from(inside, (v) => (v ? 0 : 1));
  const away = squaredDistance(outside, width, height);
  const eroded = Uint8Array.from(away, (d, i) =>
    inside[i] && d > radius * radius ? 1 : 0,
  );
  const lobes = components(eroded, width).sort((a, b) => b.length - a.length);
  if (lobes.length === 0) return null;
  if (lobes.length > 1 && lobes[1].length >= LOBE_RATIO * lobes[0].length)
    return null;
  const lobe = new Uint8Array(inside.length);
  for (const c of lobes[0]) lobe[c] = 1;
  const near = squaredDistance(lobe, width, height);
  return Uint8Array.from(near, (d, i) =>
    inside[i] && d <= radius * radius ? 1 : 0,
  );
}

function regularizeTerritory(
  labelGrid: Int16Array,
  width: number,
  height: number,
  label: number,
  box: Box,
  radius: number,
): void {
  const pad = radius + 1;
  const w = box.x1 - box.x0 + 1 + 2 * pad;
  const h = box.y1 - box.y0 + 1 + 2 * pad;
  const globalX = (lx: number) => box.x0 - pad + lx;
  const globalY = (ly: number) => box.y0 - pad + ly;
  const valid = (lx: number, ly: number) =>
    globalX(lx) >= 0 &&
    globalX(lx) < width &&
    globalY(ly) >= 0 &&
    globalY(ly) < height;
  const inside = new Uint8Array(w * h);
  let total = 0;
  for (let ly = 0; ly < h; ly++)
    for (let lx = 0; lx < w; lx++) {
      const gx = Math.min(width - 1, Math.max(0, globalX(lx)));
      const gy = Math.min(height - 1, Math.max(0, globalY(ly)));
      if (labelGrid[gy * width + gx] === label) {
        inside[ly * w + lx] = 1;
        total++;
      }
    }
  const core = coreOf(inside, w, h, radius);
  if (!core) return;
  let kept = 0;
  const released = new Uint8Array(w * h);
  for (let ly = 0; ly < h; ly++)
    for (let lx = 0; lx < w; lx++) {
      const i = ly * w + lx;
      if (core[i]) kept++;
      else if (inside[i] && valid(lx, ly)) released[i] = 1;
    }
  if (kept < MIN_CORE_SHARE * total) return;
  for (const cells of components(released, w)) {
    let own = 0;
    const others = new Map<number, number>();
    for (const c of cells) {
      const lx = c % w;
      const ly = Math.floor(c / w);
      for (const [nx, ny] of [
        [lx - 1, ly],
        [lx + 1, ly],
        [lx, ly - 1],
        [lx, ly + 1],
      ]) {
        if (!valid(nx, ny) || released[ny * w + nx]) continue;
        if (inside[ny * w + nx]) {
          own++;
          continue;
        }
        const other = labelGrid[globalY(ny) * width + globalX(nx)];
        if (other >= 0) others.set(other, (others.get(other) ?? 0) + 1);
      }
    }
    const best = [...others.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] <= own) continue;
    for (const c of cells)
      labelGrid[globalY(Math.floor(c / w)) * width + globalX(c % w)] = best[0];
  }
}

export function regularizeBorders(
  labelGrid: Int16Array,
  width: number,
  height: number,
  territoryArea: number,
): void {
  const radius = Math.max(
    MIN_RADIUS,
    Math.round(RADIUS_RATIO * Math.sqrt(territoryArea)),
  );
  for (const [label, box] of labelBoxes(labelGrid, width))
    regularizeTerritory(labelGrid, width, height, label, box, radius);
}
