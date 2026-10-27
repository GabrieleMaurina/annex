import citiesUrl from './cities.json?url';
import gazetteerUrl from './gazetteer.json?url';
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

const loadOutlines = cachedJson(
  regionsUrl,
  (regions: { outlines: Record<string, number[][]> }) => regions.outlines,
);

const loadCityShapes = cachedJson(
  citiesUrl,
  (file: CityShapesFile) =>
    new Map(file.cities.map(([id, shape]) => [id, file.shapes[shape]])),
);

export function loadOutline(place: GazetteerPlace): Promise<number[][]> {
  if (place.kind === 'city')
    return loadCityShapes().then((shapes) => {
      const shape = shapes.get(place.id);
      return shape ? [shape] : [];
    });
  return loadOutlines().then((outlines) => outlines[place.id] ?? []);
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

export function loadFrameBounds(
  place: GazetteerPlace,
): Promise<GazetteerPlace['bounds']> {
  if (place.kind !== 'city') return Promise.resolve(place.bounds);
  return loadCityShapes()
    .then((shapes) => {
      const shape = shapes.get(place.id);
      return shape ? ringBounds(shape) : place.bounds;
    })
    .catch(() => place.bounds);
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
