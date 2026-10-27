import {
  generateOsmMap,
  mapImageSize,
  type OsmFocus,
  type OsmPlace,
} from 'engine';
import {
  addTileFeatures,
  emptyFeatures,
  lonLatToImage,
  type Projection,
} from './osmFeatures';
import regionsUrl from './regions.json?url';
import { tileCover } from './tileCover';
import {
  TILEJSON_URL,
  type WorldFocus,
  type WorldMapReply,
  type WorldMapRequest,
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
const FOCUS_LEVELS: Record<string, number> = {
  country: 100,
  state: 90,
  city: 70,
};

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

function osmFocus(
  focus: WorldFocus | null,
  regions: Regions,
  projection: Projection,
): OsmFocus | null {
  const level = focus ? FOCUS_LEVELS[focus.kind] : undefined;
  if (!focus || !level) return null;
  const rings = (regions.outlines[focus.id] ?? []).map((ring) => {
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
  return { rings, name: focus.name, x, y, level, minArea };
}

function seedOf(request: WorldMapRequest): string {
  const { x0, y0, ux, uy, vx, vy } = request.frame;
  return [x0, y0, ux, uy, vx, vy].map((v) => v.toFixed(7)).join(':');
}

self.addEventListener('message', (event: MessageEvent<WorldMapRequest>) => {
  const request = event.data;
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
        const features = emptyFeatures();
        buffers.forEach((buffer, i) =>
          addTileFeatures(
            features,
            buffer,
            tiles[i][0],
            tiles[i][1],
            projection,
          ),
        );
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
          focus: osmFocus(request.focus, regions, projection),
          features,
        });
        reply({ type: 'done', map });
      }),
    )
    .catch((error: unknown) =>
      reply({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
});
