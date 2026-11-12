import { GameExport } from 'engine';
import { ObjectId } from 'mongodb';
import { GAMES_SCHEMA } from './gamesSchema';
import { findMapIdsByName, getMapNamesByIds } from './maps/replayMaps';
import { CollectionSpec, getCollection } from './mongo';
import {
  CareerTotals,
  findUserByUsername,
  getCountriesByIds,
  getUsernamesByIds,
} from './users/users';

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
  elo: number;
  eloDelta: number;
  eloPenalty: 'disconnected' | 'surrender' | null;
}

export interface PlayerHistoryPoint extends CareerTotals {
  startedAt: number;
  endedAt: number;
  elo: number;
  eloDelta: number;
  won: boolean;
}

export type GameResultDoc = GameExport['results'][number] & {
  played?: boolean;
  disconnected?: boolean;
};

export type GameDoc = Omit<GameExport, 'players' | 'mapName' | 'results'> & {
  mapId: string;
  players: GamePlayerDoc[];
  results: GameResultDoc[];
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
  draw: boolean;
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
  name?: string;
  mode?: string;
  mapName?: string;
  startedFrom?: number;
  startedTo?: number;
  endedFrom?: number;
  endedTo?: number;
  durationMin?: number;
  durationMax?: number;
  mapKind?: string;
  mapGenerationSize?: string;
  mapGenerationType?: string;
  mapGenerationFill?: string;
  mapGenerationTile?: string;
  mapGenerationAspect?: string;
  mapGenerationSeas?: boolean;
  mapGenerationTimed?: boolean;
  mapGenerationDirectional?: boolean;
  mapGenerationSwitched?: boolean;
  mapGenerationUnlockable?: boolean;
  mapGenerationMountains?: boolean;
  mapGenerationRivers?: boolean;
  minRounds?: number;
  maxRounds?: number;
  hasBots?: boolean;
  settings?: Record<string, string | number>;
  outcome?: 'won' | 'draw' | 'lost';
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

function collection() {
  return getCollection<GameDoc>(NAME);
}

export const GAMES_COLLECTION: CollectionSpec = {
  name: NAME,
  schema: GAMES_SCHEMA,
  indexes: [
    { key: { 'players.userId': 1, endedAt: -1, _id: -1 } },
    { key: { 'players.userId': 1, 'players.rank': 1 } },
    { key: { 'settings.gameMode': 1 } },
    { key: { mapId: 1 } },
    { key: { startedAt: 1 } },
    { key: { endedAt: 1 } },
  ],
};

export function storeGame(
  id: string | undefined,
  doc: GameDoc,
): Promise<string> {
  return collection()
    .insertOne({ ...doc, _id: new ObjectId(id) } as GameDoc & {
      _id: ObjectId;
    })
    .then((res) => res.insertedId.toString());
}

export function countGamesPlayed(userId: string): Promise<number> {
  return collection().countDocuments({ 'players.userId': userId });
}

export function countGameResults(
  userId: string,
): Promise<{ played: number; won: number; eliminated: number }> {
  return collection()
    .find(
      { 'players.userId': userId },
      {
        projection: {
          winnerIds: 1,
          draw: 1,
          'settings.gameMode': 1,
          'players.$': 1,
          'results.playerId': 1,
          'results.eliminated': 1,
          'results.played': 1,
          'results.disconnected': 1,
        },
      },
    )
    .toArray()
    .then((docs) => {
      const games = docs.map((doc) => ({
        doc,
        result: doc.results.find(
          (result) => result.playerId === doc.players[0].playerId,
        ),
      }));
      const played = games.filter(({ result }) => result?.played !== false);
      return {
        played: played.length,
        won: played.filter(
          ({ doc, result }) =>
            !doc.draw &&
            doc.settings.gameMode !== 'team deathmatch' &&
            doc.winnerIds.length === 1 &&
            doc.winnerIds[0] === doc.players[0].playerId &&
            !result?.disconnected,
        ).length,
        eliminated: played.filter(({ result }) => result?.eliminated).length,
      };
    });
}

export function getGameReportInfo(
  id: string,
): Promise<{ userIds: string[]; endedAt: number } | null> {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return collection()
    .findOne(
      { _id: new ObjectId(id) },
      { projection: { endedAt: 1, 'players.userId': 1 } },
    )
    .then((doc) =>
      doc
        ? {
            userIds: doc.players
              .map((player) => player.userId)
              .filter((userId): userId is string => userId !== null),
            endedAt: doc.endedAt,
          }
        : null,
    );
}

function playerDisplayName(
  player: GamePlayerDoc,
  nameByUserId: Map<string, string>,
): string {
  return player.userId
    ? (nameByUserId.get(player.userId) ?? '?')
    : (player.name ?? '?');
}

export function replaceGamesMapId(
  oldId: string,
  newId: string,
): Promise<number> {
  return collection()
    .updateMany(
      { mapId: oldId },
      { $set: { mapId: newId } },
      { bypassDocumentValidation: true },
    )
    .then((res) => res.modifiedCount);
}

export function resolveNames(
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

export type ResolvedGamePlayer = Omit<GamePlayerDoc, 'name'> & {
  name: string;
  country: string | null;
};
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
      const userIds = rest.players
        .map((p) => p.userId)
        .filter((userId): userId is string => userId !== null);
      return Promise.all([
        resolveNames([rest]),
        getCountriesByIds(userIds),
      ]).then(([{ mapNameById, nameByUserId }, countryByUserId]) => ({
        ...rest,
        id: _id.toString(),
        mapName: mapNameById.get(rest.mapId) ?? '?',
        players: rest.players.map((p) => ({
          ...p,
          name: playerDisplayName(p, nameByUserId),
          country: p.userId ? (countryByUserId.get(p.userId) ?? null) : null,
        })),
      }));
    });
}

