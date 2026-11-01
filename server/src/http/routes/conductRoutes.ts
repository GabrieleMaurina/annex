import { Router } from 'express';
import { blockUser, unblockUser } from '../../conduct/blockPeers';
import { fileReport } from '../../conduct/reports';
import { getBlockedIds } from '../../db';
import { isObject } from '../../validate';
import { identityOf } from '../middleware';

export const conductRouter = Router();

function targetId(req: { body: unknown }): string {
  const body = isObject(req.body) ? req.body : {};
  return typeof body.userId === 'string' ? body.userId : '';
}

conductRouter.get('/blocks', (_req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ blocked: [] });
    return;
  }
  getBlockedIds(session.userId)
    .then((blocked) => res.json({ blocked }))
    .catch(() => res.json({ blocked: [] }));
});

conductRouter.post('/blocks', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  blockUser(session.userId, targetId(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

conductRouter.post('/blocks/remove', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  unblockUser(session.userId, targetId(req))
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

conductRouter.post('/reports', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  const body = isObject(req.body) ? req.body : {};
  fileReport(session.userId, body.userId, body.reason, body.gameId)
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});
