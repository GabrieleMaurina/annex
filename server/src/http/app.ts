import express, { NextFunction, Request, Response } from 'express';
import { accountRouter } from './accountRoutes';
import { authRouter } from './authRoutes';
import { friendsRouter } from './friendsRoutes';
import { gameHistoryRouter, publicGamesRouter } from './gameHistoryRoutes';
import { gamesRouter } from './gamesRoutes';
import { LiveGameRow } from './liveGames';
import { messagesRouter } from './messagesRoutes';
import { corsMiddleware, identityMiddleware } from './middleware';
import { playersRouter } from './playersRoutes';
import { sessionRouter } from './session';
import { settingsRouter } from './settingsRoutes';

export interface HttpDeps {
  listGames: () => LiveGameRow[];
  playerGame: (token: string, userId: string | null) => string | null;
  inLiveGame: (token: string, userId: string | null) => boolean;
}

function errorHandler(
  _error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(_error);
    return;
  }
  res.status(500).json({ ok: false, error: 'server error' });
}

export function createHttpApp(deps: HttpDeps): express.Express {
  const app = express();
  app.use(corsMiddleware);

  const api = express.Router();
  api.use(gamesRouter(deps.listGames));
  api.use(publicGamesRouter);
  api.use(playersRouter);
  api.use('/account/picture', express.json({ limit: '4mb' }));
  api.use(express.json({ limit: '16kb' }));
  api.use(identityMiddleware);
  api.use(gameHistoryRouter);
  api.use(sessionRouter(deps.playerGame));
  api.use(authRouter(deps.inLiveGame));
  api.use(settingsRouter);
  api.use(accountRouter);
  api.use(friendsRouter);
  api.use(messagesRouter);
  app.use('/api', api);

  app.use(errorHandler);
  return app;
}
