import { maps } from '../../maps';
import { Game } from '../../types';
import { shuffle } from './mechanics';

const MIN_CONTINENT_SIZE = 7;

export function continentTerritoryIds(
  game: Game,
  continentId: number,
): number[] {
  const map = maps.get(game.mapName)!;
  return map.territories
    .filter((t) => t.continentId === continentId)
    .map((t) => t.id);
}

export function initializeContinent(game: Game) {
  if (game.gameMode !== 'Continent') {
    game.continentId = null;
    return;
  }
  const map = maps.get(game.mapName)!;
  const sizeByContinentId = new Map<number, number>();
  for (const t of map.territories) {
    sizeByContinentId.set(
      t.continentId,
      (sizeByContinentId.get(t.continentId) ?? 0) + 1,
    );
  }
  const qualifying = [...sizeByContinentId.entries()].filter(
    ([, size]) => size >= MIN_CONTINENT_SIZE,
  );
  const candidates =
    qualifying.length > 0
      ? qualifying
      : (() => {
          const maxSize = Math.max(...sizeByContinentId.values());
          return [...sizeByContinentId.entries()].filter(
            ([, size]) => size === maxSize,
          );
        })();
  game.continentId = shuffle(candidates.map(([continentId]) => continentId))[0];
}
