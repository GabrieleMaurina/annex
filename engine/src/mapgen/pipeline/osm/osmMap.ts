import {
  mapImageSize,
  TERRAIN_MAX_LAND_NEIGHBORS_PER_SEA,
  TERRITORY_COUNT_RANGES,
} from '../../core/params';
import { createRng } from '../../core/rng';
import { MOUNTAIN_VOID } from '../../render/gif';
import {
  RIVER_BORDER_COLOR,
  TERRITORY_STROKE_COLOR,
} from '../../render/palette';
import { enforceContiguity } from '../contiguity';
import { cleanLandMask } from '../islands';
import { finishTerrainMap } from '../terrain/terrainGraph';
import { buildAdjacency } from '../tessellate';
import { carveRegions } from './carve';
import { buildCutLevels, chooseCut, parentCutIndex } from './cut';
import { fitRegions } from './fit';
import { focusAtoms, matchComponents } from './focus';
import { groupByParent } from './groups';
import { mapTitle, nameMap } from './names';
import { DETAIL_RANKS, lineRank, LOCAL_ZOOM, RIVER_RANK } from './ranks';
import {
  cutRiverBorders,
  keepLakes,
  lakeMask,
  mountainMask,
} from './raster/nature';
import { extendLine, fillRings, strokeLine } from './raster/rasterize';
import { smoothBorders, smoothCoast } from './raster/smooth';
import { Atoms, buildAtoms } from './regions';
import {
  OsmAreaParams,
  OsmGeneratedMap,
  OsmMapParams,
  OsmPlaceParams,
} from './types';

const SPECK_AREA_RATIO = 0.1;
const FINE_SPECK_AREA_RATIO = 0.3;
const ISLAND_AREA_RATIO = 0.005;
const STATE_CUT = 90;
const SEA_AREA_MULTIPLIER = 16;
const LAKE_AREA_RATIO = 0.1;
const BORDER_OVERSHOOT = 12;
const WATER_CLASSES = ['ocean', 'lake'];
const LIMIT_LEVELS = [8, 7, 6, 5, 4];

function landMask(
  params: Pick<OsmMapParams, 'features'>,
  width: number,
  height: number,
): Uint8Array {
  const water = new Uint8Array(width * height);
  for (const area of params.features.water)
    if (WATER_CLASSES.includes(area.cls))
      fillRings(water, width, height, area.rings, 1);
  return Uint8Array.from(water, (w) => (w ? 0 : 1));
}

function barrierMask(
  params: Pick<OsmMapParams, 'features' | 'zoom'>,
  width: number,
  height: number,
): Uint8Array {
  const barrier = new Uint8Array(width * height);
  for (const line of params.features.lines) {
    const rank = lineRank(line, params.zoom);
    if (rank === 0) continue;
    const points =
      line.layer === 'boundary'
        ? extendLine(line.points, BORDER_OVERSHOOT)
        : line.points;
    strokeLine(barrier, width, height, points, rank);
  }
  for (const area of params.features.water)
    if (area.cls === 'river' && params.zoom >= LOCAL_ZOOM)
      fillRings(barrier, width, height, area.rings, RIVER_RANK);
  return barrier;
}

function denseLabels(
  grid: Int16Array | Int32Array,
  width: number,
  height: number,
  seedNames: Map<number, string>,
): {
  labelGrid: Int16Array;
  landCount: number;
  seedNames: Map<number, string>;
} {
  const labelGrid = Int16Array.from(grid);
  enforceContiguity(labelGrid, width, height);
  const remap = new Map<number, number>();
  for (let i = 0; i < labelGrid.length; i++) {
    const label = labelGrid[i];
    if (label < 0) continue;
    if (!remap.has(label)) remap.set(label, remap.size);
    labelGrid[i] = remap.get(label)!;
  }
  const names = new Map<number, string>();
  for (const [label, name] of seedNames)
    if (remap.has(label)) names.set(remap.get(label)!, name);
  return { labelGrid, landCount: remap.size, seedNames: names };
}

