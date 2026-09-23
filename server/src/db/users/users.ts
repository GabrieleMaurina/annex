import { Binary, ObjectId, WithId } from 'mongodb';
import { ensureCollection, getCollection } from '../mongo';
import {
  ClientSettings,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  DEFAULT_HOME_FILTERS,
  GameSettings,
  HomeFilters,
  preferencesSchemaProperties,
  sanitizeClientSettings,
  sanitizeGameSettings,
  sanitizeHomeFilters,
} from './preferences';

const NAME = 'users';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailValidated: boolean;
  elo: number;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
  homeFilters: HomeFilters;
}

interface PictureDoc {
  id: string;
  data: Binary;
  mime: string;
  dangerous: boolean;
}

interface UserDoc {
  username: string;
  username_lower: string;
  email: string;
  email_normalized: string;
  password: string;
  validated_email: boolean;
  elo: number;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
  homeFilters: HomeFilters;
  picture: PictureDoc | null;
}

export interface StoredPicture {
  id: string;
  data: string;
  mime: string;
  dangerous: boolean;
}

const PICTURE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 0) return lower;
  const local = lower.slice(0, at).replace(/\./g, '');
  return (local.split('+')[0] || local) + lower.slice(at);
}

export const DEFAULT_ELO = 0;

const schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'username',
        'username_lower',
        'email',
        'email_normalized',
        'password',
        'validated_email',
        'elo',
        'clientSettings',
        'gameSettings',
        'homeFilters',
        'picture',
      ],
      additionalProperties: false,
      properties: {
        _id: {},
        elo: { bsonType: 'number' },
        picture: {
          bsonType: ['object', 'null'],
          required: ['id', 'data', 'mime', 'dangerous'],
          additionalProperties: false,
          properties: {
            id: { bsonType: 'string' },
            data: { bsonType: 'binData' },
            mime: { enum: PICTURE_MIMES },
            dangerous: { bsonType: 'bool' },
          },
        },
        username: {
          bsonType: 'string',
          maxLength: 10,
          pattern: '^[A-Za-z0-9]+$',
        },
        username_lower: {
          bsonType: 'string',
          maxLength: 10,
          pattern: '^[a-z0-9]+$',
        },
        email: {
          bsonType: 'string',
          maxLength: 50,
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
        email_normalized: {
          bsonType: 'string',
          maxLength: 50,
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
        password: { bsonType: 'string' },
        validated_email: { bsonType: 'bool' },
        ...preferencesSchemaProperties,
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<UserDoc>(NAME);
}

export function ensureUsers(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex({ username_lower: 1 }, { unique: true }),
      collection().createIndex({ email_normalized: 1 }, { unique: true }),
      collection().createIndex({ elo: -1 }),
    ]),
  );
}

function toUser(doc: WithId<UserDoc>): User {
  return {
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    passwordHash: doc.password,
    emailValidated: doc.validated_email,
    elo: doc.elo,
    clientSettings: sanitizeClientSettings(doc.clientSettings),
    gameSettings: sanitizeGameSettings(doc.gameSettings),
    homeFilters: sanitizeHomeFilters(doc.homeFilters),
  };
}

export function findUserByUsername(username: string): Promise<User | null> {
  return collection()
    .findOne(
      { username_lower: normalizeUsername(username) },
      { projection: { picture: 0 } },
    )
    .then((doc) => (doc ? toUser(doc) : null));
}

export function findUserByEmail(email: string): Promise<User | null> {
  return collection()
    .findOne(
      { email_normalized: normalizeEmail(email) },
      { projection: { picture: 0 } },
    )
    .then((doc) => (doc ? toUser(doc) : null));
}

export function findUserById(id: string): Promise<User | null> {
  return collection()
    .findOne({ _id: new ObjectId(id) }, { projection: { picture: 0 } })
    .then((doc) => (doc ? toUser(doc) : null));
}

export function getUserPicture(id: string): Promise<StoredPicture | null> {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return collection()
    .findOne({ _id: new ObjectId(id) }, { projection: { picture: 1 } })
    .then((doc) => {
      const picture = doc?.picture;
      if (!picture) return null;
      return {
        id: picture.id,
        data: Buffer.from(picture.data.buffer).toString('base64'),
        mime: picture.mime,
        dangerous: picture.dangerous,
      };
    });
}

export function setUserPicture(
  userId: string,
  picture: { id: string; data: Buffer; mime: string },
): Promise<void> {
  return collection()
    .updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          picture: {
            id: picture.id,
            data: new Binary(picture.data),
            mime: picture.mime,
            dangerous: false,
          },
        },
      },
    )
    .then(() => undefined);
}

