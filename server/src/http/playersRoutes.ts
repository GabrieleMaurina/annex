import { Router } from 'express';
import { getPlayerProfile, listPlayers, PlayersQuery } from '../db';

export const playersRouter = Router();

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

playersRouter.get('/players/:username', (req, res) => {
  getPlayerProfile(req.params.username)
    .then((profile) =>
      profile
        ? res.json(profile)
        : res.status(404).json({ ok: false, error: 'not found' }),
    )
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});
