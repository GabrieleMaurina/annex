import { GameExport } from 'engine';
import { ObjectId } from 'mongodb';
import { findMapIdsByName, getMapNamesByIds } from './maps';
import { ensureCollection, getCollection } from './mongo';
import {
  GAME_ENUMS,
  getUsernamesByIds,
  MAP_SIZES,
  WATER_LEVELS,
} from './users';

const NAME = 'games';

export interface GamePlayerDoc {
  playerId: number;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  botDifficulty: string | null;
  botPersonality: string | null;
  team: number;
  color: number;
  turnOrder: number;
  rank: number;
  won: boolean;
}

export type GameDoc = Omit<GameExport, 'players' | 'mapName'> & {
  mapId: string;
  players: GamePlayerDoc[];
};

export interface GameHistoryRow {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  mapName: string;
  gameMode: string;
  roundNumber: number;
  playerCount: number;
  winnerIds: number[];
  winnerNames: string[];
  yourRank: number | null;
  settings: GameDoc['settings'];
  players: { name: string; isBot: boolean; color: number; team: number }[];
}

export interface GamesQuery {
  page: number;
  pageSize: number;
  playerIds?: string[];
  playersMin?: number;
  playersMax?: number;
  mode?: string;
  mapName?: string;
  startedFrom?: number;
  startedTo?: number;
  endedFrom?: number;
  endedTo?: number;
  durationMin?: number;
  durationMax?: number;
  generatedMap?: boolean;
  mapGenerationSize?: string;
  mapGenerationWater?: string;
  minRounds?: number;
  maxRounds?: number;
  settings?: Record<string, string | number>;
  outcome?: 'won' | 'lost';
  positionMin?: number;
  positionMax?: number;
  userId?: string;
  viewerId?: string;
  rankUserId?: string;
  sort: 'newest' | 'rounds' | 'position';
  sortDir: 'asc' | 'desc';
}

