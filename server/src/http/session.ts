import { Router } from 'express';
import { anonNameFor } from '../anonName';
import { DEFAULT_CLIENT_SETTINGS, DEFAULT_GAME_SETTINGS } from '../auth';
import { identityOf } from './middleware';

export function sessionRouter(
  playerGame: (token: string, userId: string | null) => string | null,
): Router {
  const router = Router();
  router.get('/session', (_req, res) => {
    const { token, session } = identityOf(res);
    res.json({
      account: session
        ? { username: session.username, elo: session.elo }
        : null,
      name: session ? session.username : anonNameFor(token),
      gameName: playerGame(token, session ? session.userId : null),
      clientSettings: session
        ? session.clientSettings
        : DEFAULT_CLIENT_SETTINGS,
      gameSettings: session ? session.gameSettings : DEFAULT_GAME_SETTINGS,
    });
  });
  return router;
}
