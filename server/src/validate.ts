import {
  duplicatePlaceNames,
  Fill,
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  GenerationType,
  isValidPlaceName,
  LockedTile,
  MAP_ASPECT_VALUES,
  MAP_SIZE_VALUES,
  MapAspect,
  MapSize,
  MAX_TIMED_VALUE,
  TILE_SHAPE_VALUES,
  TileShape,
  TimedConnection,
} from 'engine';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

export function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

export interface MapTerritory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface MapSeaTerritory {
  id: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface MapWrap {
  a: number;
  b: number;
  x: boolean;
  y: boolean;
}

const NO_CONTINENT = -1;
const MAX_CONTINENTS = 30;
const MIN_BONUS = 2;
const MAX_BONUS = 25;
const MIN_CONTINENT_SIZE = 2;
const MAX_CONTINENT_SIZE = 40;
const MAX_TERRITORIES = MAX_CONTINENTS * MAX_CONTINENT_SIZE;
const MAX_TILE_POINTS = 8;
export const MAX_BORDER_COLORS = 8;
export const BORDER_COLOR_PATTERN = '^#[0-9a-f]{6}$';

export function isBorderColors(value: unknown): value is string[] {
  const pattern = new RegExp(BORDER_COLOR_PATTERN);
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= MAX_BORDER_COLORS &&
    new Set(value).size === value.length &&
    value.every((c) => typeof c === 'string' && pattern.test(c))
  );
}

function isTerritory(value: unknown): value is MapTerritory {
  if (!isObject(value)) return false;
  return (
    Object.keys(value).length === 5 &&
    Number.isInteger(value.id) &&
    Number.isInteger(value.continentId) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    Array.isArray(value.neighbors) &&
    value.neighbors.every((n) => Number.isInteger(n))
  );
}

function isSeaTerritory(value: unknown): value is MapSeaTerritory {
  if (!isObject(value)) return false;
  return (
    Object.keys(value).length === 4 &&
    Number.isInteger(value.id) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    Array.isArray(value.neighbors) &&
    value.neighbors.every((n) => Number.isInteger(n))
  );
}

function isWrap(value: unknown): value is MapWrap {
  if (!isObject(value)) return false;
  return (
    Object.keys(value).length === 4 &&
    Number.isInteger(value.a) &&
    Number.isInteger(value.b) &&
    typeof value.x === 'boolean' &&
    typeof value.y === 'boolean' &&
    (value.x === true || value.y === true)
  );
}

function isTimedValue(value: unknown, min: number): boolean {
  return isInteger(value) && value >= min && value <= MAX_TIMED_VALUE;
}

function isTimedConnection(value: unknown): value is TimedConnection {
  if (!isObject(value)) return false;
  return (
    Object.keys(value).length === 5 &&
    Number.isInteger(value.a) &&
    Number.isInteger(value.b) &&
    value.a !== value.b &&
    isTimedValue(value.delay, 0) &&
    isTimedValue(value.open, 1) &&
    isTimedValue(value.closed, 1)
  );
}

function isLockedTile(value: unknown): value is LockedTile {
  if (!isObject(value)) return false;
  return (
    Object.keys(value).length === 5 &&
    Number.isInteger(value.id) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    Array.isArray(value.points) &&
    value.points.length >= 3 &&
    value.points.length <= MAX_TILE_POINTS &&
    value.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((c) => typeof c === 'number' && Number.isFinite(c)),
    ) &&
    Array.isArray(value.neighbors) &&
    value.neighbors.every((n) => Number.isInteger(n))
  );
}

