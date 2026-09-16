import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { BotView, isVisible, ownerOf, shipsAt } from '../view';
import { isTeammate } from './mode';

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

function coastalSourceBySeaId(
  game: Game,
  coastal: CoastalTerritory[],
): Map<number, number> {
  const bySeaId = new Map<number, number>();
  for (const { territoryId, seaIds } of coastal) {
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
  const bySeaId = coastalSourceBySeaId(game, coastalTerritoriesOf(game, botId));
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
  const bySeaId = coastalSourceBySeaId(game, coastalTerritoriesOf(game, botId));
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
        if (ships > ownShips)
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
