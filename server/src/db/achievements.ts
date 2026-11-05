import { ObjectId } from 'mongodb';
import { CollectionSpec, getCollection } from './mongo';

const NAME = 'achievements';
const EARNED_NAME = 'userAchievements';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
}

interface AchievementDoc {
  _id: string;
  title: string;
  description: string;
  order: number;
}

interface UserAchievementDoc {
  userId: ObjectId;
  achievementId: string;
  achievedAt: Date;
  notified: boolean;
}

export interface PlayerAchievement extends AchievementDefinition {
  achievedAt: number | null;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'title', 'description', 'order'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string' },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        order: { bsonType: 'int' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

const earnedSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'achievementId', 'achievedAt', 'notified'],
      additionalProperties: false,
      properties: {
        _id: {},
        userId: { bsonType: 'objectId' },
        achievementId: { bsonType: 'string' },
        achievedAt: { bsonType: 'date' },
        notified: { bsonType: 'bool' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<AchievementDoc>(NAME);
}

function earnedCollection() {
  return getCollection<UserAchievementDoc>(EARNED_NAME);
}

export const ACHIEVEMENTS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [],
};

export const USER_ACHIEVEMENTS_COLLECTION: CollectionSpec = {
  name: EARNED_NAME,
  schema: earnedSchema,
  indexes: [
    { key: { userId: 1, achievementId: 1 }, options: { unique: true } },
    { key: { userId: 1, notified: 1 } },
  ],
};

export function installAchievements(
  definitions: AchievementDefinition[],
): Promise<void> {
  return collection()
    .bulkWrite(
      definitions.map(({ id, title, description }, order) => ({
        replaceOne: {
          filter: { _id: id },
          replacement: { title, description, order },
          upsert: true,
        },
      })),
    )
    .then(() =>
      collection().deleteMany({ _id: { $nin: definitions.map((d) => d.id) } }),
    )
    .then(() => undefined);
}

export function grantAchievements(
  userId: string,
  achievementIds: string[],
): Promise<void> {
  if (achievementIds.length === 0) return Promise.resolve();
  const uid = new ObjectId(userId);
  const achievedAt = new Date();
  return earnedCollection()
    .bulkWrite(
      achievementIds.map((achievementId) => ({
        updateOne: {
          filter: { userId: uid, achievementId },
          update: { $setOnInsert: { achievedAt, notified: false } },
          upsert: true,
        },
      })),
      { ordered: false },
    )
    .then(() => undefined);
}

export function listPlayerAchievements(
  userId: string,
): Promise<PlayerAchievement[]> {
  return Promise.all([
    collection()
      .find({}, { sort: { order: 1 } })
      .toArray(),
    earnedCollection()
      .find({ userId: new ObjectId(userId) })
      .toArray(),
  ]).then(([definitions, earned]) => {
    const achievedAt = new Map(
      earned.map((doc) => [doc.achievementId, doc.achievedAt.getTime()]),
    );
    return definitions.map((doc) => ({
      id: doc._id,
      title: doc.title,
      description: doc.description,
      achievedAt: achievedAt.get(doc._id) ?? null,
    }));
  });
}

export function takeNewAchievements(
  userId: string,
): Promise<PlayerAchievement[]> {
  const uid = new ObjectId(userId);
  return earnedCollection()
    .find({ userId: uid, notified: false })
    .toArray()
    .then((docs) =>
      Promise.all(
        docs.map((doc) =>
          earnedCollection()
            .updateOne(
              { _id: doc._id, notified: false },
              { $set: { notified: true } },
            )
            .then((res) => (res.modifiedCount === 1 ? doc : null)),
        ),
      ),
    )
    .then((claimed) => {
      const fresh = claimed.filter((doc) => doc !== null);
      if (fresh.length === 0) return [];
      const achievedAt = new Map(
        fresh.map((doc) => [doc.achievementId, doc.achievedAt.getTime()]),
      );
      return collection()
        .find({ _id: { $in: [...achievedAt.keys()] } })
        .sort({ order: 1 })
        .toArray()
        .then((definitions) =>
          definitions.map((definition) => ({
            id: definition._id,
            title: definition.title,
            description: definition.description,
            achievedAt: achievedAt.get(definition._id)!,
          })),
        );
    });
}
