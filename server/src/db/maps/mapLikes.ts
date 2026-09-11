import { ObjectId } from 'mongodb';
import { ensureCollection, getCollection } from '../mongo';
import { playerMapExists, setLikeCount } from './playerMaps';

const NAME = 'map_likes';

interface LikeDoc {
  mapId: ObjectId;
  userId: ObjectId;
  createdAt: Date;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['mapId', 'userId', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        mapId: { bsonType: 'objectId' },
        userId: { bsonType: 'objectId' },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<LikeDoc>(NAME);
}

function syncLikeCount(mapId: string): Promise<void> {
  return collection()
    .countDocuments({ mapId: new ObjectId(mapId) })
    .then((count) => setLikeCount(mapId, count));
}

export function ensureMapLikes(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex({ mapId: 1, userId: 1 }, { unique: true }),
      collection().createIndex({ userId: 1 }),
    ]),
  );
}

type Result = { ok: true } | { ok: false; error: string };

export function likeMap(userId: string, mapId: string): Promise<Result> {
  if (!ObjectId.isValid(mapId))
    return Promise.resolve({ ok: false as const, error: 'map not found' });
  return playerMapExists(mapId).then((exists): Result | Promise<Result> => {
    if (!exists) return { ok: false as const, error: 'map not found' };
    return collection()
      .insertOne({
        mapId: new ObjectId(mapId),
        userId: new ObjectId(userId),
        createdAt: new Date(),
      })
      .then(() => syncLikeCount(mapId).then(() => ({ ok: true as const })))
      .catch((error: { code?: number }) => {
        if (error?.code === 11000) return { ok: true as const };
        throw error;
      });
  });
}

export function unlikeMap(userId: string, mapId: string): Promise<Result> {
  if (!ObjectId.isValid(mapId)) return Promise.resolve({ ok: true as const });
  return collection()
    .deleteOne({ mapId: new ObjectId(mapId), userId: new ObjectId(userId) })
    .then((res) =>
      res.deletedCount > 0
        ? syncLikeCount(mapId).then(() => ({ ok: true as const }))
        : { ok: true as const },
    );
}

export function likedMapIds(
  userId: string,
  mapIds?: string[],
): Promise<ObjectId[]> {
  const filter: Record<string, unknown> = { userId: new ObjectId(userId) };
  if (mapIds) filter.mapId = { $in: mapIds.map((id) => new ObjectId(id)) };
  return collection()
    .find(filter, { projection: { mapId: 1 } })
    .toArray()
    .then((docs) => docs.map((doc) => doc.mapId));
}

export function deleteLikesForMap(mapId: string): Promise<void> {
  return collection()
    .deleteMany({ mapId: new ObjectId(mapId) })
    .then(() => undefined);
}
