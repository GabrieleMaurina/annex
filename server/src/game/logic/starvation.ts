import { maps } from '../../maps';
import { Game } from '../../types';
import { recordReplayFrame } from './replay';

const PERCENT_LOSS = 0.3;
const TOTAL_CAP_MULTIPLIER = 3;
export const TERRITORY_CAP = 30;

export function totalTroopsCap(game: Game): number {
  return maps.get(game.mapName)!.territories.length * TOTAL_CAP_MULTIPLIER;
}

function playerTerritoryIds(game: Game, playerId: number): number[] {
  return [...game.territoryOwners.entries()]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([territoryId]) => territoryId);
}

function largestArmyTerritoryId(
  game: Game,
  territoryIds: number[],
): number | null {
  let best: number | null = null;
  let bestTroops = 0;
  for (const territoryId of territoryIds) {
    const troops = game.territoryTroops.get(territoryId) ?? 0;
    if (troops > bestTroops) {
      best = territoryId;
      bestTroops = troops;
    }
  }
  return best;
}

export function applyStarvation(
  game: Game,
  playerId: number,
): Map<number, number> {
  const losses = new Map<number, number>();
  if (game.starvation === 'off') return losses;
  const territoryIds = playerTerritoryIds(game, playerId);

  function removeTroop(territoryId: number) {
    game.territoryTroops.set(
      territoryId,
      (game.territoryTroops.get(territoryId) ?? 0) - 1,
    );
    losses.set(territoryId, (losses.get(territoryId) ?? 0) + 1);
  }

  if (game.starvation === 'territory') {
    for (const territoryId of territoryIds) {
      let troops = game.territoryTroops.get(territoryId) ?? 0;
      while (troops > TERRITORY_CAP) {
        removeTroop(territoryId);
        troops--;
      }
    }
  } else if (game.starvation === 'total') {
    const cap = totalTroopsCap(game);
    let total = territoryIds.reduce(
      (sum, id) => sum + (game.territoryTroops.get(id) ?? 0),
      0,
    );
    while (total > cap) {
      const removable = territoryIds.filter(
        (id) => (game.territoryTroops.get(id) ?? 0) > 1,
      );
      const territoryId = largestArmyTerritoryId(game, removable);
      if (territoryId === null) break;
      removeTroop(territoryId);
      total--;
    }
  } else {
    const territoryId = largestArmyTerritoryId(game, territoryIds);
    if (territoryId !== null) {
      const troops = game.territoryTroops.get(territoryId) ?? 0;
      const loss = Math.min(Math.floor(troops * PERCENT_LOSS), troops - 1);
      for (let i = 0; i < loss; i++) removeTroop(territoryId);
    }
  }

  for (const [territoryId, troops] of losses) {
    recordReplayFrame(game, {
      type: 'starve',
      territoryId,
      troops,
      playerId,
    });
  }

  return losses;
}
