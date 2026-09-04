import { Binary } from 'mongodb';
import { ensureCollection, getCollection } from './mongo';

const NAME = 'maps';

export interface MapDoc {
  _id: string;
  name: string;
  territories: {
    id: number;
    continentId: number;
    x: number;
    y: number;
    neighbors: number[];
  }[];
  bonuses: number[];
  generation: { seed: string; size: string; water: string } | null;
  image: Binary;
  imageMime: string;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        '_id',
        'name',
        'territories',
        'bonuses',
        'generation',
        'image',
        'imageMime',
      ],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string' },
        name: { bsonType: 'string' },
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
        bonuses: { bsonType: 'array', items: { bsonType: 'number' } },
        generation: {
          bsonType: ['object', 'null'],
          required: ['seed', 'size', 'water'],
          additionalProperties: false,
          properties: {
            seed: { bsonType: 'string' },
            size: { enum: ['small', 'medium', 'large', 'xlarge'] },
            water: { enum: ['land', 'mixed', 'ocean'] },
          },
        },
        image: { bsonType: 'binData' },
        imageMime: { bsonType: 'string' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<MapDoc>(NAME);
}

export function ensureMaps(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    collection().createIndex({ name: 1 }),
  );
}

export function storeMap(doc: MapDoc): Promise<void> {
  const { _id, ...rest } = doc;
  return collection()
    .updateOne({ _id }, { $setOnInsert: rest }, { upsert: true })
    .then(() => undefined);
}

export interface StoredMap {
  name: string;
  territories: MapDoc['territories'];
  bonuses: number[];
  image: string;
  imageMime: string;
}

export function findMapIdsByName(name: string): Promise<string[]> {
  return collection()
    .find({ name }, { projection: { _id: 1 } })
    .toArray()
    .then((docs) => docs.map((doc) => doc._id));
}

export function getMapNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return Promise.resolve(new Map());
  return collection()
    .find({ _id: { $in: ids } }, { projection: { name: 1 } })
    .toArray()
    .then((docs) => new Map(docs.map((doc) => [doc._id, doc.name])));
}

export function getMapById(id: string): Promise<StoredMap | null> {
  return collection()
    .findOne({ _id: id })
    .then((doc) =>
      doc
        ? {
            name: doc.name,
            territories: doc.territories,
            bonuses: doc.bonuses,
            image: Buffer.from(doc.image.buffer).toString('base64'),
            imageMime: doc.imageMime,
          }
        : null,
    );
}
