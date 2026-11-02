import { Router } from 'express';
import { updateUserSettings } from '../../auth/auth';
import {
  addUserTutorial,
  getUserPresets,
  getUserTutorials,
  saveUserPresets,
} from '../../db';
import { isObject } from '../../validate';
import { identityOf } from '../middleware';

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
    homeFilters: req.body.homeFilters,
  })
    .then(() => res.json({ ok: true }))
    .catch(() => res.json({ ok: true }));
});

settingsRouter.get('/presets', (_req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  getUserPresets(session.userId)
    .then((presets) => res.json({ ok: true, presets }))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

settingsRouter.post('/presets', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  if (!isObject(req.body) || !Array.isArray(req.body.presets)) {
    res.json({ ok: false, error: 'invalid presets' });
    return;
  }
  saveUserPresets(session.userId, req.body.presets)
    .then((presets) => res.json({ ok: true, presets }))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

settingsRouter.get('/tutorials', (_req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  getUserTutorials(session.userId)
    .then((completed) => res.json({ ok: true, completed }))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

settingsRouter.post('/tutorials', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  const id = isObject(req.body) ? req.body.id : undefined;
  addUserTutorial(session.userId, id)
    .then((completed) =>
      res.json(
        completed
          ? { ok: true, completed }
          : { ok: false, error: 'invalid tutorial' },
      ),
    )
    .catch(() => res.json({ ok: false, error: 'server error' }));
});
