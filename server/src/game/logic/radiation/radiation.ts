import { Server } from 'socket.io';
import { maps } from '../../../maps';
import { Game, Radiation } from '../../../types';
import { wouldSplitMap } from '../connectivity';
import { ownsAnyTerritory, shuffle } from '../mechanics';
import { removePortalTerritory } from '../portals';
import { recordElimination } from '../progression/stats';
import { gameRoomName } from '../rooms';
import { selectRadiationTerritories } from './selection';

const TERRITORIES_PER_RADIATION = 10;
const MAX_RADIATION_TERRITORIES = 8;

export function radiationInitialCount(
  radiation: Radiation,
  territoryCount: number,
): number {
  if (radiation === 'off') return 0;
  if (radiation === 'expanding') return 1;
  return Math.min(
    MAX_RADIATION_TERRITORIES,
    Math.ceil(territoryCount / TERRITORIES_PER_RADIATION),
  );
}

export function initializeRadiation(game: Game) {
  if (game.radiation === 'off') {
    game.radiationTerritoryIds = new Set();
    game.radiationUpcomingTerritoryIds = new Set();
    return;
  }
  const map = maps.get(game.mapName)!;
  const count = radiationInitialCount(game.radiation, map.territories.length);
  game.radiationTerritoryIds = new Set(
    selectRadiationTerritories(map.territories, count),
  );
  game.radiationUpcomingTerritoryIds = new Set();
}

function isValidRadiationTarget(
  game: Game,
  working: Set<number>,
  candidateId: number,
): boolean {
  if (working.has(candidateId)) return false;
  if (game.capitalTerritoryIds.has(candidateId)) return false;
  return !wouldSplitMap(game, working, candidateId);
}

function computeDynamicTarget(game: Game): Set<number> {
  const map = maps.get(game.mapName)!;
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  const working = new Set(game.radiationTerritoryIds);

  for (const oldId of shuffle([...game.radiationTerritoryIds])) {
    working.delete(oldId);
    const neighbors = shuffle(territoryById.get(oldId)?.neighbors ?? []);
    const target = neighbors.find((n) =>
      isValidRadiationTarget(game, working, n),
    );
    working.add(target ?? oldId);
  }

  return working;
}

function computeExpandingTarget(game: Game): Set<number> {
  const map = maps.get(game.mapName)!;
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  const current = game.radiationTerritoryIds;

  const candidates = new Set<number>();
  for (const id of current) {
    for (const n of territoryById.get(id)?.neighbors ?? []) {
      if (isValidRadiationTarget(game, current, n)) candidates.add(n);
    }
  }
  if (candidates.size === 0) return new Set(current);

  const chosen = shuffle([...candidates])[0];
  return new Set([...current, chosen]);
}

function computeUpcomingRadiation(game: Game) {
  game.radiationUpcomingTerritoryIds =
    game.radiation === 'dynamic'
      ? computeDynamicTarget(game)
      : computeExpandingTarget(game);
}

function applyRadiation(game: Game): number[] {
  const newlyRadiated = [...game.radiationUpcomingTerritoryIds].filter(
    (id) => !game.radiationTerritoryIds.has(id),
  );
  game.radiationTerritoryIds = game.radiationUpcomingTerritoryIds;
  game.radiationUpcomingTerritoryIds = new Set();

  const eliminatedPlayerIds: number[] = [];
  for (const territoryId of newlyRadiated) {
    if (game.radiation === 'expanding')
      removePortalTerritory(game, territoryId);

    const ownerId = game.territoryOwners.get(territoryId);
    if (ownerId === undefined) continue;
    game.territoryOwners.delete(territoryId);
    game.territoryTroops.delete(territoryId);
    game.territoryEntrenchment.delete(territoryId);
    if (!ownsAnyTerritory(game, ownerId)) {
      const wasNewlyEliminated = recordElimination(game, ownerId);
      if (wasNewlyEliminated) eliminatedPlayerIds.push(ownerId);
    }
  }
  return eliminatedPlayerIds;
}

export function updateRadiationForNewTurn(game: Game, io: Server): number[] {
  if (game.radiation === 'off' || game.radiation === 'static') return [];

  if (game.turnNumber % 2 === 1) {
    computeUpcomingRadiation(game);
    io.to(gameRoomName(game.name)).emit('game:radiationUpcoming', {
      territoryIds: [...game.radiationUpcomingTerritoryIds],
    });
    return [];
  }

  const eliminatedPlayerIds = applyRadiation(game);
  io.to(gameRoomName(game.name)).emit('game:radiationChanged', {
    territoryIds: [...game.radiationTerritoryIds],
    eliminatedPlayerIds,
  });
  return eliminatedPlayerIds;
}
