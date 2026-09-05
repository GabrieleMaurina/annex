import { ObjectId } from 'mongodb';
import { ensureCollection, getCollection } from './mongo';
import {
  DEFAULT_ELO,
  findUserById,
  getElosByIds,
  getUsernamesByIds,
} from './users';

const NAME = 'friendships';

interface FriendshipDoc {
  userA: ObjectId;
  userB: ObjectId;
  requesterId: ObjectId;
  status: 'pending' | 'accepted';
  createdAt: Date;
}

export interface FriendSummary {
  id: string;
  username: string;
  elo: number;
}

export interface FriendsOverview {
  friends: FriendSummary[];
  incoming: FriendSummary[];
  outgoing: FriendSummary[];
}

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userA', 'userB', 'requesterId', 'status', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        userA: { bsonType: 'objectId' },
        userB: { bsonType: 'objectId' },
        requesterId: { bsonType: 'objectId' },
        status: { enum: ['pending', 'accepted'] },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<FriendshipDoc>(NAME);
}

export function ensureFriendships(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex({ userA: 1, userB: 1 }, { unique: true }),
      collection().createIndex({ userB: 1 }),
    ]),
  );
}

function sortedPair(a: string, b: string): [ObjectId, ObjectId] {
  return a < b
    ? [new ObjectId(a), new ObjectId(b)]
    : [new ObjectId(b), new ObjectId(a)];
}

export function getFriendsOverview(userId: string): Promise<FriendsOverview> {
  const me = new ObjectId(userId);
  return collection()
    .find({ $or: [{ userA: me }, { userB: me }] })
    .sort({ createdAt: -1 })
    .toArray()
    .then((docs) => {
      const otherOf = (doc: FriendshipDoc) =>
        (doc.userA.equals(me) ? doc.userB : doc.userA).toString();
      const ids = docs.map(otherOf);
      return Promise.all([getUsernamesByIds(ids), getElosByIds(ids)]).then(
        ([names, elos]) => {
          const summary = (id: string): FriendSummary => ({
            id,
            username: names.get(id) ?? '?',
            elo: elos.get(id) ?? DEFAULT_ELO,
          });
          const overview: FriendsOverview = {
            friends: [],
            incoming: [],
            outgoing: [],
          };
          for (const doc of docs) {
            const person = summary(otherOf(doc));
            if (doc.status === 'accepted') overview.friends.push(person);
            else if (doc.requesterId.equals(me)) overview.outgoing.push(person);
            else overview.incoming.push(person);
          }
          return overview;
        },
      );
    });
}

type MutationResult = { ok: true } | { ok: false; error: string };

export function sendFriendRequest(
  requesterId: string,
  recipientId: string,
): Promise<MutationResult> {
  if (requesterId === recipientId)
    return Promise.resolve({
      ok: false as const,
      error: 'cannot friend yourself',
    });
  if (!ObjectId.isValid(recipientId))
    return Promise.resolve({ ok: false as const, error: 'user not found' });
  return findUserById(recipientId).then((user) => {
    if (!user) return { ok: false as const, error: 'user not found' };
    const [userA, userB] = sortedPair(requesterId, recipientId);
    const requester = new ObjectId(requesterId);
    return collection()
      .findOne({ userA, userB })
      .then((existing) => {
        if (existing?.status === 'accepted')
          return { ok: false as const, error: 'already friends' };
        if (existing) {
          if (existing.requesterId.equals(requester))
            return { ok: false as const, error: 'request already sent' };
          return collection()
            .updateOne({ userA, userB }, { $set: { status: 'accepted' } })
            .then(() => ({ ok: true as const }));
        }
        return collection()
          .insertOne({
            userA,
            userB,
            requesterId: requester,
            status: 'pending',
            createdAt: new Date(),
          })
          .then(() => ({ ok: true as const }))
          .catch((error: { code?: number }) => {
            if (error?.code === 11000) return { ok: true as const };
            throw error;
          });
      });
  });
}

export function acceptFriendRequest(
  userId: string,
  otherId: string,
): Promise<MutationResult> {
  if (!ObjectId.isValid(otherId))
    return Promise.resolve({ ok: false as const, error: 'no request' });
  const [userA, userB] = sortedPair(userId, otherId);
  return collection()
    .updateOne(
      { userA, userB, status: 'pending', requesterId: new ObjectId(otherId) },
      { $set: { status: 'accepted' } },
    )
    .then((res) =>
      res.matchedCount > 0
        ? { ok: true as const }
        : { ok: false as const, error: 'no request' },
    );
}

export function removeFriend(
  userId: string,
  otherId: string,
): Promise<MutationResult> {
  if (!ObjectId.isValid(otherId)) return Promise.resolve({ ok: true as const });
  const [userA, userB] = sortedPair(userId, otherId);
  return collection()
    .deleteOne({ userA, userB })
    .then(() => ({ ok: true as const }));
}
