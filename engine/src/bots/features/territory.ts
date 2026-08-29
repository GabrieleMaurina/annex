import { withPortalEdges } from '../../game/world/portals';
import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { BotView, isVisible, ownerOf } from '../view';
import { isTeammate } from './mode';

// Toxined and radiated territories have no owner but can't be attacked into
// (see isFreeConquestTarget/isAttackEndCandidate in the attack handler), so
// they're dead ends, not free conquests. Fog-hidden territories default to
// not-hazardous, the same optimistic default ownerOf/troopsAt use for unseen
// ground.
export function isHazardTerritory(
  game: Game,
  view: BotView,
  territoryId: number,
): boolean {
  if (!isVisible(view, territoryId)) return false;
  return (
    game.territoryToxins.has(territoryId) ||
    game.radiationTerritoryIds.has(territoryId)
  );
}

export function neighborsOf(game: Game, territoryId: number): number[] {
  const map = getGameMap(game);
  const territory = map.territories.find((t) => t.id === territoryId);
  return withPortalEdges(
    territory?.neighbors ?? [],
    territoryId,
    game.portalTerritoryIds,
    game.portalsEnabled,
  );
}

export function ownedTerritoryIds(game: Game, botId: number): number[] {
  const ids: number[] = [];
  for (const [id, ownerId] of game.territoryOwners) {
    if (ownerId === botId) ids.push(id);
  }
  return ids;
}

export function isFrontier(
  game: Game,
  view: BotView,
  botId: number,
  territoryId: number,
): boolean {
  if ((game.territoryTroops.get(territoryId) ?? 0) < 2) return false;
  return neighborsOf(game, territoryId).some((n) => {
    const ownerId = ownerOf(game, view, n);
    return (
      ownerId !== undefined &&
      ownerId !== botId &&
      !isTeammate(game, botId, ownerId)
    );
  });
}

export function frontierTerritories(
  game: Game,
  view: BotView,
  botId: number,
): number[] {
  return ownedTerritoryIds(game, botId).filter((id) =>
    isFrontier(game, view, botId, id),
  );
}

export function hostileNeighbors(
  game: Game,
  view: BotView,
  botId: number,
  territoryId: number,
): number[] {
  return neighborsOf(game, territoryId).filter((n) => {
    const ownerId = ownerOf(game, view, n);
    return (
      ownerId !== undefined &&
      ownerId !== botId &&
      !isTeammate(game, botId, ownerId)
    );
  });
}

export function isAdjacentToOwned(
  game: Game,
  botId: number,
  territoryId: number,
): boolean {
  return neighborsOf(game, territoryId).some(
    (n) => game.territoryOwners.get(n) === botId,
  );
}

export function strongestOwnedTerritory(
  game: Game,
  botId: number,
): number | null {
  let best: number | null = null;
  let bestTroops = -1;
  for (const id of ownedTerritoryIds(game, botId)) {
    const troops = game.territoryTroops.get(id) ?? 0;
    if (troops > bestTroops) {
      bestTroops = troops;
      best = id;
    }
  }
  return best;
}
