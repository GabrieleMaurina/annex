import { Router } from 'express';

export function gamesRouter(getGames: () => unknown[]): Router {
  const router = Router();
  router.get('/games/live', (_req, res) => {
    res.json(getGames());
  });
  return router;
}
