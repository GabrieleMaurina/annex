import { BUILTIN_MAP_NAMES, type GameMap } from 'engine';

function fetchMap(name: string): Promise<GameMap> {
  return fetch(`/maps/${encodeURIComponent(name)}.anx`)
    .then((res) => res.json() as Promise<Partial<GameMap>>)
    .then((data) => ({
      name: data.name ?? name,
      territories: data.territories ?? [],
      bonuses: data.bonuses ?? [],
    }));
}

export function loadBuiltinMaps(): Promise<GameMap[]> {
  return Promise.all(BUILTIN_MAP_NAMES.map(fetchMap));
}
