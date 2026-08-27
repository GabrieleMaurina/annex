import { Server } from 'socket.io';
import { maps } from '../../maps';
import { Game, Player } from '../../types';
import { allianceStatesForViewer, alliedIds } from './alliances';
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
  if (!isFogActive(game, viewerId)) return null;
  return computeVisibleTerritoryIds(game, viewerId);
}

// Splits a territory-id path into runs, dropping any hop where neither
// endpoint is visible so a client never learns two hidden territories are
// connected by a fortify chain. Each remaining hop keeps at least one
// visible endpoint, which is enough for the client to draw a full or
// half-faded arrow using its own visibleTerritoryIds.
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

// Troop-move events (fortify, attack-move) transfer the same amount out of
// one territory and into another with no loss. Revealing that amount for a
// territory the recipient can't see would tell them exactly how many troops
// just left (or arrived at) a hidden territory, so each side is only
// included when that specific territory is visible to this recipient.
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

const LOGGED_EVENTS = new Set([
  'game:deployed',
  'game:fortified',
  'game:attackMoved',
  'game:deployedMany',
  'game:entrenched',
  'game:toxined',
  'game:radiationChanged',
  'game:attacked',
  'game:cardSetPlayed',
  'game:turnStarted',
  'game:allianceFormed',
  'game:allianceTerminated',
  'game:capitalPlacementStarted',
  'game:territoryClaimed',
]);

export function recordLog(
  game: Game,
  viewerId: number,
  type: string,
  payload: unknown,
): void {
  if (!LOGGED_EVENTS.has(type)) return;
  const entries = game.logs.get(viewerId);
  if (entries) entries.push({ type, payload });
  else game.logs.set(viewerId, [{ type, payload }]);
}

export function recordLogForAll(
  game: Game,
  type: string,
  payload: unknown,
): void {
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    recordLog(game, viewerId, type, payload);
  }
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
    recordLog(game, viewerId, event, payload);
  }
}
