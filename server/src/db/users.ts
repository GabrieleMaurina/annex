import { BUILTIN_MAP_NAMES } from 'engine';
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
  mapGeneration: {
    seed: string;
    size: string;
    type: string;
    fill: string;
  } | null;
  slots: number;
  bots: { difficulty: string; personality: string }[];
  localPlayers: string[];
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
  nukes: string;
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

export interface HomeFilters {
  players: { id: string; label: string }[];
  name: string;
  mode: string;
  mapName: string;
  mapGenerationSize: string;
  mapGenerationType: string;
  mapGenerationFill: string;
  playersMin: number;
  playersMax: number;
  roundsMin: number;
  roundsMax: number;
  phase: string;
  password: string;
  hasBots: string;
  settings: Record<string, string>;
  sort: string;
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
  homeFilters: HomeFilters;
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
  homeFilters: HomeFilters;
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
export const FILL_VALUES = ['full', 'mixed', 'sparse'];
export const GENERATION_TYPES = ['terrain', 'dungeon', 'temple'];

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
  blitz: ['Balanced', 'True', 'Fair'],
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
  nukes: ['off', 'on'],
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

const BOT_DIFFICULTIES = GAME_ENUMS.disconnectBotDifficulty as string[];
const BOT_PERSONALITIES = GAME_ENUMS.disconnectBotPersonality as string[];
const MAX_SAVED_BOTS = 19;
const MAX_SAVED_LOCAL_PLAYERS = 19;
const MAX_PLAYER_NAME_LENGTH = 10;

const GENERATED_MAP_VALUE = 'generated';

const HOME_MODES = ['', ...(GAME_ENUMS.gameMode as string[])];
const HOME_MAP_NAMES = ['', GENERATED_MAP_VALUE, ...BUILTIN_MAP_NAMES];
const HOME_SIZES = ['', ...MAP_SIZES];
const HOME_GENERATION_TYPES = ['', ...GENERATION_TYPES];
const HOME_FILLS = ['', ...FILL_VALUES];
const HOME_PHASES = ['', 'lobby', 'playing', 'ended'];
const HOME_PASSWORDS = ['', 'yes', 'no'];
const HOME_HAS_BOTS = ['', 'yes', 'no'];
const HOME_SORTS = [
  'newest',
  'oldest',
  'mostPlayers',
  'fewestPlayers',
  'mostRounds',
  'fewestRounds',
  'nameAsc',
  'nameDesc',
];
const HOME_PLAYERS_MIN = 2;
const HOME_PLAYERS_MAX = 20;
const HOME_ROUNDS_MIN = 0;
const HOME_ROUNDS_MAX = 1000;
const MAX_FILTER_PLAYERS = 10;

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
  bots: [],
  localPlayers: [],
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
  nukes: 'off',
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

export const DEFAULT_HOME_FILTERS: HomeFilters = {
  players: [],
  name: '',
  mode: '',
  mapName: '',
  mapGenerationSize: '',
  mapGenerationType: '',
  mapGenerationFill: '',
  playersMin: HOME_PLAYERS_MIN,
  playersMax: HOME_PLAYERS_MAX,
  roundsMin: HOME_ROUNDS_MIN,
  roundsMax: HOME_ROUNDS_MAX,
  phase: '',
  password: '',
  hasBots: '',
  settings: {},
  sort: 'newest',
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
        'homeFilters',
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
            'bots',
            'localPlayers',
            ...Object.keys(GAME_ENUMS),
          ],
          additionalProperties: false,
          properties: {
            mapName: { bsonType: 'string' },
            bots: {
              bsonType: 'array',
              maxItems: MAX_SAVED_BOTS,
              items: {
                bsonType: 'object',
                required: ['difficulty', 'personality'],
                additionalProperties: false,
                properties: {
                  difficulty: { enum: BOT_DIFFICULTIES },
                  personality: { enum: BOT_PERSONALITIES },
                },
              },
            },
            localPlayers: {
              bsonType: 'array',
              maxItems: MAX_SAVED_LOCAL_PLAYERS,
              items: { bsonType: 'string', maxLength: MAX_PLAYER_NAME_LENGTH },
            },
            mapGeneration: {
              bsonType: ['object', 'null'],
              required: ['seed', 'size', 'type', 'fill'],
              additionalProperties: false,
              properties: {
                seed: { bsonType: 'string' },
                size: { enum: MAP_SIZES },
                type: { enum: GENERATION_TYPES },
                fill: { enum: FILL_VALUES },
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
        homeFilters: {
          bsonType: 'object',
          required: [
            'players',
            'name',
            'mode',
            'mapName',
            'mapGenerationSize',
            'mapGenerationType',
            'mapGenerationFill',
            'playersMin',
            'playersMax',
            'roundsMin',
            'roundsMax',
            'phase',
            'password',
            'hasBots',
            'settings',
            'sort',
          ],
          additionalProperties: false,
          properties: {
            players: {
              bsonType: 'array',
              maxItems: MAX_FILTER_PLAYERS,
              items: {
                bsonType: 'object',
                required: ['id', 'label'],
                additionalProperties: false,
                properties: {
                  id: { bsonType: 'string' },
                  label: { bsonType: 'string', maxLength: 10 },
                },
              },
            },
            name: { bsonType: 'string', maxLength: 20 },
            mode: { enum: HOME_MODES },
            mapName: { enum: HOME_MAP_NAMES },
            mapGenerationSize: { enum: HOME_SIZES },
            mapGenerationType: { enum: HOME_GENERATION_TYPES },
            mapGenerationFill: { enum: HOME_FILLS },
            playersMin: {
              bsonType: 'number',
              minimum: HOME_PLAYERS_MIN,
              maximum: HOME_PLAYERS_MAX,
            },
            playersMax: {
              bsonType: 'number',
              minimum: HOME_PLAYERS_MIN,
              maximum: HOME_PLAYERS_MAX,
            },
            roundsMin: {
              bsonType: 'number',
              minimum: HOME_ROUNDS_MIN,
              maximum: HOME_ROUNDS_MAX,
            },
            roundsMax: {
              bsonType: 'number',
              minimum: HOME_ROUNDS_MIN,
              maximum: HOME_ROUNDS_MAX,
            },
            phase: { enum: HOME_PHASES },
            password: { enum: HOME_PASSWORDS },
            hasBots: { enum: HOME_HAS_BOTS },
            settings: {
              bsonType: 'object',
              additionalProperties: false,
              properties: Object.fromEntries(
                Object.entries(GAME_ENUMS).map(([key, values]) => [
                  key,
                  { enum: values.map(String) },
                ]),
              ),
            },
            sort: { enum: HOME_SORTS },
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
    !GENERATION_TYPES.includes(r.type as string) ||
    !FILL_VALUES.includes(r.fill as string)
  )
    return null;
  return {
    seed: r.seed,
    size: r.size as string,
    type: r.type as string,
    fill: r.fill as string,
  };
}

function sanitizeSavedBots(raw: unknown): GameSettings['bots'] {
  if (!Array.isArray(raw)) return [];
  const out: GameSettings['bots'] = [];
  for (const item of raw) {
    if (out.length >= MAX_SAVED_BOTS) break;
    const r = (item ?? {}) as Record<string, unknown>;
    if (
      typeof r.difficulty === 'string' &&
      BOT_DIFFICULTIES.includes(r.difficulty) &&
      typeof r.personality === 'string' &&
      BOT_PERSONALITIES.includes(r.personality)
    )
      out.push({ difficulty: r.difficulty, personality: r.personality });
  }
  return out;
}

function sanitizeLocalPlayers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= MAX_SAVED_LOCAL_PLAYERS) break;
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
    if (trimmed) out.push(trimmed);
  }
  return out;
}

function sanitizeGameSettings(raw: unknown): GameSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  if (typeof r.mapName === 'string' && r.mapName.length <= 100)
    out.mapName = r.mapName;
  out.mapGeneration = sanitizeMapGeneration(r.mapGeneration);
  out.bots = sanitizeSavedBots(r.bots);
  out.localPlayers = sanitizeLocalPlayers(r.localPlayers);
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

function pickEnum(value: unknown, allowed: string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value)
    ? value
    : fallback;
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback;
}

