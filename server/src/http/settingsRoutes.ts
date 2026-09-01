import { Router } from 'express';
import { updateUserSettings } from '../auth';
import { isObject } from '../validate';
import { identityOf } from './middleware';

export const settingsRouter = Router();

settingsRouter.patch('/settings', (req, res) => {
  const { session } = identityOf(res);
  if (!session || !isObject(req.body)) {
    res.json({ ok: true });
    return;
  }
  updateUserSettings(session.userId, {
    clientSettings: req.body.clientSettings,
    gameSettings: req.body.gameSettings,
  })
    .then(() => res.json({ ok: true }))
    .catch(() => res.json({ ok: true }));
});
