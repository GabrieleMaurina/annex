import { callbacks } from '../../callbacks';
import { getGameMap } from '../../maps/maps';
import { Arsenal, Game, NukeProject } from '../../types';
import { ownedTerritoryIds, ownsAnyTerritory } from '../mechanics';
import { recordElimination } from '../progression/stats';
import { recordReplayFrame } from '../replay';
import { connectedOwnedTerritories } from '../world/connectivity';
import { recordLogForAll } from '../world/fog';

export const NUKE_INSTALLMENT = 5;
export const ANTI_NUKE_INSTALLMENT = 3;
export const NUKE_INSTALLMENTS = 5;

type NukeKind = NukeProject['kind'];
type Result = { ok: true } | { ok: false; error: string };

export function installmentCost(kind: NukeKind): number {
  return kind === 'nuke' ? NUKE_INSTALLMENT : ANTI_NUKE_INSTALLMENT;
}

export function playerProjects(game: Game, playerId: number): NukeProject[] {
  return game.nukeProjects.get(playerId) ?? [];
}

export function playerArsenal(game: Game, playerId: number): Arsenal {
  return game.arsenal.get(playerId) ?? { nukes: 0, antiNukes: 0 };
}

export function hasReadyNuke(game: Game, playerId: number): boolean {
  if (game.nukes !== 'on') return false;
  const arsenal = playerArsenal(game, playerId);
  return arsenal.nukes > 0 || arsenal.antiNukes > 0;
}

function addToArsenal(game: Game, playerId: number, kind: NukeKind): void {
  const arsenal = game.arsenal.get(playerId) ?? { nukes: 0, antiNukes: 0 };
  if (kind === 'nuke') arsenal.nukes++;
  else arsenal.antiNukes++;
  game.arsenal.set(playerId, arsenal);
}

function takeFromArsenal(
  game: Game,
  playerId: number,
  kind: NukeKind,
): boolean {
  const arsenal = game.arsenal.get(playerId);
  if (!arsenal) return false;
  if (kind === 'nuke') {
    if (arsenal.nukes < 1) return false;
    arsenal.nukes--;
  } else {
    if (arsenal.antiNukes < 1) return false;
    arsenal.antiNukes--;
  }
  return true;
}

export function startNukeProject(
  game: Game,
  playerId: number,
  kind: NukeKind,
): Result {
  const cost = installmentCost(kind);
  if (game.troopsToDeploy < cost)
    return { ok: false, error: 'not enough troops' };
  game.troopsToDeploy -= cost;
  const list = game.nukeProjects.get(playerId) ?? [];
  list.push({ kind, installmentsPaid: 1, lastPaidRound: game.roundNumber });
  game.nukeProjects.set(playerId, list);
  if (list[list.length - 1].installmentsPaid >= NUKE_INSTALLMENTS) {
    list.pop();
    if (list.length === 0) game.nukeProjects.delete(playerId);
    addToArsenal(game, playerId, kind);
  }
  return { ok: true };
}

export function advanceNukeProject(
  game: Game,
  playerId: number,
  index: number,
): Result {
  const list = game.nukeProjects.get(playerId) ?? [];
  const project = list[index];
  if (!project) return { ok: false, error: 'no such project' };
  if (project.lastPaidRound >= game.roundNumber)
    return { ok: false, error: 'already advanced this turn' };
  const cost = installmentCost(project.kind);
  if (game.troopsToDeploy < cost)
    return { ok: false, error: 'not enough troops' };
  game.troopsToDeploy -= cost;
  project.installmentsPaid++;
  project.lastPaidRound = game.roundNumber;
  if (project.installmentsPaid >= NUKE_INSTALLMENTS) {
    list.splice(index, 1);
    if (list.length === 0) game.nukeProjects.delete(playerId);
    addToArsenal(game, playerId, project.kind);
  }
  return { ok: true };
}

