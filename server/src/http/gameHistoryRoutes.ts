import { Router } from 'express';
import {
  GAME_ENUMS,
  GamesQuery,
  getGameById,
  getMapById,
  listGames,
  SETTINGS_ENUM_KEYS,
} from '../db';
import { identityOf } from './middleware';

export const gameHistoryRouter = Router();
export const publicGamesRouter = Router();

const GAME_MODES = GAME_ENUMS.gameMode as string[];
const SETTING_KEYS = SETTINGS_ENUM_KEYS.filter((k) => k !== 'gameMode');

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

function parseSettings(
  q: Record<string, unknown>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const key of SETTING_KEYS) {
    const raw = q[key];
    if (typeof raw !== 'string' || raw === '') continue;
    const values = GAME_ENUMS[key];
    if (values.includes(raw)) out[key] = raw;
    else if (values.includes(Number(raw))) out[key] = Number(raw);
  }
  return out;
}

gameHistoryRouter.get('/games/history', (req, res) => {
  const { session } = identityOf(res);
  const q = req.query as Record<string, unknown>;

  const page = intParam(q.page, 1, 1, 100000);
  const pageSize = intParam(q.pageSize, 20, 1, 100);

  if (q.mine === '1' && !session) {
    res.json({ games: [], total: 0, page, pageSize });
    return;
  }

  const search =
    typeof q.search === 'string' && q.search.trim()
      ? q.search.trim().slice(0, 100)
      : undefined;
  const mode =
    typeof q.mode === 'string' && GAME_MODES.includes(q.mode)
      ? q.mode
      : undefined;
  const mapName =
    typeof q.mapName === 'string' && q.mapName.trim()
      ? q.mapName.trim().slice(0, 100)
      : undefined;
  const outcome =
    q.outcome === 'won' || q.outcome === 'lost' ? q.outcome : undefined;
  const sort = q.sort === 'rounds' || q.sort === 'position' ? q.sort : 'newest';
  const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc';

  const query: GamesQuery = {
    page,
    pageSize,
    search,
    mode,
    mapName,
    playersMin: optIntParam(q.playersMin, 1, 100),
    playersMax: optIntParam(q.playersMax, 1, 100),
    minRounds: optIntParam(q.minRounds, 1, 100000),
    maxRounds: optIntParam(q.maxRounds, 1, 100000),
    settings: parseSettings(q),
    outcome,
    positionMin: optIntParam(q.positionMin, 1, 100),
    positionMax: optIntParam(q.positionMax, 1, 100),
    userId: q.mine === '1' ? session?.userId : undefined,
    viewerId: session?.userId,
    sort,
    sortDir,
  };

  listGames(query)
    .then((r) => res.json(r))
    .catch(() => res.json({ games: [], total: 0, page, pageSize }));
});

publicGamesRouter.get('/games/replay/:id', (req, res) => {
  getGameById(req.params.id)
    .then((doc) =>
      doc
        ? res.json(doc)
        : res.status(404).json({ ok: false, error: 'not found' }),
    )
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});

publicGamesRouter.get('/maps/:id', (req, res) => {
  getMapById(req.params.id)
    .then((map) =>
      map
        ? res.json(map)
        : res.status(404).json({ ok: false, error: 'not found' }),
    )
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});
