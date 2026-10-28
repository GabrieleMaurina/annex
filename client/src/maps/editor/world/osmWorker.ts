import {
  generateOsmMap,
  mapImageSize,
  osmAreaMask,
  osmPlaceMask,
  type OsmFocus,
  type OsmPlace,
} from 'engine';
import { traceOuterLoops } from '../../../game/regions/traceRegions';
import {
  addTileFeatures,
  emptyFeatures,
  lonLatToImage,
  type Projection,
} from './osmFeatures';
import regionsUrl from './regions.json?url';
import {
  budgetCover,
  mercatorY,
  tileCover,
  type WorldFrame,
} from './tileCover';
import {
  TILEJSON_URL,
  type CityLimitsRequest,
  type WorldFocus,
  type WorldMapReply,
  type WorldMapRequest,
  type WorldWorkerRequest,
} from './worldTypes';

interface Regions {
  outlines: Record<string, number[][]>;
  counties: [string, number, number][];
}

const PARALLEL_DOWNLOADS = 4;
const BIG_CITY_POPULATION = 100000;
const RETRIES = 1;
const EARTH_CIRCUMFERENCE_KM = 40075;
const CITY_MAX_DENSITY = 40000;
const LIMITS_ATTEMPTS = [
  { scale: 2, approximate: false },
  { scale: 4, approximate: false },
  { scale: 2, approximate: true },
];
const LIMITS_TOLERANCE = 1;
const LIMITS_IMAGE = 1024;
const LIMITS_MAX_ZOOM = 12;
const LIMITS_TILE_BUDGET = 25;
const FOCUS_LEVELS: Record<string, number> = {
  country: 100,
  state: 90,
  city: 70,
  area: 70,
};
const EXACT_KINDS = ['city', 'area'];

function reply(message: WorldMapReply): void {
  self.postMessage(message);
}

function fetchBuffer(url: string, retries: number): Promise<ArrayBuffer> {
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .catch((error) => {
      if (retries > 0) return fetchBuffer(url, retries - 1);
      throw error;
    });
}

