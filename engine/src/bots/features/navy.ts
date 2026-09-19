import { alliedIds } from '../../game/alliances';
import { supplyHubTerritoryIds } from '../../game/mechanics';
import { connectedFortifyTerritories } from '../../game/world/connectivity';
import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { BotView, isVisible, ownerOf, shipsAt } from '../view';
import { attackWinProbability, defenceDiceFor } from './combat';
import { isTeammate } from './mode';
import { minWinProbability } from './pressure';

export interface CoastalTerritory {
  territoryId: number;
  seaIds: number[];
}

function seaTerritoryIds(game: Game): Set<number> {
  return new Set(getGameMap(game).seaTerritories.map((t) => t.id));
}

export function coastalTerritoriesOf(
  game: Game,
  botId: number,
): CoastalTerritory[] {
  const seaIds = seaTerritoryIds(game);
  const result: CoastalTerritory[] = [];
  for (const territory of getGameMap(game).territories) {
    if (game.territoryOwners.get(territory.id) !== botId) continue;
    const adjacentSeas = territory.neighbors.filter((n) => seaIds.has(n));
    if (adjacentSeas.length > 0)
      result.push({ territoryId: territory.id, seaIds: adjacentSeas });
  }
  return result;
}

function coastalSourceBySeaId(game: Game, botId: number): Map<number, number> {
  const supplied =
    game.supplyLines === 'on'
      ? connectedFortifyTerritories(
          game,
          botId,
          supplyHubTerritoryIds(game, botId),
        )
      : null;
  const bySeaId = new Map<number, number>();
  for (const { territoryId, seaIds } of coastalTerritoriesOf(game, botId)) {
    if (
      supplied !== null &&
      !supplied.has(territoryId) &&
      (game.territoryTroops.get(territoryId) ?? 0) < 2
    )
      continue;
    for (const seaId of seaIds) {
      const current = bySeaId.get(seaId);
      if (
        current === undefined ||
        (game.territoryTroops.get(territoryId) ?? 0) >
          (game.territoryTroops.get(current) ?? 0)
      )
        bySeaId.set(seaId, territoryId);
    }
  }
  return bySeaId;
}

const MIN_SUPPLY_BRIDGE_GAIN = 2;

export function shippedSeaIdsOf(game: Game, botId: number): Set<number> {
  const ids = new Set<number>();
  for (const [seaId, shipsByPlayer] of game.seaShips)
    if ((shipsByPlayer.get(botId) ?? 0) > 0) ids.add(seaId);
  return ids;
}

function suppliedTerritoryCount(
  game: Game,
  botId: number,
  hubIds: number[],
  shippedSeaIds: Set<number>,
): number {
  let count = 0;
  for (const id of connectedFortifyTerritories(
    game,
    botId,
    hubIds,
    shippedSeaIds,
  ))
    if (game.territoryOwners.get(id) === botId) count++;
  return count;
}

export interface SupplyBridge {
  sourceTerritoryId: number;
  seaTerritoryId: number;
}

export function supplyBridgeSite(
  game: Game,
  botId: number,
): SupplyBridge | null {
  if (game.supplyLines !== 'on') return null;
  const hubIds = supplyHubTerritoryIds(game, botId);
  const shipped = shippedSeaIdsOf(game, botId);
  const base = suppliedTerritoryCount(game, botId, hubIds, shipped);
  const tried = new Set<number>();
  let best: SupplyBridge | null = null;
  let bestGain = MIN_SUPPLY_BRIDGE_GAIN - 1;
  for (const { territoryId, seaIds } of coastalTerritoriesOf(game, botId)) {
    for (const seaId of seaIds) {
      if (shipped.has(seaId) || tried.has(seaId)) continue;
      tried.add(seaId);
      const gain =
        suppliedTerritoryCount(
          game,
          botId,
          hubIds,
          new Set(shipped).add(seaId),
        ) - base;
      if (gain > bestGain) {
        bestGain = gain;
        best = { sourceTerritoryId: territoryId, seaTerritoryId: seaId };
      }
    }
  }
  return best;
}

export function supplyCarryingSeaIds(game: Game, botId: number): Set<number> {
  const carrying = new Set<number>();
  if (game.supplyLines !== 'on') return carrying;
  const hubIds = supplyHubTerritoryIds(game, botId);
  const shipped = shippedSeaIdsOf(game, botId);
  const base = suppliedTerritoryCount(game, botId, hubIds, shipped);
  for (const seaId of shipped) {
    const without = new Set(shipped);
    without.delete(seaId);
    if (suppliedTerritoryCount(game, botId, hubIds, without) < base)
      carrying.add(seaId);
  }
  return carrying;
}

export interface SeaBridgeTarget {
  sourceTerritoryId: number;
  seaTerritoryId: number;
  targetId: number;
  ownerId: number;
}

export function seaBridgeTargets(
  game: Game,
  view: BotView,
  botId: number,
): SeaBridgeTarget[] {
  const seaIds = seaTerritoryIds(game);
  const bySeaId = coastalSourceBySeaId(game, botId);
  if (bySeaId.size === 0) return [];

  const results: SeaBridgeTarget[] = [];
  for (const territory of getGameMap(game).territories) {
    const ownerId = ownerOf(game, view, territory.id);
    if (
      ownerId === undefined ||
      ownerId === botId ||
      isTeammate(game, botId, ownerId)
    )
      continue;
    for (const seaId of territory.neighbors) {
      if (!seaIds.has(seaId)) continue;
      const sourceTerritoryId = bySeaId.get(seaId);
      if (sourceTerritoryId === undefined || !isVisible(view, seaId)) continue;
      const attackerShips = shipsAt(game, view, seaId, botId);
      const defenderShips = shipsAt(game, view, seaId, ownerId);
      if (attackerShips <= defenderShips) continue;
      results.push({
        sourceTerritoryId,
        seaTerritoryId: seaId,
        targetId: territory.id,
        ownerId,
      });
    }
  }
  return results;
}

