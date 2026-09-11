import { ObjectId } from 'mongodb';
import { ensureCollection, getCollection } from '../mongo';
import { getPlayerMapOwner, markPlayerMapDangerous } from './playerMaps';

const NAME = 'map_reports';
const REPORT_THRESHOLD = 3;

interface ReportDoc {
  mapId: ObjectId;
  reporterId: ObjectId;
  createdAt: Date;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['mapId', 'reporterId', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        mapId: { bsonType: 'objectId' },
        reporterId: { bsonType: 'objectId' },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<ReportDoc>(NAME);
}

export function ensureMapReports(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex({ mapId: 1, reporterId: 1 }, { unique: true }),
      collection().createIndex({ mapId: 1 }),
    ]),
  );
}

type Result = { ok: true } | { ok: false; error: string };

export function reportMap(reporterId: string, mapId: string): Promise<Result> {
  if (!ObjectId.isValid(mapId))
    return Promise.resolve({ ok: false as const, error: 'map not found' });
  return getPlayerMapOwner(mapId).then((owner): Result | Promise<Result> => {
    if (!owner) return { ok: false as const, error: 'map not found' };
    if (owner.dangerous) return { ok: false as const, error: 'map not found' };
    if (new ObjectId(reporterId).equals(owner.authorId))
      return { ok: false as const, error: 'cannot report yourself' };
    return collection()
      .insertOne({
        mapId: new ObjectId(mapId),
        reporterId: new ObjectId(reporterId),
        createdAt: new Date(),
      })
      .then(() => collection().countDocuments({ mapId: new ObjectId(mapId) }))
      .then((count) => {
        if (count < REPORT_THRESHOLD) return { ok: true as const };
        return markPlayerMapDangerous(mapId).then(() => ({
          ok: true as const,
        }));
      })
      .catch((error: { code?: number }) => {
        if (error?.code === 11000)
          return { ok: false as const, error: 'already reported' };
        throw error;
      });
  });
}

export function deleteReportsForMap(mapId: string): Promise<void> {
  return collection()
    .deleteMany({ mapId: new ObjectId(mapId) })
    .then(() => undefined);
}
