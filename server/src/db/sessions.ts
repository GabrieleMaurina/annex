import { ObjectId } from 'mongodb';
import { CollectionSpec, getCollection } from './mongo';

const NAME = 'sessions';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MS = 180 * 24 * 60 * 60 * 1000;

interface SessionDoc {
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expireAt: Date;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'tokenHash', 'createdAt', 'expireAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        userId: { bsonType: 'objectId' },
        tokenHash: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        expireAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<SessionDoc>(NAME);
}

function expiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

export const SESSIONS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [
    { key: { tokenHash: 1 }, options: { unique: true } },
    { key: { expireAt: 1 }, options: { expireAfterSeconds: 0 } },
    {
      key: { createdAt: 1 },
      options: { expireAfterSeconds: ABSOLUTE_MS / 1000 },
    },
  ],
};

export function touchSession(tokenHash: string): Promise<string | null> {
  const now = new Date();
  return collection()
    .findOneAndUpdate(
      {
        tokenHash,
        expireAt: { $gt: now },
        createdAt: { $gt: new Date(now.getTime() - ABSOLUTE_MS) },
      },
      { $set: { expireAt: new Date(now.getTime() + SESSION_TTL_MS) } },
    )
    .then((doc) => (doc ? doc.userId.toString() : null));
}

export function upsertSession(
  tokenHash: string,
  userId: string,
): Promise<void> {
  return collection()
    .updateOne(
      { tokenHash },
      {
        $set: { userId: new ObjectId(userId), expireAt: expiry() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    )
    .then(() => undefined);
}

export function deleteSession(tokenHash: string): Promise<void> {
  return collection()
    .deleteOne({ tokenHash })
    .then(() => undefined);
}

export function deleteUserSessions(userId: string): Promise<void> {
  return collection()
    .deleteMany({ userId: new ObjectId(userId) })
    .then(() => undefined);
}
