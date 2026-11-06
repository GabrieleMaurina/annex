import { Router } from 'express';
import { resolveSession } from '../../auth/auth';
import { isSessionToken, parseCookies } from '../../auth/cookies';
import { loadBlockPeers } from '../../conduct/blockPeers';
import { cachedUserId } from '../../conduct/viewerCache';
import {
  findUserByUsername,
  getPlayerHistory,
  getPlayerProfile,
  getUserBio,
  getUserPicture,
  listPlayerAchievements,
  listPlayers,
  pictureDataUrl,
  PlayersQuery,
} from '../../db';
import { rateLimited } from '../middleware';
import { isOnline } from '../presence';

export const playersRouter = Router();

function isBlockPeer(
  cookieHeader: string | undefined,
  userId: string,
): Promise<boolean> {
  const token = parseCookies(cookieHeader).anx;
  if (!isSessionToken(token)) return Promise.resolve(false);
  const cached = cachedUserId(token);
  const viewerId =
    cached !== undefined
      ? Promise.resolve(cached)
      : resolveSession(token).then((session) => session?.userId);
  return viewerId.then((id) =>
    id === undefined
      ? false
      : loadBlockPeers(id).then((peers) => peers.all.has(userId)),
  );
}

function intParam(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function optIntParam(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

playersRouter.get('/players', (req, res) => {
  const q = req.query as Record<string, unknown>;

  const page = intParam(q.page, 1, 1, 100000);
  const pageSize = intParam(q.pageSize, 20, 1, 100);
  const username =
    typeof q.username === 'string' && q.username.trim()
      ? q.username.trim().slice(0, 10)
      : undefined;
  const sort = q.sort === 'username' || q.sort === 'games' ? q.sort : 'elo';
  const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc';

  const query: PlayersQuery = {
    page,
    pageSize,
    username,
    eloMin: optIntParam(q.eloMin, 0, 100000),
    eloMax: optIntParam(q.eloMax, 0, 100000),
    gamesMin: optIntParam(q.gamesMin, 0, 1000000),
    gamesMax: optIntParam(q.gamesMax, 0, 1000000),
    sort,
    sortDir,
  };

  listPlayers(query)
    .then((r) => res.json(r))
    .catch(() => res.json({ players: [], total: 0, page, pageSize }));
});

playersRouter.get('/presence', (req, res) => {
  const userId = req.query.userId;
  if (typeof userId !== 'string') {
    res.json({ online: false });
    return;
  }
  isBlockPeer(req.headers.cookie, userId)
    .then((blocked) => res.json({ online: !blocked && isOnline(userId) }))
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});

playersRouter.get('/players/id/:userId/profile', (req, res) => {
  if (rateLimited(req)) {
    res.json({ ok: false, error: 'too many requests' });
    return;
  }
  Promise.all([
    getUserPicture(req.params.userId),
    getUserBio(req.params.userId),
  ])
    .then(([picture, bio]) =>
      res.json({ ok: true, picture: pictureDataUrl(picture), bio }),
    )
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});

playersRouter.get('/players/:username/history', (req, res) => {
  getPlayerHistory(req.params.username)
    .then((history) => res.json(history))
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});

playersRouter.get('/players/:username/achievements', (req, res) => {
  findUserByUsername(req.params.username)
    .then((user) => (user ? listPlayerAchievements(user.id) : []))
    .then((achievements) => res.json(achievements))
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});

playersRouter.get('/players/:username', (req, res) => {
  getPlayerProfile(req.params.username)
    .then((profile) =>
      profile
        ? isBlockPeer(req.headers.cookie, profile.id).then((blocked) =>
            res.json({ ...profile, online: !blocked && isOnline(profile.id) }),
          )
        : res.status(404).json({ ok: false, error: 'not found' }),
    )
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});
