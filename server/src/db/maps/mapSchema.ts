import { FILL_VALUES, GENERATION_TYPE_VALUES, MAP_SIZE_VALUES } from 'engine';

const MAX_NAME_LENGTH = 40;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export const MAP_REQUIRED = [
  'name',
  'territories',
  'seaTerritories',
  'bonuses',
  'wraps',
  'generation',
  'image',
  'imageMime',
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
  generation: {
    bsonType: ['object', 'null'],
    required: ['seed', 'size', 'type', 'fill', 'seas'],
    additionalProperties: false,
    properties: {
      seed: { bsonType: 'string', minLength: 1, maxLength: 20 },
      size: { enum: MAP_SIZE_VALUES },
      type: { enum: GENERATION_TYPE_VALUES },
      fill: { enum: FILL_VALUES },
      seas: { bsonType: 'bool' },
    },
  },
  image: { bsonType: 'binData' },
  imageMime: { enum: IMAGE_MIMES },
};
