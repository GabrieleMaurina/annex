const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WORLD = path.join(__dirname, '../client/src/maps/editor/world');
const GAZETTEER_OUT = path.join(WORLD, 'gazetteer.json');
const REGIONS_OUT = path.join(WORLD, 'regions.json');
const UA = 'AnnexGame-gazetteer/1.0 (+https://www.annexgame.com)';
const NE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const GEONAMES = 'https://download.geonames.org/export/dump/';

const KINDS = ['country', 'state', 'city', 'lake', 'sea', 'region'];
const MIN_PART_SHARE = 0.005;
const BIG_PART_SHARE = 0.25;
const REACH_RATIO = 0.5;
const GAP_SAMPLES = 400;
const BLOCKER_SAMPLES = 2000;
const CROSSING_SAMPLES = 16;
const KM_PER_DEGREE = 111.32;
const CLASS_LABELS = {
  'Range/mtn': 'Mountain range',
  'Pen/cape': 'Peninsula',
  Geoarea: 'Region',
  generic: 'Sea',
};
const SKIPPED_CLASSES = new Set(['Dragons-be-here']);
const COUNTRY_TOLERANCE = 0.08;
const STATE_TOLERANCE = 0.04;
const MIN_PART_KM2 = 200;
const CITY_ABBREVIATION = /^[A-Z]{2,5}$/;
const POSTAL_COUNTRIES = new Set(['US', 'CA', 'AU']);
const COUNTY_COUNTRY = 'US';

function download(url) {
  return fetch(url, { headers: { 'User-Agent': UA } })
    .then((res) => {
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((data) => Buffer.from(data));
}

function readJson(data) {
  return JSON.parse(data.toString('utf8'));
}

function unzipEntry(zip, name) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let entry = zip.readUInt32LE(eocd + 16);
  for (let n = zip.readUInt16LE(eocd + 10); n > 0; n--) {
    const nameLength = zip.readUInt16LE(entry + 28);
    const entryName = zip.toString('utf8', entry + 46, entry + 46 + nameLength);
    if (entryName === name) {
      const method = zip.readUInt16LE(entry + 10);
      const compressedSize = zip.readUInt32LE(entry + 20);
      const local = zip.readUInt32LE(entry + 42);
      const start =
        local +
        30 +
        zip.readUInt16LE(local + 26) +
        zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + compressedSize);
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    }
    entry +=
      46 +
      nameLength +
      zip.readUInt16LE(entry + 30) +
      zip.readUInt16LE(entry + 32);
  }
  throw new Error(`${name} not found`);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringBox(ring) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of ring) {
    box[0] = Math.min(box[0], lon);
    box[1] = Math.min(box[1], lat);
    box[2] = Math.max(box[2], lon);
    box[3] = Math.max(box[3], lat);
  }
  return box;
}

function ringAreaKm2(ring) {
  const project = ([lon, lat]) => [lon * Math.cos((lat * Math.PI) / 180), lat];
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = project(ring[i]);
    const [x1, y1] = project(ring[i + 1]);
    sum += x0 * y1 - x1 * y0;
  }
  return (Math.abs(sum) / 2) * KM_PER_DEGREE * KM_PER_DEGREE;
}

function boxAreaKm2([west, south, east, north]) {
  const midLat = (((south + north) / 2) * Math.PI) / 180;
  return (
    (east - west) * Math.cos(midLat) * (north - south) * KM_PER_DEGREE ** 2
  );
}

function classLabel(featurecla) {
  const label = CLASS_LABELS[featurecla] ?? featurecla ?? '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function sampled(ring, count) {
  const step = Math.max(1, Math.floor(ring.length / count));
  return ring.filter((_, i) => i % step === 0);
}

function distanceKm([lon0, lat0], [lon1, lat1]) {
  const scale = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  return Math.hypot((lon1 - lon0) * scale, lat1 - lat0) * KM_PER_DEGREE;
}

