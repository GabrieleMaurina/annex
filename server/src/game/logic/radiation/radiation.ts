import { Server } from 'socket.io';
import { maps } from '../../../maps';
import { Game, Player, Radiations } from '../../../types';
import { ownsAnyTerritory, shuffle } from '../mechanics';
import { recordElimination } from '../progression/stats';
import { wouldSplitMap } from '../world/connectivity';
import { fogFilterEmit, visibleTerritoryIdsOrAll } from '../world/fog';
import { removePortalTerritory } from '../world/portals';
import { selectRadiationTerritories } from './selection';

const TERRITORIES_PER_RADIATION = 10;
const MAX_RADIATION_TERRITORIES = 8;

export function radiationInitialCount(
  radiations: Radiations,
  territoryCount: number,
): number {
  if (radiations === 'off') return 0;
  if (radiations === 'expanding') return 1;
  return Math.min(
    MAX_RADIATION_TERRITORIES,
    Math.ceil(territoryCount / TERRITORIES_PER_RADIATION),
  );
}

export function initializeRadiation(game: Game) {
  if (game.radiations === 'off') {
    game.radiationTerritoryIds = new Set();
    game.radiationUpcomingTerritoryIds = new Set();
    return;
  }
  const map = maps.get(game.mapName)!;
  const count = radiationInitialCount(game.radiations, map.territories.length);
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
  if (game.radiations === 'dynamic' && game.territoryToxins.has(candidateId))
    return false;
  const holes = new Set([...working, ...game.territoryToxins.keys()]);
  return !wouldSplitMap(game, holes, candidateId);
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
    game.radiations === 'dynamic'
      ? computeDynamicTarget(game)
      : computeExpandingTarget(game);
}

function applyRadiation(game: Game): {
  eliminatedPlayerIds: number[];
  newlyRadiated: number[];
} {
  const newlyRadiated = [...game.radiationUpcomingTerritoryIds].filter(
    (id) => !game.radiationTerritoryIds.has(id),
  );
  game.radiationTerritoryIds = game.radiationUpcomingTerritoryIds;
  game.radiationUpcomingTerritoryIds = new Set();

  const eliminatedPlayerIds: number[] = [];
  for (const territoryId of newlyRadiated) {
    if (game.radiations === 'expanding')
      removePortalTerritory(game, territoryId);
    game.territoryToxins.delete(territoryId);

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
  return { eliminatedPlayerIds, newlyRadiated };
}

export function updateRadiationForNewTurn(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
): number[] {
  if (game.radiations === 'off' || game.radiations === 'static') return [];

  if (game.turnNumber % 2 === 1) {
    computeUpcomingRadiation(game);
    fogFilterEmit(
      io,
      game,
      playersById,
      'game:radiationUpcoming',
      (viewerId) => {
        const visible = visibleTerritoryIdsOrAll(game, viewerId);
        const territoryIds = [...game.radiationUpcomingTerritoryIds].filter(
          (id) => visible === null || visible.has(id),
        );
        return { territoryIds };
      },
    );
    return [];
  }

  const { eliminatedPlayerIds, newlyRadiated } = applyRadiation(game);
  fogFilterEmit(io, game, playersById, 'game:radiationChanged', (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    const territoryIds = [...game.radiationTerritoryIds].filter(
      (id) => visible === null || visible.has(id),
    );
    const newlyRadiatedIds = newlyRadiated.filter(
      (id) => visible === null || visible.has(id),
    );
    return { territoryIds, eliminatedPlayerIds, newlyRadiatedIds };
  });
  return eliminatedPlayerIds;
}
