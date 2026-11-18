import { Router } from 'express';
import { identityOf } from '../http/middleware';
import { markSeen } from '../http/presence';
import { isObject } from '../validate';
import {
  cancelInvite,
  createInvite,
  invitableFriends,
  listInvites,
  respondToInvite,
} from './invites';

export const invitesRouter = Router();

function bodyOf(req: { body: unknown }): Record<string, unknown> {
  return isObject(req.body) ? req.body : {};
}

invitesRouter.use('/invites', (_req, res, next) => {
  const { session } = identityOf(res);
  if (session) markSeen(session.userId);
  next();
});

invitesRouter.get('/invites', (_req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ incoming: [], outgoing: [] });
    return;
  }
  res.json(listInvites(session.userId));
});

invitesRouter.get('/invites/friends', (_req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json([]);
    return;
  }
  invitableFriends(session.userId)
    .then((friends) => res.json(friends))
    .catch(() => res.json([]));
});

invitesRouter.post('/invites', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  const { userId, kind, lobby } = bodyOf(req);
  if (
    typeof userId !== 'string' ||
    (kind !== 'challenge' && kind !== 'invite')
  ) {
    res.json({ ok: false, error: 'invalid invite' });
    return;
  }
  createInvite(
    { userId: session.userId, name: session.username },
    userId,
    kind,
    lobby === true,
  )
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

invitesRouter.post('/invites/respond', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  const { id, accept } = bodyOf(req);
  if (typeof id !== 'string') {
    res.json({ ok: false, error: 'invite expired' });
    return;
  }
  res.json(respondToInvite(session.userId, id, accept === true));
});

invitesRouter.post('/invites/cancel', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  const { id } = bodyOf(req);
  if (typeof id === 'string') cancelInvite(session.userId, id);
  res.json({ ok: true });
});
