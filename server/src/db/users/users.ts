import {
  effectiveReputation,
  MAX_REPUTATION,
  MIN_REPUTATION,
  TUTORIAL_IDS,
} from 'engine';
import { Binary, ObjectId, WithId } from 'mongodb';
import { COUNTRY_CODES } from '../../countries';
import { CollectionSpec, getCollection } from '../mongo';
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
import {
  DEFAULT_PRESETS,
  Preset,
  presetsSchemaProperties,
  sanitizePresets,
} from './presets';

const NAME = 'users';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailValidated: boolean;
  elo: number;
  country: string;
  createdAt: number;
  reputation: number;
  reputationRecoveryFrom: number | null;
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
  country: string;
  reputation: number;
  reputationRecoveryFrom: Date | null;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
  homeFilters: HomeFilters;
  presets: (Preset | null)[];
  tutorials: string[];
  picture: PictureDoc | null;
  bio: string;
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
export const MAX_BIO_LENGTH = 200;
const MAX_TUTORIALS = 50;
const TUTORIAL_ID_PATTERN = /^[a-z-]{1,30}$/;

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
        'country',
        'reputation',
        'reputationRecoveryFrom',
        'clientSettings',
        'gameSettings',
        'homeFilters',
        'presets',
        'tutorials',
        'picture',
        'bio',
      ],
      additionalProperties: false,
      properties: {
        _id: {},
        elo: { bsonType: 'number' },
        country: { enum: COUNTRY_CODES },
        reputation: {
          bsonType: 'int',
          minimum: MIN_REPUTATION,
          maximum: MAX_REPUTATION,
        },
        reputationRecoveryFrom: { bsonType: ['date', 'null'] },
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
        bio: { bsonType: 'string', maxLength: MAX_BIO_LENGTH },
        ...preferencesSchemaProperties,
        ...presetsSchemaProperties,
        tutorials: {
          bsonType: 'array',
          maxItems: MAX_TUTORIALS,
          items: { bsonType: 'string', pattern: TUTORIAL_ID_PATTERN.source },
        },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<UserDoc>(NAME);
}

export const USERS_COLLECTION: CollectionSpec = {
  name: NAME,
  schema,
  indexes: [
    { key: { username_lower: 1 }, options: { unique: true } },
    { key: { email_normalized: 1 }, options: { unique: true } },
    { key: { elo: -1 } },
  ],
};

function toUser(doc: WithId<UserDoc>): User {
  return {
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    passwordHash: doc.password,
    emailValidated: doc.validated_email,
    elo: doc.elo,
    country: doc.country,
    createdAt: doc._id.getTimestamp().getTime(),
    reputation: doc.reputation,
    reputationRecoveryFrom: doc.reputationRecoveryFrom?.getTime() ?? null,
    clientSettings: sanitizeClientSettings(doc.clientSettings),
    gameSettings: sanitizeGameSettings(doc.gameSettings),
    homeFilters: sanitizeHomeFilters(doc.homeFilters),
  };
}

export function findUserByUsername(username: string): Promise<User | null> {
  return collection()
    .findOne(
      { username_lower: normalizeUsername(username) },
      { projection: { picture: 0, presets: 0 } },
    )
    .then((doc) => (doc ? toUser(doc) : null));
}

export function findUserByEmail(email: string): Promise<User | null> {
  return collection()
    .findOne(
      { email_normalized: normalizeEmail(email) },
      { projection: { picture: 0, presets: 0 } },
    )
    .then((doc) => (doc ? toUser(doc) : null));
}

export function findUserById(id: string): Promise<User | null> {
  return collection()
    .findOne(
      { _id: new ObjectId(id) },
      { projection: { picture: 0, presets: 0 } },
    )
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
): Promise<boolean> {
  return collection()
    .updateOne(
      {
        _id: new ObjectId(userId),
        'picture.id': pictureId,
        'picture.dangerous': false,
      },
      { $set: { 'picture.dangerous': true } },
    )
    .then((res) => res.modifiedCount === 1);
}

export function insertUser(data: {
  username: string;
  email: string;
  passwordHash: string;
  country: string;
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
      country: data.country,
      reputation: 0,
      reputationRecoveryFrom: null,
      clientSettings: { ...DEFAULT_CLIENT_SETTINGS },
      gameSettings: { ...DEFAULT_GAME_SETTINGS },
      homeFilters: { ...DEFAULT_HOME_FILTERS },
      presets: [...DEFAULT_PRESETS],
      tutorials: [],
      picture: null,
      bio: '',
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

export function setReputationState(
  userId: string,
  reputation: number,
  recoveryFrom: number | null,
): Promise<void> {
  return collection()
    .updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          reputation,
          reputationRecoveryFrom:
            recoveryFrom === null ? null : new Date(recoveryFrom),
        },
      },
    )
    .then(() => undefined);
}

export function setCountry(userId: string, country: string): Promise<void> {
  return collection()
    .updateOne({ _id: new ObjectId(userId) }, { $set: { country } })
    .then(() => undefined);
}

