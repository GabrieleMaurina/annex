import gazetteerUrl from './gazetteer.json?url';
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
