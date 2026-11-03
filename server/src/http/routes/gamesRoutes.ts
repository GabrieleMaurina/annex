import { joinReputation } from 'engine';
import { Router } from 'express';
import { resolveSession } from '../../auth/auth';
import { isSessionToken, parseCookies } from '../../auth/cookies';
import {
  loadBlockPeers,
  peerGames,
  warmBlockPeers,
} from '../../conduct/blockPeers';
import {
  cachedReputation,
  cachedUserId,
  claimWarmUp,
} from '../../conduct/viewerCache';
import {
  countGamesPlayed,
  FILL_VALUES,
  GAME_ENUMS,
  GENERATION_TYPES,
  MAP_SIZES,
  TILE_SHAPES,
} from '../../db';
import {
  filterLiveGames,
  LiveGameRow,
  LiveGamesQuery,
  LiveViewer,
  SeatProfile,
  watchGameName,
} from '../liveGames';
import { identityOf } from '../middleware';
import {
  intParam,
  optBoolParam,
  optIntParam,
  parseSettings,
  stringArrayParam,
} from '../queryParams';

const GAME_MODES = GAME_ENUMS.gameMode as string[];
const MAX_SELECTED_PLAYERS = 10;
const GUEST_VIEWER: LiveViewer = { reputation: 0, excludedGames: new Set() };

function liveViewer(cookieHeader: string | undefined): LiveViewer {
  const token = parseCookies(cookieHeader).anx;
  if (!isSessionToken(token)) return GUEST_VIEWER;
  const userId = cachedUserId(token);
  const cached = userId === undefined ? undefined : cachedReputation(userId);
  if (userId === undefined || !cached) {
    if (claimWarmUp(token)) resolveSession(token).catch(console.error);
    return GUEST_VIEWER;
  }
  warmBlockPeers(userId);
  return {
    reputation: joinReputation(
      {
        reputation: cached.reputation,
        reputationRecoveryFrom: cached.recoveryFrom,
        accountCreatedAt: cached.createdAt,
      },
      Date.now(),
    ),
    excludedGames: peerGames(userId),
  };
}

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
      mapGenerationType:
        typeof q.mapGenerationType === 'string' &&
        GENERATION_TYPES.includes(q.mapGenerationType)
          ? q.mapGenerationType
          : undefined,
      mapGenerationFill:
        typeof q.mapGenerationFill === 'string' &&
        FILL_VALUES.includes(q.mapGenerationFill)
          ? q.mapGenerationFill
          : undefined,
      mapGenerationTile:
        typeof q.mapGenerationTile === 'string' &&
        TILE_SHAPES.includes(q.mapGenerationTile)
          ? q.mapGenerationTile
          : undefined,
      mapGenerationSeas: optBoolParam(q.mapGenerationSeas),
      mapGenerationTimed: optBoolParam(q.mapGenerationTimed),
      mapGenerationDirectional: optBoolParam(q.mapGenerationDirectional),
      mapGenerationUnlockable: optBoolParam(q.mapGenerationUnlockable),
      playersMin: optIntParam(q.playersMin, 1, 100),
      playersMax: optIntParam(q.playersMax, 1, 100),
      minRounds: optIntParam(q.roundsMin, 0, 100000),
      maxRounds: optIntParam(q.roundsMax, 0, 100000),
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
      hasBots: q.hasBots === '1' ? true : q.hasBots === '0' ? false : undefined,
      sort:
        q.sort === 'players' || q.sort === 'rounds' || q.sort === 'name'
          ? q.sort
          : 'newest',
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    };
    res.json(
      filterLiveGames(getGames(), query, liveViewer(req.headers.cookie)),
    );
  });
  router.get('/games/watch', (req, res) => {
    const userId = req.query.userId;
    res.json({
      gameName:
        typeof userId === 'string'
          ? watchGameName(getGames(), userId, liveViewer(req.headers.cookie))
          : null,
    });
  });
  return router;
}

export function randomGameRouter(
  randomGame: (
    token: string,
    userId: string | null,
    profile: SeatProfile,
  ) => string | null,
): Router {
  const router = Router();
  router.get('/games/random', (_req, res, next) => {
    const { token, session } = identityOf(res);
    Promise.all([
      session ? countGamesPlayed(session.userId) : null,
      session ? loadBlockPeers(session.userId) : null,
    ])
      .then(([gamesPlayed]) => {
        res.json({
          ok: true,
          gameName: randomGame(token, session ? session.userId : null, {
            elo: session ? session.elo : null,
            gamesPlayed,
            accountCreatedAt: session ? session.createdAt : null,
            reputation: session ? session.reputation : null,
            reputationRecoveryFrom: session
              ? session.reputationRecoveryFrom
              : null,
          }),
        });
      })
      .catch(next);
  });
  return router;
}
