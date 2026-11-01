import { DAY_MS, MAX_REPUTATION, MIN_REPUTATION } from 'engine';
import { ObjectId } from 'mongodb';
import { CollectionSpec, getCollection } from '../mongo';

const NAME = 'reputation_events';

export const REPUTATION_REASONS = [
  'game',
  'recovery',
  'disconnected',
  'surrender',
  'map',
  'report',
] as const;

export type ReputationReason = (typeof REPUTATION_REASONS)[number];

interface ReputationEventDoc {
  userId: ObjectId;
  delta: number;
  reputation: number;
  reason: ReputationReason;
  reportReason: string | null;
  gameId: ObjectId | null;
  refId: string | null;
  createdAt: Date;
}

export interface ReputationEvent {
  id: string | null;
  userId: string;
  delta: number;
  reputation: number;
  reason: ReputationReason;
  reportReason: string | null;
  gameId: string | null;
  refId: string | null;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'userId',
        'delta',
        'reputation',
        'reason',
        'reportReason',
        'gameId',
        'refId',
        'createdAt',
      ],
      additionalProperties: false,
      properties: {
        _id: {},
        userId: { bsonType: 'objectId' },
        delta: { bsonType: 'int' },
        reputation: {
          bsonType: 'int',
          minimum: MIN_REPUTATION,
          maximum: MAX_REPUTATION,
        },
        reason: { enum: [...REPUTATION_REASONS] },
        reportReason: { bsonType: ['string', 'null'] },
        gameId: { bsonType: ['objectId', 'null'] },
        refId: { bsonType: ['string', 'null'] },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<ReputationEventDoc>(NAME);
}

export const REPUTATION_EVENTS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [{ key: { userId: 1, reason: 1, createdAt: -1 } }],
};

export function insertReputationEvent(event: ReputationEvent): Promise<string> {
  return collection()
    .insertOne({
      _id: event.id === null ? new ObjectId() : new ObjectId(event.id),
      userId: new ObjectId(event.userId),
      delta: event.delta,
      reputation: event.reputation,
      reason: event.reason,
      reportReason: event.reportReason,
      gameId: event.gameId === null ? null : new ObjectId(event.gameId),
      refId: event.refId,
      createdAt: new Date(),
    })
    .then((res) => res.insertedId.toString());
}

export function countRecentGains(userId: string): Promise<number> {
  return collection().countDocuments({
    userId: new ObjectId(userId),
    reason: 'game',
    createdAt: { $gte: new Date(Date.now() - DAY_MS) },
  });
}
