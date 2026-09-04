import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { allianceStatesForViewer, alliedIds } from '../alliances';
import { gameState, isEliminated, territoryStats } from '../state';
import { SERVER_VIEW_ID } from './fog';
import { withPortalEdges } from './portals';

export function computeVisibleTerritoryIds(
  game: Game,
  playerId: number,
): Set<number> {
  const map = getGameMap(game);
  const neighborsById = new Map(
    map.territories.map((t) => [t.id, t.neighbors]),
  );
  const visible = new Set<number>();
  const ownersToInclude = new Set([playerId, ...alliedIds(game, playerId)]);
  for (const [territoryId, ownerId] of game.territoryOwners) {
    if (!ownersToInclude.has(ownerId)) continue;
    visible.add(territoryId);
    for (const n of withPortalEdges(
      neighborsById.get(territoryId) ?? [],
      territoryId,
      game.portalTerritoryIds,
      game.portalsEnabled,
    )) {
      visible.add(n);
    }
  }
  return visible;
}

export function isFogActive(
  game: Game,
  viewerId: number,
  stats: ReturnType<typeof territoryStats> = territoryStats(game),
): boolean {
  if (game.fogOfWar !== 'on') return false;
  if (game.state !== 'playing') return false;
  if (game.turnPhase === 'territory' || game.turnPhase === 'troop')
    return false;
  if (game.spectatorIds.includes(viewerId)) return false;
  if (game.surrenderedIds.has(viewerId)) return false;
  const territoryCount = stats.get(viewerId)?.territoryCount ?? 0;
  if (isEliminated(game, territoryCount)) return false;
  return true;
}

export function visibleTerritoryIdsOrAll(
  game: Game,
  viewerId: number,
): Set<number> | null {
  if (viewerId === SERVER_VIEW_ID) return null;
  if (!isFogActive(game, viewerId)) return null;
  return computeVisibleTerritoryIds(game, viewerId);
}

export function pathRunsForViewer(
  path: number[],
  visible: Set<number> | null,
): number[][] {
  if (path.length < 2) return [];
  if (visible === null) return [path];
  const runs: number[][] = [];
  let current: number[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const fromId = path[i - 1];
    const toId = path[i];
    if (!visible.has(fromId) && !visible.has(toId)) {
      if (current.length > 1) runs.push(current);
      current = [toId];
      continue;
    }
    current.push(toId);
  }
  if (current.length > 1) runs.push(current);
  return runs;
}

export function troopMoveFields(
  visible: Set<number> | null,
  fromTerritoryId: number,
  territoryId: number,
  troops: number,
): { troopsRemoved?: number; troopsAdded?: number } {
  const fromVisible = visible === null || visible.has(fromTerritoryId);
  const toVisible = visible === null || visible.has(territoryId);
  return {
    ...(fromVisible ? { troopsRemoved: troops } : {}),
    ...(toVisible ? { troopsAdded: troops } : {}),
  };
}

export function filterGameStateForViewer(
  base: ReturnType<typeof gameState>,
  game: Game,
  viewerId: number,
): ReturnType<typeof gameState> {
  const withAlliances = {
    ...base,
    allianceStates: allianceStatesForViewer(game, viewerId),
  };
  if (!isFogActive(game, viewerId)) return withAlliances;

  const visible = computeVisibleTerritoryIds(game, viewerId);
  const attackEndVisible =
    base.attackEndTerritoryId !== null &&
    visible.has(base.attackEndTerritoryId);

  const keepPairIfEitherVisible = (
    startId: number | null,
    endId: number | null,
  ): [number | null, number | null] => {
    if (startId === null && endId === null) return [null, null];
    const startVisible = startId !== null && visible.has(startId);
    const endVisible = endId !== null && visible.has(endId);
    if (!startVisible && !endVisible) return [null, null];
    return [startId, endId];
  };

  const [fortifyStartTerritoryId, fortifyEndTerritoryId] =
    keepPairIfEitherVisible(
      base.fortifyStartTerritoryId,
      base.fortifyEndTerritoryId,
    );
  const [attackStartTerritoryId, attackEndTerritoryId] =
    keepPairIfEitherVisible(
      base.attackStartTerritoryId,
      base.attackEndTerritoryId,
    );

  const allies = alliedIds(game, viewerId);

  return {
    ...withAlliances,
    territories: base.territories.filter((t) => visible.has(t.id)),
    toxinTerritories: base.toxinTerritories.filter((t) => visible.has(t.id)),
    portalTerritoryIds: base.portalTerritoryIds.filter((id) => visible.has(id)),
    radiationTerritoryIds: base.radiationTerritoryIds.filter((id) =>
      visible.has(id),
    ),
    radiationUpcomingTerritoryIds: base.radiationUpcomingTerritoryIds.filter(
      (id) => visible.has(id),
    ),
    visibleTerritoryIds: [...visible],
    selectedTerritoryId:
      base.selectedTerritoryId !== null && visible.has(base.selectedTerritoryId)
        ? base.selectedTerritoryId
        : null,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    attackStartTerritoryId,
    attackEndTerritoryId,
    attackConquestMinTroops: attackEndVisible
      ? base.attackConquestMinTroops
      : null,
    fortifyPathTerritoryIds: pathRunsForViewer(
      base.fortifyPathTerritoryIds[0] ?? [],
      visible,
    ),
    players: base.players.map((p) =>
      p.id === viewerId || allies.has(p.id)
        ? p
        : { ...p, territoryCount: null, troopCount: null },
    ),
  };
}
