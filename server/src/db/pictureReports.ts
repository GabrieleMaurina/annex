import { ObjectId } from 'mongodb';
import { ensureCollection, getCollection } from './mongo';
import { getUserPicture, markPictureDangerous } from './users';

const NAME = 'picture_reports';
const REPORT_THRESHOLD = 3;

interface ReportDoc {
  pictureId: string;
  targetUserId: ObjectId;
  reporterId: ObjectId;
  createdAt: Date;
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['pictureId', 'targetUserId', 'reporterId', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        pictureId: { bsonType: 'string' },
        targetUserId: { bsonType: 'objectId' },
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

export function ensurePictureReports(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex(
        { pictureId: 1, reporterId: 1 },
        { unique: true },
      ),
      collection().createIndex({ pictureId: 1 }),
    ]),
  );
}

type Result = { ok: true } | { ok: false; error: string };

export function reportPicture(
  reporterId: string,
  targetUserId: string,
): Promise<Result> {
  if (!ObjectId.isValid(targetUserId))
    return Promise.resolve({ ok: false as const, error: 'user not found' });
  if (new ObjectId(reporterId).equals(targetUserId))
    return Promise.resolve({
      ok: false as const,
      error: 'cannot report yourself',
    });
  return getUserPicture(targetUserId).then((picture) => {
    if (!picture || picture.dangerous)
      return { ok: false as const, error: 'no picture' };
    const pictureId = picture.id;
    return collection()
      .insertOne({
        pictureId,
        targetUserId: new ObjectId(targetUserId),
        reporterId: new ObjectId(reporterId),
        createdAt: new Date(),
      })
      .then(() => collection().countDocuments({ pictureId }))
      .then((count) => {
        if (count < REPORT_THRESHOLD) return { ok: true as const };
        return markPictureDangerous(targetUserId, pictureId).then(() => ({
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

export function deleteReportsForPicture(pictureId: string): Promise<void> {
  return collection()
    .deleteMany({ pictureId })
    .then(() => undefined);
}