export function deployAntiNuke(
  game: Game,
  playerId: number,
  territoryId: number,
): Result {
  if (game.territoryOwners.get(territoryId) !== playerId)
    return { ok: false, error: 'territory not owned' };
  if (game.antiNukeTerritoryIds.has(territoryId))
    return { ok: false, error: 'territory already protected' };
  if (!takeFromArsenal(game, playerId, 'antiNuke'))
    return { ok: false, error: 'no anti-nuke available' };
  game.antiNukeTerritoryIds.add(territoryId);
  return { ok: true };
}

function rocketOrigin(game: Game, playerId: number): number | null {
  const owned = ownedTerritoryIds(game, playerId);
  if (owned.length === 0) return null;
  const capitals = owned.filter((id) => game.capitalTerritoryIds.has(id));
  const pool = capitals.length > 0 ? capitals : owned;
  return pool.reduce((best, id) =>
    (game.territoryTroops.get(id) ?? 0) > (game.territoryTroops.get(best) ?? 0)
      ? id
      : best,
  );
}

function findInterceptor(game: Game, targetTerritoryId: number): number | null {
  const targetOwner = game.territoryOwners.get(targetTerritoryId);
  if (targetOwner === undefined || game.antiNukeTerritoryIds.size === 0)
    return null;
  const connected = connectedOwnedTerritories(game, targetOwner, [
    targetTerritoryId,
  ]);
  for (const id of connected) if (game.antiNukeTerritoryIds.has(id)) return id;
  return null;
}

export function launchNuke(
  game: Game,
  playerId: number,
  targetTerritoryId: number,
): { ok: true; eliminatedPlayerIds: number[] } | { ok: false; error: string } {
  if (playerArsenal(game, playerId).nukes < 1)
    return { ok: false, error: 'no nuke available' };
  const onMap = getGameMap(game).territories.some(
    (t) => t.id === targetTerritoryId,
  );
  if (!onMap) return { ok: false, error: 'invalid territory' };
  if (game.territoryOwners.get(targetTerritoryId) === playerId)
    return { ok: false, error: 'cannot nuke your own territory' };
  const fromTerritoryId = rocketOrigin(game, playerId);
  if (fromTerritoryId === null) return { ok: false, error: 'no launch site' };

  takeFromArsenal(game, playerId, 'nuke');

  const interceptFromTerritoryId = findInterceptor(game, targetTerritoryId);
  const intercepted = interceptFromTerritoryId !== null;
  const eliminatedPlayerIds: number[] = [];

  if (intercepted) {
    game.antiNukeTerritoryIds.delete(interceptFromTerritoryId);
  } else {
    const targetOwner = game.territoryOwners.get(targetTerritoryId);
    game.territoryOwners.delete(targetTerritoryId);
    game.territoryTroops.delete(targetTerritoryId);
    game.territoryEntrenchment.delete(targetTerritoryId);
    game.antiNukeTerritoryIds.delete(targetTerritoryId);
    if (game.selectedTerritoryId === targetTerritoryId)
      game.selectedTerritoryId = null;
    if (targetOwner !== undefined && !ownsAnyTerritory(game, targetOwner)) {
      if (recordElimination(game, targetOwner, playerId))
        eliminatedPlayerIds.push(targetOwner);
    }
  }

  recordReplayFrame(game, {
    type: 'nuke',
    fromTerritoryId,
    targetTerritoryId,
    intercepted,
    interceptFromTerritoryId,
    playerId,
  });

  const payload = {
    playerId,
    fromTerritoryId,
    targetTerritoryId,
    intercepted,
    interceptFromTerritoryId,
    eliminatedPlayerIds,
  };
  for (const viewerId of [...game.playerIds, ...game.spectatorIds])
    callbacks.onNukeLaunched(viewerId, payload);
  recordLogForAll(game, 'game:nukeLaunched', payload);

  return { ok: true, eliminatedPlayerIds };
}
