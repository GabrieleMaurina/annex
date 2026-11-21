import { callbacks } from '../../callbacks';
import { addTroopsCapped, ownedTerritoryIds } from '../../game/mechanics';
import { bumpStat, recordElimination } from '../../game/progression/stats';
import { recordReplayFrame } from '../../game/replay';
import { fogFilterEmit } from '../../game/world/fog';
import { visibleTerritoryIdsOrAll } from '../../game/world/visibility';
import { discardHand } from '../../territory/cards';
import { Game } from '../../types';

function victimIds(game: Game, minTerritories: number): number[] {
  return game.playerIds.filter(
    (id) =>
      id !== game.zombieId &&
      ownedTerritoryIds(game, id).length >= minTerritories,
  );
}

function pickWeighted(game: Game, territoryIds: number[]): number {
  const weights = territoryIds.map((id) =>
    Math.max(1, game.territoryTroops.get(id) ?? 0),
  );
  let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < territoryIds.length; i++) {
    roll -= weights[i];
    if (roll < 0) return territoryIds[i];
  }
  return territoryIds[territoryIds.length - 1];
}

function infectVictim(game: Game, victimId: number, respawn: boolean): number {
  const zombieId = game.zombieId!;
  const territoryId = pickWeighted(game, ownedTerritoryIds(game, victimId));
  const troops = game.territoryTroops.get(territoryId) ?? 0;
  game.territoryOwners.set(territoryId, zombieId);
  game.territoryEntrenchment.delete(territoryId);
  game.territoryToxins.delete(territoryId);
  game.zombieInfectedIds.add(victimId);
  game.stats.get(victimId)!.territoriesLost++;
  game.stats.get(zombieId)!.territoriesConquered++;
  recordReplayFrame(game, {
    type: 'infect',
    territoryId,
    troops,
    victimId,
    playerId: zombieId,
    respawn,
  });
  fogFilterEmit(game, 'game:infected', callbacks.onInfected, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(territoryId)) return null;
    return { territoryId, troops, victimId, playerId: zombieId, respawn };
  });
  if (recordElimination(game, victimId, zombieId)) discardHand(game, victimId);
  return territoryId;
}

export function infectDefenders(
  game: Game,
  territoryId: number,
  defenders: number,
): void {
  const troops = addTroopsCapped(game, territoryId, Math.ceil(defenders / 2));
  if (troops <= 0) return;
  const playerId = game.zombieId!;
  bumpStat(game, playerId, 'troopsGained', troops);
  recordReplayFrame(game, { type: 'deploy', territoryId, troops, playerId });
  fogFilterEmit(game, 'game:deployed', callbacks.onDeployed, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(territoryId)) return null;
    return { territoryId, troops, playerId };
  });
}

export function infectEveryone(game: Game): number[] {
  game.zombieInfectedIds.clear();
  return victimIds(game, 2).map((id) => infectVictim(game, id, false));
}

export function infectOne(game: Game, respawn: boolean): number | null {
  let candidates = victimIds(game, 2);
  if (candidates.length === 0 && respawn) candidates = victimIds(game, 1);
  if (candidates.length === 0) return null;
  let pool = candidates.filter((id) => !game.zombieInfectedIds.has(id));
  if (pool.length === 0) {
    game.zombieInfectedIds.clear();
    pool = candidates;
  }
  return infectVictim(
    game,
    pool[Math.floor(Math.random() * pool.length)],
    respawn,
  );
}
