import { NextFunction, Request, Response } from 'express';
import { randomToken, resolveSession, SessionInfo } from '../auth';
import {
  clientIp,
  isSecureRequest,
  isSessionToken,
  parseCookies,
  serializeSessionCookie,
} from '../cookies';
import { allowAuthAttempt } from '../rateLimit';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5000';

export interface Identity {
  token: string;
  session: SessionInfo | null;
}

export function identityOf(res: Response): Identity {
  return res.locals.identity as Identity;
}

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Access-Control-Allow-Origin', CLIENT_URL);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

export function identityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = parseCookies(req.headers.cookie).anx;
  if (!isSessionToken(raw)) {
    const token = randomToken();
    res.setHeader(
      'Set-Cookie',
      serializeSessionCookie(token, isSecureRequest(req), true),
    );
    res.locals.identity = { token, session: null } satisfies Identity;
    next();
    return;
  }
  resolveSession(raw)
    .then((session) => {
      res.locals.identity = { token: raw, session } satisfies Identity;
      next();
    })
    .catch(next);
}

export function rateLimited(req: Request): boolean {
  return !allowAuthAttempt(
    clientIp(req.headers, req.socket.remoteAddress ?? ''),
  );
}