export function getPlayerHistory(
  username: string,
): Promise<PlayerHistoryPoint[]> {
  return findUserByUsername(username).then((user) => {
    if (!user) return [];
    return collection()
      .find(
        { 'players.userId': user.id },
        {
          projection: {
            startedAt: 1,
            endedAt: 1,
            'players.$': 1,
            results: 1,
            draw: 1,
          },
          sort: { endedAt: 1 },
        },
      )
      .toArray()
      .then((docs) =>
        docs.map((doc) => {
          const player = doc.players[0];
          const result = doc.results.find(
            (r) => r.playerId === player.playerId,
          );
          return {
            startedAt: doc.startedAt,
            endedAt: doc.endedAt,
            elo: player.elo,
            eloDelta: player.eloDelta,
            won: !doc.draw && result?.rank === 0,
            playersKilled: result?.playersKilled.length ?? 0,
            troopsGained: result?.troopsGained ?? 0,
            troopsKilled: result?.troopsKilled ?? 0,
            troopsLost: result?.troopsLost ?? 0,
            territoriesConquered: result?.territoriesConquered ?? 0,
            capitalsConquered: result?.capitalsConquered ?? 0,
            setsPlayed: result?.setsPlayed ?? 0,
          };
        }),
      );
  });
}

export function toRow(
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
    draw: !!doc.draw,
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

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function listGames(query: GamesQuery): Promise<GamesPage> {
  const viewer = query.rankUserId ?? query.viewerId ?? query.userId;

  return (
    query.mapName ? findMapIdsByName(query.mapName) : Promise.resolve(null)
  ).then((mapNameIds) => queryGames(query, viewer, mapNameIds));
}

const NOT_TRUE = { $ne: true };

function queryGames(
  query: GamesQuery,
  viewer: string | undefined,
  mapNameIds: string[] | null,
): Promise<GamesPage> {
  const filter: Record<string, unknown> = {};

  if (query.name)
    filter.name = { $regex: escapeRegex(query.name), $options: 'i' };
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
  if (query.mapKind === 'generated') filter.mapGeneration = { $ne: null };
  else if (query.mapKind) {
    filter.mapGeneration = null;
    filter.playerMapId = {
      $type: query.mapKind === 'library' ? 'string' : 'null',
    };
  }
  if (query.mapGenerationAspect)
    filter['mapGeneration.aspect'] = query.mapGenerationAspect;
  if (query.mapGenerationMountains !== undefined) {
    filter.mapGeneration = { $ne: null };
    filter['mapGeneration.mountains'] =
      query.mapGenerationMountains || NOT_TRUE;
  }
  if (query.mapGenerationRivers !== undefined) {
    filter.mapGeneration = { $ne: null };
    filter['mapGeneration.rivers'] = query.mapGenerationRivers || NOT_TRUE;
  }
  if (query.mapGenerationSize)
    filter['mapGeneration.size'] = query.mapGenerationSize;
  if (query.mapGenerationType)
    filter['mapGeneration.type'] = query.mapGenerationType;
  if (query.mapGenerationFill)
    filter['mapGeneration.fill'] = query.mapGenerationFill;
  if (query.mapGenerationTile)
    filter['mapGeneration.tile'] = query.mapGenerationTile;
  if (query.mapGenerationSeas !== undefined)
    filter['mapGeneration.seas'] = query.mapGenerationSeas;
  if (query.mapGenerationTimed !== undefined)
    filter['mapGeneration.timed'] = query.mapGenerationTimed;
  if (query.mapGenerationDirectional !== undefined)
    filter['mapGeneration.directional'] = query.mapGenerationDirectional;
  if (query.mapGenerationSwitched !== undefined) {
    filter.mapGeneration = { $ne: null };
    filter['mapGeneration.switched'] = query.mapGenerationSwitched || NOT_TRUE;
  }
  if (query.mapGenerationUnlockable !== undefined)
    filter['mapGeneration.unlockable'] = query.mapGenerationUnlockable;
  if (query.minRounds !== undefined || query.maxRounds !== undefined) {
    const range: Record<string, number> = {};
    if (query.minRounds !== undefined) range.$gte = query.minRounds;
    if (query.maxRounds !== undefined) range.$lte = query.maxRounds;
    filter.roundNumber = range;
  }
  if (query.hasBots === true) filter['players.isBot'] = true;
  else if (query.hasBots === false) filter['players.isBot'] = { $ne: true };
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

  // Viewer-relative fields are derived from `results` / `winnerIds`, the source
  // of truth that the denormalised `players[].rank`/`won` are copied from.
  const wantsViewerFilter =
    viewer !== undefined &&
    (query.outcome !== undefined ||
      query.positionMin !== undefined ||
      query.positionMax !== undefined ||
      query.sort === 'position');

  const relMatch: Record<string, unknown> = {};
  if (viewer !== undefined && query.outcome !== undefined) {
    relMatch._myWon = query.outcome === 'won';
    relMatch._myDrawn = query.outcome === 'draw';
  }
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
      ? { _myRank: dir, endedAt: -1, _id: -1 }
      : query.sort === 'rounds'
        ? { roundNumber: dir, endedAt: -1, _id: -1 }
        : { endedAt: dir, _id: dir };

  const pipeline: Record<string, unknown>[] = [
    { $match: filter },
    { $project: { replay: 0, serverLog: 0 } },
  ];
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
        _myDrawn: {
          $in: ['$_mePid', { $ifNull: ['$draw.playerIds', []] }],
        },
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