function sanitizeFilterPlayers(raw: unknown): { id: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { id: string; label: string }[] = [];
  for (const item of raw) {
    if (out.length >= MAX_FILTER_PLAYERS) break;
    const r = (item ?? {}) as Record<string, unknown>;
    if (
      typeof r.id === 'string' &&
      /^[a-f\d]{24}$/i.test(r.id) &&
      typeof r.label === 'string' &&
      r.label.length <= 10
    )
      out.push({ id: r.id, label: r.label });
  }
  return out;
}

function sanitizeFilterSettings(raw: unknown): Record<string, string> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of Object.keys(GAME_ENUMS)) {
    const value = r[key];
    if (
      typeof value === 'string' &&
      GAME_ENUMS[key].map(String).includes(value)
    )
      out[key] = value;
  }
  return out;
}

function sanitizeHomeFilters(raw: unknown): HomeFilters {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    players: sanitizeFilterPlayers(r.players),
    name: typeof r.name === 'string' ? r.name.slice(0, 20) : '',
    mode: pickEnum(r.mode, HOME_MODES, ''),
    mapName: pickEnum(r.mapName, HOME_MAP_NAMES, ''),
    mapGenerationSize: pickEnum(r.mapGenerationSize, HOME_SIZES, ''),
    mapGenerationType: pickEnum(r.mapGenerationType, HOME_GENERATION_TYPES, ''),
    mapGenerationFill: pickEnum(r.mapGenerationFill, HOME_FILLS, ''),
    playersMin: clampInt(
      r.playersMin,
      HOME_PLAYERS_MIN,
      HOME_PLAYERS_MAX,
      HOME_PLAYERS_MIN,
    ),
    playersMax: clampInt(
      r.playersMax,
      HOME_PLAYERS_MIN,
      HOME_PLAYERS_MAX,
      HOME_PLAYERS_MAX,
    ),
    roundsMin: clampInt(
      r.roundsMin,
      HOME_ROUNDS_MIN,
      HOME_ROUNDS_MAX,
      HOME_ROUNDS_MIN,
    ),
    roundsMax: clampInt(
      r.roundsMax,
      HOME_ROUNDS_MIN,
      HOME_ROUNDS_MAX,
      HOME_ROUNDS_MAX,
    ),
    phase: pickEnum(r.phase, HOME_PHASES, ''),
    password: pickEnum(r.password, HOME_PASSWORDS, ''),
    hasBots: pickEnum(r.hasBots, HOME_HAS_BOTS, ''),
    settings: sanitizeFilterSettings(r.settings),
    sort: pickEnum(r.sort, HOME_SORTS, 'newest'),
  };
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
    homeFilters: sanitizeHomeFilters(doc.homeFilters),
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
      homeFilters: { ...DEFAULT_HOME_FILTERS },
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
  createdAt: number;
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
          createdAt: doc._id.getTimestamp().getTime(),
        };
      });
    });
}
