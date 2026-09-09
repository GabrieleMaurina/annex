import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { isValidPassword } from '../auth';
import {
  deleteReportsForPicture,
  findUserById,
  getUserPicture,
  reportPicture,
  setPassword,
  setUserPicture,
  unsetUserPicture,
} from '../db';
import { isImageAllowed } from '../moderation';
import { hashPassword, verifyPassword } from '../password';
import { isObject } from '../validate';
import { identityOf, rateLimited } from './middleware';

export const accountRouter = Router();

const IMAGE_RE =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_IMAGE_BYTES = 2_500_000;

function bodyOf(req: { body: unknown }): Record<string, unknown> {
  return isObject(req.body) ? req.body : {};
}

function clearReports(pictureId: string): Promise<void> {
  return deleteReportsForPicture(pictureId).catch((error) => {
    console.error('[account] failed to clear picture reports', error);
  });
}

accountRouter.get('/account', (_req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  Promise.all([findUserById(session.userId), getUserPicture(session.userId)])
    .then(([user, picture]) => {
      if (!user) {
        res.json({ ok: false, error: 'not logged in' });
        return;
      }
      res.json({
        ok: true,
        username: user.username,
        email: user.email,
        picture:
          picture && !picture.dangerous
            ? `data:${picture.mime};base64,${picture.data}`
            : null,
        pictureDangerous: !!picture?.dangerous,
      });
    })
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

accountRouter.post('/account/password', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  if (rateLimited(req)) {
    res.json({ ok: false, error: 'too many requests' });
    return;
  }
  const { currentPassword, newPassword } = bodyOf(req);
  if (!isValidPassword(newPassword)) {
    res.json({ ok: false, error: 'invalid password' });
    return;
  }
  if (typeof currentPassword !== 'string') {
    res.json({ ok: false, error: 'incorrect password' });
    return;
  }
  findUserById(session.userId)
    .then((user) => {
      if (!user) {
        res.json({ ok: false, error: 'not logged in' });
        return;
      }
      return verifyPassword(user.passwordHash, currentPassword).then(
        (valid) => {
          if (!valid) {
            res.json({ ok: false, error: 'incorrect password' });
            return;
          }
          if (newPassword === currentPassword) {
            res.json({ ok: false, error: 'new password must be different' });
            return;
          }
          return hashPassword(newPassword)
            .then((hash) => setPassword(session.userId, hash))
            .then(() => res.json({ ok: true }));
        },
      );
    })
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

accountRouter.post('/account/picture', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  if (rateLimited(req)) {
    res.json({ ok: false, error: 'too many requests' });
    return;
  }
  const image = bodyOf(req).image;
  const match = typeof image === 'string' ? image.match(IMAGE_RE) : null;
  if (!match) {
    res.json({ ok: false, error: 'invalid image' });
    return;
  }
  const mime = match[1];
  const data = Buffer.from(match[2], 'base64');
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
    res.json({ ok: false, error: 'invalid image' });
    return;
  }
  isImageAllowed(match[0])
    .catch(() => 'error' as const)
    .then((verdict) => {
      if (verdict === 'error') {
        res.json({ ok: false, error: 'moderation failed' });
        return;
      }
      if (!verdict) {
        res.json({ ok: false, error: 'image rejected' });
        return;
      }
      return getUserPicture(session.userId).then((previous) => {
        const id = new ObjectId().toString();
        return setUserPicture(session.userId, { id, data, mime })
          .then(() => (previous ? clearReports(previous.id) : undefined))
          .then(() => res.json({ ok: true }));
      });
    })
    .catch((error) => {
      console.error('[account] picture upload failed', error);
      res.json({ ok: false, error: 'server error' });
    });
});

accountRouter.post('/account/picture/remove', (_req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  getUserPicture(session.userId)
    .then((previous) =>
      unsetUserPicture(session.userId).then(() =>
        previous ? clearReports(previous.id) : undefined,
      ),
    )
    .then(() => res.json({ ok: true }))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

accountRouter.post('/account/report', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  const userId = bodyOf(req).userId;
  reportPicture(session.userId, typeof userId === 'string' ? userId : '')
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});
