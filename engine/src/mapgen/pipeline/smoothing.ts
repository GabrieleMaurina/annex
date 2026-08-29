const NEIGHBOR_OFFSETS: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const MAX_OWN_COUNT = 3;
const MIN_MAJORITY_COUNT = 2;
const PASSES = 20;

export function smoothBorders(
  labelGrid: Int16Array,
  width: number,
  height: number,
): void {
  for (let pass = 0; pass < PASSES; pass++) {
    const next = labelGrid.slice();
    let changed = false;

    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        if (gx === 0 || gx === width - 1 || gy === 0 || gy === height - 1)
          continue;

        const idx = gy * width + gx;
        const own = labelGrid[idx];

        const counts = new Map<number, number>();
        for (const [dx, dy] of NEIGHBOR_OFFSETS) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const label = labelGrid[ny * width + nx];
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }

        if ((counts.get(own) ?? 0) > MAX_OWN_COUNT) continue;

        let bestLabel = own;
        let bestCount = counts.get(own) ?? 0;
        for (const [label, count] of counts) {
          if (label !== own && count > bestCount) {
            bestCount = count;
            bestLabel = label;
          }
        }

        if (bestLabel !== own && bestCount >= MIN_MAJORITY_COUNT) {
          next[idx] = bestLabel;
          changed = true;
        }
      }
    }

    labelGrid.set(next);
    if (!changed) break;
  }
}
