import { Router } from 'express';
import { anonNameFor } from '../auth/anonName';
import {
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  DEFAULT_HOME_FILTERS,
} from '../auth/auth';
import { countGamesPlayed } from '../db';
import { identityOf } from './middleware';

export function sessionRouter(
  playerGame: (token: string, userId: string | null) => string | null,
): Router {
  const router = Router();
  router.get('/session', (_req, res, next) => {
    const { token, session } = identityOf(res);
    (session ? countGamesPlayed(session.userId) : Promise.resolve(null))
      .then((gamesPlayed) => {
        res.json({
          account: session
            ? {
                username: session.username,
                elo: session.elo,
                country: session.country,
                gamesPlayed,
                createdAt: session.createdAt,
              }
            : null,
          name: session ? session.username : anonNameFor(token),
          gameName: playerGame(token, session ? session.userId : null),
          clientSettings: session
            ? session.clientSettings
            : DEFAULT_CLIENT_SETTINGS,
          gameSettings: session ? session.gameSettings : DEFAULT_GAME_SETTINGS,
          homeFilters: session ? session.homeFilters : DEFAULT_HOME_FILTERS,
        });
      })
      .catch(next);
  });
  return router;
}
