import { Router } from 'express';
import { GAME_ENUMS, MAP_SIZES, WATER_LEVELS } from '../db';
import { filterLiveGames, LiveGameRow, LiveGamesQuery } from './liveGames';
import {
  intParam,
  optIntParam,
  parseSettings,
  stringArrayParam,
} from './queryParams';

const GAME_MODES = GAME_ENUMS.gameMode as string[];
const MAX_SELECTED_PLAYERS = 10;

export function gamesRouter(getGames: () => LiveGameRow[]): Router {
  const router = Router();
  router.get('/games/live', (req, res) => {
    const q = req.query as Record<string, unknown>;
    const query: LiveGamesQuery = {
      page: intParam(q.page, 1, 1, 100000),
      pageSize: intParam(q.pageSize, 20, 1, 100),
      playerIds: stringArrayParam(q.playerIds, MAX_SELECTED_PLAYERS),
      name:
        typeof q.name === 'string' && q.name.trim()
          ? q.name.trim().slice(0, 100)
          : undefined,
      mode:
        typeof q.mode === 'string' && GAME_MODES.includes(q.mode)
          ? q.mode
          : undefined,
      mapName:
        typeof q.mapName === 'string' && q.mapName.trim()
          ? q.mapName.trim().slice(0, 100)
          : undefined,
      generatedMap: q.generatedMap === '1' ? true : undefined,
      mapGenerationSize:
        typeof q.mapGenerationSize === 'string' &&
        MAP_SIZES.includes(q.mapGenerationSize)
          ? q.mapGenerationSize
          : undefined,
      mapGenerationWater:
        typeof q.mapGenerationWater === 'string' &&
        WATER_LEVELS.includes(q.mapGenerationWater)
          ? q.mapGenerationWater
          : undefined,
      playersMin: optIntParam(q.playersMin, 1, 100),
      playersMax: optIntParam(q.playersMax, 1, 100),
      minRounds: optIntParam(q.minRounds, 0, 100000),
      maxRounds: optIntParam(q.maxRounds, 0, 100000),
      settings: parseSettings(q),
      phase:
        q.phase === 'lobby' || q.phase === 'playing' || q.phase === 'ended'
          ? q.phase
          : undefined,
      hasPassword:
        q.hasPassword === '1'
          ? true
          : q.hasPassword === '0'
            ? false
            : undefined,
      sort:
        q.sort === 'players' || q.sort === 'rounds' || q.sort === 'name'
          ? q.sort
          : 'newest',
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    };
    res.json(filterLiveGames(getGames(), query));
  });
  return router;
}