function closestPoints(a, b) {
  let best = { km: Infinity, from: null, to: null };
  for (const from of a)
    for (const to of b) {
      const km = distanceKm(from, to);
      if (km < best.km) best = { km, from, to };
    }
  return best;
}

function insideRing(ring, [lon, lat]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}

function crossesLand(from, to, blockers) {
  for (let k = 1; k < CROSSING_SAMPLES; k++) {
    const t = k / CROSSING_SAMPLES;
    const point = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
    ];
    const hit = blockers.some(
      ({ box, ring }) =>
        point[0] >= box[0] &&
        point[0] <= box[2] &&
        point[1] >= box[1] &&
        point[1] <= box[3] &&
        insideRing(ring, point),
    );
    if (hit) return true;
  }
  return false;
}

function mainBox(geometry, blockers = []) {
  const parts = polygonsOf(geometry)
    .map((polygon) => ({
      box: ringBox(polygon[0]),
      area: ringAreaKm2(polygon[0]),
      points: sampled(polygon[0], GAP_SAMPLES),
    }))
    .sort((a, b) => b.area - a.area);
  if (parts.length === 0) return null;
  const total = parts.reduce((sum, p) => sum + p.area, 0);
  const reach = Math.sqrt(parts[0].area) * REACH_RATIO;
  const included = parts.filter(
    (part, i) => i === 0 || part.area >= total * BIG_PART_SHARE,
  );
  let pending = parts.filter(
    (part) => !included.includes(part) && part.area >= total * MIN_PART_SHARE,
  );
  for (let grew = true; grew;) {
    grew = false;
    for (const part of pending) {
      const reachable = included.some((other) => {
        const gap = closestPoints(part.points, other.points);
        return gap.km <= reach && !crossesLand(gap.from, gap.to, blockers);
      });
      if (!reachable) continue;
      included.push(part);
      grew = true;
    }
    pending = pending.filter((part) => !included.includes(part));
  }
  const box = [
    Math.min(...included.map((part) => part.box[0])),
    Math.min(...included.map((part) => part.box[1])),
    Math.max(...included.map((part) => part.box[2])),
    Math.max(...included.map((part) => part.box[3])),
  ];
  return {
    box: box[2] - box[0] > 180 ? parts[0].box : box,
    area: total,
  };
}

function cityBox(lon, lat, population) {
  const radiusKm = Math.min(40, Math.max(3, 0.012 * Math.sqrt(population)));
  const dLat = radiusKm / KM_PER_DEGREE;
  const dLon = dLat / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function simplify(ring, tolerance) {
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    const [ax, ay] = ring[first];
    const [bx, by] = ring[last];
    const length = Math.hypot(bx - ax, by - ay);
    let farthest = -1;
    let distance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = ring[i];
      const d =
        length > 0
          ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
          : Math.hypot(px - ax, py - ay);
      if (d > distance) {
        distance = d;
        farthest = i;
      }
    }
    if (farthest < 0) continue;
    keep[farthest] = 1;
    stack.push([first, farthest], [farthest, last]);
  }
  return ring.filter((_, i) => keep[i]);
}

function outline(geometry, tolerance) {
  const rings = polygonsOf(geometry).flat();
  return rings
    .filter((ring) => ringAreaKm2(ring) >= MIN_PART_KM2)
    .map((ring) => simplify(ring, tolerance))
    .filter((ring) => ring.length >= 4)
    .map((ring) => ring.flatMap(([lon, lat]) => [round(lon), round(lat)]));
}

function aliasesOf(name, candidates) {
  const seen = new Set([name.toLowerCase()]);
  const aliases = [];
  for (const raw of candidates) {
    const alias = typeof raw === 'string' ? raw.trim() : '';
    if (!alias || alias === '-99' || seen.has(alias.toLowerCase())) continue;
    seen.add(alias.toLowerCase());
    aliases.push(alias);
  }
  return aliases;
}

