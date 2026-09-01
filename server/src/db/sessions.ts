import { ObjectId } from 'mongodb';
import { ensureCollection, getCollection } from './mongo';

const NAME = 'sessions';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
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
  return new Date(Date.now() + TTL_MS);
}

export function ensureSessions(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex({ tokenHash: 1 }, { unique: true }),
      collection().createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
      collection().createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: ABSOLUTE_MS / 1000 },
      ),
    ]),
  );
}

export function touchSession(tokenHash: string): Promise<string | null> {
  const now = new Date();
  return collection()
    .findOneAndUpdate(
      {
        tokenHash,
        expireAt: { $gt: now },
        createdAt: { $gt: new Date(now.getTime() - ABSOLUTE_MS) },
      },
      { $set: { expireAt: new Date(now.getTime() + TTL_MS) } },
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
