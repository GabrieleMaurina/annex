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

// A lone stray pixel (or a small spike/notch a few cells wide) makes a
// border look noisy rather than natural. labelGrid already encodes both
// kinds of border the same way - land/water is just label -1 - so one
// despeckle pass over it cleans up coastlines and territory borders at
// once: any cell whose own label is outnumbered among its own neighbors
// flips to whichever label dominates them instead. A single pass only ever
// erodes the outermost layer of a small feature (an interior cell of a
// multi-cell nub can still see mostly itself), so several passes run in a
// row - each one eats one more layer - until a small feature is fully
// consumed by its surroundings or nothing changes. Anything wide enough to
// survive that many layers of erosion is a real region, not noise, and is
// left alone.
//
// Cells on the outer image frame are never touched: they have fewer actual
// neighbors (as few as 3 at a corner), which makes the same absolute
// thresholds effectively easier to trigger there than in the interior - so
// without this guard, real land right at the edge would erode into a fake
// "lake" that cleanLandMask (which runs earlier, before territories exist)
// never had a chance to see or remove.
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