export function unsetUserPicture(userId: string): Promise<void> {
  return collection()
    .updateOne({ _id: new ObjectId(userId) }, { $set: { picture: null } })
    .then(() => undefined);
}

export function markPictureDangerous(
  userId: string,
  pictureId: string,
): Promise<void> {
  return collection()
    .updateOne(
      { _id: new ObjectId(userId), 'picture.id': pictureId },
      { $set: { 'picture.dangerous': true } },
    )
    .then(() => undefined);
}

export function insertUser(data: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<{ id: string } | { duplicate: true }> {
  return collection()
    .insertOne({
      username: data.username,
      username_lower: normalizeUsername(data.username),
      email: data.email,
      email_normalized: normalizeEmail(data.email),
      password: data.passwordHash,
      validated_email: false,
      elo: DEFAULT_ELO,
      clientSettings: { ...DEFAULT_CLIENT_SETTINGS },
      gameSettings: { ...DEFAULT_GAME_SETTINGS },
      homeFilters: { ...DEFAULT_HOME_FILTERS },
      picture: null,
    })
    .then((res) => ({ id: res.insertedId.toString() }))
    .catch((error: { code?: number }) => {
      if (error?.code === 11000) return { duplicate: true as const };
      throw error;
    });
}

export function markEmailValidated(userId: string): Promise<void> {
  return collection()
    .updateOne(
      { _id: new ObjectId(userId) },
      { $set: { validated_email: true } },
    )
    .then(() => undefined);
}

export function setPassword(
  userId: string,
  passwordHash: string,
): Promise<void> {
  return collection()
    .updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: passwordHash } },
    )
    .then(() => undefined);
}

export function saveSettings(
  userId: string,
  patch: {
    clientSettings?: unknown;
    gameSettings?: unknown;
    homeFilters?: unknown;
  },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.clientSettings !== undefined)
    set.clientSettings = sanitizeClientSettings(patch.clientSettings);
  if (patch.gameSettings !== undefined)
    set.gameSettings = sanitizeGameSettings(patch.gameSettings);
  if (patch.homeFilters !== undefined)
    set.homeFilters = sanitizeHomeFilters(patch.homeFilters);
  if (Object.keys(set).length === 0) return Promise.resolve();
  return collection()
    .updateOne({ _id: new ObjectId(userId) }, { $set: set })
    .then(() => undefined);
}

export function searchUsers(
  query: string,
  limit: number,
): Promise<{ id: string; username: string }[]> {
  const prefix = new RegExp('^' + escapeRegex(normalizeUsername(query)));
  return collection()
    .find({ username_lower: prefix }, { projection: { username: 1 } })
    .sort({ username_lower: 1 })
    .limit(limit)
    .toArray()
    .then((docs) =>
      docs.map((doc) => ({ id: doc._id.toString(), username: doc.username })),
    );
}

export function getUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return Promise.resolve(new Map());
  return collection()
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { projection: { username: 1 } },
    )
    .toArray()
    .then(
      (docs) => new Map(docs.map((doc) => [doc._id.toString(), doc.username])),
    );
}

export function getElosByIds(ids: string[]): Promise<Map<string, number>> {
  return collection()
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { projection: { elo: 1 } },
    )
    .toArray()
    .then((docs) => new Map(docs.map((doc) => [doc._id.toString(), doc.elo])));
}

