import { Router } from 'express';

export function gamesRouter(getGames: () => unknown[]): Router {
  const router = Router();
  router.get('/games', (_req, res) => {
    res.json(getGames());
  });
  return router;
}