export interface GamesPage {
  games: GameHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const int = { bsonType: 'number' };
const string = { bsonType: 'string' };
const bool = { bsonType: 'bool' };

function object(required: string[], properties: Record<string, unknown>) {
  return {
    bsonType: 'object',
    required,
    additionalProperties: false,
    properties,
  };
}

function array(items: unknown) {
  return { bsonType: 'array', items };
}

const territory = object(['id', 'ownerId', 'troops', 'entrenchedTurns'], {
  id: int,
  ownerId: int,
  troops: int,
  entrenchedTurns: int,
});

const toxinTerritory = object(['id', 'permanent', 'roundsRemaining'], {
  id: int,
  permanent: bool,
  roundsRemaining: int,
});

const card = object(['territoryId', 'symbol'], {
  territoryId: { bsonType: ['number', 'null'] },
  symbol: { bsonType: ['string', 'null'] },
});

const hand = object(['playerId', 'cards'], {
  playerId: int,
  cards: array(card),
});

const animation = { bsonType: 'object' };

const actionFrame = object(
  [
    'kind',
    'roundNumber',
    'turnPhase',
    'playerId',
    'mapDelta',
    'toxinTerritories',
    'radiationTerritories',
    'radiationUpcoming',
    'hands',
    'animation',
  ],
  {
    kind: { enum: ['action'] },
    roundNumber: int,
    turnPhase: string,
    playerId: int,
    mapDelta: array(territory),
    toxinTerritories: array(toxinTerritory),
    radiationTerritories: array(int),
    radiationUpcoming: array(int),
    hands: array(hand),
    animation,
  },
);

const turnFrame = object(['kind', 'roundNumber', 'playerId'], {
  kind: { enum: ['turn'] },
  roundNumber: int,
  playerId: int,
});

const chatFrame = object(['kind', 'senderId', 'name', 'message'], {
  kind: { enum: ['chat'] },
  senderId: int,
  name: string,
  message: string,
});

const emojiFrame = object(
  ['kind', 'senderId', 'targetPlayerId', 'emoji', 'attackTarget'],
  {
    kind: { enum: ['emoji'] },
    senderId: int,
    targetPlayerId: { bsonType: ['number', 'null'] },
    emoji: string,
    attackTarget: { bsonType: ['object', 'null'] },
  },
);

const result = object(
  [
    'playerId',
    'rank',
    'team',
    'eliminated',
    'surrendered',
    'playersKilled',
    'troopsGained',
    'troopsKilled',
    'troopsLost',
    'territoriesConquered',
    'territoriesLost',
    'capitalsConquered',
    'capitalsLost',
    'cardsGained',
    'turnsPlayed',
    'setsPlayed',
  ],
  {
    playerId: int,
    rank: int,
    team: int,
    eliminated: bool,
    surrendered: bool,
    playersKilled: array(int),
    troopsGained: int,
    troopsKilled: int,
    troopsLost: int,
    territoriesConquered: int,
    territoriesLost: int,
    capitalsConquered: int,
    capitalsLost: int,
    cardsGained: int,
    turnsPlayed: int,
    setsPlayed: int,
  },
);

export const SETTINGS_ENUM_KEYS = [
  'gameMode',
  'blitz',
  'defenceDice',
  'cards',
  'placement',
  'fortification',
  'entrenchments',
  'toxins',
  'portals',
  'radiations',
  'starvation',
  'roundTroops',
  'bounties',
  'supplyLines',
  'fogOfWar',
  'alliances',
  'turnDuration',
  'disconnectBotDifficulty',
  'disconnectBotPersonality',
];

const settings = object(['continentId', 'slots', ...SETTINGS_ENUM_KEYS], {
  continentId: { bsonType: ['number', 'null'] },
  slots: int,
  ...Object.fromEntries(
    SETTINGS_ENUM_KEYS.map((key) => [key, { enum: GAME_ENUMS[key] }]),
  ),
});

const player = object(
  [
    'playerId',
    'userId',
    'name',
    'isBot',
    'botDifficulty',
    'botPersonality',
    'team',
    'color',
    'turnOrder',
  ],
  {
    playerId: int,
    userId: { bsonType: ['string', 'null'] },
    name: { bsonType: ['string', 'null'] },
    isBot: bool,
    botDifficulty: { bsonType: ['string', 'null'] },
    botPersonality: { bsonType: ['string', 'null'] },
    team: int,
    color: int,
    turnOrder: int,
    rank: int,
    won: bool,
  },
);

const schema = {
  validator: {
    $jsonSchema: object(
      [
        'name',
        'mapId',
        'mapGeneration',
        'settings',
        'players',
        'winnerIds',
        'roundNumber',
        'playerCount',
        'originalHostId',
        'startedAt',
        'endedAt',
        'capitalTerritoryIds',
        'results',
        'serverLog',
        'replay',
      ],
      {
        _id: {},
        name: string,
        mapId: string,
        originalHostId: int,
        startedAt: int,
        endedAt: int,
        mapGeneration: {
          bsonType: ['object', 'null'],
          required: ['seed', 'size', 'water'],
          additionalProperties: false,
          properties: {
            seed: string,
            size: { enum: MAP_SIZES },
            water: { enum: WATER_LEVELS },
          },
        },
        settings,
        players: array(player),
        winnerIds: array(int),
        roundNumber: int,
        playerCount: int,
        capitalTerritoryIds: array(int),
        results: array(result),
        serverLog: array(
          object(['type', 'payload'], {
            type: string,
            payload: { bsonType: 'object' },
          }),
        ),
        replay: object(['initialTerritories', 'initialRadiation', 'frames'], {
          initialTerritories: array(territory),
          initialRadiation: array(int),
          frames: {
            bsonType: 'array',
            items: {
              oneOf: [actionFrame, turnFrame, chatFrame, emojiFrame],
            },
          },
        }),
      },
    ),
  },
  validationLevel: 'strict',
  validationAction: 'error',
};

function collection() {
  return getCollection<GameDoc>(NAME);
}

export function ensureGames(): Promise<unknown> {
  return ensureCollection(NAME, schema).then(() =>
    Promise.all([
      collection().createIndex({ 'players.userId': 1, _id: -1 }),
      collection().createIndex({ 'players.userId': 1, 'players.rank': 1 }),
      collection().createIndex({ 'settings.gameMode': 1 }),
      collection().createIndex({ mapId: 1 }),
      collection().createIndex({ startedAt: 1 }),
      collection().createIndex({ endedAt: 1 }),
    ]),
  );
}

export function storeGame(doc: GameDoc): Promise<string> {
  return collection()
    .insertOne(doc as GameDoc & { _id?: ObjectId })
    .then((res) => res.insertedId.toString());
}

function playerDisplayName(
  player: GamePlayerDoc,
  nameByUserId: Map<string, string>,
): string {
  return player.userId
    ? (nameByUserId.get(player.userId) ?? '?')
    : (player.name ?? '?');
}

function resolveNames(
  docs: { mapId: string; players: GamePlayerDoc[] }[],
): Promise<{
  mapNameById: Map<string, string>;
  nameByUserId: Map<string, string>;
}> {
  const mapIds = [...new Set(docs.map((d) => d.mapId))];
  const userIds = [
    ...new Set(
      docs
        .flatMap((d) => d.players.map((p) => p.userId))
        .filter((id): id is string => id !== null),
    ),
  ];
  return Promise.all([
    getMapNamesByIds(mapIds),
    getUsernamesByIds(userIds),
  ]).then(([mapNameById, nameByUserId]) => ({ mapNameById, nameByUserId }));
}

export type ResolvedGamePlayer = Omit<GamePlayerDoc, 'name'> & { name: string };
export type ResolvedGameDoc = Omit<GameDoc, 'players'> & {
  id: string;
  mapName: string;
  players: ResolvedGamePlayer[];
};

export function getGameById(id: string): Promise<ResolvedGameDoc | null> {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return collection()
    .findOne({ _id: new ObjectId(id) })
    .then((doc) => {
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return resolveNames([rest]).then(({ mapNameById, nameByUserId }) => ({
        ...rest,
        id: _id.toString(),
        mapName: mapNameById.get(rest.mapId) ?? '?',
        players: rest.players.map((p) => ({
          ...p,
          name: playerDisplayName(p, nameByUserId),
        })),
      }));
    });
}

function toRow(
  doc: GameDoc & { _id: ObjectId },
  mapNameById: Map<string, string>,
  nameByUserId: Map<string, string>,
  userId?: string,
): GameHistoryRow {
  const nameById = new Map(
    doc.players.map((p) => [p.playerId, playerDisplayName(p, nameByUserId)]),
  );
  const you = userId ? doc.players.find((p) => p.userId === userId) : undefined;
  const yourResult = you
    ? doc.results.find((r) => r.playerId === you.playerId)
    : undefined;
  return {
    id: doc._id.toString(),
    name: doc.name,
    startedAt: new Date(doc.startedAt).toISOString(),
    endedAt: new Date(doc.endedAt).toISOString(),
    mapName: mapNameById.get(doc.mapId) ?? '?',
    gameMode: doc.settings.gameMode,
    roundNumber: doc.roundNumber,
    playerCount: doc.playerCount ?? doc.players.length,
    winnerIds: doc.winnerIds,
    winnerNames: doc.winnerIds.map((id) => nameById.get(id) ?? '?'),
    yourRank: yourResult ? yourResult.rank : null,
    settings: doc.settings,
    players: doc.players.map((p) => ({
      name: playerDisplayName(p, nameByUserId),
      isBot: p.isBot,
      color: p.color,
      team: p.team,
    })),
  };
}

export function listGames(query: GamesQuery): Promise<GamesPage> {
  const viewer = query.rankUserId ?? query.viewerId ?? query.userId;

  return (
    query.mapName ? findMapIdsByName(query.mapName) : Promise.resolve(null)
  ).then((mapNameIds) => queryGames(query, viewer, mapNameIds));
}

function queryGames(
  query: GamesQuery,
  viewer: string | undefined,
  mapNameIds: string[] | null,
): Promise<GamesPage> {
  const filter: Record<string, unknown> = {};

  if (query.mode) filter['settings.gameMode'] = query.mode;
  if (mapNameIds) filter.mapId = { $in: mapNameIds };
  if (query.startedFrom !== undefined || query.startedTo !== undefined) {
    const range: Record<string, number> = {};
    if (query.startedFrom !== undefined) range.$gte = query.startedFrom;
    if (query.startedTo !== undefined) range.$lte = query.startedTo;
    filter.startedAt = range;
  }
  if (query.endedFrom !== undefined || query.endedTo !== undefined) {
    const range: Record<string, number> = {};
    if (query.endedFrom !== undefined) range.$gte = query.endedFrom;
    if (query.endedTo !== undefined) range.$lte = query.endedTo;
    filter.endedAt = range;
  }
  if (query.generatedMap) filter.mapGeneration = { $ne: null };
  if (query.mapGenerationSize)
    filter['mapGeneration.size'] = query.mapGenerationSize;
  if (query.mapGenerationWater)
    filter['mapGeneration.water'] = query.mapGenerationWater;
  if (query.minRounds !== undefined || query.maxRounds !== undefined) {
    const range: Record<string, number> = {};
    if (query.minRounds !== undefined) range.$gte = query.minRounds;
    if (query.maxRounds !== undefined) range.$lte = query.maxRounds;
    filter.roundNumber = range;
  }
  for (const [key, value] of Object.entries(query.settings ?? {}))
    filter[`settings.${key}`] = value;
  const requiredPlayerIds = [
    ...new Set([
      ...(query.userId ? [query.userId] : []),
      ...(query.playerIds ?? []),
    ]),
  ];
  if (requiredPlayerIds.length === 1)
    filter['players.userId'] = requiredPlayerIds[0];
  else if (requiredPlayerIds.length > 1)
    filter['players.userId'] = { $all: requiredPlayerIds };
  const exprConditions: Record<string, unknown>[] = [];
  if (query.playersMin !== undefined)
    exprConditions.push({ $gte: [{ $size: '$players' }, query.playersMin] });
  if (query.playersMax !== undefined)
    exprConditions.push({ $lte: [{ $size: '$players' }, query.playersMax] });
  if (query.durationMin !== undefined || query.durationMax !== undefined) {
    const duration = { $subtract: ['$endedAt', '$startedAt'] };
    if (query.durationMin !== undefined)
      exprConditions.push({ $gte: [duration, query.durationMin * 60000] });
    if (query.durationMax !== undefined)
      exprConditions.push({ $lte: [duration, query.durationMax * 60000] });
  }
  if (exprConditions.length > 0)
    filter.$expr =
      exprConditions.length === 1
        ? exprConditions[0]
        : { $and: exprConditions };

  // Viewer-relative fields are derived from `results` / `winnerIds`, which every
  // stored game has (unlike the newer denormalised `players[].rank`/`won`).
  const wantsViewerFilter =
    viewer !== undefined &&
    (query.outcome !== undefined ||
      query.positionMin !== undefined ||
      query.positionMax !== undefined ||
      query.sort === 'position');

  const relMatch: Record<string, unknown> = {};
  if (viewer !== undefined && query.outcome !== undefined)
    relMatch._myWon = query.outcome === 'won';
  if (
    viewer !== undefined &&
    (query.positionMin !== undefined || query.positionMax !== undefined)
  ) {
    const rank: Record<string, number> = {};
    if (query.positionMin !== undefined) rank.$gte = query.positionMin - 1;
    if (query.positionMax !== undefined) rank.$lte = query.positionMax - 1;
    relMatch._myRank = rank;
  }

  const dir: 1 | -1 = query.sortDir === 'asc' ? 1 : -1;
  const sortStage: Record<string, 1 | -1> =
    query.sort === 'position' && viewer !== undefined
      ? { _myRank: dir, _id: -1 }
      : query.sort === 'rounds'
        ? { roundNumber: dir, _id: -1 }
        : { _id: dir };

  const pipeline: Record<string, unknown>[] = [{ $match: filter }];
  if (wantsViewerFilter) {
    pipeline.push({
      $addFields: {
        _mePid: {
          $first: {
            $map: {
              input: {
                $filter: {
                  input: '$players',
                  as: 'p',
                  cond: { $eq: ['$$p.userId', viewer] },
                },
              },
              as: 'p',
              in: '$$p.playerId',
            },
          },
        },
      },
    });
    pipeline.push({
      $addFields: {
        _myRank: {
          $let: {
            vars: {
              r: {
                $first: {
                  $filter: {
                    input: '$results',
                    as: 'r',
                    cond: { $eq: ['$$r.playerId', '$_mePid'] },
                  },
                },
              },
            },
            in: { $ifNull: ['$$r.rank', 9999] },
          },
        },
        _myWon: { $in: ['$_mePid', { $ifNull: ['$winnerIds', []] }] },
      },
    });
    if (Object.keys(relMatch).length > 0) pipeline.push({ $match: relMatch });
  }
  pipeline.push({
    $facet: {
      total: [{ $count: 'n' }],
      rows: [
        { $sort: sortStage },
        { $skip: (query.page - 1) * query.pageSize },
        { $limit: query.pageSize },
      ],
    },
  });

  return collection()
    .aggregate<{
      total: { n: number }[];
      rows: (GameDoc & { _id: ObjectId })[];
    }>(pipeline, { allowDiskUse: true })
    .toArray()
    .then(([res]) => {
      const rows = res?.rows ?? [];
      return resolveNames(rows).then(({ mapNameById, nameByUserId }) => ({
        total: res?.total[0]?.n ?? 0,
        page: query.page,
        pageSize: query.pageSize,
        games: rows.map((doc) => toRow(doc, mapNameById, nameByUserId, viewer)),
      }));
    });
}
