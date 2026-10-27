import {
  Fill,
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_SIZE_VALUES,
  MapSize,
  TILE_SHAPE_VALUES,
  TileShape,
} from 'engine';
import { Response, Router } from 'express';
import {
  createPlayerMap,
  deleteLikesForMap,
  deletePlayerMap,
  deleteReportsForMap,
  getPlayerMapById,
  getPlayerMapImage,
  getPlayerMapOwner,
  likedMapIds,
  likeMap,
  listPlayerMapNames,
  listPlayerMaps,
  playerMapExists,
  PlayerMapSort,
  PlayerMapsQuery,
  reportMap,
  unlikeMap,
  updatePlayerMap,
} from '../../db';
import { isImageAllowed } from '../../moderation';
import { isObject, parseMapInput } from '../../validate';
import { identityOf, rateLimited } from '../middleware';
import { intParam, optBoolParam, optIntParam } from '../queryParams';

export const playerMapsRouter = Router();

const SORTS: PlayerMapSort[] = [
  'mostLiked',
  'newest',
  'oldest',
  'nameAsc',
  'nameDesc',
];

function bodyOf(req: { body: unknown }): Record<string, unknown> {
  return isObject(req.body) ? req.body : {};
}

function viewerId(res: Response): string | undefined {
  return identityOf(res).session?.userId;
}

function enumParam<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function moderate(dataUrl: string): Promise<'error' | boolean> {
  return isImageAllowed(dataUrl).catch(() => 'error' as const);
}

playerMapsRouter.get('/player-maps', (req, res) => {
  const q = req.query as Record<string, unknown>;
  const page = intParam(q.page, 1, 1, 100000);
  const pageSize = intParam(q.pageSize, 24, 1, 60);
  const sort = SORTS.includes(q.sort as PlayerMapSort)
    ? (q.sort as PlayerMapSort)
    : 'mostLiked';
  const viewer = viewerId(res);

  const query: PlayerMapsQuery = {
    page,
    pageSize,
    q:
      typeof q.q === 'string' && q.q.trim()
        ? q.q.trim().slice(0, 60)
        : undefined,
    authorId:
      typeof q.author === 'string' && /^[a-f\d]{24}$/i.test(q.author)
        ? q.author
        : undefined,
    mine: q.mine === '1' && viewer ? true : undefined,
    notMine: q.notMine === '1' && viewer ? true : undefined,
    liked: q.liked === '1' && viewer ? true : undefined,
    notLiked: q.notLiked === '1' && viewer ? true : undefined,
    territoryMin: optIntParam(q.territoryMin, 0, 100000),
    territoryMax: optIntParam(q.territoryMax, 0, 100000),
    generationType: enumParam<GenerationType>(
      q.genType,
      GENERATION_TYPE_VALUES,
    ),
    generationFill: enumParam<Fill>(q.genFill, FILL_VALUES),
    generationSize: enumParam<MapSize>(q.genSize, MAP_SIZE_VALUES),
    generationTile: enumParam<TileShape>(q.genTile, TILE_SHAPE_VALUES),
    generationSeas: optBoolParam(q.genSeas),
    generationTimed: optBoolParam(q.genTimed),
    generationUnlockable: optBoolParam(q.genUnlockable),
    sort,
    viewerId: viewer,
  };

  listPlayerMaps(query)
    .then((r) => res.json(r))
    .catch(() => res.json({ maps: [], total: 0, page, pageSize }));
});