export function setBio(userId: string, bio: string): Promise<void> {
  return collection()
    .updateOne({ _id: new ObjectId(userId) }, { $set: { bio } })
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

export function getUserPresets(userId: string): Promise<(Preset | null)[]> {
  return collection()
    .findOne({ _id: new ObjectId(userId) }, { projection: { presets: 1 } })
    .then((doc) => sanitizePresets(doc?.presets));
}

export function saveUserPresets(
  userId: string,
  raw: unknown,
): Promise<(Preset | null)[]> {
  const presets = sanitizePresets(raw);
  return collection()
    .updateOne({ _id: new ObjectId(userId) }, { $set: { presets } })
    .then(() => presets);
}

export function getUserTutorials(userId: string): Promise<string[]> {
  return collection()
    .findOne({ _id: new ObjectId(userId) }, { projection: { tutorials: 1 } })
    .then((doc) => doc?.tutorials ?? []);
}

export function addUserTutorial(
  userId: string,
  tutorialId: unknown,
): Promise<string[] | null> {
  if (typeof tutorialId !== 'string' || !TUTORIAL_IDS.includes(tutorialId))
    return Promise.resolve(null);
  return collection()
    .findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $addToSet: { tutorials: tutorialId } },
      { returnDocument: 'after', projection: { tutorials: 1 } },
    )
    .then((doc) => doc?.tutorials ?? null);
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

export function getCountriesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return Promise.resolve(new Map());
  return collection()
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { projection: { country: 1 } },
    )
    .toArray()
    .then(
      (docs) => new Map(docs.map((doc) => [doc._id.toString(), doc.country])),
    );
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

export interface CareerTotals {
  playersKilled: number;
  troopsGained: number;
  troopsKilled: number;
  troopsLost: number;
  territoriesConquered: number;
  capitalsConquered: number;
  setsPlayed: number;
}

interface GameStats extends CareerTotals {
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
    .aggregate<GameStats & { _id: string }>([
      { $match: { 'players.userId': { $in: userIds } } },
      { $project: { players: 1, results: 1, draw: 1 } },
      { $unwind: '$players' },
      { $match: { 'players.userId': { $in: userIds } } },
      {
        $addFields: {
          _result: {
            $first: {
              $filter: {
                input: '$results',
                as: 'r',
                cond: { $eq: ['$$r.playerId', '$players.playerId'] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$players.userId',
          gamesPlayed: { $sum: 1 },
          placingSum: { $sum: '$_result.rank' },
          wins: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ['$_result.rank', 0] }, { $not: ['$draw'] }],
                },
                1,
                0,
              ],
            },
          },
          playersKilled: {
            $sum: { $size: { $ifNull: ['$_result.playersKilled', []] } },
          },
          troopsGained: { $sum: '$_result.troopsGained' },
          troopsKilled: { $sum: '$_result.troopsKilled' },
          troopsLost: { $sum: '$_result.troopsLost' },
          territoriesConquered: { $sum: '$_result.territoriesConquered' },
          capitalsConquered: { $sum: '$_result.capitalsConquered' },
          setsPlayed: { $sum: '$_result.setsPlayed' },
        },
      },
    ])
    .toArray()
    .then((rows) => new Map(rows.map(({ _id, ...stats }) => [_id, stats])));
}

function averagePlacing(stats: GameStats | undefined): number | null {
  if (!stats || stats.gamesPlayed === 0) return null;
  return stats.placingSum / stats.gamesPlayed + 1;
}

export interface PlayerRow {
  id: string;
  username: string;
  elo: number;
  country: string;
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

export interface PlayerProfile extends CareerTotals {
  id: string;
  username: string;
  elo: number;
  country: string;
  gamesPlayed: number;
  wins: number;
  averagePlacing: number | null;
  percentile: number;
  createdAt: number;
  reputation: number;
  picture: string | null;
  bio: string;
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
    .find(filter, { projection: { username: 1, elo: 1, country: 1 } })
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
              country: doc.country,
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
    .findOne(
      { username_lower: normalizeUsername(username) },
      { projection: { presets: 0 } },
    )
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
          country: doc.country,
          gamesPlayed: stats?.gamesPlayed ?? 0,
          wins: stats?.wins ?? 0,
          averagePlacing: averagePlacing(stats),
          playersKilled: stats?.playersKilled ?? 0,
          troopsGained: stats?.troopsGained ?? 0,
          troopsKilled: stats?.troopsKilled ?? 0,
          troopsLost: stats?.troopsLost ?? 0,
          territoriesConquered: stats?.territoriesConquered ?? 0,
          capitalsConquered: stats?.capitalsConquered ?? 0,
          setsPlayed: stats?.setsPlayed ?? 0,
          percentile: total > 1 ? Math.round((lower / (total - 1)) * 100) : 100,
          createdAt: doc._id.getTimestamp().getTime(),
          reputation: effectiveReputation(
            doc.reputation,
            doc.reputationRecoveryFrom?.getTime() ?? null,
            Date.now(),
          ),
          picture:
            doc.picture && !doc.picture.dangerous
              ? `data:${doc.picture.mime};base64,${Buffer.from(
                  doc.picture.data.buffer,
                ).toString('base64')}`
              : null,
          bio: doc.bio,
        };
      });
    });
}
