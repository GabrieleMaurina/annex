export interface Islands {
  islandId: Int32Array;
  sizes: number[];
}

function computeComponents(land: boolean[][], target: boolean): Islands {
  const height = land.length;
  const width = land[0]?.length ?? 0;
  const islandId = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  const idx = (gx: number, gy: number) => gy * width + gx;

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (land[gy][gx] !== target || islandId[idx(gx, gy)] !== -1) continue;
      const id = sizes.length;
      let size = 0;
      const stack: [number, number][] = [[gx, gy]];
      islandId[idx(gx, gy)] = id;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        size++;
        const neighbors: [number, number][] = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (land[ny][nx] !== target || islandId[idx(nx, ny)] !== -1) continue;
          islandId[idx(nx, ny)] = id;
          stack.push([nx, ny]);
        }
      }
      sizes.push(size);
    }
  }

  return { islandId, sizes };
}

export function computeIslands(land: boolean[][]): Islands {
  return computeComponents(land, true);
}

const MIN_COMPONENT_AREA_RATIO = 0.4;
const MAX_CLEAN_PASSES = 8;

// Islands and water bodies are both measured against the same mask, then
// applied together - cleaning up tiny lakes against an already-island-
// cleaned grid would see the freshly emptied island footprint as another
// tiny lake and immediately refill it, undoing the island removal.
function cleanLandMaskOnce(land: boolean[][], minArea: number): boolean[][] {
  const height = land.length;
  const width = land[0]?.length ?? 0;
  const islands = computeComponents(land, true);
  const waterBodies = computeComponents(land, false);

  const cleaned = land.map((row) => [...row]);
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const idx = gy * width + gx;
      if (land[gy][gx]) {
        if (islands.sizes[islands.islandId[idx]] < minArea)
          cleaned[gy][gx] = false;
      } else {
        const waterId = waterBodies.islandId[idx];
        if (waterBodies.sizes[waterId] < minArea) cleaned[gy][gx] = true;
      }
    }
  }
  return cleaned;
}

function landMasksEqual(a: boolean[][], b: boolean[][]): boolean {
  const height = a.length;
  const width = a[0]?.length ?? 0;
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (a[gy][gx] !== b[gy][gx]) return false;
    }
  }
  return true;
}

// A single pass can create new tiny slivers (e.g. filling a lake leaves a
// newly isolated speck of land behind), so repeat until nothing changes.
export function cleanLandMask(
  land: boolean[][],
  expectedTerritoryArea: number,
): boolean[][] {
  const minArea = expectedTerritoryArea * MIN_COMPONENT_AREA_RATIO;

  let current = land;
  for (let pass = 0; pass < MAX_CLEAN_PASSES; pass++) {
    const next = cleanLandMaskOnce(current, minArea);
    if (landMasksEqual(next, current)) return next;
    current = next;
  }
  return current;
}
