import { Router } from 'express';
import {
  blockUser,
  getMessagesOverview,
  sendMessage,
  unblockUser,
} from '../db';
import { isObject } from '../validate';
import { identityOf } from './middleware';

export const messagesRouter = Router();

function targetId(req: { body: unknown }): string {
  const body = isObject(req.body) ? req.body : {};
  return typeof body.userId === 'string' ? body.userId : '';
}

function targetText(req: { body: unknown }): string {
  const body = isObject(req.body) ? req.body : {};
  return typeof body.text === 'string' ? body.text : '';
}

messagesRouter.get('/messages', (_req, res) => {
  const { session } = identityOf(res);
  const empty = { conversations: [], blocked: [] };
  if (!session) {
    res.json(empty);
    return;
  }
  getMessagesOverview(session.userId)
    .then((overview) => res.json(overview))
    .catch(() => res.json(empty));
});

messagesRouter.post('/messages', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  sendMessage(session.userId, targetId(req), targetText(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

messagesRouter.post('/messages/block', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  blockUser(session.userId, targetId(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

messagesRouter.post('/messages/unblock', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  unblockUser(session.userId, targetId(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});
