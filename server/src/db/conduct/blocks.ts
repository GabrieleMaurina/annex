import { ObjectId } from 'mongodb';
import { CollectionSpec, getCollection } from '../mongo';

const NAME = 'blocks';

interface BlockDoc {
  blockerId: ObjectId;
  blockedId: ObjectId;
  createdAt: Date;
}

export interface StoredBlockPeers {
  blockedByMe: Set<string>;
  blockedMe: Set<string>;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['blockerId', 'blockedId', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        blockerId: { bsonType: 'objectId' },
        blockedId: { bsonType: 'objectId' },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<BlockDoc>(NAME);
}

export const BLOCKS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [
    { key: { blockerId: 1, blockedId: 1 }, options: { unique: true } },
    { key: { blockedId: 1 } },
  ],
};

export function isBlocked(
  blockerId: ObjectId,
  blockedId: ObjectId,
): Promise<boolean> {
  return collection()
    .findOne({ blockerId, blockedId })
    .then((doc) => !!doc);
}

export function getBlockedIds(userId: string): Promise<string[]> {
  return collection()
    .find({ blockerId: new ObjectId(userId) })
    .toArray()
    .then((docs) => docs.map((doc) => doc.blockedId.toString()));
}

export function getBlockPeers(userId: string): Promise<StoredBlockPeers> {
  const me = new ObjectId(userId);
  return Promise.all([
    collection().find({ blockerId: me }).toArray(),
    collection().find({ blockedId: me }).toArray(),
  ]).then(([mine, theirs]) => ({
    blockedByMe: new Set(mine.map((doc) => doc.blockedId.toString())),
    blockedMe: new Set(theirs.map((doc) => doc.blockerId.toString())),
  }));
}

export function countBlocks(blockerId: string): Promise<number> {
  return collection().countDocuments({ blockerId: new ObjectId(blockerId) });
}

export function insertBlock(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  return collection()
    .updateOne(
      {
        blockerId: new ObjectId(blockerId),
        blockedId: new ObjectId(blockedId),
      },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )
    .then(
      () => undefined,
      (error: { code?: number }) => {
        if (error?.code !== 11000) throw error;
      },
    );
}

export function deleteBlock(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  return collection()
    .deleteOne({
      blockerId: new ObjectId(blockerId),
      blockedId: new ObjectId(blockedId),
    })
    .then(() => undefined);
}
