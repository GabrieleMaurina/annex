import citiesUrl from './cities.json?url';
import gazetteerUrl from './gazetteer.json?url';
import { traceCityLimits } from './generateWorldMap';
import regionsUrl from './regions.json?url';
import type { WorldMapRequest } from './worldTypes';

export interface GazetteerPlace {
  id: number;
  name: string;
  kind: string;
  context: string;
  bounds: [number, number, number, number];
  rank: number;
}

interface IndexedPlace {
  place: GazetteerPlace;
  normalized: string;
  aliases: string[];
}

export type GazetteerIndex = IndexedPlace[];

interface CityShapesFile {
  shapes: number[][];
  cities: [number, number][];
}

interface GazetteerFile {
  kinds: string[];
  contexts: string[];
  places: [string, number, number, number, number, number, number, number][];
  aliases: [number, string][];
}

const KIND_ORDER = ['country', 'state', 'city', 'region', 'lake', 'sea'];
const MIN_QUERY_LENGTH = 2;
const MIN_PREFIX_ALIAS_LENGTH = 4;
const MAX_RESULTS = 8;
const MAX_NEARBY = 20;
const LABEL_GRID = 12;

const RANDOM_COUNTRY_SHARE = 0.5;
const RANDOM_CITY_SHARE = 0.35;
const US_NAME = 'United States of America';
const MIN_US_STATE_AREA = 1000;

const COUNTRY_WEIGHTS: Record<string, number> = {
  [US_NAME]: 20,
  'United Kingdom': 15,
  France: 15,
  Germany: 15,
  Italy: 15,
  Spain: 12,
  Canada: 12,
  Australia: 10,
  "People's Republic of China": 12,
  Russia: 12,
  Japan: 10,
  Netherlands: 6,
  Switzerland: 6,
  Norway: 6,
  Sweden: 6,
  Belgium: 5,
  Finland: 5,
  India: 5,
  Brazil: 5,
  Mexico: 4,
  Portugal: 3,
  Ireland: 3,
  Austria: 3,
  Denmark: 3,
  Poland: 3,
  Greece: 3,
  'New Zealand': 3,
  Ukraine: 3,
  Turkey: 3,
  'South Korea': 3,
  Iceland: 2,
  'Czech Republic': 2,
  Indonesia: 2,
  Argentina: 2,
  Egypt: 2,
  'South Africa': 2,
  Pakistan: 1,
  Nigeria: 1,
  Iran: 1,
  Philippines: 1,
  Vietnam: 1,
  Thailand: 1,
  Colombia: 1,
  Chile: 1,
  'Saudi Arabia': 1,
  Israel: 1,
  Hungary: 1,
  Romania: 1,
  Croatia: 1,
  Luxembourg: 1,
  Greenland: 1,
  Antarctica: 0,
};
const OTHER_COUNTRY_WEIGHT = 0.1;
const OTHER_COUNTRY_FULL_AREA = 100000;

const CITY_COUNTRY_BIAS: Record<string, number> = {
  'United States': 25,
  'United Kingdom': 25,
  France: 25,
  Germany: 25,
  Italy: 25,
  Spain: 25,
  Canada: 25,
  Australia: 25,
  Switzerland: 25,
  'The Netherlands': 25,
  Belgium: 25,
  Norway: 25,
  Sweden: 25,
  Finland: 25,
  Portugal: 6,
  Ireland: 6,
  Austria: 6,
  Denmark: 6,
  Poland: 6,
  Greece: 6,
  Czechia: 6,
  'New Zealand': 6,
  Japan: 6,
};
const CITY_POPULATION_EXPONENT = 1.5;

let loading: Promise<IndexedPlace[]> | null = null;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function indexFile(file: GazetteerFile): IndexedPlace[] {
  const aliases = new Map(
    file.aliases.map(([id, list]) => [id, list.split('|').map(normalize)]),
  );
  return file.places.map(
    ([name, kind, context, w, s, e, n, rank], id): IndexedPlace => ({
      place: {
        id,
        name,
        kind: file.kinds[kind],
        context: file.contexts[context] ?? '',
        bounds: [w, s, e, n],
        rank,
      },
      normalized: normalize(name),
      aliases: aliases.get(id) ?? [],
    }),
  );
}

export function loadGazetteer(): Promise<GazetteerIndex> {
  const pending =
    loading ??
    fetch(gazetteerUrl)
      .then((res) => res.json())
      .then(indexFile)
      .catch((error) => {
        loading = null;
        throw error;
      });
  loading = pending;
  return pending;
}

function cachedJson<T, R>(url: string, read: (json: T) => R) {
  let cached: Promise<R> | null = null;
  return (): Promise<R> => {
    const pending =
      cached ??
      fetch(url)
        .then((res) => res.json())
        .then(read)
        .catch((error) => {
          cached = null;
          throw error;
        });
    cached = pending;
    return pending;
  };
}

