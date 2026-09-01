import express, { NextFunction, Request, Response } from 'express';
import { authRouter } from './authRoutes';
import { gamesRouter } from './gamesRoutes';
import { corsMiddleware, identityMiddleware } from './middleware';
import { sessionRouter } from './session';
import { settingsRouter } from './settingsRoutes';

export interface HttpDeps {
  listGames: () => unknown[];
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
  app.use(gamesRouter(deps.listGames));
  app.use(express.json({ limit: '16kb' }));
  app.use(identityMiddleware);
  app.use(sessionRouter(deps.playerGame));
  app.use(authRouter(deps.inLiveGame));
  app.use(settingsRouter);
  app.use(errorHandler);
  return app;
}
