const MIN_COMPONENT_AREA_RATIO = 0.4;
const MAX_CLEAN_PASSES = 8;

export function cleanLandMask(
  land: Uint8Array,
  width: number,
  height: number,
  expectedTerritoryArea: number,
): Uint8Array {
  const minArea = expectedTerritoryArea * MIN_COMPONENT_AREA_RATIO;
  const size = width * height;
  const cur = land.slice();
  const comp = new Int32Array(size);
  const stack = new Int32Array(size);

  for (let pass = 0; pass < MAX_CLEAN_PASSES; pass++) {
    comp.fill(-1);
    const sizes: number[] = [];
    for (let start = 0; start < size; start++) {
      if (comp[start] !== -1) continue;
      const phase = cur[start];
      const id = sizes.length;
      let sp = 0;
      let area = 0;
      stack[sp++] = start;
      comp[start] = id;
      while (sp > 0) {
        const c = stack[--sp];
        area++;
        const x = c % width;
        if (x > 0 && comp[c - 1] === -1 && cur[c - 1] === phase) {
          comp[c - 1] = id;
          stack[sp++] = c - 1;
        }
        if (x < width - 1 && comp[c + 1] === -1 && cur[c + 1] === phase) {
          comp[c + 1] = id;
          stack[sp++] = c + 1;
        }
        if (c >= width && comp[c - width] === -1 && cur[c - width] === phase) {
          comp[c - width] = id;
          stack[sp++] = c - width;
        }
        if (
          c + width < size &&
          comp[c + width] === -1 &&
          cur[c + width] === phase
        ) {
          comp[c + width] = id;
          stack[sp++] = c + width;
        }
      }
      sizes.push(area);
    }

    let changed = false;
    for (let i = 0; i < size; i++) {
      if (sizes[comp[i]] >= minArea) continue;
      cur[i] = cur[i] ? 0 : 1;
      changed = true;
    }
    if (!changed) break;
  }

  return cur;
}
