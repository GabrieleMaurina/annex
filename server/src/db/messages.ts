import { containsProfanity } from 'engine';
import { ObjectId } from 'mongodb';
import { ensureCollection, getCollection } from './mongo';
import {
  DEFAULT_ELO,
  findUserById,
  getElosByIds,
  getUsernamesByIds,
} from './users';

const MESSAGES = 'messages';
const BLOCKS = 'blocks';

export const MAX_MESSAGE_LENGTH = 1000;
export const MESSAGE_MIN_INTERVAL_MS = 1000;
export const MESSAGE_DAILY_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

interface MessageDoc {
  senderId: ObjectId;
  recipientId: ObjectId;
  text: string;
  createdAt: Date;
}

interface BlockDoc {
  blockerId: ObjectId;
  blockedId: ObjectId;
  createdAt: Date;
}

export interface ConversationMessage {
  fromMe: boolean;
  text: string;
  createdAt: number;
}

export interface Conversation {
  userId: string;
  username: string;
  elo: number;
  messages: ConversationMessage[];
}

export interface BlockedPlayer {
  userId: string;
  username: string;
  elo: number;
}

export interface MessagesOverview {
  conversations: Conversation[];
  blocked: BlockedPlayer[];
}

type MutationResult = { ok: true } | { ok: false; error: string };

const messagesSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['senderId', 'recipientId', 'text', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id: {},
        senderId: { bsonType: 'objectId' },
        recipientId: { bsonType: 'objectId' },
        text: {
          bsonType: 'string',
          minLength: 1,
          maxLength: MAX_MESSAGE_LENGTH,
        },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

const blocksSchema = {
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

function messages() {
  return getCollection<MessageDoc>(MESSAGES);
}

function blocks() {
  return getCollection<BlockDoc>(BLOCKS);
}

export function ensureMessages(): Promise<unknown> {
  return Promise.all([
    ensureCollection(MESSAGES, messagesSchema).then(() =>
      Promise.all([
        messages().createIndex({ senderId: 1, createdAt: -1 }),
        messages().createIndex({ recipientId: 1, createdAt: -1 }),
      ]),
    ),
    ensureCollection(BLOCKS, blocksSchema).then(() =>
      blocks().createIndex({ blockerId: 1, blockedId: 1 }, { unique: true }),
    ),
  ]);
}

export function getMessagesOverview(userId: string): Promise<MessagesOverview> {
  const me = new ObjectId(userId);
  return Promise.all([
    messages()
      .find({ $or: [{ senderId: me }, { recipientId: me }] })
      .sort({ createdAt: 1 })
      .toArray(),
    blocks().find({ blockerId: me }).toArray(),
  ]).then(([msgs, blockDocs]) => {
    const blockedIds = new Set(
      blockDocs.map((doc) => doc.blockedId.toString()),
    );
    const threads = new Map<string, ConversationMessage[]>();
    const lastAt = new Map<string, number>();
    for (const msg of msgs) {
      const fromMe = msg.senderId.equals(me);
      const other = (fromMe ? msg.recipientId : msg.senderId).toString();
      if (blockedIds.has(other)) continue;
      const at = msg.createdAt.getTime();
      const list = threads.get(other) ?? [];
      list.push({ fromMe, text: msg.text, createdAt: at });
      threads.set(other, list);
      lastAt.set(other, at);
    }

    const ids = new Set<string>([...threads.keys(), ...blockedIds]);
    if (ids.size === 0)
      return { conversations: [], blocked: [] } satisfies MessagesOverview;

    const idList = [...ids];
    return Promise.all([getUsernamesByIds(idList), getElosByIds(idList)]).then(
      ([names, elos]) => {
        const name = (id: string) => names.get(id) ?? '?';
        const elo = (id: string) => elos.get(id) ?? DEFAULT_ELO;

        const conversations: Conversation[] = [...threads.entries()]
          .map(([id, list]) => ({
            userId: id,
            username: name(id),
            elo: elo(id),
            messages: list,
          }))
          .sort(
            (a, b) => (lastAt.get(b.userId) ?? 0) - (lastAt.get(a.userId) ?? 0),
          );

        const blocked: BlockedPlayer[] = [...blockedIds].map((id) => ({
          userId: id,
          username: name(id),
          elo: elo(id),
        }));

        return { conversations, blocked };
      },
    );
  });
}

function isBlocked(blockerId: ObjectId, blockedId: ObjectId): Promise<boolean> {
  return blocks()
    .findOne({ blockerId, blockedId })
    .then((doc) => !!doc);
}

export function sendMessage(
  senderId: string,
  recipientId: string,
  rawText: string,
): Promise<MutationResult> {
  if (senderId === recipientId)
    return Promise.resolve({
      ok: false as const,
      error: 'cannot message yourself',
    });
  if (!ObjectId.isValid(recipientId))
    return Promise.resolve({ ok: false as const, error: 'user not found' });

  const text = rawText.trim();
  const sender = new ObjectId(senderId);
  const recipient = new ObjectId(recipientId);
  return findUserById(recipientId).then((user) => {
    if (!user) return { ok: false as const, error: 'user not found' };
    return isBlocked(sender, recipient).then((blocked) => {
      if (blocked) return { ok: false as const, error: 'blocked' };
      if (!text) return { ok: false as const, error: 'empty message' };
      if (text.length > MAX_MESSAGE_LENGTH)
        return { ok: false as const, error: 'message too long' };
      if (containsProfanity(text))
        return { ok: false as const, error: 'message contains profanity' };
      return Promise.all([
        messages()
          .find({ senderId: sender })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray(),
        messages().countDocuments({
          senderId: sender,
          createdAt: { $gte: new Date(Date.now() - DAY_MS) },
        }),
      ]).then(([recent, dayCount]) => {
        if (
          recent[0] &&
          Date.now() - recent[0].createdAt.getTime() < MESSAGE_MIN_INTERVAL_MS
        )
          return { ok: false as const, error: 'too fast' };
        if (dayCount >= MESSAGE_DAILY_LIMIT)
          return { ok: false as const, error: 'daily limit reached' };
        return messages()
          .insertOne({
            senderId: sender,
            recipientId: recipient,
            text,
            createdAt: new Date(),
          })
          .then(() => ({ ok: true as const }));
      });
    });
  });
}

export function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<MutationResult> {
  if (blockerId === blockedId)
    return Promise.resolve({
      ok: false as const,
      error: 'cannot block yourself',
    });
  if (!ObjectId.isValid(blockedId))
    return Promise.resolve({ ok: false as const, error: 'user not found' });
  return findUserById(blockedId).then((user) => {
    if (!user) return { ok: false as const, error: 'user not found' };
    return blocks()
      .updateOne(
        {
          blockerId: new ObjectId(blockerId),
          blockedId: new ObjectId(blockedId),
        },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      )
      .then((): MutationResult => ({ ok: true }))
      .catch((error: { code?: number }): MutationResult => {
        if (error?.code === 11000) return { ok: true };
        throw error;
      });
  });
}

export function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<MutationResult> {
  if (!ObjectId.isValid(blockedId))
    return Promise.resolve({ ok: true as const });
  return blocks()
    .deleteOne({
      blockerId: new ObjectId(blockerId),
      blockedId: new ObjectId(blockedId),
    })
    .then(() => ({ ok: true as const }));
}
