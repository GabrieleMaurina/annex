import { ObjectId } from 'mongodb';
import { CollectionSpec, getCollection } from './mongo';

const NAME = 'email_confirmations';
const TTL_MS = 24 * 60 * 60 * 1000;

interface CodeDoc {
  userId: ObjectId;
  codeHash: string;
  expireAt: Date;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'codeHash', 'expireAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        userId: { bsonType: 'objectId' },
        codeHash: { bsonType: 'string' },
        expireAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<CodeDoc>(NAME);
}

export const EMAIL_CONFIRMATIONS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [
    { key: { codeHash: 1 }, options: { unique: true } },
    { key: { expireAt: 1 }, options: { expireAfterSeconds: 0 } },
  ],
};

export function createEmailConfirmation(
  userId: string,
  codeHash: string,
): Promise<void> {
  const uid = new ObjectId(userId);
  return collection()
    .deleteMany({ userId: uid })
    .then(() =>
      collection().insertOne({
        userId: uid,
        codeHash,
        expireAt: new Date(Date.now() + TTL_MS),
      }),
    )
    .then(() => undefined);
}

export function consumeEmailConfirmation(
  codeHash: string,
): Promise<string | null> {
  return collection()
    .findOneAndDelete({ codeHash })
    .then((doc) => {
      if (!doc) return null;
      return collection()
        .deleteMany({ userId: doc.userId })
        .then(() => doc.userId.toString());
    });
}