export const loadOutlines = cachedJson(
  regionsUrl,
  (regions: { outlines: Record<string, number[][]> }) => regions.outlines,
);

const loadCityShapes = cachedJson(
  citiesUrl,
  (file: CityShapesFile) =>
    new Map(file.cities.map(([id, shape]) => [id, file.shapes[shape]])),
);

const cityLimits = new Map<number, Promise<number[][]>>();

function loadCityLimits(place: GazetteerPlace): Promise<number[][]> {
  let pending = cityLimits.get(place.id);
  if (!pending) {
    const [w, s, e, n] = place.bounds;
    pending = traceCityLimits({
      type: 'limits',
      name: place.name,
      lon: (w + e) / 2,
      lat: (s + n) / 2,
      population: place.rank,
      bounds: place.bounds,
    }).catch(() => {
      cityLimits.delete(place.id);
      return [];
    });
    cityLimits.set(place.id, pending);
  }
  return pending;
}

const drawnAreas = new Map<number, number[]>();

export function drawnArea(ring: number[]): GazetteerPlace {
  const id = -1 - drawnAreas.size;
  drawnAreas.set(id, ring);
  return {
    id,
    name: `Area ${drawnAreas.size}`,
    kind: 'area',
    context: '',
    bounds: ringBounds(ring),
    rank: 0,
  };
}

function drawnRings(place: GazetteerPlace): number[][] {
  const ring = drawnAreas.get(place.id);
  return ring ? [ring] : [];
}

export function loadFocusRings(place: GazetteerPlace): Promise<number[][]> {
  if (place.kind === 'area') return Promise.resolve(drawnRings(place));
  if (place.kind === 'city') return loadCityLimits(place);
  return loadOutlines()
    .then((outlines) => outlines[place.id] ?? [])
    .catch(() => []);
}

export function loadOutline(place: GazetteerPlace): Promise<number[][]> {
  if (place.kind !== 'city') return loadFocusRings(place);
  return loadCityLimits(place).then((limits) =>
    limits.length > 0
      ? limits
      : loadCityShapes()
          .then((shapes) => {
            const shape = shapes.get(place.id);
            return shape ? [shape] : [];
          })
          .catch(() => []),
  );
}

function ringBounds(ring: number[]): GazetteerPlace['bounds'] {
  const bounds: GazetteerPlace['bounds'] = [
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
  ];
  for (let i = 0; i < ring.length; i += 2) {
    bounds[0] = Math.min(bounds[0], ring[i]);
    bounds[1] = Math.min(bounds[1], ring[i + 1]);
    bounds[2] = Math.max(bounds[2], ring[i]);
    bounds[3] = Math.max(bounds[3], ring[i + 1]);
  }
  return bounds;
}

function ringArea(ring: number[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    sum += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  return Math.abs(sum) / 2;
}

function insideRing(ring: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2)
    if (
      ring[i + 1] > y !== ring[j + 1] > y &&
      x <
        ((ring[j] - ring[i]) * (y - ring[i + 1])) /
          (ring[j + 1] - ring[i + 1]) +
          ring[i]
    )
      inside = !inside;
  return inside;
}

function interiorPoint(ring: number[]): [number, number] {
  const [w, s, e, n] = ringBounds(ring);
  let best: [number, number] = [(w + e) / 2, (s + n) / 2];
  let bestDistance = -1;
  for (let i = 0; i < LABEL_GRID; i++)
    for (let j = 0; j < LABEL_GRID; j++) {
      const x = w + ((i + 0.5) / LABEL_GRID) * (e - w);
      const y = s + ((j + 0.5) / LABEL_GRID) * (n - s);
      if (!insideRing(ring, x, y)) continue;
      let distance = Infinity;
      for (let k = 0; k < ring.length; k += 2)
        distance = Math.min(distance, Math.hypot(ring[k] - x, ring[k + 1] - y));
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [x, y];
      }
    }
  return best;
}

const labelPoints = new Map<number, [number, number]>();

export function labelPoint(
  place: GazetteerPlace,
  outlines: Record<string, number[][]>,
): [number, number] {
  const cached = labelPoints.get(place.id);
  if (cached) return cached;
  const rings =
    place.kind === 'area'
      ? drawnRings(place)
      : place.kind === 'city'
        ? []
        : (outlines[place.id] ?? []);
  const [w, s, e, n] = place.bounds;
  const point =
    rings.length > 0
      ? interiorPoint(
          rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a)),
        )
      : ([(w + e) / 2, (s + n) / 2] as [number, number]);
  labelPoints.set(place.id, point);
  return point;
}

