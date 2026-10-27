import {
  isValidPlaceName,
  MAX_PLACE_NAME_LENGTH,
} from '../../../maps/placeNames';
import { SeaTerritory, Territory } from '../../../types';
import { CutLevels } from './cut';
import {
  comparePlaces,
  cutLabel,
  LANDMASS_RANK,
  placeScore,
  waterNameScore,
} from './ranks';
import { OsmPlace } from './types';

const MAX_MAP_NAME_LENGTH = 40;
const MAP_NAME_CLASSES = ['country', 'state', 'city', 'town'];
const CENTRAL_FRACTION = 0.25;
const OUTSIDE_REACH = 0.25;
const SHORT_WORD_LENGTH = 3;
const WHOLE_SHARE = 0.7;
const STATE_CUT = 90;
const SETTLEMENT_CUT = 70;
const MAJORITY_SHARE = 0.5;
const COUNTRY_CUT = 100;
const FALLBACK_SCORE = 10;
const ISLAND_SPREAD = 2;
const ISLAND_MAX_SHARE = 0.25;
const DIRECTIONS = [
  'Eastern',
  'South-Eastern',
  'Southern',
  'South-Western',
  'Western',
  'North-Western',
  'Northern',
  'North-Eastern',
];

export interface NamingInput {
  labelGrid: Int16Array;
  width: number;
  height: number;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  places: OsmPlace[];
  cut: number;
  parentCut: number;
  atomOf: Int32Array;
  atomArea: Float64Array;
  cutComponent: Int32Array;
  levels: CutLevels;
  seedNames: Map<number, string>;
}

type Weight = (place: OsmPlace) => number;

export interface MapNames {
  territoryNames: string[];
  seaNames: string[];
  continentNames: string[];
}

function sanitize(raw: string): string {
  let name = raw.replace(/\s+/g, ' ').trim();
  if (name.length > MAX_PLACE_NAME_LENGTH) {
    const words = name.split(' ');
    name = words
      .filter(
        (word, i) =>
          i === 0 || i === words.length - 1 || word.length > SHORT_WORD_LENGTH,
      )
      .join(' ');
  }
  if (name.length > MAX_PLACE_NAME_LENGTH) {
    const space = name.lastIndexOf(' ', MAX_PLACE_NAME_LENGTH);
    name = name.slice(0, space > 0 ? space : MAX_PLACE_NAME_LENGTH).trim();
  }
  return isValidPlaceName(name) ? name : '';
}

function regionOf(name: string): string {
  return /\bregion$/i.test(name) ? name : `${name} Region`;
}

function compass(dx: number, dy: number, spread: number): string {
  if (Math.hypot(dx, dy) < spread * CENTRAL_FRACTION) return 'Central';
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return DIRECTIONS[(sector + 8) % 8];
}

function createRegistry() {
  const used = new Set<string>();
  const take = (raw: string, composed = false): string => {
    if (composed && raw.length > MAX_PLACE_NAME_LENGTH) return '';
    const name = sanitize(raw);
    if (!name || used.has(name.toLowerCase())) return '';
    used.add(name.toLowerCase());
    return name;
  };
  const claim = (
    base: string,
    qualifier: string,
    qualifyFirst: boolean,
    alternative = '',
  ) => {
    const qualified = `${qualifier} ${base}`;
    const options = qualifyFirst
      ? [qualified, base, alternative]
      : [base, qualified, alternative];
    for (const option of options) {
      const name = take(option, option !== base);
      if (name) return name;
    }
    for (let n = 2; ; n++) {
      const suffix = ` ${n}`;
      const name = take(
        base.slice(0, MAX_PLACE_NAME_LENGTH - suffix.length).trim() + suffix,
      );
      if (name) return name;
    }
  };
  return { take, claim };
}

function placeCell(input: NamingInput, p: OsmPlace, reach: number): number {
  const { width, height } = input;
  if (
    p.x < -reach ||
    p.y < -reach ||
    p.x >= width + reach ||
    p.y >= height + reach
  )
    return -1;
  const x = Math.min(width - 1, Math.max(0, Math.floor(p.x)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(p.y)));
  return y * width + x;
}

function placesByTerritory(
  input: NamingInput,
  outside: boolean,
): Map<number, OsmPlace[]> {
  const byTerritory = new Map<number, OsmPlace[]>();
  for (const p of input.places) {
    const inImage = placeCell(input, p, 0) >= 0;
    if (inImage === outside) continue;
    const cell = placeCell(input, p, outside ? input.width * OUTSIDE_REACH : 0);
    if (cell < 0) continue;
    const t = input.labelGrid[cell];
    if (t < 0) continue;
    const list = byTerritory.get(t);
    if (list) list.push(p);
    else byTerritory.set(t, [p]);
  }
  return byTerritory;
}