function focusedLand(
  params: OsmMapParams,
  land: Uint8Array,
  atoms: Atoms,
  width: number,
  height: number,
): { land: Uint8Array; voidMask: Uint8Array } | null {
  if (params.focus.length === 0) return null;
  const keep = focusAtoms(
    atoms,
    buildCutLevels(atoms),
    params.focus.filter((one) => !one.exact),
    params.features.places,
    width,
    height,
  );
  const exact = new Uint8Array(land.length);
  for (const one of params.focus)
    if (one.exact) fillRings(exact, width, height, one.rings, 1);
  const kept = new Uint8Array(land.length);
  const voidMask = new Uint8Array(land.length);
  for (let i = 0; i < land.length; i++) {
    const atom = atoms.atomOf[i];
    if ((atom >= 0 && keep?.[atom]) || (land[i] && exact[i])) kept[i] = 1;
    else if (land[i]) voidMask[i] = 1;
  }
  return countLand(kept) > 0 ? { land: kept, voidMask } : null;
}

function limitRegion(
  barrier: Uint8Array,
  start: number,
  width: number,
): Uint8Array | null {
  const region = new Uint8Array(barrier.length);
  const stack = [start];
  region[start] = 1;
  while (stack.length > 0) {
    const c = stack.pop()!;
    const x = c % width;
    if (x === 0 || x === width - 1 || c < width || c >= region.length - width)
      return null;
    for (const n of [c - 1, c + 1, c - width, c + width])
      if (!region[n] && !barrier[n]) {
        region[n] = 1;
        stack.push(n);
      }
  }
  return region;
}

export function osmPlaceMask(params: OsmPlaceParams): Uint8Array | null {
  const { width, height, focus, features } = params;
  const x = Math.floor(focus.x);
  const y = Math.floor(focus.y);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const land = landMask(params, width, height);
  for (const level of LIMIT_LEVELS) {
    const barrier = new Uint8Array(width * height);
    for (const line of features.lines)
      if (
        line.layer === 'boundary' &&
        line.adminLevel > 0 &&
        line.adminLevel <= level
      )
        strokeLine(barrier, width, height, line.points, 1);
    const region = limitRegion(barrier, y * width + x, width);
    if (!region) continue;
    let landArea = 0;
    for (let i = 0; i < region.length; i++) landArea += region[i] & land[i];
    if (landArea >= focus.minArea) return region;
  }
  return null;
}

export function osmAreaMask(params: OsmAreaParams): Uint8Array {
  const { width, height, focus, radius } = params;
  const land = landMask(params, width, height);
  const disc = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (Math.hypot(x + 0.5 - focus.x, y + 0.5 - focus.y) <= radius)
        disc[y * width + x] = 1;
  const atoms = buildAtoms(
    land,
    barrierMask(params, width, height),
    width,
    height,
  );
  if (atoms.count === 0) return disc;
  const levels = buildCutLevels(atoms);
  const keep = matchComponents(atoms, levels, disc, levels.thresholds);
  if (!keep) return disc;
  return Uint8Array.from(atoms.atomOf, (atom, i) =>
    (atom >= 0 && keep[atom]) || (disc[i] && !land[i]) ? 1 : 0,
  );
}

function countLand(land: Uint8Array): number {
  let cells = 0;
  for (let i = 0; i < land.length; i++) cells += land[i];
  return cells;
}

function majorityParents(
  labelGrid: Int16Array,
  atomOf: Int32Array,
  parentComponent: Int32Array,
  landCount: number,
): number[] {
  const votes = Array.from(
    { length: landCount },
    () => new Map<number, number>(),
  );
  for (let i = 0; i < labelGrid.length; i++) {
    const t = labelGrid[i];
    if (t < 0) continue;
    const parent = parentComponent[atomOf[i]];
    votes[t].set(parent, (votes[t].get(parent) ?? 0) + 1);
  }
  return votes.map(
    (tally) => [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0],
  );
}

