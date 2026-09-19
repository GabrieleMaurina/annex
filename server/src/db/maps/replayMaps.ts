import { createHash } from 'crypto';
import { Binary } from 'mongodb';
import { MapGeneration } from '../../validate';
import { ensureCollection, getCollection } from '../mongo';
import { MAP_PROPERTIES, MAP_REQUIRED } from './mapSchema';

export const REPLAY_MAPS = 'replay_maps';

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
  seaTerritories: { id: number; x: number; y: number; neighbors: number[] }[];
  bonuses: number[];
  wraps: { a: number; b: number; x: boolean; y: boolean }[];
  generation: MapGeneration | null;
  image: Binary;
  imageMime: string;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', ...MAP_REQUIRED],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string' },
        ...MAP_PROPERTIES,
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

export function replayMapId(
  map: Pick<
    MapDoc,
    'territories' | 'seaTerritories' | 'bonuses' | 'wraps' | 'imageMime'
  >,
  imageBytes: Uint8Array,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        territories: map.territories,
        seaTerritories: map.seaTerritories,
        bonuses: map.bonuses,
        wraps: map.wraps,
        imageMime: map.imageMime,
      }),
    )
    .update(imageBytes)
    .digest('hex');
}

function collection() {
  return getCollection<MapDoc>(REPLAY_MAPS);
}

export function ensureReplayMaps(): Promise<unknown> {
  return ensureCollection(REPLAY_MAPS, schema).then(() =>
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
  seaTerritories: MapDoc['seaTerritories'];
  bonuses: number[];
  wraps: MapDoc['wraps'];
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
            seaTerritories: doc.seaTerritories ?? [],
            bonuses: doc.bonuses,
            wraps: doc.wraps,
            image: Buffer.from(doc.image.buffer).toString('base64'),
            imageMime: doc.imageMime,
          }
        : null,
    );
}
