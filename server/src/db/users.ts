import { ObjectId, WithId } from 'mongodb';
import { ensureCollection, getCollection } from './mongo';

const NAME = 'users';

export interface ClientSettings {
  muted: boolean;
  volume: number;
  animationsDisabled: boolean;
}

export interface GameSettings {
  mapName: string;
  mapGeneration: { seed: string; size: string; water: string } | null;
  slots: number;
  gameMode: string;
  blitz: string;
  defenceDice: number;
  cards: string;
  placement: string;
  fortification: string;
  entrenchments: string;
  toxins: string;
  portals: string;
  radiations: string;
  starvation: string;
  roundTroops: string;
  bounties: string;
  supplyLines: string;
  fogOfWar: string;
  alliances: string;
  turnDuration: number;
  disconnectBotDifficulty: string;
  disconnectBotPersonality: string;
  visibility: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailValidated: boolean;
  elo: number;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
}

interface UserDoc {
  username: string;
  username_lower: string;
  email: string;
  email_normalized: string;
  password: string;
  validated_email: boolean;
  elo?: number;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
}

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

export const MAP_SIZES = ['small', 'medium', 'large', 'xlarge'];
export const WATER_LEVELS = ['land', 'mixed', 'ocean'];

export const GAME_ENUMS: Record<string, unknown[]> = {
  gameMode: [
    'Supremacy',
    'Supremacy 3/4',
    'Supremacy 2/3',
    'Capitals',
    'Team Deathmatch',
    'Continent',
    '5-Round',
    '10-Round',
    'Assassin',
    'Mission',
    'Player Kills',
    'Troop Kills',
  ],
  blitz: ['Balanced', 'True'],
  defenceDice: [2, 3],
  cards: [
    'Constant',
    'Linear',
    'Exponential',
    'Linear Per Player',
    'Exponential Per Player',
  ],
  placement: ['Random', 'Semi', 'Custom'],
  fortification: ['Connected', 'Neighboring', 'Unrestricted'],
  entrenchments: ['off', 'on'],
  toxins: ['off', 'temporary', 'permanent'],
  portals: ['off', 'static', 'dynamic'],
  radiations: ['off', 'static', 'dynamic', 'expanding'],
  starvation: ['off', 'territory', 'total', 'percent'],
  roundTroops: ['off', 'on'],
  bounties: ['off', 'on'],
  supplyLines: ['off', 'on'],
  fogOfWar: ['off', 'on'],
  alliances: ['off', 'on'],
  turnDuration: [60, 90, 120, 150, 180, 300],
  disconnectBotDifficulty: ['idle', 'easy', 'medium', 'hard', 'random'],
  disconnectBotPersonality: [
    'balanced',
    'taker',
    'breaker',
    'killer',
    'vengeful',
    'erratic',
    'random',
  ],
  visibility: ['public', 'private'],
};

export const DEFAULT_ELO = 0;

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  muted: false,
  volume: 1,
  animationsDisabled: false,
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  mapName: 'World',
  mapGeneration: null,
  slots: 2,
  gameMode: 'Supremacy',
  blitz: 'Balanced',
  defenceDice: 2,
  cards: 'Constant',
  placement: 'Random',
  fortification: 'Connected',
  entrenchments: 'off',
  toxins: 'off',
  portals: 'off',
  radiations: 'off',
  starvation: 'off',
  roundTroops: 'off',
  bounties: 'off',
  supplyLines: 'off',
  fogOfWar: 'off',
  alliances: 'off',
  turnDuration: 120,
  disconnectBotDifficulty: 'random',
  disconnectBotPersonality: 'random',
  visibility: 'public',
};

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
        'clientSettings',
        'gameSettings',
      ],
      additionalProperties: false,
      properties: {
        _id: {},
        elo: { bsonType: 'number' },
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
        clientSettings: {
          bsonType: 'object',
          required: ['muted', 'volume', 'animationsDisabled'],
          additionalProperties: false,
          properties: {
            muted: { bsonType: 'bool' },
            volume: { bsonType: 'number', minimum: 0, maximum: 1 },
            animationsDisabled: { bsonType: 'bool' },
          },
        },
        gameSettings: {
          bsonType: 'object',
          required: [
            'mapName',
            'mapGeneration',
            'slots',
            ...Object.keys(GAME_ENUMS),
          ],
          additionalProperties: false,
          properties: {
            mapName: { bsonType: 'string' },
            mapGeneration: {
              bsonType: ['object', 'null'],
              required: ['seed', 'size', 'water'],
              additionalProperties: false,
              properties: {
                seed: { bsonType: 'string' },
                size: { enum: MAP_SIZES },
                water: { enum: WATER_LEVELS },
              },
            },
            slots: { bsonType: 'number', minimum: 2, maximum: 20 },
            ...Object.fromEntries(
              Object.entries(GAME_ENUMS).map(([key, values]) => [
                key,
                { enum: values },
              ]),
            ),
          },
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

export function ensureUsers(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex({ username_lower: 1 }, { unique: true }),
      collection().createIndex({ email_normalized: 1 }, { unique: true }),
      collection().createIndex({ elo: -1 }),
    ]),
  );
}