function countyPoints(zip) {
  const text = unzipEntry(zip, `${COUNTY_COUNTRY}.txt`);
  const counties = [];
  for (
    let at = text.indexOf('\tADM2\t');
    at >= 0;
    at = text.indexOf('\tADM2\t', at + 1)
  ) {
    const start = text.lastIndexOf('\n', at) + 1;
    const end = text.indexOf('\n', at);
    const cols = text.slice(start, end < 0 ? undefined : end).split('\t');
    if (cols[7] !== 'ADM2') continue;
    counties.push([cols[1], round(Number(cols[5])), round(Number(cols[4]))]);
  }
  return counties;
}

function buildGazetteer(files) {
  const contexts = [];
  const contextIndex = new Map();
  const contextOf = (text) => {
    if (!text) return -1;
    if (!contextIndex.has(text)) {
      contextIndex.set(text, contexts.length);
      contexts.push(text);
    }
    return contextIndex.get(text);
  };
  const places = [];
  const aliases = [];
  const outlines = {};
  const add = (name, kind, context, box, rank) => {
    if (!name || !box) return -1;
    places.push([
      name,
      KINDS.indexOf(kind),
      contextOf(context),
      ...box.map(round),
      Math.round(rank),
    ]);
    return places.length - 1;
  };
  const describe = (index, names, geometry, tolerance) => {
    if (index < 0) return;
    if (names.length > 0) aliases.push([index, names.join('|')]);
    const rings = outline(geometry, tolerance);
    if (rings.length > 0) outlines[index] = rings;
  };

  const countries = readJson(files.countries).features;
  const countryRings = countries.flatMap((f, owner) =>
    polygonsOf(f.geometry).map((polygon) => ({
      owner,
      box: ringBox(polygon[0]),
      ring: sampled(polygon[0], BLOCKER_SAMPLES),
    })),
  );
  for (const [owner, f] of countries.entries()) {
    const shape = mainBox(
      f.geometry,
      countryRings.filter((ring) => ring.owner !== owner),
    );
    const p = f.properties;
    const name = p.NAME_EN || p.NAME;
    if (!shape || !name) continue;
    const index = add(name, 'country', '', shape.box, shape.area);
    describe(
      index,
      aliasesOf(name, [
        p.ISO_A3,
        p.ISO_A2,
        p.ADM0_A3,
        String(p.ABBREV ?? '').replace(/[.\s]/g, ''),
        p.NAME,
        p.NAME_LONG,
        p.FORMAL_EN,
        p.NAME_SORT,
      ]),
      f.geometry,
      COUNTRY_TOLERANCE,
    );
  }
  const stateKeys = new Set();
  for (const f of readJson(files.states).features) {
    const shape = mainBox(f.geometry);
    const p = f.properties;
    for (const name of [p.name, p.name_en, p.gn_name, p.woe_name])
      if (name) stateKeys.add(`${p.iso_a2}|${name.toLowerCase()}`);
    const name = p.name_en || p.name;
    if (!shape || !name) continue;
    const index = add(name, 'state', p.admin, shape.box, shape.area);
    describe(
      index,
      aliasesOf(name, [p.name, POSTAL_COUNTRIES.has(p.iso_a2) ? p.postal : '']),
      f.geometry,
      STATE_TOLERANCE,
    );
  }
  for (const f of readJson(files.lakes).features) {
    const shape = mainBox(f.geometry);
    const p = f.properties;
    if (shape) add(p.name_en || p.name, 'lake', '', shape.box, shape.area);
  }
  for (const f of readJson(files.marine).features) {
    const shape = mainBox(f.geometry);
    const p = f.properties;
    if (shape)
      add(p.name, 'sea', classLabel(p.featurecla), shape.box, shape.area);
  }
  for (const f of readJson(files.regions).features) {
    const shape = mainBox(f.geometry);
    const p = f.properties;
    if (shape && !SKIPPED_CLASSES.has(p.FEATURECLA))
      add(
        p.NAME_EN || p.NAME,
        'region',
        classLabel(p.FEATURECLA),
        shape.box,
        shape.area,
      );
  }

  const countryNames = new Map();
  for (const line of files.countryInfo.toString('utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    countryNames.set(cols[0], cols[4]);
  }
  const admin1Names = new Map();
  for (const line of files.admin1.toString('utf8').split('\n')) {
    const cols = line.split('\t');
    if (cols.length > 1) admin1Names.set(cols[0], cols[1]);
  }
  const admin1Boxes = new Map();
  for (const line of unzipEntry(files.cities, 'cities15000.txt').split('\n')) {
    const cols = line.split('\t');
    if (cols.length < 15) continue;
    const lat = Number(cols[4]);
    const lon = Number(cols[5]);
    const population = Number(cols[14]);
    const admin1 = `${cols[8]}.${cols[10]}`;
    const context = [admin1Names.get(admin1), countryNames.get(cols[8])]
      .filter(Boolean)
      .join(', ');
    const box = cityBox(lon, lat, population);
    const index = add(cols[1], 'city', context, box, population);
    const abbreviations = aliasesOf(
      cols[1],
      cols[3].split(',').filter((alias) => CITY_ABBREVIATION.test(alias)),
    );
    if (index >= 0 && abbreviations.length > 0)
      aliases.push([index, abbreviations.join('|')]);
    const union = admin1Boxes.get(admin1);
    admin1Boxes.set(
      admin1,
      union
        ? [
            Math.min(union[0], box[0]),
            Math.min(union[1], box[1]),
            Math.max(union[2], box[2]),
            Math.max(union[3], box[3]),
          ]
        : box,
    );
  }
  for (const [admin1, box] of admin1Boxes) {
    const name = admin1Names.get(admin1);
    const country = admin1.split('.')[0];
    if (!name || stateKeys.has(`${country}|${name.toLowerCase()}`)) continue;
    if (box[2] - box[0] > 180) continue;
    add(name, 'state', countryNames.get(country), box, boxAreaKm2(box));
  }

  return {
    gazetteer: { kinds: KINDS, contexts, places, aliases },
    regions: { outlines, counties: countyPoints(files.counties) },
  };
}

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  const raw = fs.statSync(file).size;
  const gzip = zlib.gzipSync(fs.readFileSync(file)).length;
  console.log(
    `${(raw / 1e6).toFixed(2)} MB raw, ${(gzip / 1e6).toFixed(2)} MB gzip -> ${file}`,
  );
}