function readPngDimensions(
  data: Buffer,
): { width: number; height: number } | null {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 24 || !data.subarray(0, 8).equals(PNG_SIG)) return null;
  if (data.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function readJpegDimensions(
  data: Buffer,
): { width: number; height: number } | null {
  if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = data[offset + 1];
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    const length = data.readUInt16BE(offset + 2);
    const isSOF =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSOF) {
      if (offset + 9 > data.length) return null;
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(
  data: Buffer,
): { width: number; height: number } | null {
  if (
    data.length < 30 ||
    data.toString('ascii', 0, 4) !== 'RIFF' ||
    data.toString('ascii', 8, 12) !== 'WEBP'
  )
    return null;
  const fourCC = data.toString('ascii', 12, 16);
  if (fourCC === 'VP8 ') {
    if (data.toString('hex', 23, 26) !== '9d012a') return null;
    return {
      width: data.readUInt16LE(26) & 0x3fff,
      height: data.readUInt16LE(28) & 0x3fff,
    };
  }
  if (fourCC === 'VP8L') {
    if (data[20] !== 0x2f) return null;
    const bits = data.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (fourCC === 'VP8X') {
    return {
      width: data.readUIntLE(24, 3) + 1,
      height: data.readUIntLE(27, 3) + 1,
    };
  }
  return null;
}

export function readImageDimensions(
  data: Buffer,
  mime: string,
): { width: number; height: number } | null {
  const dims =
    mime === 'image/png'
      ? readPngDimensions(data)
      : mime === 'image/jpeg'
        ? readJpegDimensions(data)
        : mime === 'image/webp'
          ? readWebpDimensions(data)
          : null;
  if (!dims || dims.width <= 0 || dims.height <= 0) return null;
  return dims;
}

function allConnected(
  nodes: { id: number; neighbors: number[] }[],
  byId: Map<number, { neighbors: number[] }>,
  timedConnections: TimedConnection[],
  lockedTiles: LockedTile[],
): boolean {
  const extraNeighbors = new Map<number, number[]>();
  const link = (a: number, b: number) =>
    extraNeighbors.set(a, [...(extraNeighbors.get(a) ?? []), b]);
  for (const { a, b } of timedConnections) {
    link(a, b);
    link(b, a);
  }
  for (const tile of lockedTiles) {
    for (const n of tile.neighbors) {
      link(tile.id, n);
      link(n, tile.id);
    }
  }
  const visited = new Set<number>();
  const stack = [nodes[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const n of [
      ...(byId.get(id)?.neighbors ?? []),
      ...(extraNeighbors.get(id) ?? []),
    ])
      if (!visited.has(n)) stack.push(n);
  }
  return nodes.every((t) => visited.has(t.id));
}

export interface MapGeneration {
  seed: string;
  size: MapSize;
  type: GenerationType;
  fill: Fill;
  tile: TileShape;
  seas: boolean;
  timed: boolean;
  unlockable: boolean;
  aspect: MapAspect;
}

const MAX_SEED_LENGTH = 20;

export function validateMapGeneration(
  raw: unknown,
):
  | { ok: true; generation: MapGeneration | null }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, generation: null };
  if (!isObject(raw)) return { ok: false, error: 'invalid generation' };
  const { seed, size, type, fill, tile, seas, timed, unlockable } = raw;
  const aspect = raw.aspect ?? 'wide';
  if (
    typeof seed !== 'string' ||
    seed.length < 1 ||
    seed.length > MAX_SEED_LENGTH ||
    !(MAP_SIZE_VALUES as string[]).includes(size as string) ||
    !(GENERATION_TYPE_VALUES as string[]).includes(type as string) ||
    !(FILL_VALUES as string[]).includes(fill as string) ||
    !(TILE_SHAPE_VALUES as string[]).includes(tile as string) ||
    typeof seas !== 'boolean' ||
    typeof timed !== 'boolean' ||
    typeof unlockable !== 'boolean' ||
    (unlockable && (type !== 'tile' || seas || timed)) ||
    !(MAP_ASPECT_VALUES as unknown[]).includes(aspect)
  )
    return { ok: false, error: 'invalid generation' };
  return {
    ok: true,
    generation: {
      seed,
      size: size as MapSize,
      type: type as GenerationType,
      fill: fill as Fill,
      tile: tile as TileShape,
      seas,
      timed,
      unlockable,
      aspect: aspect as MapAspect,
    },
  };
}

interface MapNames {
  territoryNames: string[] | null;
  seaNames: string[] | null;
  continentNames: string[] | null;
}

function parsePlaceNames(
  raw: unknown,
  length: number,
): string[] | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (
    !Array.isArray(raw) ||
    raw.length !== length ||
    !raw.every((name) => typeof name === 'string' && isValidPlaceName(name))
  )
    return undefined;
  return raw.every((name) => name === '') ? null : raw;
}

export function validateMapNames(
  territoryNamesRaw: unknown,
  seaNamesRaw: unknown,
  continentNamesRaw: unknown,
  territoryCount: number,
  seaCount: number,
  continentCount: number,
): { ok: true; names: MapNames } | { ok: false; error: string } {
  const territoryNames = parsePlaceNames(territoryNamesRaw, territoryCount);
  const seaNames = parsePlaceNames(seaNamesRaw, seaCount);
  const continentNames = parsePlaceNames(continentNamesRaw, continentCount);
  if (
    territoryNames === undefined ||
    seaNames === undefined ||
    continentNames === undefined
  )
    return { ok: false, error: 'invalid names' };
  const allNames = [
    ...(territoryNames ?? []),
    ...(seaNames ?? []),
    ...(continentNames ?? []),
  ];
  if (duplicatePlaceNames(allNames).size > 0)
    return { ok: false, error: 'duplicate names' };
  return { ok: true, names: { territoryNames, seaNames, continentNames } };
}

