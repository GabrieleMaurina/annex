import {
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  MAP_SIZE_VALUES,
  MAX_TIMED_VALUE,
} from 'engine';
import { BORDER_COLOR_PATTERN, MAX_BORDER_COLORS } from '../../validate';

const MAX_NAME_LENGTH = 40;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TIMED_DELAY = {
  bsonType: 'number',
  minimum: 0,
  maximum: MAX_TIMED_VALUE,
};
const TIMED_PERIOD = { ...TIMED_DELAY, minimum: 1 };

export const MAP_REQUIRED = [
  'name',
  'territories',
  'seaTerritories',
  'bonuses',
  'wraps',
  'timedConnections',
  'generation',
  'image',
  'imageMime',
  'borderColors',
];

export const MAP_PROPERTIES = {
  name: { bsonType: 'string', minLength: 1, maxLength: MAX_NAME_LENGTH },
  territories: {
    bsonType: 'array',
    items: {
      bsonType: 'object',
      required: ['id', 'continentId', 'x', 'y', 'neighbors'],
      additionalProperties: false,
      properties: {
        id: { bsonType: 'number' },
        continentId: { bsonType: 'number' },
        x: { bsonType: 'number' },
        y: { bsonType: 'number' },
        neighbors: { bsonType: 'array', items: { bsonType: 'number' } },
      },
    },
  },
  seaTerritories: {
    bsonType: 'array',
    items: {
      bsonType: 'object',
      required: ['id', 'x', 'y', 'neighbors'],
      additionalProperties: false,
      properties: {
        id: { bsonType: 'number' },
        x: { bsonType: 'number' },
        y: { bsonType: 'number' },
        neighbors: { bsonType: 'array', items: { bsonType: 'number' } },
      },
    },
  },
  bonuses: { bsonType: 'array', items: { bsonType: 'number' } },
  wraps: {
    bsonType: 'array',
    items: {
      bsonType: 'object',
      required: ['a', 'b', 'x', 'y'],
      additionalProperties: false,
      properties: {
        a: { bsonType: 'number' },
        b: { bsonType: 'number' },
        x: { bsonType: 'bool' },
        y: { bsonType: 'bool' },
      },
    },
  },
  timedConnections: {
    bsonType: 'array',
    items: {
      bsonType: 'object',
      required: ['a', 'b', 'delay', 'open', 'closed'],
      additionalProperties: false,
      properties: {
        a: { bsonType: 'number' },
        b: { bsonType: 'number' },
        delay: TIMED_DELAY,
        open: TIMED_PERIOD,
        closed: TIMED_PERIOD,
      },
    },
  },
  generation: {
    bsonType: ['object', 'null'],
    required: ['seed', 'size', 'type', 'fill', 'seas', 'timed'],
    additionalProperties: false,
    properties: {
      seed: { bsonType: 'string', minLength: 1, maxLength: 20 },
      size: { enum: MAP_SIZE_VALUES },
      type: { enum: GENERATION_TYPE_VALUES },
      fill: { enum: FILL_VALUES },
      seas: { bsonType: 'bool' },
      timed: { bsonType: 'bool' },
    },
  },
  image: { bsonType: 'binData' },
  imageMime: { enum: IMAGE_MIMES },
  borderColors: {
    bsonType: 'array',
    minItems: 1,
    maxItems: MAX_BORDER_COLORS,
    items: { bsonType: 'string', pattern: BORDER_COLOR_PATTERN },
  },
};
