import { ObjectId } from 'mongodb';
import { UNKNOWN_COUNTRY } from '../countries';
import { getBlockedIds, isBlocked } from './conduct/blocks';
import { CollectionSpec, getCollection } from './mongo';
import {
  DEFAULT_ELO,
  findUserById,
  getCountriesByIds,
  getElosByIds,
  getUsernamesByIds,
} from './users/users';

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
  country: string;
}

export interface FriendsOverview {
  friends: FriendSummary[];
  incoming: FriendSummary[];
  outgoing: FriendSummary[];
  blocked: FriendSummary[];
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

export const FRIENDSHIPS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [
    { key: { userA: 1, userB: 1 }, options: { unique: true } },
    { key: { userB: 1 } },
  ],
};

function sortedPair(a: string, b: string): [ObjectId, ObjectId] {
  return a < b
    ? [new ObjectId(a), new ObjectId(b)]
    : [new ObjectId(b), new ObjectId(a)];
}

export function getFriendsOverview(userId: string): Promise<FriendsOverview> {
  const me = new ObjectId(userId);
  return Promise.all([
    collection()
      .find({ $or: [{ userA: me }, { userB: me }] })
      .sort({ createdAt: -1 })
      .toArray(),
    getBlockedIds(userId),
  ]).then(([allDocs, blockedIds]) => {
    const blocked = new Set(blockedIds);
    const otherOf = (doc: FriendshipDoc) =>
      (doc.userA.equals(me) ? doc.userB : doc.userA).toString();
    const docs = allDocs.filter(
      (doc) =>
        doc.status === 'accepted' ||
        doc.requesterId.equals(me) ||
        !blocked.has(otherOf(doc)),
    );
    const ids = [...docs.map(otherOf), ...blockedIds];
    return Promise.all([
      getUsernamesByIds(ids),
      getElosByIds(ids),
      getCountriesByIds(ids),
    ]).then(([names, elos, countries]) => {
      const summary = (id: string): FriendSummary => ({
        id,
        username: names.get(id) ?? '?',
        elo: elos.get(id) ?? DEFAULT_ELO,
        country: countries.get(id) ?? UNKNOWN_COUNTRY,
      });
      const overview: FriendsOverview = {
        friends: [],
        incoming: [],
        outgoing: [],
        blocked: blockedIds.map(summary),
      };
      for (const doc of docs) {
        const person = summary(otherOf(doc));
        if (doc.status === 'accepted') overview.friends.push(person);
        else if (doc.requesterId.equals(me)) overview.outgoing.push(person);
        else overview.incoming.push(person);
      }
      return overview;
    });
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
    const recipient = new ObjectId(recipientId);
    return Promise.all([
      collection().findOne({ userA, userB }),
      isBlocked(requester, recipient),
      isBlocked(recipient, requester),
    ]).then(([existing, blocking, blockedBy]) => {
      if (blocking) return { ok: false as const, error: 'blocked' };
      if (existing?.status === 'accepted')
        return { ok: false as const, error: 'already friends' };
      if (existing) {
        if (existing.requesterId.equals(requester))
          return { ok: false as const, error: 'request already sent' };
        if (blockedBy) return { ok: true as const };
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
  const other = new ObjectId(otherId);
  return isBlocked(new ObjectId(userId), other).then((blocked) => {
    if (blocked) return { ok: false as const, error: 'no request' };
    return collection()
      .updateOne(
        { userA, userB, status: 'pending', requesterId: other },
        { $set: { status: 'accepted' } },
      )
      .then((res) =>
        res.matchedCount > 0
          ? { ok: true as const }
          : { ok: false as const, error: 'no request' },
      );
  });
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
