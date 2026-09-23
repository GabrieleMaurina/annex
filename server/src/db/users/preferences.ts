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
    seas: boolean;
  } | null;
  playerMapId: string | null;
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
  blitz: ['Balanced', 'True', 'Fair', 'Off'],
  defenceDice: [2, 3],
  cards: [
    'Constant',
    'Linear',
    'Exponential',
    'Linear Per Player',
    'Exponential Per Player',
    'Off',
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
    'defensive',
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
const HOME_MAP_NAMES = ['', GENERATED_MAP_VALUE];
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

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  muted: false,
  volume: 1,
  animationsDisabled: false,
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  mapName: '',
  mapGeneration: null,
  playerMapId: null,
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

export const preferencesSchemaProperties = {
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
      'playerMapId',
      'slots',
      'bots',
      'localPlayers',
      ...Object.keys(GAME_ENUMS),
    ],
    additionalProperties: false,
    properties: {
      mapName: { bsonType: 'string' },
      playerMapId: { bsonType: ['string', 'null'] },
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
        required: ['seed', 'size', 'type', 'fill', 'seas'],
        additionalProperties: false,
        properties: {
          seed: { bsonType: 'string' },
          size: { enum: MAP_SIZES },
          type: { enum: GENERATION_TYPES },
          fill: { enum: FILL_VALUES },
          seas: { bsonType: 'bool' },
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
};

export function sanitizeClientSettings(raw: unknown): ClientSettings {
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
    !FILL_VALUES.includes(r.fill as string) ||
    typeof r.seas !== 'boolean'
  )
    return null;
  return {
    seed: r.seed,
    size: r.size as string,
    type: r.type as string,
    fill: r.fill as string,
    seas: r.seas,
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

export function sanitizeGameSettings(raw: unknown): GameSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  if (typeof r.mapName === 'string' && r.mapName.length <= 100)
    out.mapName = r.mapName;
  out.mapGeneration = sanitizeMapGeneration(r.mapGeneration);
  out.playerMapId =
    typeof r.playerMapId === 'string' && /^[a-f\d]{24}$/i.test(r.playerMapId)
      ? r.playerMapId
      : null;
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
  if (
    out.blitz === 'Off' &&
    (out.roundTroops === 'on' || !['Constant', 'Off'].includes(out.cards))
  )
    out.blitz = DEFAULT_GAME_SETTINGS.blitz;
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

export function sanitizeHomeFilters(raw: unknown): HomeFilters {
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