const sources = {
  countries: NE + 'ne_10m_admin_0_countries.geojson',
  states: NE + 'ne_10m_admin_1_states_provinces.geojson',
  lakes: NE + 'ne_10m_lakes.geojson',
  marine: NE + 'ne_10m_geography_marine_polys.geojson',
  regions: NE + 'ne_10m_geography_regions_polys.geojson',
  countryInfo: GEONAMES + 'countryInfo.txt',
  admin1: GEONAMES + 'admin1CodesASCII.txt',
  cities: GEONAMES + 'cities15000.zip',
  counties: GEONAMES + `${COUNTY_COUNTRY}.zip`,
};

Object.entries(sources)
  .reduce(
    (chain, [key, url]) =>
      chain.then((files) => {
        console.log(`downloading ${url}`);
        return download(url).then((data) => ({ ...files, [key]: data }));
      }),
    Promise.resolve({}),
  )
  .then((files) => {
    const { gazetteer, regions } = buildGazetteer(files);
    console.log(
      `${gazetteer.places.length} places, ${gazetteer.aliases.length} with aliases, ${Object.keys(regions.outlines).length} outlines, ${regions.counties.length} counties`,
    );
    write(GAZETTEER_OUT, gazetteer);
    write(REGIONS_OUT, regions);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
