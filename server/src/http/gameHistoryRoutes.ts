import { Router } from 'express';
import {
  GAME_ENUMS,
  GamesQuery,
  getGameById,
  getMapById,
  listGames,
  MAP_SIZES,
  searchUsers,
  WATER_LEVELS,
} from '../db';
import { identityOf } from './middleware';
import {
  intParam,
  optIntParam,
  parseSettings,
  stringArrayParam,
  timeParam,
} from './queryParams';

export const gameHistoryRouter = Router();
export const publicGamesRouter = Router();

const GAME_MODES = GAME_ENUMS.gameMode as string[];
const MAX_SELECTED_PLAYERS = 10;
const PLAYER_SEARCH_LIMIT = 8;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

gameHistoryRouter.get('/games/history', (req, res) => {
  const { session } = identityOf(res);
  const q = req.query as Record<string, unknown>;

  const page = intParam(q.page, 1, 1, 100000);
  const pageSize = intParam(q.pageSize, 20, 1, 100);

  if (q.mine === '1' && !session) {
    res.json({ games: [], total: 0, page, pageSize });
    return;
  }

  const name =
    typeof q.name === 'string' && q.name.trim()
      ? q.name.trim().slice(0, 100)
      : undefined;
  const mode =
    typeof q.mode === 'string' && GAME_MODES.includes(q.mode)
      ? q.mode
      : undefined;
  const mapName =
    typeof q.mapName === 'string' && q.mapName.trim()
      ? q.mapName.trim().slice(0, 100)
      : undefined;
  const generatedMap = q.generatedMap === '1' ? true : undefined;
  const mapGenerationSize =
    typeof q.mapGenerationSize === 'string' &&
    MAP_SIZES.includes(q.mapGenerationSize)
      ? q.mapGenerationSize
      : undefined;
  const mapGenerationWater =
    typeof q.mapGenerationWater === 'string' &&
    WATER_LEVELS.includes(q.mapGenerationWater)
      ? q.mapGenerationWater
      : undefined;
  const outcome =
    q.outcome === 'won' || q.outcome === 'lost' ? q.outcome : undefined;
  const sort = q.sort === 'rounds' || q.sort === 'position' ? q.sort : 'newest';
  const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc';

  const query: GamesQuery = {
    page,
    pageSize,
    playerIds: stringArrayParam(q.playerIds, MAX_SELECTED_PLAYERS),
    name,
    mode,
    mapName,
    startedFrom: timeParam(q.startedFrom),
    startedTo: timeParam(q.startedTo),
    endedFrom: timeParam(q.endedFrom),
    endedTo: timeParam(q.endedTo),
    durationMin: optIntParam(q.durationMin, 0, 100000),
    durationMax: optIntParam(q.durationMax, 0, 100000),
    generatedMap,
    mapGenerationSize,
    mapGenerationWater,
    playersMin: optIntParam(q.playersMin, 1, 100),
    playersMax: optIntParam(q.playersMax, 1, 100),
    minRounds: optIntParam(q.minRounds, 1, 100000),
    maxRounds: optIntParam(q.maxRounds, 1, 100000),
    settings: parseSettings(q),
    outcome,
    positionMin: optIntParam(q.positionMin, 1, 100),
    positionMax: optIntParam(q.positionMax, 1, 100),
    userId: q.mine === '1' ? session?.userId : undefined,
    viewerId: session?.userId,
    rankUserId:
      typeof q.rankUserId === 'string' && q.rankUserId.trim()
        ? q.rankUserId.trim()
        : undefined,
    sort,
    sortDir,
  };

  listGames(query)
    .then((r) => res.json(r))
    .catch(() => res.json({ games: [], total: 0, page, pageSize }));
});

publicGamesRouter.get('/games/players/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.json([]);
    return;
  }
  const rx = new RegExp(escapeRegex(q.slice(0, 100)), 'i');
  searchUsers(rx, PLAYER_SEARCH_LIMIT)
    .then((results) => res.json(results))
    .catch(() => res.json([]));
});

publicGamesRouter.get('/games/replay/:id', (req, res) => {
  getGameById(req.params.id)
    .then((doc) =>
      doc
        ? res.json(doc)
        : res.status(404).json({ ok: false, error: 'not found' }),
    )
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});

publicGamesRouter.get('/maps/:id', (req, res) => {
  getMapById(req.params.id)
    .then((map) =>
      map
        ? res.json(map)
        : res.status(404).json({ ok: false, error: 'not found' }),
    )
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});
