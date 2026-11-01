import { DAY_MS, REPORT_REASONS } from 'engine';
import { ObjectId } from 'mongodb';
import { CollectionSpec, getCollection } from '../mongo';

const NAME = 'player_reports';

const PROFILE_REPORT_DAYS = 30;

export type ReportSource = 'game' | 'profile';

interface PlayerReportDoc {
  source: ReportSource;
  gameId: ObjectId | null;
  pictureId: string | null;
  reporterId: ObjectId;
  targetId: ObjectId;
  reason: string;
  createdAt: Date;
  consumedBy: ObjectId | null;
  weight: number | null;
}

export interface NewPlayerReport {
  source: ReportSource;
  gameId: string | null;
  pictureId: string | null;
  reporterId: string;
  targetId: string;
  reason: string;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'source',
        'gameId',
        'pictureId',
        'reporterId',
        'targetId',
        'reason',
        'createdAt',
        'consumedBy',
        'weight',
      ],
      additionalProperties: false,
      properties: {
        _id: {},
        source: { enum: ['game', 'profile'] },
        gameId: { bsonType: ['objectId', 'null'] },
        pictureId: { bsonType: ['string', 'null'] },
        reporterId: { bsonType: 'objectId' },
        targetId: { bsonType: 'objectId' },
        reason: { enum: [...REPORT_REASONS] },
        createdAt: { bsonType: 'date' },
        consumedBy: { bsonType: ['objectId', 'null'] },
        weight: { bsonType: ['number', 'null'] },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<PlayerReportDoc>(NAME);
}

export const PLAYER_REPORTS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [
    {
      key: { gameId: 1, reporterId: 1, targetId: 1 },
      options: { unique: true, partialFilterExpression: { source: 'game' } },
    },
    { key: { reporterId: 1, targetId: 1, reason: 1, createdAt: -1 } },
    { key: { targetId: 1, reason: 1, createdAt: -1 } },
    { key: { reporterId: 1, createdAt: -1 } },
  ],
};

export function hasRecentProfileReport(
  reporterId: string,
  targetId: string,
  reason: string,
  pictureId: string | null,
): Promise<boolean> {
  return collection()
    .findOne(
      {
        source: 'profile',
        reporterId: new ObjectId(reporterId),
        targetId: new ObjectId(targetId),
        reason,
        createdAt: {
          $gte: new Date(Date.now() - PROFILE_REPORT_DAYS * DAY_MS),
        },
        ...(pictureId === null ? {} : { pictureId }),
      },
      { projection: { _id: 1 } },
    )
    .then((doc) => doc !== null);
}

export function insertPlayerReport(report: NewPlayerReport): Promise<boolean> {
  return collection()
    .insertOne({
      source: report.source,
      gameId: report.gameId === null ? null : new ObjectId(report.gameId),
      pictureId: report.pictureId,
      reporterId: new ObjectId(report.reporterId),
      targetId: new ObjectId(report.targetId),
      reason: report.reason,
      createdAt: new Date(),
      consumedBy: null,
      weight: null,
    })
    .then(
      () => true,
      (error: { code?: number }) => {
        if (error?.code === 11000) return false;
        throw error;
      },
    );
}

export interface OpenPlayerReport {
  id: string;
  source: ReportSource;
  reporterId: string;
  createdAt: number;
}

export function listOpenReports(
  targetId: string,
  reason: string,
  pictureId: string | null,
  since: number,
): Promise<OpenPlayerReport[]> {
  return collection()
    .find(
      {
        targetId: new ObjectId(targetId),
        reason,
        createdAt: { $gte: new Date(since) },
        consumedBy: null,
        ...(pictureId === null ? {} : { pictureId }),
      },
      { projection: { source: 1, reporterId: 1, createdAt: 1 } },
    )
    .toArray()
    .then((docs) =>
      docs.map((doc) => ({
        id: doc._id.toString(),
        source: doc.source,
        reporterId: doc.reporterId.toString(),
        createdAt: doc.createdAt.getTime(),
      })),
    );
}

export function countReportsBy(
  reporterId: string,
  from: number,
  to: number,
): Promise<number> {
  return collection().countDocuments({
    reporterId: new ObjectId(reporterId),
    createdAt: { $gte: new Date(from), $lt: new Date(to) },
  });
}

export function consumeReports(
  weights: { id: string; weight: number }[],
  eventId: string,
): Promise<void> {
  return collection()
    .bulkWrite(
      weights.map(({ id, weight }) => ({
        updateOne: {
          filter: { _id: new ObjectId(id), consumedBy: null },
          update: { $set: { consumedBy: new ObjectId(eventId), weight } },
        },
      })),
    )
    .then(() => undefined);
}
