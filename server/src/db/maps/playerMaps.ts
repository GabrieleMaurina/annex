import {
  Fill,
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_SIZE_VALUES,
  MapSize,
} from 'engine';
import { Binary, ObjectId } from 'mongodb';
import { MapGeneration } from '../../validate';
import { ensureCollection, getCollection } from '../mongo';
import { getUsernamesByIds, searchUsers } from '../users';
import { likedMapIds } from './mapLikes';

const NAME = 'player_maps';

const MAX_NAME_LENGTH = 40;
const PICTURE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

export interface PlayerMapTerritory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

interface PlayerMapDoc {
  authorId: ObjectId;
  name: string;
  territories: PlayerMapTerritory[];
  bonuses: number[];
  image: Binary;
  imageMime: string;
  generation?: MapGeneration | null;
  territoryCount: number;
  continentCount: number;
  likeCount: number;
  dangerous: boolean;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'authorId',
        'name',
        'territories',
        'bonuses',
        'image',
        'imageMime',
        'territoryCount',
        'continentCount',
        'likeCount',
        'dangerous',
      ],
      additionalProperties: false,
      properties: {
        _id: {},
        authorId: { bsonType: 'objectId' },
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
        bonuses: { bsonType: 'array', items: { bsonType: 'number' } },
        image: { bsonType: 'binData' },
        imageMime: { enum: PICTURE_MIMES },
        generation: {
          bsonType: ['object', 'null'],
          required: ['seed', 'size', 'type', 'fill'],
          additionalProperties: false,
          properties: {
            seed: { bsonType: 'string', minLength: 1, maxLength: 20 },
            size: { enum: MAP_SIZE_VALUES },
            type: { enum: GENERATION_TYPE_VALUES },
            fill: { enum: FILL_VALUES },
          },
        },
        territoryCount: { bsonType: 'number' },
        continentCount: { bsonType: 'number' },
        likeCount: { bsonType: 'number' },
        dangerous: { bsonType: 'bool' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<PlayerMapDoc>(NAME);
}

const NAME_COLLATION = { locale: 'en', strength: 2 };

function isDuplicateName(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export function ensurePlayerMaps(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex(
        { authorId: 1, name: 1 },
        { unique: true, collation: NAME_COLLATION },
      ),
      collection().createIndex({ likeCount: -1 }),
      collection().createIndex(
        { name: 1 },
        { name: 'name_collated', collation: NAME_COLLATION },
      ),
      collection().createIndex({ territoryCount: 1 }),
    ]),
  );
}

