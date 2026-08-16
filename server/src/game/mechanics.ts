import { maps } from '../maps';
import { Game } from '../types';

const COLOR_COUNT = 20;

function colorBound(game: Game) {
  return Math.min(COLOR_COUNT, game.playerIds.length + 3);
}

export function maxTeam(game: Game) {
  return Math.max(0, game.playerIds.length - 2);
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignTerritories(game: Game) {
  const map = maps.get(game.mapName)!;
  const territoryIds = shuffle(map.territories.map((t) => t.id));
  const playerCount = game.playerIds.length;
  const base = Math.floor(territoryIds.length / playerCount);
  const remainder = territoryIds.length % playerCount;

  let index = 0;
  game.playerIds.forEach((playerId, i) => {
    const count = base + (i >= playerCount - remainder ? 1 : 0);
    const owned = territoryIds.slice(index, index + count);
    index += count;

    for (const territoryId of owned) {
      game.territoryOwners.set(territoryId, playerId);
      game.territoryTroops.set(territoryId, 1);
    }

    let remainingTroops = count * 2;
    while (remainingTroops > 0) {
      const territoryId = owned[Math.floor(Math.random() * owned.length)];
      game.territoryTroops.set(
        territoryId,
        (game.territoryTroops.get(territoryId) ?? 0) + 1,
      );
      remainingTroops--;
    }
  });
}

export function assignRandomColor(game: Game, playerId: number) {
  const bound = colorBound(game);
  const used = new Set(game.playerColors.values());
  const available = [];
  for (let i = 0; i < bound; i++) {
    if (!used.has(i)) available.push(i);
  }
  const pool =
    available.length > 0
      ? available
      : Array.from({ length: bound }, (_, i) => i);
  game.playerColors.set(
    playerId,
    pool[Math.floor(Math.random() * pool.length)],
  );
}

export function cycleColor(game: Game, playerId: number) {
  const bound = colorBound(game);
  const current = game.playerColors.get(playerId) ?? 0;
  const usedByOthers = new Set(
    [...game.playerColors.entries()]
      .filter(([id]) => id !== playerId)
      .map(([, index]) => index),
  );
  for (let step = 1; step <= bound; step++) {
    const candidate = (current + step) % bound;
    if (!usedByOthers.has(candidate)) {
      game.playerColors.set(playerId, candidate);
      return;
    }
  }
}
