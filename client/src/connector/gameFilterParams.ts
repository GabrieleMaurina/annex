import type { GamesQuery, HomeGamesQuery } from '../lib/types';

export function appendGameFilterParams(
  params: URLSearchParams,
  query: GamesQuery | HomeGamesQuery,
): void {
  for (const id of query.playerIds ?? []) params.append('playerIds', id);
  if (query.name) params.set('name', query.name);
  if (query.mode) params.set('mode', query.mode);
  if (query.mapName) params.set('mapName', query.mapName);
  if (query.mapKind) params.set('mapKind', query.mapKind);
  if (query.mapGenerationSize)
    params.set('mapGenerationSize', query.mapGenerationSize);
  if (query.mapGenerationType)
    params.set('mapGenerationType', query.mapGenerationType);
  if (query.mapGenerationFill)
    params.set('mapGenerationFill', query.mapGenerationFill);
  if (query.mapGenerationTile)
    params.set('mapGenerationTile', query.mapGenerationTile);
  if (query.mapGenerationAspect)
    params.set('mapGenerationAspect', query.mapGenerationAspect);
  if (query.mapGenerationSeas !== undefined)
    params.set('mapGenerationSeas', query.mapGenerationSeas ? '1' : '0');
  if (query.mapGenerationTimed !== undefined)
    params.set('mapGenerationTimed', query.mapGenerationTimed ? '1' : '0');
  if (query.mapGenerationDirectional !== undefined)
    params.set(
      'mapGenerationDirectional',
      query.mapGenerationDirectional ? '1' : '0',
    );
  if (query.mapGenerationSwitched !== undefined)
    params.set(
      'mapGenerationSwitched',
      query.mapGenerationSwitched ? '1' : '0',
    );
  if (query.mapGenerationUnlockable !== undefined)
    params.set(
      'mapGenerationUnlockable',
      query.mapGenerationUnlockable ? '1' : '0',
    );
  if (query.mapGenerationMountains !== undefined)
    params.set(
      'mapGenerationMountains',
      query.mapGenerationMountains ? '1' : '0',
    );
  if (query.mapGenerationRivers !== undefined)
    params.set('mapGenerationRivers', query.mapGenerationRivers ? '1' : '0');
  if (query.playersMin !== undefined)
    params.set('playersMin', String(query.playersMin));
  if (query.playersMax !== undefined)
    params.set('playersMax', String(query.playersMax));
  if (query.minRounds !== undefined)
    params.set('roundsMin', String(query.minRounds));
  if (query.maxRounds !== undefined)
    params.set('roundsMax', String(query.maxRounds));
  for (const [key, value] of Object.entries(query.settings ?? {}))
    if (value) params.set(key, value);
  if (query.hasBots !== undefined)
    params.set('hasBots', query.hasBots ? '1' : '0');
  if (query.sort) params.set('sort', query.sort);
  if (query.sortDir) params.set('sortDir', query.sortDir);
}
