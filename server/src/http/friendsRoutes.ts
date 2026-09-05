import { Router } from 'express';
import {
  acceptFriendRequest,
  getFriendsOverview,
  removeFriend,
  sendFriendRequest,
} from '../db';
import { isObject } from '../validate';
import { identityOf } from './middleware';

export const friendsRouter = Router();

function targetId(req: { body: unknown }): string {
  const body = isObject(req.body) ? req.body : {};
  return typeof body.userId === 'string' ? body.userId : '';
}

friendsRouter.get('/friends', (_req, res) => {
  const { session } = identityOf(res);
  const empty = { friends: [], incoming: [], outgoing: [] };
  if (!session) {
    res.json(empty);
    return;
  }
  getFriendsOverview(session.userId)
    .then((overview) => res.json(overview))
    .catch(() => res.json(empty));
});

friendsRouter.post('/friends/requests', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  sendFriendRequest(session.userId, targetId(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

friendsRouter.post('/friends/accept', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  acceptFriendRequest(session.userId, targetId(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

friendsRouter.post('/friends/remove', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  removeFriend(session.userId, targetId(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});
