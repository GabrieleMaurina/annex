import type { OsmDetail } from 'engine';
import {
  GameSettings,
  MAP_ASPECTS,
  MAP_SIZES,
  preferencesSchemaProperties,
  sanitizeGameSettings,
} from './preferences';

export const PRESET_COUNT = 5;
const MAX_PRESET_NAME_LENGTH = 30;
const MAX_EARTH_FOCUS = 20;
const MAX_EARTH_RECIPE_LENGTH = 200_000;
const OSM_DETAILS: OsmDetail[] = [
  'auto',
  'countries',
  'states',
  'counties',
  'municipalities',
  'districts',
  'neighbourhoods',
  'blocks',
];
const FRAME_KEYS = ['x0', 'y0', 'ux', 'uy', 'vx', 'vy'] as const;
const EARTH_FLAGS = ['seas', 'timed', 'mountains', 'rivers'] as const;

export type PresetSettings = Omit<GameSettings, 'localPlayers'>;

export interface EarthFocus {
  kind: string;
  name: string;
  lon: number;
  lat: number;
  population: number;
  rings: number[][];
}

export interface EarthRecipe {
  frame: Record<(typeof FRAME_KEYS)[number], number>;
  size: string;
  aspect: string;
  detail: string;
  seas: boolean;
  timed: boolean;
  directional: boolean;
  switched: boolean;
  mountains: boolean;
  rivers: boolean;
  greenAreas: boolean;
  name: string;
  focus: EarthFocus[];
}

export interface Preset {
  name: string;
  settings: PresetSettings;
  earth: EarthRecipe | null;
}

export const DEFAULT_PRESETS: (Preset | null)[] = Array.from(
  { length: PRESET_COUNT },
  () => null,
);

const gameSettingsSchema = preferencesSchemaProperties.gameSettings;

export const earthSchema = {
  bsonType: ['object', 'null'],
  required: [
    'frame',
    'size',
    'aspect',
    'detail',
    ...EARTH_FLAGS,
    'name',
    'focus',
  ],
  additionalProperties: false,
  properties: {
    frame: {
      bsonType: 'object',
      required: [...FRAME_KEYS],
      additionalProperties: false,
      properties: Object.fromEntries(
        FRAME_KEYS.map((key) => [key, { bsonType: 'number' }]),
      ),
    },
    size: { enum: MAP_SIZES },
    aspect: { enum: MAP_ASPECTS },
    detail: { enum: OSM_DETAILS },
    ...Object.fromEntries(
      EARTH_FLAGS.map((key) => [key, { bsonType: 'bool' }]),
    ),
    directional: { bsonType: 'bool' },
    switched: { bsonType: 'bool' },
    greenAreas: { bsonType: 'bool' },
    name: { bsonType: 'string' },
    focus: {
      bsonType: 'array',
      maxItems: MAX_EARTH_FOCUS,
      items: {
        bsonType: 'object',
        required: ['kind', 'name', 'lon', 'lat', 'population', 'rings'],
        additionalProperties: false,
        properties: {
          kind: { bsonType: 'string' },
          name: { bsonType: 'string' },
          lon: { bsonType: 'number' },
          lat: { bsonType: 'number' },
          population: { bsonType: 'number' },
          rings: {
            bsonType: 'array',
            items: { bsonType: 'array', items: { bsonType: 'number' } },
          },
        },
      },
    },
  },
};

export const presetsSchemaProperties = {
  presets: {
    bsonType: 'array',
    minItems: PRESET_COUNT,
    maxItems: PRESET_COUNT,
    items: {
      bsonType: ['object', 'null'],
      required: ['name', 'settings', 'earth'],
      additionalProperties: false,
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: MAX_PRESET_NAME_LENGTH,
        },
        settings: {
          ...gameSettingsSchema,
          required: gameSettingsSchema.required.filter(
            (key) => key !== 'localPlayers',
          ),
          properties: Object.fromEntries(
            Object.entries(gameSettingsSchema.properties).filter(
              ([key]) => key !== 'localPlayers',
            ),
          ),
        },
        earth: earthSchema,
      },
    },
  },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeRings(raw: unknown): number[][] | null {
  if (!Array.isArray(raw)) return null;
  if (!raw.every((ring) => Array.isArray(ring) && ring.every(isFiniteNumber)))
    return null;
  return raw as number[][];
}

function sanitizeFocus(raw: unknown): EarthFocus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rings = sanitizeRings(r.rings);
  if (
    typeof r.kind !== 'string' ||
    typeof r.name !== 'string' ||
    !isFiniteNumber(r.lon) ||
    !isFiniteNumber(r.lat) ||
    !isFiniteNumber(r.population) ||
    !rings
  )
    return null;
  return {
    kind: r.kind,
    name: r.name,
    lon: r.lon,
    lat: r.lat,
    population: r.population,
    rings,
  };
}

export function sanitizeEarth(raw: unknown): EarthRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  if (JSON.stringify(raw).length > MAX_EARTH_RECIPE_LENGTH) return null;
  const r = raw as Record<string, unknown>;
  const frame = (r.frame ?? {}) as Record<string, unknown>;
  if (
    !FRAME_KEYS.every((key) => isFiniteNumber(frame[key])) ||
    !MAP_SIZES.includes(r.size as string) ||
    !MAP_ASPECTS.includes(r.aspect as string) ||
    !OSM_DETAILS.includes(r.detail as OsmDetail) ||
    !EARTH_FLAGS.every((key) => typeof r[key] === 'boolean') ||
    typeof r.name !== 'string' ||
    !Array.isArray(r.focus) ||
    r.focus.length > MAX_EARTH_FOCUS
  )
    return null;
  const focus = r.focus.map(sanitizeFocus);
  if (focus.some((one) => !one)) return null;
  return {
    frame: Object.fromEntries(
      FRAME_KEYS.map((key) => [key, frame[key]]),
    ) as EarthRecipe['frame'],
    size: r.size as string,
    aspect: r.aspect as string,
    detail: r.detail as string,
    seas: r.seas as boolean,
    timed: r.timed as boolean,
    directional: r.directional === true,
    switched:
      r.switched === true && (r.timed === true || r.directional === true),
    mountains: r.mountains as boolean,
    rivers: r.rivers as boolean,
    greenAreas: r.greenAreas !== false,
    name: r.name,
    focus: focus as EarthFocus[],
  };
}

function sanitizePreset(raw: unknown, index: number): Preset | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name =
    typeof r.name === 'string'
      ? r.name.trim().slice(0, MAX_PRESET_NAME_LENGTH)
      : '';
  const { localPlayers, ...settings } = sanitizeGameSettings(r.settings);
  void localPlayers;
  return {
    name: name || `Preset ${index + 1}`,
    settings,
    earth: sanitizeEarth(r.earth),
  };
}

export function sanitizePresets(raw: unknown): (Preset | null)[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PRESET_COUNT }, (_, index) =>
    sanitizePreset(list[index], index),
  );
}
