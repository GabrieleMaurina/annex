import { Server } from 'socket.io';
import { maps } from '../../maps';
import { Game, Player } from '../../types';
import { withPortalEdges } from './portals';
import { gameState, isEliminated, territoryStats } from './state';

export function computeVisibleTerritoryIds(
  game: Game,
  playerId: number,
): Set<number> {
  const map = maps.get(game.mapName)!;
  const neighborsById = new Map(
    map.territories.map((t) => [t.id, t.neighbors]),
  );
  const visible = new Set<number>();
  for (const [territoryId, ownerId] of game.territoryOwners) {
    if (ownerId !== playerId) continue;
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
  if (!isFogActive(game, viewerId)) return null;
  return computeVisibleTerritoryIds(game, viewerId);
}

export function filterGameStateForViewer(
  base: ReturnType<typeof gameState>,
  game: Game,
  viewerId: number,
): ReturnType<typeof gameState> {
  if (!isFogActive(game, viewerId)) return base;

  const visible = computeVisibleTerritoryIds(game, viewerId);
  const attackEndVisible =
    base.attackEndTerritoryId !== null &&
    visible.has(base.attackEndTerritoryId);

  // A start/end pair for a 2-territory selection (attack or fortify) is kept
  // whole as long as either endpoint is visible, mirroring the redaction rule
  // for the action events themselves: the client needs both ids to draw the
  // preview arrow, fading it toward whichever end it can't see. Only null
  // both when neither endpoint is visible.
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

  return {
    ...base,
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
    players: base.players.map((p) =>
      p.id === viewerId ? p : { ...p, territoryCount: null, troopCount: null },
    ),
  };
}

export function fogFilterEmit<T>(
  io: Server,
  game: Game,
  playersById: Map<number, Player>,
  event: string,
  buildPayload: (viewerId: number) => T | null,
): void {
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    const payload = buildPayload(viewerId);
    if (payload === null) continue;
    const socketId = playersById.get(viewerId)?.socketId;
    if (socketId) io.to(socketId).emit(event, payload);
  }
}