export function setElos(
  updates: { userId: string; elo: number }[],
): Promise<void> {
  if (updates.length === 0) return Promise.resolve();
  return collection()
    .bulkWrite(
      updates.map((update) => ({
        updateOne: {
          filter: { _id: new ObjectId(update.userId) },
          update: { $set: { elo: update.elo } },
        },
      })),
    )
    .then(() => undefined);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface GameStats {
  gamesPlayed: number;
  placingSum: number;
  wins: number;
}

interface GamesCollectionDoc {
  players: { userId: string | null; playerId: number }[];
  results: { playerId: number; rank: number }[];
}

function computeGameStats(userIds: string[]): Promise<Map<string, GameStats>> {
  if (userIds.length === 0) return Promise.resolve(new Map());
  return getCollection<GamesCollectionDoc>('games')
    .aggregate<{
      _id: string;
      gamesPlayed: number;
      placingSum: number;
      wins: number;
    }>([
      { $match: { 'players.userId': { $in: userIds } } },
      { $project: { players: 1, results: 1 } },
      { $unwind: '$players' },
      { $match: { 'players.userId': { $in: userIds } } },
      {
        $addFields: {
          _rank: {
            $first: {
              $map: {
                input: {
                  $filter: {
                    input: '$results',
                    as: 'r',
                    cond: { $eq: ['$$r.playerId', '$players.playerId'] },
                  },
                },
                as: 'r',
                in: '$$r.rank',
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$players.userId',
          gamesPlayed: { $sum: 1 },
          placingSum: { $sum: '$_rank' },
          wins: { $sum: { $cond: [{ $eq: ['$_rank', 0] }, 1, 0] } },
        },
      },
    ])
    .toArray()
    .then(
      (rows) =>
        new Map(
          rows.map((r) => [
            r._id,
            {
              gamesPlayed: r.gamesPlayed,
              placingSum: r.placingSum,
              wins: r.wins,
            },
          ]),
        ),
    );
}

function averagePlacing(stats: GameStats | undefined): number | null {
  if (!stats || stats.gamesPlayed === 0) return null;
  return stats.placingSum / stats.gamesPlayed + 1;
}

export interface PlayerRow {
  id: string;
  username: string;
  elo: number;
  gamesPlayed: number;
}

export interface PlayersQuery {
  page: number;
  pageSize: number;
  username?: string;
  eloMin?: number;
  eloMax?: number;
  gamesMin?: number;
  gamesMax?: number;
  sort: 'elo' | 'username' | 'games';
  sortDir: 'asc' | 'desc';
}

export interface PlayersPage {
  players: PlayerRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlayerProfile {
  id: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  averagePlacing: number | null;
  percentile: number;
  createdAt: number;
  picture: string | null;
}

export function listPlayers(query: PlayersQuery): Promise<PlayersPage> {
  const filter: Record<string, unknown> = {};
  if (query.username)
    filter.username = new RegExp(escapeRegex(query.username), 'i');
  if (query.eloMin !== undefined || query.eloMax !== undefined) {
    const range: Record<string, number> = {};
    if (query.eloMin !== undefined) range.$gte = query.eloMin;
    if (query.eloMax !== undefined) range.$lte = query.eloMax;
    filter.elo = range;
  }

  return collection()
    .find(filter, { projection: { username: 1, elo: 1 } })
    .toArray()
    .then((docs) =>
      computeGameStats(docs.map((doc) => doc._id.toString())).then(
        (statsById) => {
          let rows: PlayerRow[] = docs.map((doc) => {
            const id = doc._id.toString();
            const stats = statsById.get(id);
            return {
              id,
              username: doc.username,
              elo: doc.elo,
              gamesPlayed: stats?.gamesPlayed ?? 0,
            };
          });

          if (query.gamesMin !== undefined)
            rows = rows.filter((r) => r.gamesPlayed >= query.gamesMin!);
          if (query.gamesMax !== undefined)
            rows = rows.filter((r) => r.gamesPlayed <= query.gamesMax!);

          const dir = query.sortDir === 'asc' ? 1 : -1;
          rows.sort((a, b) => {
            if (query.sort === 'username')
              return dir * a.username.localeCompare(b.username);
            if (query.sort === 'games')
              return dir * (a.gamesPlayed - b.gamesPlayed);
            return dir * (a.elo - b.elo);
          });

          const total = rows.length;
          const start = (query.page - 1) * query.pageSize;
          return {
            players: rows.slice(start, start + query.pageSize),
            total,
            page: query.page,
            pageSize: query.pageSize,
          };
        },
      ),
    );
}

export function getPlayerProfile(
  username: string,
): Promise<PlayerProfile | null> {
  return collection()
    .findOne({ username_lower: normalizeUsername(username) })
    .then((doc) => {
      if (!doc) return null;
      const elo = doc.elo;
      const id = doc._id.toString();
      return Promise.all([
        collection().countDocuments({}),
        collection().countDocuments({ elo: { $lt: elo } }),
        computeGameStats([id]),
      ]).then(([total, lower, statsById]) => {
        const stats = statsById.get(id);
        return {
          id,
          username: doc.username,
          elo,
          gamesPlayed: stats?.gamesPlayed ?? 0,
          wins: stats?.wins ?? 0,
          averagePlacing: averagePlacing(stats),
          percentile: total > 1 ? Math.round((lower / (total - 1)) * 100) : 100,
          createdAt: doc._id.getTimestamp().getTime(),
          picture:
            doc.picture && !doc.picture.dangerous
              ? `data:${doc.picture.mime};base64,${Buffer.from(
                  doc.picture.data.buffer,
                ).toString('base64')}`
              : null,
        };
      });
    });
}