export function validateMapGeometry(
  territoriesRaw: unknown,
  seaTerritoriesRaw: unknown,
  bonusesRaw: unknown,
  wrapsRaw: unknown,
  timedRaw: unknown,
  lockedRaw: unknown,
  imageWidth: number,
  imageHeight: number,
):
  | {
      ok: true;
      territories: MapTerritory[];
      seaTerritories: MapSeaTerritory[];
      bonuses: number[];
      wraps: MapWrap[];
      timedConnections: TimedConnection[];
      lockedTiles: LockedTile[];
    }
  | { ok: false; error: string } {
  if (!Array.isArray(territoriesRaw))
    return { ok: false, error: 'invalid territories' };
  if (!Array.isArray(seaTerritoriesRaw))
    return { ok: false, error: 'invalid seas' };
  if (territoriesRaw.length + seaTerritoriesRaw.length > MAX_TERRITORIES)
    return { ok: false, error: 'too many territories' };
  if (!territoriesRaw.every(isTerritory))
    return { ok: false, error: 'invalid territories' };
  if (!seaTerritoriesRaw.every(isSeaTerritory))
    return { ok: false, error: 'invalid seas' };
  if (
    !Array.isArray(bonusesRaw) ||
    bonusesRaw.length > MAX_CONTINENTS ||
    !bonusesRaw.every(
      (b) => Number.isInteger(b) && b >= MIN_BONUS && b <= MAX_BONUS,
    )
  )
    return { ok: false, error: 'invalid bonuses' };
  if (!Array.isArray(wrapsRaw) || !wrapsRaw.every(isWrap))
    return { ok: false, error: 'invalid wraps' };
  if (
    !Array.isArray(timedRaw) ||
    timedRaw.length > MAX_TERRITORIES ||
    !timedRaw.every(isTimedConnection)
  )
    return { ok: false, error: 'invalid timed connections' };
  if (
    !Array.isArray(lockedRaw) ||
    lockedRaw.length > MAX_TERRITORIES ||
    !lockedRaw.every(isLockedTile)
  )
    return { ok: false, error: 'invalid locked tiles' };

  const territories = territoriesRaw as MapTerritory[];
  const seaTerritories = seaTerritoriesRaw as MapSeaTerritory[];
  const bonuses = bonusesRaw as number[];
  const wraps = wrapsRaw as MapWrap[];
  const timedConnections = timedRaw as TimedConnection[];
  const lockedTiles = lockedRaw as LockedTile[];

  if (territories.length < MIN_CONTINENT_SIZE)
    return { ok: false, error: 'not enough territories' };

  const allNodes = [...territories, ...seaTerritories];
  const ids = new Set(allNodes.map((t) => t.id));
  if (ids.size !== allNodes.length)
    return { ok: false, error: 'duplicate territory id' };

  const byId = new Map(allNodes.map((t) => [t.id, t]));
  for (const t of allNodes) {
    if (t.x < 0 || t.x > imageWidth || t.y < 0 || t.y > imageHeight)
      return { ok: false, error: 'territory out of bounds' };
  }
  for (const t of territories) {
    if (t.continentId < NO_CONTINENT || t.continentId >= bonuses.length)
      return { ok: false, error: 'invalid continent' };
  }
  for (const t of allNodes) {
    if (t.neighbors.some((n) => n === t.id || !ids.has(n)))
      return { ok: false, error: 'invalid neighbor' };
    if (t.neighbors.some((n) => !byId.get(n)!.neighbors.includes(t.id)))
      return { ok: false, error: 'asymmetric neighbor' };
  }

  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const landIds = new Set(territories.map((t) => t.id));
  const timedKeys = new Set<string>();
  for (const c of timedConnections) {
    const key = pairKey(c.a, c.b);
    if (
      timedKeys.has(key) ||
      !landIds.has(c.a) ||
      !landIds.has(c.b) ||
      byId.get(c.a)!.neighbors.includes(c.b)
    )
      return { ok: false, error: 'invalid timed connections' };
    timedKeys.add(key);
  }

  const wrapKeys = new Set<string>();
  for (const w of wraps) {
    const key = pairKey(w.a, w.b);
    if (
      wrapKeys.has(key) ||
      (!byId.get(w.a)?.neighbors.includes(w.b) && !timedKeys.has(key))
    )
      return { ok: false, error: 'invalid wraps' };
    wrapKeys.add(key);
  }

  const lockedById = new Map(lockedTiles.map((t) => [t.id, t]));
  if (
    lockedById.size !== lockedTiles.length ||
    lockedTiles.some((t) => ids.has(t.id))
  )
    return { ok: false, error: 'invalid locked tiles' };
  const inImage = ([x, y]: [number, number]) =>
    x >= 0 && x <= imageWidth && y >= 0 && y <= imageHeight;
  for (const t of lockedTiles) {
    if (
      !inImage([t.x, t.y]) ||
      !t.points.every(inImage) ||
      t.neighbors.some(
        (n) => n === t.id || (!landIds.has(n) && !lockedById.has(n)),
      ) ||
      t.neighbors.some(
        (n) =>
          lockedById.has(n) && !lockedById.get(n)!.neighbors.includes(t.id),
      )
    )
      return { ok: false, error: 'invalid locked tiles' };
  }

  if (!allConnected(allNodes, byId, timedConnections, lockedTiles))
    return { ok: false, error: 'territories not all connected' };

  const sizeByContinent = new Map<number, number>();
  for (const t of territories)
    sizeByContinent.set(
      t.continentId,
      (sizeByContinent.get(t.continentId) ?? 0) + 1,
    );
  for (let i = 0; i < bonuses.length; i++) {
    const size = sizeByContinent.get(i) ?? 0;
    if (size < MIN_CONTINENT_SIZE || size > MAX_CONTINENT_SIZE)
      return { ok: false, error: 'invalid continent size' };
  }

  return {
    ok: true,
    territories,
    seaTerritories,
    bonuses,
    wraps,
    timedConnections,
    lockedTiles,
  };
}