playerMapsRouter.get('/player-maps/mine/names', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  listPlayerMapNames(session.userId)
    .then((names) => res.json({ ok: true, names }))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

playerMapsRouter.get('/player-maps/:id', (req, res) => {
  const viewer = viewerId(res);
  getPlayerMapById(req.params.id)
    .then((map) => {
      if (!map || (map.dangerous && map.authorId !== viewer)) {
        res.status(404).json({ ok: false, error: 'not found' });
        return;
      }
      res.json({
        id: map.id,
        name: map.name,
        authorId: map.authorId,
        territories: map.territories,
        seaTerritories: map.seaTerritories,
        bonuses: map.bonuses,
        wraps: map.wraps,
        timedConnections: map.timedConnections,
        lockedTiles: map.lockedTiles,
        image: `data:${map.imageMime};base64,${map.image}`,
        imageMime: map.imageMime,
        borderColors: map.borderColors,
        territoryNames: map.territoryNames,
        seaNames: map.seaNames,
        continentNames: map.continentNames,
        generation: map.generation,
        dangerous: map.dangerous,
        likeCount: map.likeCount,
        mine: map.authorId === viewer,
        createdAt: map.createdAt,
      });
    })
    .catch(() => res.status(500).json({ ok: false, error: 'server error' }));
});

playerMapsRouter.get('/player-maps/:id/image', (req, res) => {
  const viewer = viewerId(res);
  getPlayerMapImage(req.params.id)
    .then((image) => {
      if (!image || (image.dangerous && image.authorId !== viewer)) {
        res.status(404).end();
        return;
      }
      res.type(image.mime).send(image.bytes);
    })
    .catch(() => res.status(500).end());
});

playerMapsRouter.post('/player-maps', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  if (rateLimited(req)) {
    res.json({ ok: false, error: 'too many requests' });
    return;
  }
  const parsed = parseMapInput(bodyOf(req));
  if (!parsed.ok) {
    res.json({ ok: false, error: parsed.error });
    return;
  }
  moderate(parsed.input.imageDataUrl)
    .then((verdict) => {
      if (verdict === 'error') {
        res.json({ ok: false, error: 'moderation failed' });
        return;
      }
      if (!verdict) {
        res.json({ ok: false, error: 'image rejected' });
        return;
      }
      return createPlayerMap(session.userId, parsed.input).then((r) =>
        res.json(r),
      );
    })
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

playerMapsRouter.post('/player-maps/:id', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  if (rateLimited(req)) {
    res.json({ ok: false, error: 'too many requests' });
    return;
  }
  getPlayerMapOwner(req.params.id)
    .then((owner) => {
      if (!owner || owner.authorId !== session.userId) {
        res.json({ ok: false, error: 'map not found' });
        return;
      }
      if (owner.dangerous) {
        res.json({ ok: false, error: 'map unavailable' });
        return;
      }
      const parsed = parseMapInput(bodyOf(req));
      if (!parsed.ok) {
        res.json({ ok: false, error: parsed.error });
        return;
      }
      return moderate(parsed.input.imageDataUrl).then((verdict) => {
        if (verdict === 'error') {
          res.json({ ok: false, error: 'moderation failed' });
          return;
        }
        if (!verdict) {
          res.json({ ok: false, error: 'image rejected' });
          return;
        }
        return updatePlayerMap(
          req.params.id,
          session.userId,
          parsed.input,
        ).then((result) => res.json(result));
      });
    })
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

playerMapsRouter.post('/player-maps/:id/delete', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  deletePlayerMap(req.params.id, session.userId)
    .then((result) => {
      if (!result.ok) {
        res.json(result);
        return;
      }
      return Promise.all([
        deleteLikesForMap(req.params.id),
        deleteReportsForMap(req.params.id),
      ]).then(() => res.json({ ok: true }));
    })
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

playerMapsRouter.post('/player-maps/:id/like', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  likeMap(session.userId, req.params.id)
    .then(() => res.json({ ok: true }))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

playerMapsRouter.get('/player-maps/:id/liked', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  playerMapExists(req.params.id)
    .then((exists) => {
      if (!exists) {
        res.json({ ok: false, error: 'map not found' });
        return;
      }
      return likedMapIds(session.userId, [req.params.id]).then((ids) =>
        res.json({ ok: true, liked: ids.length > 0 }),
      );
    })
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

playerMapsRouter.post('/player-maps/:id/unlike', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  unlikeMap(session.userId, req.params.id)
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});

playerMapsRouter.post('/player-maps/:id/report', (req, res) => {
  const { session } = identityOf(res);
  if (!session) {
    res.json({ ok: false, error: 'not logged in' });
    return;
  }
  reportMap(session.userId, req.params.id)
    .then((result) => res.json(result))
    .catch(() => res.json({ ok: false, error: 'server error' }));
});
