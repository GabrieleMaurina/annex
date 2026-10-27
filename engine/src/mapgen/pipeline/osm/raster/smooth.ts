const SMOOTH_RADIUS = 4;
const SMOOTH_PASSES = 3;
const MAX_LABELS = 32768;
const COAST_RADIUS = 4;
const COAST_PASSES = 3;
const COAST_THRESHOLD = 0.5;

export function smoothCoast(
  land: Uint8Array,
  width: number,
  height: number,
): void {
  const stride = width + 1;
  const sums = new Float64Array(stride * (height + 1));
  let field = Float64Array.from(land);
  for (let pass = 0; pass < COAST_PASSES; pass++) {
    for (let y = 0; y < height; y++) {
      let row = 0;
      for (let x = 0; x < width; x++) {
        row += field[y * width + x];
        sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
      }
    }
    const blurred = new Float64Array(field.length);
    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - COAST_RADIUS);
      const y1 = Math.min(height - 1, y + COAST_RADIUS) + 1;
      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - COAST_RADIUS);
        const x1 = Math.min(width - 1, x + COAST_RADIUS) + 1;
        blurred[y * width + x] =
          (sums[y1 * stride + x1] -
            sums[y0 * stride + x1] -
            sums[y1 * stride + x0] +
            sums[y0 * stride + x0]) /
          ((x1 - x0) * (y1 - y0));
      }
    }
    field = blurred;
  }
  for (let i = 0; i < land.length; i++)
    land[i] = field[i] >= COAST_THRESHOLD ? 1 : 0;
}

function isBorder(
  labelGrid: Int16Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  const i = y * width + x;
  const label = labelGrid[i];
  const differs = (j: number) => labelGrid[j] >= 0 && labelGrid[j] !== label;
  return (
    (x > 0 && differs(i - 1)) ||
    (x < width - 1 && differs(i + 1)) ||
    (y > 0 && differs(i - width)) ||
    (y < height - 1 && differs(i + width))
  );
}

export function smoothBorders(
  labelGrid: Int16Array,
  width: number,
  height: number,
): void {
  const counts = new Int32Array(MAX_LABELS);
  const touched: number[] = [];
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const changes: number[] = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const label = labelGrid[i];
        if (label < 0 || !isBorder(labelGrid, width, height, x, y)) continue;
        for (let dy = -SMOOTH_RADIUS; dy <= SMOOTH_RADIUS; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -SMOOTH_RADIUS; dx <= SMOOTH_RADIUS; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const other = labelGrid[ny * width + nx];
            if (other < 0) continue;
            if (counts[other] === 0) touched.push(other);
            counts[other]++;
          }
        }
        let best = label;
        for (const other of touched)
          if (counts[other] > counts[best]) best = other;
        for (const other of touched) counts[other] = 0;
        touched.length = 0;
        if (best !== label) changes.push(i, best);
      }
    for (let k = 0; k < changes.length; k += 2)
      labelGrid[changes[k]] = changes[k + 1];
  }
}
