import { Router } from 'express';
import {
  attachSession,
  confirmEmail,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  destroySession,
  login,
  LoginResult,
  normalizeEmail,
  randomToken,
  registerAccount,
  requestPasswordReset,
  resetPassword,
} from '../auth';
import { isSecureRequest, serializeSessionCookie } from '../cookies';
import {
  clearLoginFailures,
  loginLockedOut,
  recordLoginFailure,
} from '../rateLimit';
import { isObject } from '../validate';
import { identityOf, rateLimited } from './middleware';

type InLiveGame = (token: string, userId: string | null) => boolean;

type Body = Record<string, unknown>;

function body(req: { body: unknown }): Body {
  return isObject(req.body) ? req.body : {};
}

export function authRouter(inLiveGame: InLiveGame): Router {
  const router = Router();

  router.post('/auth/register', (req, res) => {
    if (rateLimited(req)) {
      res.json({ ok: false, error: 'too many requests' });
      return;
    }
    const data = body(req);
    registerAccount({
      username: data.username,
      email: data.email,
      password: data.password,
    })
      .then((result) => res.json(result))
      .catch(() => res.json({ ok: false, error: 'server error' }));
  });

  router.post('/auth/confirm-email', (req, res) => {
    if (rateLimited(req)) {
      res.json({ ok: false, error: 'too many requests' });
      return;
    }
    confirmEmail(body(req).code)
      .then((result) => res.json(result))
      .catch(() => res.json({ ok: false, error: 'server error' }));
  });

  router.post('/auth/reset-password', (req, res) => {
    if (rateLimited(req)) {
      res.json({ ok: false, error: 'too many requests' });
      return;
    }
    const data = body(req);
    resetPassword(data.code, data.password)
      .then((result) => res.json(result))
      .catch(() => res.json({ ok: false, error: 'server error' }));
  });

  router.post('/auth/request-password-reset', (req, res) => {
    if (rateLimited(req)) {
      res.json({ ok: true });
      return;
    }
    requestPasswordReset(body(req).email)
      .then((result) => res.json(result))
      .catch(() => res.json({ ok: true }));
  });

  router.post('/auth/login', (req, res) => {
    const { token, session } = identityOf(res);
    if (inLiveGame(token, session?.userId ?? null)) {
      res.json({ ok: false, error: 'in a game' });
      return;
    }
    if (rateLimited(req)) {
      res.json({ ok: false, error: 'too many requests' });
      return;
    }
    const data = body(req);
    const email = data.email;
    const failureKey = typeof email === 'string' ? normalizeEmail(email) : null;
    login({ email, password: data.password })
      .then((result): LoginResult => {
        if (failureKey === null) return result;
        if (result.ok) {
          clearLoginFailures(failureKey);
          return result;
        }
        if (result.error === 'invalid credentials') {
          recordLoginFailure(failureKey);
          if (loginLockedOut(failureKey))
            return { ok: false, error: 'too many requests' };
        }
        return result;
      })
      .then((result) => {
        if (!result.ok) {
          res.json(result);
          return;
        }
        const newToken = randomToken();
        return attachSession(newToken, result.userId).then(() => {
          res.setHeader(
            'Set-Cookie',
            serializeSessionCookie(
              newToken,
              isSecureRequest(req),
              data.stayLoggedIn !== false,
            ),
          );
          res.json({
            ok: true,
            username: result.username,
            clientSettings: result.clientSettings,
            gameSettings: result.gameSettings,
          });
        });
      })
      .catch(() => res.json({ ok: false, error: 'server error' }));
  });

  router.post('/auth/logout', (req, res) => {
    const { token, session } = identityOf(res);
    if (inLiveGame(token, session?.userId ?? null)) {
      res.json({ ok: false, error: 'in a game' });
      return;
    }
    const done = () => {
      res.setHeader(
        'Set-Cookie',
        serializeSessionCookie(randomToken(), isSecureRequest(req), true),
      );
      res.json({
        ok: true,
        clientSettings: DEFAULT_CLIENT_SETTINGS,
        gameSettings: DEFAULT_GAME_SETTINGS,
      });
    };
    destroySession(token).then(done).catch(done);
  });

  return router;
}