function sanitizeClientSettings(raw: unknown): ClientSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    muted:
      typeof r.muted === 'boolean' ? r.muted : DEFAULT_CLIENT_SETTINGS.muted,
    volume:
      typeof r.volume === 'number' && r.volume >= 0 && r.volume <= 1
        ? r.volume
        : DEFAULT_CLIENT_SETTINGS.volume,
    animationsDisabled:
      typeof r.animationsDisabled === 'boolean'
        ? r.animationsDisabled
        : DEFAULT_CLIENT_SETTINGS.animationsDisabled,
  };
}

function sanitizeMapGeneration(raw: unknown): GameSettings['mapGeneration'] {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.seed !== 'string' ||
    !MAP_SIZES.includes(r.size as string) ||
    !WATER_LEVELS.includes(r.water as string)
  )
    return null;
  return { seed: r.seed, size: r.size as string, water: r.water as string };
}

function sanitizeGameSettings(raw: unknown): GameSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  if (typeof r.mapName === 'string' && r.mapName.length <= 100)
    out.mapName = r.mapName;
  out.mapGeneration = sanitizeMapGeneration(r.mapGeneration);
  if (
    typeof r.slots === 'number' &&
    Number.isInteger(r.slots) &&
    r.slots >= 2 &&
    r.slots <= 20
  )
    out.slots = r.slots;
  const target = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(GAME_ENUMS)) {
    if (GAME_ENUMS[key].includes(r[key])) target[key] = r[key];
  }
  return out;
}

function toUser(doc: WithId<UserDoc>): User {
  return {
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    passwordHash: doc.password,
    emailValidated: doc.validated_email,
    elo: doc.elo ?? DEFAULT_ELO,
    clientSettings: sanitizeClientSettings(doc.clientSettings),
    gameSettings: sanitizeGameSettings(doc.gameSettings),
  };
}

export function findUserByUsername(username: string): Promise<User | null> {
  return collection()
    .findOne({ username_lower: normalizeUsername(username) })
    .then((doc) => (doc ? toUser(doc) : null));
}

export function findUserByEmail(email: string): Promise<User | null> {
  return collection()
    .findOne({ email_normalized: normalizeEmail(email) })
    .then((doc) => (doc ? toUser(doc) : null));
}

export function findUserById(id: string): Promise<User | null> {
  return collection()
    .findOne({ _id: new ObjectId(id) })
    .then((doc) => (doc ? toUser(doc) : null));
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
      { $set: { password: passwordHash, validated_email: true } },
    )
    .then(() => undefined);
}

export function saveSettings(
  userId: string,
  patch: { clientSettings?: unknown; gameSettings?: unknown },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.clientSettings !== undefined)
    set.clientSettings = sanitizeClientSettings(patch.clientSettings);
  if (patch.gameSettings !== undefined)
    set.gameSettings = sanitizeGameSettings(patch.gameSettings);
  if (Object.keys(set).length === 0) return Promise.resolve();
  return collection()
    .updateOne({ _id: new ObjectId(userId) }, { $set: set })
    .then(() => undefined);
}

export function searchUsers(
  regex: RegExp,
  limit: number,
): Promise<{ id: string; username: string }[]> {
  return collection()
    .find({ username: regex }, { projection: { username: 1 } })
    .sort({ username: 1 })
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
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .toArray()
    .then(
      (docs) =>
        new Map(
          docs.map((doc) => [doc._id.toString(), doc.elo ?? DEFAULT_ELO]),
        ),
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
              elo: doc.elo ?? DEFAULT_ELO,
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
      const elo = doc.elo ?? DEFAULT_ELO;
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
        };
      });
    });
}