export function nearbyPlaces(
  index: IndexedPlace[],
  kind: string,
  [west, south, east, north]: [number, number, number, number],
  outlines: Record<string, number[][]>,
  accept: (place: GazetteerPlace) => boolean,
): { place: GazetteerPlace; point: [number, number] }[] {
  const candidates = index
    .map(({ place }) => place)
    .filter(
      (place) =>
        place.kind === kind &&
        place.bounds[0] <= east &&
        place.bounds[2] >= west &&
        place.bounds[1] <= north &&
        place.bounds[3] >= south &&
        accept(place),
    )
    .sort((a, b) => b.rank - a.rank);
  const nearby: { place: GazetteerPlace; point: [number, number] }[] = [];
  for (const place of candidates) {
    if (nearby.length >= MAX_NEARBY) break;
    const point = labelPoint(place, outlines);
    if (
      point[0] >= west &&
      point[0] <= east &&
      point[1] >= south &&
      point[1] <= north
    )
      nearby.push({ place, point });
  }
  return nearby;
}

export function loadFrameBounds(
  place: GazetteerPlace,
): Promise<GazetteerPlace['bounds']> {
  if (place.kind !== 'city') return Promise.resolve(place.bounds);
  return loadOutline(place).then((rings) =>
    rings.length > 0 ? ringBounds(rings.flat()) : place.bounds,
  );
}

export function citiesIn(
  index: IndexedPlace[],
  [west, south, east, north]: [number, number, number, number],
): WorldMapRequest['cities'] {
  const cities: WorldMapRequest['cities'] = [];
  for (const { place } of index) {
    if (place.kind !== 'city') continue;
    const [w, s, e, n] = place.bounds;
    const lon = (w + e) / 2;
    const lat = (s + n) / 2;
    const shifted = lon + 360 * Math.round(((west + east) / 2 - lon) / 360);
    if (lat < south || lat > north || shifted < west || shifted > east)
      continue;
    cities.push([place.name, shifted, lat, place.rank]);
  }
  return cities;
}

function scoreOf(entry: IndexedPlace, q: string): number {
  const { normalized, aliases } = entry;
  if (normalized === q || aliases.includes(q)) return 0;
  if (
    normalized.startsWith(q) ||
    aliases.some(
      (alias) => alias.length >= MIN_PREFIX_ALIAS_LENGTH && alias.startsWith(q),
    )
  )
    return 1;
  return ` ${normalized}`.includes(` ${q}`) ? 2 : -1;
}

function countryWeight(place: GazetteerPlace): number {
  return (
    COUNTRY_WEIGHTS[place.name] ??
    OTHER_COUNTRY_WEIGHT * Math.min(1, place.rank / OTHER_COUNTRY_FULL_AREA)
  );
}

function cityWeight(place: GazetteerPlace): number {
  const country = place.context.split(', ').at(-1) ?? '';
  return (
    Math.pow(place.rank / 1e6, CITY_POPULATION_EXPONENT) *
    (CITY_COUNTRY_BIAS[country] ?? 1)
  );
}

function isUsState(place: GazetteerPlace): boolean {
  return (
    place.kind === 'state' &&
    place.context === US_NAME &&
    place.rank >= MIN_US_STATE_AREA
  );
}

function weightedPick(
  places: GazetteerPlace[],
  weightOf: (place: GazetteerPlace) => number,
): GazetteerPlace | null {
  const weights = places.map(weightOf);
  let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < places.length; i++) {
    roll -= weights[i];
    if (roll < 0) return places[i];
  }
  return null;
}

export function randomPlace(index: IndexedPlace[]): GazetteerPlace | null {
  const places = index.map(({ place }) => place);
  const roll = Math.random();
  if (roll < RANDOM_COUNTRY_SHARE)
    return weightedPick(
      places.filter((p) => p.kind === 'country'),
      countryWeight,
    );
  if (roll < RANDOM_COUNTRY_SHARE + RANDOM_CITY_SHARE)
    return weightedPick(
      places.filter((p) => p.kind === 'city'),
      cityWeight,
    );
  return weightedPick(places.filter(isUsState), () => 1);
}

export function searchPlaces(
  index: IndexedPlace[],
  query: string,
): GazetteerPlace[] {
  const q = normalize(query.trim());
  if (q.length < MIN_QUERY_LENGTH) return [];
  const matches: { place: GazetteerPlace; score: number }[] = [];
  for (const entry of index) {
    const score = scoreOf(entry, q);
    if (score >= 0) matches.push({ place: entry.place, score });
  }
  return matches
    .sort(
      (a, b) =>
        a.score - b.score ||
        KIND_ORDER.indexOf(a.place.kind) - KIND_ORDER.indexOf(b.place.kind) ||
        b.place.rank - a.place.rank,
    )
    .slice(0, MAX_RESULTS)
    .map(({ place }) => place);
}
