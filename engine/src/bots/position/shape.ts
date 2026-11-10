import { getGameMap } from '../../maps/maps';
import { Game, Territory } from '../../types';

export interface Shape {
  remoteness: Map<number, number>;
  safety: Map<number, number>;
  entries: Map<number, Set<number>>;
}

const MAX_SOURCES = 256;
const MAX_CACHED_SHAPES = 16;
const REMOTE_SAFETY = 1;
const ENTRY_SAFETY = 0.4;
const MIN_SAFETY = 0.6;
const MAX_SAFETY = 1.6;

const shapesByTerritories = new WeakMap<Territory[], Shape>();
const shapesByFingerprint = new Map<string, Shape>();

function fingerprintOf(game: Game, territories: Territory[]): string {
  let hash = 0;
  let edges = 0;
  for (const territory of territories) {
    hash = (Math.imul(hash, 31) + territory.id * 7 + territory.continentId) | 0;
    for (const n of territory.neighbors) {
      hash = (Math.imul(hash, 31) + n) | 0;
      edges++;
    }
  }
  const portals = game.portalsEnabled ? game.portalTerritoryIds.join(',') : '';
  return `${territories.length}:${edges}:${hash}:${portals}`;
}

function adjacencyOf(
  ids: number[],
  links: Map<number, number[]>,
): { adjacency: number[][]; indexOf: Map<number, number> } {
  const indexOf = new Map(ids.map((id, index) => [id, index]));
  const adjacency = ids.map((id) =>
    (links.get(id) ?? [])
      .map((n) => indexOf.get(n))
      .filter((index): index is number => index !== undefined),
  );
  return { adjacency, indexOf };
}

function meanDistances(adjacency: number[][]): Float64Array {
  const count = adjacency.length;
  const total = new Float64Array(count);
  const distance = new Int32Array(count);
  const queue = new Int32Array(count);
  const stride = Math.max(1, Math.ceil(count / MAX_SOURCES));
  let sources = 0;
  for (let source = 0; source < count; source += stride) {
    distance.fill(-1);
    distance[source] = 0;
    queue[0] = source;
    let tail = 1;
    for (let head = 0; head < tail; head++) {
      const current = queue[head];
      for (const n of adjacency[current])
        if (distance[n] < 0) {
          distance[n] = distance[current] + 1;
          queue[tail++] = n;
        }
    }
    for (let i = 0; i < count; i++)
      total[i] += distance[i] < 0 ? count : distance[i];
    sources++;
  }
  for (let i = 0; i < count; i++) total[i] /= sources;
  return total;
}

function normalize(values: Float64Array): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return Array.from(values, (value) =>
    max > min ? (value - min) / (max - min) : 0.5,
  );
}

function entriesOf(
  territories: Territory[],
  links: Map<number, number[]>,
): Map<number, Set<number>> {
  const continentOf = new Map(territories.map((t) => [t.id, t.continentId]));
  const entries = new Map<number, Set<number>>();
  for (const { id, continentId } of territories) {
    if (continentId < 0) continue;
    const crosses = (links.get(id) ?? []).some((n) => {
      const other = continentOf.get(n);
      return other !== undefined && other !== continentId;
    });
    if (!entries.has(continentId)) entries.set(continentId, new Set());
    if (crosses) entries.get(continentId)!.add(id);
  }
  return entries;
}

function safetyOf(
  territories: Territory[],
  remoteness: Map<number, number>,
  entries: Map<number, Set<number>>,
): Map<number, number> {
  const remote = new Map<number, number>();
  const sizes = new Map<number, number>();
  for (const { id, continentId } of territories) {
    if (continentId < 0) continue;
    remote.set(
      continentId,
      (remote.get(continentId) ?? 0) + (remoteness.get(id) ?? 0),
    );
    sizes.set(continentId, (sizes.get(continentId) ?? 0) + 1);
  }
  const count = sizes.size;
  if (count === 0) return new Map();
  let remoteTotal = 0;
  let entryTotal = 0;
  for (const [continentId, size] of sizes) {
    remote.set(continentId, remote.get(continentId)! / size);
    remoteTotal += remote.get(continentId)!;
    entryTotal += Math.max(1, entries.get(continentId)?.size ?? 0);
  }
  const meanRemote = remoteTotal / count;
  const meanEntries = entryTotal / count;
  const safety = new Map<number, number>();
  for (const continentId of sizes.keys()) {
    const continentEntries = Math.max(1, entries.get(continentId)?.size ?? 0);
    const value =
      1 +
      REMOTE_SAFETY * (remote.get(continentId)! - meanRemote) +
      (ENTRY_SAFETY * (meanEntries - continentEntries)) / meanEntries;
    safety.set(continentId, Math.min(MAX_SAFETY, Math.max(MIN_SAFETY, value)));
  }
  return safety;
}

function computeShape(
  territories: Territory[],
  links: Map<number, number[]>,
): Shape {
  const ids = territories.map((t) => t.id);
  const { adjacency } = adjacencyOf(ids, links);
  const scaled = normalize(meanDistances(adjacency));
  const remoteness = new Map(ids.map((id, index) => [id, scaled[index]]));
  const entries = entriesOf(territories, links);
  return {
    remoteness,
    entries,
    safety: safetyOf(territories, remoteness, entries),
  };
}

export function shapeOf(game: Game, links: Map<number, number[]>): Shape {
  const territories = getGameMap(game).territories;
  const known = shapesByTerritories.get(territories);
  if (known) return known;
  const fingerprint = fingerprintOf(game, territories);
  let shape = shapesByFingerprint.get(fingerprint);
  if (!shape) {
    shape = computeShape(territories, links);
    if (shapesByFingerprint.size >= MAX_CACHED_SHAPES)
      shapesByFingerprint.delete(shapesByFingerprint.keys().next().value!);
    shapesByFingerprint.set(fingerprint, shape);
  }
  shapesByTerritories.set(territories, shape);
  return shape;
}