export interface NavalOpportunity {
  sourceTerritoryId: number;
  seaTerritoryId: number;
  targetId: number;
  ownerId: number;
  shipsNeeded: number;
  targetTroops: number;
}

export function navalOpportunities(
  game: Game,
  view: BotView,
  botId: number,
): NavalOpportunity[] {
  const seaIds = seaTerritoryIds(game);
  const bySeaId = coastalSourceBySeaId(game, botId);
  if (bySeaId.size === 0) return [];

  const results: NavalOpportunity[] = [];
  for (const territory of getGameMap(game).territories) {
    const ownerId = ownerOf(game, view, territory.id);
    if (
      ownerId === undefined ||
      ownerId === botId ||
      isTeammate(game, botId, ownerId)
    )
      continue;
    for (const seaId of territory.neighbors) {
      if (!seaIds.has(seaId)) continue;
      const sourceTerritoryId = bySeaId.get(seaId);
      if (sourceTerritoryId === undefined || !isVisible(view, seaId)) continue;
      const ownShips = shipsAt(game, view, seaId, botId);
      const enemyShips = shipsAt(game, view, seaId, ownerId);
      const shipsNeeded = enemyShips - ownShips + 1;
      if (shipsNeeded <= 0) continue;
      results.push({
        sourceTerritoryId,
        seaTerritoryId: seaId,
        targetId: territory.id,
        ownerId,
        shipsNeeded,
        targetTroops: game.territoryTroops.get(territory.id) ?? 0,
      });
    }
  }
  return results;
}

export interface ScoutSite {
  sourceTerritoryId: number;
  seaTerritoryId: number;
}

function enemyVisible(game: Game, view: BotView, botId: number): boolean {
  const allies = new Set(alliedIds(game, botId));
  for (const [territoryId, ownerId] of game.territoryOwners) {
    if (
      ownerId !== botId &&
      !allies.has(ownerId) &&
      !isTeammate(game, botId, ownerId) &&
      isVisible(view, territoryId)
    )
      return true;
  }
  return false;
}

export function scoutSite(
  game: Game,
  view: BotView,
  botId: number,
): ScoutSite | null {
  const visible = view.visibleIds;
  if (visible === null || enemyVisible(game, view, botId)) return null;
  const neighborsBySeaId = new Map(
    getGameMap(game).seaTerritories.map((t) => [t.id, t.neighbors]),
  );
  let best: ScoutSite | null = null;
  let bestUnseen = 0;
  const sources = coastalSourceBySeaId(game, botId);
  for (const [seaTerritoryId, sourceTerritoryId] of sources) {
    if (shipsAt(game, view, seaTerritoryId, botId) > 0) continue;
    const unseen = (neighborsBySeaId.get(seaTerritoryId) ?? []).filter(
      (id) => !visible.has(id),
    ).length;
    if (unseen > bestUnseen) {
      bestUnseen = unseen;
      best = { sourceTerritoryId, seaTerritoryId };
    }
  }
  return best;
}

export function landingViable(
  game: Game,
  attackerId: number,
  defenderId: number,
  seaId: number,
): boolean {
  const coastal = getGameMap(game).territories.filter((t) =>
    t.neighbors.includes(seaId),
  );
  const targets = coastal.filter(
    (t) => game.territoryOwners.get(t.id) === defenderId,
  );
  const threshold = minWinProbability(game);
  return coastal
    .filter((t) => game.territoryOwners.get(t.id) === attackerId)
    .some((source) =>
      targets.some(
        (target) =>
          attackWinProbability(
            game,
            (game.territoryTroops.get(source.id) ?? 0) - 1,
            game.territoryTroops.get(target.id) ?? 0,
            defenceDiceFor(game, target.id),
          ) >= threshold,
      ),
    );
}

export interface SeaThreat {
  seaTerritoryId: number;
  sourceTerritoryId: number;
  enemyId: number;
  enemyShips: number;
  ownShips: number;
}

export function seaThreats(
  game: Game,
  view: BotView,
  botId: number,
): SeaThreat[] {
  const results: SeaThreat[] = [];
  for (const { territoryId, seaIds } of coastalTerritoriesOf(game, botId)) {
    for (const seaId of seaIds) {
      if (!isVisible(view, seaId)) continue;
      const shipsByPlayer = game.seaShips.get(seaId);
      if (!shipsByPlayer) continue;
      const ownShips = shipsByPlayer.get(botId) ?? 0;
      for (const [otherId, ships] of shipsByPlayer) {
        if (otherId === botId || isTeammate(game, botId, otherId)) continue;
        if (ships > ownShips && landingViable(game, otherId, botId, seaId))
          results.push({
            seaTerritoryId: seaId,
            sourceTerritoryId: territoryId,
            enemyId: otherId,
            enemyShips: ships,
            ownShips,
          });
      }
    }
  }
  return results;
}