function rankedPlaces(
  places: OsmPlace[],
  cut: number,
  tierLimit: number,
  weight: Weight,
  rankFirst = false,
): OsmPlace[] {
  return places
    .map((p) => ({ p, score: placeScore(p, cut), weight: weight(p) }))
    .filter(({ score }) => score >= 0 && score < tierLimit)
    .sort((a, b) => {
      const byWeight = b.weight - a.weight;
      const byRank = comparePlaces(a.p, b.p);
      return (
        a.score - b.score ||
        (rankFirst ? byRank || byWeight : byWeight || byRank)
      );
    })
    .map(({ p }) => p);
}

function strongerOutside(
  inside: OsmPlace[],
  near: OsmPlace[],
  cut: number,
  weight: Weight,
): string {
  if (cut < STATE_CUT) return '';
  const own = rankedPlaces(inside, cut, 1, weight, true)[0];
  const outside = rankedPlaces(near, cut, 1, weight, true)[0];
  return own && outside && comparePlaces(outside, own) < 0 ? outside.name : '';
}

function namingCuts(input: NamingInput): number[] {
  const { labelGrid, atomOf, atomArea, levels, cut, territories } = input;
  const cellsByAtom = territories.map(() => new Map<number, number>());
  for (let i = 0; i < labelGrid.length; i++) {
    const t = labelGrid[i];
    const atom = atomOf[i];
    if (t < 0 || atom < 0) continue;
    cellsByAtom[t].set(atom, (cellsByAtom[t].get(atom) ?? 0) + 1);
  }
  const usable = levels.thresholds
    .map((threshold, index) => ({ threshold, index }))
    .filter(({ threshold }) => threshold <= cut)
    .reverse();
  const componentAreas = usable.map(({ index }) => {
    const areas = new Map<number, number>();
    const component = levels.components[index];
    for (let atom = 0; atom < atomArea.length; atom++)
      areas.set(
        component[atom],
        (areas.get(component[atom]) ?? 0) + atomArea[atom],
      );
    return areas;
  });
  return territories.map((_, t) => {
    for (let u = 0; u < usable.length; u++) {
      const component = levels.components[usable[u].index];
      const tally = new Map<number, number>();
      for (const [atom, cells] of cellsByAtom[t])
        tally.set(component[atom], (tally.get(component[atom]) ?? 0) + cells);
      const major = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!major) break;
      if (componentAreas[u].get(major[0])! * WHOLE_SHARE <= major[1])
        return usable[u].threshold;
    }
    return levels.thresholds[0];
  });
}

function nameTerritories(
  input: NamingInput,
  registry: ReturnType<typeof createRegistry>,
  inside: Map<number, OsmPlace[]>,
  near: Map<number, OsmPlace[]>,
  weight: Weight,
): { names: string[]; bases: string[] } {
  const { territories, labelGrid, seedNames } = input;
  const cuts = namingCuts(input);
  const area = new Array(territories.length).fill(0);
  for (const t of labelGrid) if (t >= 0) area[t]++;
  const names = territories.map(() => '');
  const bases = territories.map(() => '');
  const order = territories.map((t) => t.id).sort((a, b) => area[b] - area[a]);
  for (const t of order) {
    const options = [
      seedNames.get(t) ?? '',
      strongerOutside(inside.get(t) ?? [], near.get(t) ?? [], cuts[t], weight),
      ...rankedPlaces(inside.get(t) ?? [], cuts[t], Infinity, weight).map(
        (p) => p.name,
      ),
    ];
    for (const option of options) {
      names[t] = registry.take(option);
      bases[t] = names[t];
      if (names[t]) break;
    }
  }
  const spread = Math.sqrt((input.width * input.height) / territories.length);
  const leftovers = [...inside.values()].flat();
  for (const t of order) {
    if (names[t]) continue;
    const self = territories[t];
    const distance = (p: OsmPlace) => Math.hypot(p.x - self.x, p.y - self.y);
    const nearby = leftovers
      .map((p) => ({ p, score: placeScore(p, cuts[t]) }))
      .filter(({ p, score }) => score >= 0 && distance(p) <= spread)
      .sort((a, b) => a.score - b.score || distance(a.p) - distance(b.p));
    for (const { p } of nearby) {
      names[t] = registry.take(p.name);
      bases[t] = names[t];
      if (names[t]) break;
    }
  }
  for (const t of order) {
    if (names[t]) continue;
    const self = territories[t];
    const named = territories.filter((o) => names[o.id] && o.id !== t);
    if (named.length === 0) {
      bases[t] = 'Territory';
      names[t] = registry.claim(`Territory ${t + 1}`, '', false);
      continue;
    }
    const nearest = named.reduce((best, o) =>
      Math.hypot(o.x - self.x, o.y - self.y) <
      Math.hypot(best.x - self.x, best.y - self.y)
        ? o
        : best,
    );
    bases[t] = bases[nearest.id];
    names[t] = registry.claim(
      bases[t],
      compass(self.x - nearest.x, self.y - nearest.y, spread),
      true,
    );
  }
  return { names, bases };
}

