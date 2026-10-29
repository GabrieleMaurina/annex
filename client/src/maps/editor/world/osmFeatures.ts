import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { OSM_LOCAL_ZOOM, type OsmFeatures } from 'engine';
import Pbf from 'pbf';
import { mercatorY, type WorldFrame } from './tileCover';

export interface Projection {
  zoom: number;
  frame: WorldFrame;
  imageWidth: number;
  imageHeight: number;
}

type Properties = VectorTileFeature['properties'];

const LINE_LAYERS = ['boundary', 'waterway', 'transportation'];
const MOUNTAIN_CLASSES = ['rock', 'ice'];
const GREEN_CLASSES = ['wood', 'grass', 'farmland', 'wetland'];
const PLACE_LAYERS: [string, string][] = [
  ['place', 'place'],
  ['peak', 'mountain_peak'],
  ['water', 'water_name'],
];

function nameOf(properties: Properties): string {
  for (const key of ['name:en', 'name:latin', 'name_int', 'name']) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function text(properties: Properties, key: string): string {
  const value = properties[key];
  return typeof value === 'string' ? value : '';
}

function number(properties: Properties, key: string, fallback: number) {
  const value = Number(properties[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function toImage(
  projection: Projection,
  mx: number,
  my: number,
): [number, number] {
  const { x0, y0, ux, uy, vx, vy } = projection.frame;
  const det = ux * vy - vx * uy;
  const dx = mx - x0;
  const dy = my - y0;
  return [
    ((dx * vy - dy * vx) / det) * projection.imageWidth,
    ((ux * dy - uy * dx) / det) * projection.imageHeight,
  ];
}

export function lonLatToImage(
  projection: Projection,
  lon: number,
  lat: number,
): [number, number] {
  const { x0, ux, vx } = projection.frame;
  const center = x0 + (ux + vx) / 2;
  const x = (lon + 180) / 360;
  return toImage(projection, x + Math.round(center - x), mercatorY(lat));
}

export function emptyFeatures(): OsmFeatures {
  return { water: [], landcover: [], lines: [], places: [] };
}

export function addTileFeatures(
  features: OsmFeatures,
  data: ArrayBuffer,
  tileX: number,
  tileY: number,
  projection: Projection,
): void {
  const n = 2 ** projection.zoom;
  const tile = new VectorTile(new Pbf(new Uint8Array(data)));
  const flatten = (ring: { x: number; y: number }[], extent: number) => {
    const points: number[] = [];
    for (const p of ring)
      points.push(
        ...toImage(
          projection,
          (tileX + p.x / extent) / n,
          (tileY + p.y / extent) / n,
        ),
      );
    return points;
  };
  const each = (
    name: string,
    visit: (feature: VectorTileFeature, extent: number) => void,
  ) => {
    const layer = tile.layers[name];
    if (!layer) return;
    for (let i = 0; i < layer.length; i++)
      visit(layer.feature(i), layer.extent);
  };

  each('water', (feature, extent) =>
    features.water.push({
      cls: text(feature.properties, 'class'),
      rings: feature.loadGeometry().map((ring) => flatten(ring, extent)),
    }),
  );

  const landcoverClasses =
    projection.zoom >= OSM_LOCAL_ZOOM
      ? [...MOUNTAIN_CLASSES, ...GREEN_CLASSES]
      : MOUNTAIN_CLASSES;
  each('landcover', (feature, extent) => {
    const cls = text(feature.properties, 'class');
    if (landcoverClasses.includes(cls))
      features.landcover.push({
        cls,
        rings: feature.loadGeometry().map((ring) => flatten(ring, extent)),
      });
  });

  const lineLayers =
    projection.zoom >= OSM_LOCAL_ZOOM ? LINE_LAYERS : ['boundary', 'waterway'];
  for (const layer of lineLayers)
    each(layer, (feature, extent) => {
      const p = feature.properties;
      for (const part of feature.loadGeometry())
        features.lines.push({
          layer,
          cls: text(p, 'class'),
          adminLevel: number(p, 'admin_level', 0),
          name: nameOf(p),
          points: flatten(part, extent),
        });
    });

  for (const [layer, source] of PLACE_LAYERS)
    each(source, (feature, extent) => {
      const p = feature.properties;
      const name = nameOf(p);
      const point = feature.loadGeometry()[0]?.[0];
      if (!name || !point) return;
      const [x, y] = flatten([point], extent);
      features.places.push({
        layer,
        cls: text(p, 'class'),
        name,
        rank: number(p, 'rank', 99),
        capital: number(p, 'capital', 0),
        x,
        y,
      });
    });
}