export function generateOsmMap(params: OsmMapParams): OsmGeneratedMap {
  const { seed, size, detail, seas, timed, aspect, features } = params;
  const key = `osm::${seed}::${size}::${detail}::${aspect}`;
  const rng = createRng(key);
  const timedRng = timed ? createRng(`${key}::timed`) : null;
  const dims = mapImageSize(size, aspect);
  const { width, height } = dims;
  const range = TERRITORY_COUNT_RANGES[size];
  const middle = (range[0] + range[1]) / 2;

  const rawLand = landMask(params, width, height);
  if (countLand(rawLand) === 0) throw new Error('no land in the selected area');
  smoothCoast(rawLand, width, height);
  const mountains = mountainMask(features, width, height);
  for (let i = 0; i < mountains.length; i++) if (mountains[i]) rawLand[i] = 0;
  const lakes = lakeMask(features, width, height);
  const barrier = barrierMask(params, width, height);
  let expectedTerritoryArea = countLand(rawLand) / middle;
  let land = cleanLandMask(rawLand, width, height, expectedTerritoryArea);
  const visibleLand = cleanLandMask(
    rawLand,
    width,
    height,
    expectedTerritoryArea,
    ISLAND_AREA_RATIO,
  );
  keepLakes(land, lakes, width, expectedTerritoryArea * LAKE_AREA_RATIO);
  let atoms = buildAtoms(land, barrier, width, height);
  if (atoms.count === 0) throw new Error('no land in the selected area');
  const focused = focusedLand(params, land, atoms, width, height);
  if (focused) {
    expectedTerritoryArea = countLand(focused.land) / middle;
    land = cleanLandMask(focused.land, width, height, expectedTerritoryArea);
    keepLakes(land, lakes, width, expectedTerritoryArea * LAKE_AREA_RATIO);
    for (let i = 0; i < land.length; i++) if (land[i]) focused.voidMask[i] = 0;
    atoms = buildAtoms(land, barrier, width, height);
    if (atoms.count === 0) throw new Error('no land in the selected area');
  }

  const levels = buildCutLevels(atoms);
  const forced = detail === 'auto' ? null : DETAIL_RANKS[detail];
  const cutIndex = chooseCut(atoms, levels, expectedTerritoryArea, forced);
  const minArea =
    expectedTerritoryArea *
    (levels.thresholds[cutIndex] >= STATE_CUT
      ? SPECK_AREA_RATIO
      : FINE_SPECK_AREA_RATIO);
  const parentIndex = parentCutIndex(atoms, levels, cutIndex, minArea);
  const fitted = fitRegions(
    atoms,
    levels,
    cutIndex,
    parentIndex,
    minArea,
    expectedTerritoryArea,
    range,
    width,
    params.focus.length > 1,
  );
  const carved = carveRegions(
    fitted,
    width,
    height,
    features.places,
    minArea,
    expectedTerritoryArea,
    range,
    rng,
  );
  const raw = denseLabels(carved.grid, width, height, carved.seedNames);
  smoothBorders(raw.labelGrid, width, height);
  const { labelGrid, landCount, seedNames } = denseLabels(
    raw.labelGrid,
    width,
    height,
    raw.seedNames,
  );
  if (landCount < 2) throw new Error('the selected area is too small');

  const { adjacency } = buildAdjacency(labelGrid, width, height);
  for (let t = 0; t < landCount; t++)
    if (!adjacency.has(t)) adjacency.set(t, new Set());
  const rivers = cutRiverBorders(features, labelGrid, width, height, adjacency);
  const voidMask = focused?.voidMask ?? new Uint8Array(land.length);
  for (let i = 0; i < voidMask.length; i++)
    if (rawLand[i] && visibleLand[i] && labelGrid[i] < 0) voidMask[i] = 1;
  for (let i = 0; i < voidMask.length; i++)
    if (mountains[i] && !land[i]) voidMask[i] = MOUNTAIN_VOID;
  const parentOf = majorityParents(
    labelGrid,
    atoms.atomOf,
    levels.components[parentIndex],
    landCount,
  );
  const built = finishTerrainMap({
    rng,
    labelGrid,
    adjacency,
    landCount,
    dims,
    seas,
    timedRng,
    expectedTerritoryArea,
    maxLandNeighborsPerSea: TERRAIN_MAX_LAND_NEIGHBORS_PER_SEA[size],
    seaAreaMultiplier: SEA_AREA_MULTIPLIER,
    voidMask,
    riverPairs: rivers.rivers,
    bridges: rivers.bridges,
    groupContinents: (specialEdges, centroids, absorptionPartners) =>
      groupByParent(
        rng,
        landCount,
        adjacency,
        parentOf,
        specialEdges,
        centroids,
        absorptionPartners,
      ),
  });

  const cut = levels.thresholds[cutIndex];
  const names = nameMap({
    labelGrid,
    width,
    height,
    territories: built.territories,
    seaTerritories: built.seaTerritories,
    places: features.places,
    cut,
    parentCut: levels.thresholds[parentIndex],
    atomOf: atoms.atomOf,
    atomArea: atoms.area,
    cutComponent: levels.components[cutIndex],
    levels,
    seedNames,
  });
  return {
    name: mapTitle(params.name, features.places, cut, width, height),
    lockedTiles: [],
    ...built,
    borderColors: [TERRITORY_STROKE_COLOR, RIVER_BORDER_COLOR],
    ...names,
  };
}