function nameSeas(
  input: NamingInput,
  registry: ReturnType<typeof createRegistry>,
  territoryNames: string[],
): string[] {
  const { seaTerritories, territories, places } = input;
  const candidates = seaTerritories.map(() => [] as OsmPlace[]);
  for (const p of places) {
    if (waterNameScore(p) < 0 || seaTerritories.length === 0) continue;
    let best = 0;
    seaTerritories.forEach((s, i) => {
      if (
        Math.hypot(s.x - p.x, s.y - p.y) <
        Math.hypot(seaTerritories[best].x - p.x, seaTerritories[best].y - p.y)
      )
        best = i;
    });
    candidates[best].push(p);
  }
  return seaTerritories.map((sea, i) => {
    const ranked = candidates[i].sort(
      (a, b) => waterNameScore(a) - waterNameScore(b) || a.rank - b.rank,
    );
    for (const p of ranked) {
      const name = registry.take(p.name);
      if (name) return name;
    }
    const land = sea.neighbors
      .filter((n) => n < territories.length)
      .map((n) => territories[n])
      .sort(
        (a, b) =>
          Math.hypot(a.x - sea.x, a.y - sea.y) -
          Math.hypot(b.x - sea.x, b.y - sea.y),
      )[0];
    const base = land ? `Sea of ${territoryNames[land.id]}` : 'Sea';
    return registry.claim(base, 'Open', false);
  });
}

function continentEntity(
  input: NamingInput,
  overlaps: Map<number, number>[],
  area: number,
  landmassArea: Map<number, number>,
  totalLand: number,
  candidates: OsmPlace[],
): string | undefined {
  const { levels, atomOf, cut, parentCut } = input;
  const top = Math.min(COUNTRY_CUT, Math.max(parentCut, SETTLEMENT_CUT));
  const scored = candidates.flatMap((p) => {
    if (!sanitize(p.name)) return [];
    const cell = placeCell(input, p, input.width * OUTSIDE_REACH);
    const atom = cell < 0 ? -1 : atomOf[cell];
    if (atom < 0) return [];
    return levels.thresholds.flatMap((threshold, level) => {
      const component = levels.components[level][atom];
      const island =
        threshold === LANDMASS_RANK &&
        p.layer === 'place' &&
        p.cls === 'island' &&
        landmassArea.get(component)! <= area * ISLAND_SPREAD &&
        landmassArea.get(component)! <= totalLand * ISLAND_MAX_SHARE;
      const score = island ? 0 : placeScore(p, threshold);
      if (!island && (threshold < cut || threshold > COUNTRY_CUT)) return [];
      if (score < 0 || score >= FALLBACK_SCORE) return [];
      const overlap = overlaps[level].get(component) ?? 0;
      return overlap > 0 ? [{ p, threshold, score, overlap }] : [];
    });
  });
  const majority = scored.filter((e) => e.overlap >= area * MAJORITY_SHARE);
  const pool =
    majority.length > 0 ? majority : scored.filter((e) => e.threshold <= top);
  return pool.sort(
    (a, b) =>
      a.score - b.score ||
      (majority.length > 0 ? a.threshold - b.threshold : 0) ||
      b.overlap - a.overlap ||
      comparePlaces(a.p, b.p),
  )[0]?.p.name;
}

