import {
  Fill,
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_SIZE_VALUES,
  MapSize,
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

const MAX_CONTINENTS = 30;
const MIN_BONUS = 2;
const MAX_BONUS = 25;
const MIN_CONTINENT_SIZE = 2;
const MAX_CONTINENT_SIZE = 40;
const MAX_TERRITORIES = MAX_CONTINENTS * MAX_CONTINENT_SIZE;

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

function allConnected(
  territories: MapTerritory[],
  byId: Map<number, MapTerritory>,
): boolean {
  const visited = new Set<number>();
  const stack = [territories[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const n of byId.get(id)!.neighbors)
      if (byId.has(n) && !visited.has(n)) stack.push(n);
  }
  return visited.size === territories.length;
}

export interface MapGeneration {
  seed: string;
  size: MapSize;
  type: GenerationType;
  fill: Fill;
}

const MAX_SEED_LENGTH = 20;

export function validateMapGeneration(
  raw: unknown,
):
  | { ok: true; generation: MapGeneration | null }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, generation: null };
  if (!isObject(raw)) return { ok: false, error: 'invalid generation' };
  const { seed, size, type, fill } = raw;
  if (
    typeof seed !== 'string' ||
    seed.length < 1 ||
    seed.length > MAX_SEED_LENGTH ||
    !(MAP_SIZE_VALUES as string[]).includes(size as string) ||
    !(GENERATION_TYPE_VALUES as string[]).includes(type as string) ||
    !(FILL_VALUES as string[]).includes(fill as string)
  )
    return { ok: false, error: 'invalid generation' };
  return {
    ok: true,
    generation: {
      seed,
      size: size as MapSize,
      type: type as GenerationType,
      fill: fill as Fill,
    },
  };
}

export function validateMapGeometry(
  territoriesRaw: unknown,
  bonusesRaw: unknown,
):
  | { ok: true; territories: MapTerritory[]; bonuses: number[] }
  | { ok: false; error: string } {
  if (!Array.isArray(territoriesRaw))
    return { ok: false, error: 'invalid territories' };
  if (territoriesRaw.length > MAX_TERRITORIES)
    return { ok: false, error: 'too many territories' };
  if (!territoriesRaw.every(isTerritory))
    return { ok: false, error: 'invalid territories' };
  if (
    !Array.isArray(bonusesRaw) ||
    bonusesRaw.length < 1 ||
    bonusesRaw.length > MAX_CONTINENTS ||
    !bonusesRaw.every(
      (b) => Number.isInteger(b) && b >= MIN_BONUS && b <= MAX_BONUS,
    )
  )
    return { ok: false, error: 'invalid bonuses' };

  const territories = territoriesRaw as MapTerritory[];
  const bonuses = bonusesRaw as number[];

  if (territories.length < MIN_CONTINENT_SIZE)
    return { ok: false, error: 'not enough territories' };

  const ids = new Set(territories.map((t) => t.id));
  if (ids.size !== territories.length)
    return { ok: false, error: 'duplicate territory id' };

  const byId = new Map(territories.map((t) => [t.id, t]));
  for (const t of territories) {
    if (t.continentId < 0 || t.continentId >= bonuses.length)
      return { ok: false, error: 'invalid continent' };
    if (t.neighbors.some((n) => n === t.id || !ids.has(n)))
      return { ok: false, error: 'invalid neighbor' };
    if (t.neighbors.some((n) => !byId.get(n)!.neighbors.includes(t.id)))
      return { ok: false, error: 'asymmetric neighbor' };
  }

  if (!allConnected(territories, byId))
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

  return { ok: true, territories, bonuses };
}