export function listPlayerMapNames(authorId: string): Promise<string[]> {
  if (!ObjectId.isValid(authorId)) return Promise.resolve([]);
  return collection()
    .find({ authorId: new ObjectId(authorId) }, { projection: { name: 1 } })
    .toArray()
    .then((docs) => docs.map((d) => d.name));
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface PlayerMapInput {
  name: string;
  territories: PlayerMapTerritory[];
  bonuses: number[];
  image: Buffer;
  imageMime: string;
  generation: MapGeneration | null;
}

export function createPlayerMap(
  authorId: string,
  input: PlayerMapInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return collection()
    .insertOne({
      authorId: new ObjectId(authorId),
      name: input.name,
      territories: input.territories,
      bonuses: input.bonuses,
      image: new Binary(input.image),
      imageMime: input.imageMime,
      generation: input.generation,
      territoryCount: input.territories.length,
      continentCount: input.bonuses.length,
      likeCount: 0,
      dangerous: false,
    })
    .then((res) => ({ ok: true as const, id: res.insertedId.toString() }))
    .catch((error) => {
      if (isDuplicateName(error))
        return { ok: false as const, error: 'name taken' };
      throw error;
    });
}

type Result = { ok: true } | { ok: false; error: string };

export function updatePlayerMap(
  id: string,
  authorId: string,
  input: PlayerMapInput,
): Promise<Result> {
  if (!ObjectId.isValid(id))
    return Promise.resolve({ ok: false as const, error: 'map not found' });
  return collection()
    .findOne({ _id: new ObjectId(id) })
    .then((doc): Result | Promise<Result> => {
      if (!doc || !doc.authorId.equals(authorId))
        return { ok: false as const, error: 'map not found' };
      if (doc.dangerous)
        return { ok: false as const, error: 'map unavailable' };
      return collection()
        .updateOne(
          { _id: doc._id },
          {
            $set: {
              name: input.name,
              territories: input.territories,
              bonuses: input.bonuses,
              image: new Binary(input.image),
              imageMime: input.imageMime,
              generation: input.generation,
              territoryCount: input.territories.length,
              continentCount: input.bonuses.length,
            },
          },
        )
        .then((): Result => ({ ok: true as const }))
        .catch((error): Result => {
          if (isDuplicateName(error)) return { ok: false, error: 'name taken' };
          throw error;
        });
    });
}

export function deletePlayerMap(id: string, authorId: string): Promise<Result> {
  if (!ObjectId.isValid(id))
    return Promise.resolve({ ok: false as const, error: 'map not found' });
  return collection()
    .deleteOne({ _id: new ObjectId(id), authorId: new ObjectId(authorId) })
    .then((res) =>
      res.deletedCount > 0
        ? { ok: true as const }
        : { ok: false as const, error: 'map not found' },
    );
}

export interface PlayerMapDetail {
  id: string;
  authorId: string;
  name: string;
  territories: PlayerMapTerritory[];
  bonuses: number[];
  image: string;
  imageMime: string;
  generation: MapGeneration | null;
  dangerous: boolean;
  likeCount: number;
  createdAt: number;
}

export function getPlayerMapById(id: string): Promise<PlayerMapDetail | null> {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return collection()
    .findOne({ _id: new ObjectId(id) })
    .then((doc) =>
      doc
        ? {
            id: doc._id.toString(),
            authorId: doc.authorId.toString(),
            name: doc.name,
            territories: doc.territories,
            bonuses: doc.bonuses,
            image: Buffer.from(doc.image.buffer).toString('base64'),
            imageMime: doc.imageMime,
            generation: doc.generation ?? null,
            dangerous: doc.dangerous,
            likeCount: doc.likeCount,
            createdAt: doc._id.getTimestamp().getTime(),
          }
        : null,
    );
}

export function getPlayerMapImage(id: string): Promise<{
  bytes: Buffer;
  mime: string;
  dangerous: boolean;
  authorId: string;
} | null> {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return collection()
    .findOne({ _id: new ObjectId(id) })
    .then((doc) =>
      doc
        ? {
            bytes: Buffer.from(doc.image.buffer),
            mime: doc.imageMime,
            dangerous: doc.dangerous,
            authorId: doc.authorId.toString(),
          }
        : null,
    );
}

export function setLikeCount(mapId: string, likeCount: number): Promise<void> {
  return collection()
    .updateOne({ _id: new ObjectId(mapId) }, { $set: { likeCount } })
    .then(() => undefined);
}

export function markPlayerMapDangerous(mapId: string): Promise<void> {
  return collection()
    .updateOne({ _id: new ObjectId(mapId) }, { $set: { dangerous: true } })
    .then(() => undefined);
}

export function playerMapExists(mapId: string): Promise<boolean> {
  if (!ObjectId.isValid(mapId)) return Promise.resolve(false);
  return collection()
    .findOne({ _id: new ObjectId(mapId) }, { projection: { _id: 1 } })
    .then((doc) => doc !== null);
}

export function getPlayerMapOwner(
  id: string,
): Promise<{ authorId: string; dangerous: boolean } | null> {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return collection()
    .findOne(
      { _id: new ObjectId(id) },
      { projection: { authorId: 1, dangerous: 1 } },
    )
    .then((doc) =>
      doc
        ? { authorId: doc.authorId.toString(), dangerous: !!doc.dangerous }
        : null,
    );
}

export type PlayerMapSort =
  'mostLiked' | 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';

export interface PlayerMapsQuery {
  page: number;
  pageSize: number;
  q?: string;
  authorId?: string;
  mine?: boolean;
  liked?: boolean;
  notMine?: boolean;
  notLiked?: boolean;
  territoryMin?: number;
  territoryMax?: number;
  generationType?: GenerationType;
  generationFill?: Fill;
  generationSize?: MapSize;
  sort: PlayerMapSort;
  viewerId?: string;
}

export interface PlayerMapRow {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  territoryCount: number;
  continentCount: number;
  likeCount: number;
  liked: boolean;
  mine: boolean;
  dangerous: boolean;
  generation: MapGeneration | null;
  createdAt: number;
}

export interface PlayerMapsPage {
  maps: PlayerMapRow[];
  total: number;
  page: number;
  pageSize: number;
}

const AUTHOR_SEARCH_LIMIT = 50;

function sortSpec(sort: PlayerMapSort): Record<string, 1 | -1> {
  if (sort === 'nameAsc') return { name: 1, _id: 1 };
  if (sort === 'nameDesc') return { name: -1, _id: -1 };
  if (sort === 'oldest') return { _id: 1 };
  if (sort === 'newest') return { _id: -1 };
  return { likeCount: -1, _id: -1 };
}

export function listPlayerMaps(
  query: PlayerMapsQuery,
): Promise<PlayerMapsPage> {
  const viewer =
    query.viewerId && ObjectId.isValid(query.viewerId)
      ? new ObjectId(query.viewerId)
      : null;

  const filter: Record<string, unknown> = {};

  if (query.territoryMin !== undefined || query.territoryMax !== undefined) {
    const range: Record<string, number> = {};
    if (query.territoryMin !== undefined) range.$gte = query.territoryMin;
    if (query.territoryMax !== undefined) range.$lte = query.territoryMax;
    filter.territoryCount = range;
  }

  if (query.authorId && ObjectId.isValid(query.authorId))
    filter.authorId = new ObjectId(query.authorId);
  else if (viewer) {
    if (query.mine) filter.authorId = viewer;
    else if (query.notMine) filter.authorId = { $ne: viewer };
  }

  const ownOnly =
    viewer !== null &&
    filter.authorId instanceof ObjectId &&
    filter.authorId.equals(viewer);
  if (!ownOnly) filter.dangerous = { $ne: true };

  if (query.generationType) filter['generation.type'] = query.generationType;
  if (query.generationFill) filter['generation.fill'] = query.generationFill;
  if (query.generationSize) filter['generation.size'] = query.generationSize;

  const qRegex = query.q ? new RegExp(escapeRegex(query.q), 'i') : null;

  const authorMatch = query.q
    ? searchUsers(query.q, AUTHOR_SEARCH_LIMIT)
    : Promise.resolve([]);

  const viewerLikes =
    viewer && (query.liked || query.notLiked)
      ? likedMapIds(viewer.toString())
      : Promise.resolve<ObjectId[] | null>(null);

  return Promise.all([authorMatch, viewerLikes]).then(([authors, likedIds]) => {
    if (qRegex) {
      filter.$or = [
        { name: qRegex },
        { authorId: { $in: authors.map((a) => new ObjectId(a.id)) } },
      ];
    }
    if (likedIds) {
      filter._id = query.liked ? { $in: likedIds } : { $nin: likedIds };
    }

    const cursor = collection()
      .find(filter, { projection: { image: 0, territories: 0, bonuses: 0 } })
      .sort(sortSpec(query.sort))
      .collation(NAME_COLLATION)
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize);

    return Promise.all([
      collection().countDocuments(filter),
      cursor.toArray(),
    ]).then(([total, pageDocs]) => {
      const authorIds = [
        ...new Set(pageDocs.map((d) => d.authorId.toString())),
      ];
      const likedSet = viewer
        ? likedMapIds(
            viewer.toString(),
            pageDocs.map((d) => d._id.toString()),
          )
        : Promise.resolve<ObjectId[]>([]);
      return Promise.all([getUsernamesByIds(authorIds), likedSet]).then(
        ([names, liked]) => {
          const likedStrings = new Set(liked.map((id) => id.toString()));
          return {
            total,
            page: query.page,
            pageSize: query.pageSize,
            maps: pageDocs.map((d) => ({
              id: d._id.toString(),
              name: d.name,
              authorId: d.authorId.toString(),
              authorName: names.get(d.authorId.toString()) ?? '?',
              territoryCount: d.territoryCount,
              continentCount: d.continentCount,
              likeCount: d.likeCount,
              liked: likedStrings.has(d._id.toString()),
              mine: viewer ? d.authorId.equals(viewer) : false,
              dangerous: d.dangerous,
              generation: d.generation ?? null,
              createdAt: d._id.getTimestamp().getTime(),
            })),
          };
        },
      );
    });
  });
}
