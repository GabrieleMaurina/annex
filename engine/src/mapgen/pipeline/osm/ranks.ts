import { OsmDetail, OsmLine, OsmPlace } from './types';

export const LANDMASS_RANK = 101;
export const CUT_RANKS = [30, 40, 50, 60, 70, 80, 90, 100, LANDMASS_RANK];
export const RIVER_RANK = 50;
export const LOCAL_ZOOM = 12;

export const DETAIL_RANKS: Record<Exclude<OsmDetail, 'auto'>, number> = {
  countries: 100,
  states: 90,
  counties: 80,
  municipalities: 70,
  districts: 60,
  neighbourhoods: 50,
  blocks: 30,
};

const CUT_LABELS: Record<number, string> = {
  30: 'Blocks',
  40: 'Quarters',
  50: 'Neighbourhoods',
  60: 'Districts',
  70: 'Municipalities',
  80: 'Provinces',
  90: 'States',
  100: 'Countries',
  [LANDMASS_RANK]: 'Islands',
};

const ROAD_RANKS: Record<string, number> = {
  motorway: 50,
  trunk: 50,
  rail: 50,
  primary: 40,
  secondary: 40,
  tertiary: 30,
  minor: 30,
};

const CUT_PLACE_CLASSES: Record<number, string[]> = {
  30: ['neighbourhood', 'quarter', 'suburb', 'hamlet'],
  40: ['quarter', 'neighbourhood', 'suburb'],
  50: ['suburb', 'quarter', 'neighbourhood', 'borough'],
  60: ['borough', 'suburb', 'quarter', 'city', 'town'],
  70: ['city', 'town', 'village'],
  80: ['province', 'city', 'town'],
  90: ['state', 'province'],
  100: ['country'],
  [LANDMASS_RANK]: ['continent', 'country', 'island'],
};

const FALLBACK_PLACE_CLASSES = [
  'island',
  'city',
  'town',
  'village',
  'suburb',
  'quarter',
  'neighbourhood',
  'hamlet',
  'isolated_dwelling',
  'province',
  'state',
  'country',
];

const WATER_NAME_CLASSES = ['ocean', 'sea', 'gulf', 'bay', 'strait'];

export function cutLabel(cut: number): string {
  return CUT_LABELS[cut];
}

export function lineRank(line: OsmLine, zoom: number): number {
  if (line.layer === 'boundary') {
    const level = line.adminLevel;
    if (level <= 0) return 0;
    if (level <= 2) return 100;
    if (level <= 4) return 90;
    if (level <= 6) return 80;
    if (level <= 8) return 70;
    if (level <= 10) return 60;
    return 0;
  }
  if (zoom < LOCAL_ZOOM) return 0;
  if (line.layer === 'waterway')
    return line.cls === 'river' || line.cls === 'canal' ? RIVER_RANK : 0;
  if (line.layer === 'transportation') return ROAD_RANKS[line.cls] ?? 0;
  return 0;
}

const COUNTY_CUT = 80;

function tierOf(place: OsmPlace, classes: string[]): number {
  if (place.layer !== 'place') return -1;
  return classes.indexOf(place.cls);
}

export function placeScore(place: OsmPlace, cut: number): number {
  if (place.layer === 'admin2') return cut === COUNTY_CUT ? 0 : -1;
  const tier = tierOf(place, CUT_PLACE_CLASSES[cut]);
  if (tier >= 0) return tier;
  const fallback = tierOf(place, FALLBACK_PLACE_CLASSES);
  if (fallback >= 0) return 10 + fallback;
  if (place.layer === 'peak') return 30;
  if (place.layer === 'water' && place.cls === 'lake') return 31;
  return -1;
}

export function waterNameScore(place: OsmPlace): number {
  return place.layer === 'water' ? WATER_NAME_CLASSES.indexOf(place.cls) : -1;
}

export function comparePlaces(a: OsmPlace, b: OsmPlace): number {
  const capital = (p: OsmPlace) => (p.capital > 0 ? p.capital : 99);
  return capital(a) - capital(b) || a.rank - b.rank;
}
