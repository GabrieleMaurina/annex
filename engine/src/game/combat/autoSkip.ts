import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { ownedTerritoryIds } from '../mechanics';
import {
  isFreeConquestTarget,
  toxinsCost,
  wouldSplitMap,
} from '../toxins/toxins';
import {
  connectedSeaTerritories,
  hasConnectedFortifyDestination,
} from '../world/connectivity';
import { hasAnySeaBridgeFrom } from './seaBridge';

export function hasAnyAttack(game: Game, playerId: number): boolean {
  const map = getGameMap(game);
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  return ownedTerritoryIds(game, playerId).some((id) => {
    if ((game.territoryTroops.get(id) ?? 0) < 2) return false;
    return (
      (territoryById.get(id)?.neighbors.some((n) => {
        const ownerId = game.territoryOwners.get(n);
        if (ownerId !== undefined) return ownerId !== playerId;
        return isFreeConquestTarget(game, n);
      }) ??
        false) ||
      hasAnySeaBridgeFrom(game, playerId, id)
    );
  });
}

export function hasAnyToxin(game: Game, playerId: number): boolean {
  if (game.toxins === 'off') return false;
  const owned = ownedTerritoryIds(game, playerId);
  if (owned.length <= 1) return false;
  const cost = toxinsCost(game, playerId);
  return owned.some((id) => {
    if (game.capitalTerritoryIds.has(id)) return false;
    if ((game.territoryTroops.get(id) ?? 0) < cost) return false;
    return !wouldSplitMap(game, id);
  });
}

export function hasAnyFortify(game: Game, playerId: number): boolean {
  const map = getGameMap(game);
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  return ownedTerritoryIds(game, playerId).some((id) => {
    if ((game.territoryTroops.get(id) ?? 0) < 2) return false;
    if (game.fortification === 'Connected')
      return hasConnectedFortifyDestination(game, playerId, id);
    return (
      territoryById
        .get(id)
        ?.neighbors.some((n) => game.territoryOwners.get(n) === playerId) ??
      false
    );
  });
}

export function hasAnyEntrench(game: Game, playerId: number): boolean {
  return ownedTerritoryIds(game, playerId).some(
    (id) =>
      (game.territoryTroops.get(id) ?? 0) >= 2 &&
      !game.capitalTerritoryIds.has(id),
  );
}

export function hasAnySail(game: Game, playerId: number): boolean {
  for (const [seaTerritoryId, shipsByPlayer] of game.seaShips) {
    if ((shipsByPlayer.get(playerId) ?? 0) < 1) continue;
    if (connectedSeaTerritories(game, [seaTerritoryId]).size > 1) return true;
  }
  return false;
}

export function hasAnyShipFight(game: Game, playerId: number): boolean {
  for (const shipsByPlayer of game.seaShips.values()) {
    if ((shipsByPlayer.get(playerId) ?? 0) < 1) continue;
    for (const [otherId, ships] of shipsByPlayer) {
      if (otherId !== playerId && ships > 0) return true;
    }
  }
  return false;
}