function nameContinents(
  input: NamingInput,
  registry: ReturnType<typeof createRegistry>,
  territoryBases: string[],
): string[] {
  const { territories, parentCut, labelGrid, atomOf, levels } = input;
  const count = Math.max(0, ...territories.map((t) => t.continentId + 1));
  const atomCells = Array.from(
    { length: count },
    () => new Map<number, number>(),
  );
  const area = new Array(count).fill(0);
  for (let i = 0; i < labelGrid.length; i++) {
    const atom = atomOf[i];
    if (labelGrid[i] < 0 || atom < 0) continue;
    const c = territories[labelGrid[i]].continentId;
    area[c]++;
    atomCells[c].set(atom, (atomCells[c].get(atom) ?? 0) + 1);
  }
  const overlaps = atomCells.map((cells) =>
    levels.components.map((component) => {
      const totals = new Map<number, number>();
      for (const [atom, n] of cells)
        totals.set(component[atom], (totals.get(component[atom]) ?? 0) + n);
      return totals;
    }),
  );
  const landmass = levels.components[levels.thresholds.indexOf(LANDMASS_RANK)];
  const landmassArea = new Map<number, number>();
  for (let atom = 0; atom < landmass.length; atom++)
    landmassArea.set(
      landmass[atom],
      (landmassArea.get(landmass[atom]) ?? 0) + input.atomArea[atom],
    );
  const totalLand = input.atomArea.reduce((sum, a) => sum + a, 0);
  const inside = input.places.filter((p) => placeCell(input, p, 0) >= 0);
  const outside = input.places.filter((p) => placeCell(input, p, 0) < 0);
  const center = (members: { x: number; y: number }[]) => ({
    x: members.reduce((s, t) => s + t.x, 0) / members.length,
    y: members.reduce((s, t) => s + t.y, 0) / members.length,
  });
  const continents = Array.from({ length: count }, (_, c) => {
    const members = territories.filter((t) => t.continentId === c);
    const entity =
      continentEntity(
        input,
        overlaps[c],
        area[c],
        landmassArea,
        totalLand,
        inside,
      ) ??
      continentEntity(
        input,
        overlaps[c],
        area[c],
        landmassArea,
        totalLand,
        outside,
      );
    if (entity) return { members, base: entity };
    const at = members.length > 0 ? center(members) : null;
    const nearestContinent =
      parentCut === LANDMASS_RANK && at
        ? input.places
            .filter(
              (p) =>
                p.layer === 'place' &&
                p.cls === 'continent' &&
                sanitize(p.name),
            )
            .sort(
              (a, b) =>
                Math.hypot(a.x - at.x, a.y - at.y) -
                Math.hypot(b.x - at.x, b.y - at.y),
            )[0]?.name
        : undefined;
    const base =
      nearestContinent ??
      (members[0] ? regionOf(territoryBases[members[0].id]) : 'Region');
    return { members, base };
  });
  const sharing = new Map<string, Territory[]>();
  for (const { members, base } of continents)
    sharing.set(base, [...(sharing.get(base) ?? []), ...members]);
  const spread = Math.sqrt((input.width * input.height) / Math.max(1, count));
  return continents.map(({ members, base }) => {
    if (members.length === 0) return registry.claim(base, 'Central', false);
    const at = center(members);
    const shared = sharing.get(base)!;
    const reference = center(shared);
    return registry.claim(
      base,
      compass(at.x - reference.x, at.y - reference.y, spread),
      shared.length > members.length,
      regionOf(base),
    );
  });
}

export function nameMap(input: NamingInput): MapNames {
  const registry = createRegistry();
  const componentArea = new Map<number, number>();
  for (let atom = 0; atom < input.atomArea.length; atom++) {
    const component = input.cutComponent[atom];
    componentArea.set(
      component,
      (componentArea.get(component) ?? 0) + input.atomArea[atom],
    );
  }
  const weight: Weight = (p) => {
    const cell = placeCell(input, p, input.width * OUTSIDE_REACH);
    const atom = cell < 0 ? -1 : input.atomOf[cell];
    return atom < 0 ? 0 : componentArea.get(input.cutComponent[atom])!;
  };
  const territories = nameTerritories(
    input,
    registry,
    placesByTerritory(input, false),
    placesByTerritory(input, true),
    weight,
  );
  const territoryNames = territories.names;
  const seaNames = nameSeas(input, registry, territoryNames);
  const continentNames = nameContinents(input, registry, territories.bases);
  return { territoryNames, seaNames, continentNames };
}

export function mapTitle(
  requested: string,
  places: OsmPlace[],
  cut: number,
  width: number,
  height: number,
): string {
  const label = cutLabel(cut);
  const offCenter = (p: OsmPlace) =>
    Math.hypot(p.x - width / 2, p.y - height / 2);
  const best = places
    .filter((p) => p.layer === 'place' && MAP_NAME_CLASSES.includes(p.cls))
    .sort(
      (a, b) =>
        MAP_NAME_CLASSES.indexOf(a.cls) - MAP_NAME_CLASSES.indexOf(b.cls) ||
        comparePlaces(a, b) ||
        offCenter(a) - offCenter(b),
    )[0];
  const room = MAX_MAP_NAME_LENGTH - label.length - 3;
  const base = (requested.trim() || best?.name || 'World').slice(0, room);
  return `${base.trim()} (${label})`;
}