function tileTemplate(): Promise<string> {
  return fetch(TILEJSON_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((tilejson: { tiles: string[] }) => tilejson.tiles[0]);
}

function loadRegions(): Promise<Regions> {
  return fetch(regionsUrl).then((res) => res.json());
}

function downloadTiles(
  template: string,
  zoom: number,
  tiles: [number, number][],
): Promise<ArrayBuffer[]> {
  const n = 2 ** zoom;
  const buffers: ArrayBuffer[] = new Array(tiles.length);
  let next = 0;
  let done = 0;
  const work = (): Promise<void> => {
    if (next >= tiles.length) return Promise.resolve();
    const index = next++;
    const [x, y] = tiles[index];
    const url = template
      .replace('{z}', String(zoom))
      .replace('{x}', String(((x % n) + n) % n))
      .replace('{y}', String(y));
    return fetchBuffer(url, RETRIES).then((buffer) => {
      buffers[index] = buffer;
      done++;
      reply({ type: 'progress', stage: 'download', done, total: tiles.length });
      return work();
    });
  };
  return Promise.all(
    Array.from({ length: PARALLEL_DOWNLOADS }, () => work()),
  ).then(() => buffers);
}

function countyPlaces(regions: Regions, projection: Projection): OsmPlace[] {
  const places: OsmPlace[] = [];
  for (const [name, lon, lat] of regions.counties) {
    const [x, y] = lonLatToImage(projection, lon, lat);
    if (x < 0 || y < 0 || x >= projection.imageWidth) continue;
    if (y >= projection.imageHeight) continue;
    places.push({
      layer: 'admin2',
      cls: 'county',
      name,
      rank: 0,
      capital: 0,
      x,
      y,
    });
  }
  return places;
}

function cityPlaces(
  cities: WorldMapRequest['cities'],
  projection: Projection,
): OsmPlace[] {
  return cities.map(([name, lon, lat, population]) => {
    const [x, y] = lonLatToImage(projection, lon, lat);
    return {
      layer: 'place',
      cls: population >= BIG_CITY_POPULATION ? 'city' : 'town',
      name,
      rank: Math.round(40 - Math.log2(Math.max(2, population))),
      capital: 0,
      x,
      y,
    };
  });
}

function osmFocus(focus: WorldFocus, projection: Projection): OsmFocus | null {
  const level = FOCUS_LEVELS[focus.kind];
  if (!level) return null;
  const rings = focus.rings.map((ring) => {
    const points: number[] = [];
    for (let i = 0; i + 1 < ring.length; i += 2)
      points.push(...lonLatToImage(projection, ring[i], ring[i + 1]));
    return points;
  });
  const [x, y] = lonLatToImage(projection, focus.lon, focus.lat);
  const { ux, uy } = projection.frame;
  const kmPerPixel =
    (Math.hypot(ux, uy) *
      EARTH_CIRCUMFERENCE_KM *
      Math.cos((focus.lat * Math.PI) / 180)) /
    projection.imageWidth;
  const minArea = focus.population / CITY_MAX_DENSITY / kmPerPixel ** 2;
  return {
    rings,
    exact: EXACT_KINDS.includes(focus.kind) && rings.length > 0,
    name: focus.name,
    x,
    y,
    level,
    minArea,
  };
}

function seedOf(request: WorldMapRequest): string {
  const { x0, y0, ux, uy, vx, vy } = request.frame;
  return [x0, y0, ux, uy, vx, vy].map((v) => v.toFixed(7)).join(':');
}

function decodeTiles(
  buffers: ArrayBuffer[],
  tiles: [number, number][],
  projection: Projection,
) {
  const features = emptyFeatures();
  buffers.forEach((buffer, i) =>
    addTileFeatures(features, buffer, tiles[i][0], tiles[i][1], projection),
  );
  return features;
}

function fail(error: unknown): void {
  reply({
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
  });
}

function limitsFrame(
  [w, s, e, n]: CityLimitsRequest['bounds'],
  scale: number,
): WorldFrame {
  const x = ((w + e) / 2 + 180) / 360;
  const y = (mercatorY(s) + mercatorY(n)) / 2;
  const half =
    (Math.max((e - w) / 360, mercatorY(s) - mercatorY(n)) * scale) / 2;
  return {
    x0: x - half,
    y0: y - half,
    ux: 2 * half,
    uy: 0,
    vx: 0,
    vy: 2 * half,
  };
}

function imageToLonLat(
  { frame, imageWidth, imageHeight }: Projection,
  px: number,
  py: number,
): [number, number] {
  const u = px / imageWidth;
  const v = py / imageHeight;
  const x = frame.x0 + u * frame.ux + v * frame.vx;
  const y = frame.y0 + u * frame.uy + v * frame.vy;
  return [
    x * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
  ];
}

function simplifyLoop(loop: number[]): number[] {
  const count = loop.length / 2;
  const at = (i: number) => (i % count) * 2;
  const keep = new Uint8Array(count);
  keep[0] = 1;
  const stack: [number, number][] = [[0, count]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const ax = loop[at(first)];
    const ay = loop[at(first) + 1];
    const bx = loop[at(last)];
    const by = loop[at(last) + 1];
    const length = Math.hypot(bx - ax, by - ay);
    let farthest = -1;
    let distance = LIMITS_TOLERANCE;
    for (let i = first + 1; i < last; i++) {
      const px = loop[at(i)];
      const py = loop[at(i) + 1];
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
  return loop.filter((_, i) => keep[Math.floor(i / 2)]);
}

function limitRings(mask: Uint8Array, projection: Projection): number[][] {
  const labels = Int16Array.from(mask, (inside) => (inside ? 0 : -1));
  return traceOuterLoops(labels, LIMITS_IMAGE, LIMITS_IMAGE).map((loop) => {
    const simple = simplifyLoop(loop);
    const ring: number[] = [];
    for (let i = 0; i < simple.length; i += 2)
      ring.push(...imageToLonLat(projection, simple[i], simple[i + 1]));
    return ring;
  });
}

function limitsAt(
  request: CityLimitsRequest,
  template: string,
  { scale, approximate }: (typeof LIMITS_ATTEMPTS)[number],
): Promise<number[][]> {
  const frame = limitsFrame(request.bounds, scale);
  const { zoom, tiles } = budgetCover(
    frame,
    LIMITS_MAX_ZOOM,
    LIMITS_TILE_BUDGET,
  );
  const projection: Projection = {
    zoom,
    frame,
    imageWidth: LIMITS_IMAGE,
    imageHeight: LIMITS_IMAGE,
  };
  return downloadTiles(template, zoom, tiles).then((buffers) => {
    const features = decodeTiles(buffers, tiles, projection);
    const focus = osmFocus(
      {
        kind: 'city',
        name: request.name,
        lon: request.lon,
        lat: request.lat,
        population: request.population,
        rings: [],
      },
      projection,
    );
    const area = { width: LIMITS_IMAGE, height: LIMITS_IMAGE, features };
    const mask =
      focus &&
      (approximate
        ? osmAreaMask({
            ...area,
            focus,
            zoom,
            radius: LIMITS_IMAGE / (2 * scale),
          })
        : osmPlaceMask({ ...area, focus }));
    return mask ? limitRings(mask, projection) : [];
  });
}

function traceLimits(request: CityLimitsRequest): void {
  tileTemplate()
    .then((template) =>
      LIMITS_ATTEMPTS.reduce<Promise<number[][]>>(
        (found, attempt) =>
          found.then((rings) =>
            rings.length > 0 ? rings : limitsAt(request, template, attempt),
          ),
        Promise.resolve([]),
      ),
    )
    .then((rings) => reply({ type: 'limits', rings }))
    .catch(fail);
}

function buildMap(request: WorldMapRequest): void {
  const { zoom, tiles } = tileCover(
    request.frame,
    request.size,
    request.aspect,
  );
  const image = mapImageSize(request.size, request.aspect);
  const projection: Projection = {
    zoom,
    frame: request.frame,
    imageWidth: image.width,
    imageHeight: image.height,
  };
  reply({ type: 'progress', stage: 'download', done: 0, total: tiles.length });
  Promise.all([tileTemplate(), loadRegions()])
    .then(([template, regions]) =>
      downloadTiles(template, zoom, tiles).then((buffers) => {
        reply({ type: 'progress', stage: 'build', done: 0, total: 1 });
        const features = decodeTiles(buffers, tiles, projection);
        features.places.push(
          ...countyPlaces(regions, projection),
          ...cityPlaces(request.cities, projection),
        );
        const map = generateOsmMap({
          seed: seedOf(request),
          size: request.size,
          detail: request.detail,
          seas: request.seas,
          timed: request.timed,
          name: request.name,
          zoom,
          aspect: request.aspect,
          focus: request.focus
            .filter((one) => one.kind !== 'city' || one.rings.length > 0)
            .map((one) => osmFocus(one, projection))
            .filter((one): one is OsmFocus => one !== null),
          features,
        });
        reply({ type: 'done', map });
      }),
    )
    .catch(fail);
}

self.addEventListener('message', (event: MessageEvent<WorldWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'limits') traceLimits(request);
  else buildMap(request);
});
