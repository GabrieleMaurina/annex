import { visibleTerritoryIdsOrAll } from '../game/world/visibility';
import { Game, RememberedTerritory } from '../types';

export interface BotView {
  visibleIds: Set<number> | null;
  remembered: Map<number, RememberedTerritory>;
}

export function getBotView(game: Game, botId: number): BotView {
  const visibleIds = visibleTerritoryIdsOrAll(game, botId);
  return {
    visibleIds,
    remembered:
      visibleIds === null
        ? new Map()
        : (game.fogMemory.get(botId) ?? new Map()),
  };
}

export function isVisible(view: BotView, territoryId: number): boolean {
  return view.visibleIds === null || view.visibleIds.has(territoryId);
}

export function ownerOf(
  game: Game,
  view: BotView,
  territoryId: number,
): number | undefined {
  if (!isVisible(view, territoryId))
    return view.remembered.get(territoryId)?.ownerId;
  return game.territoryOwners.get(territoryId);
}

export function troopsAt(
  game: Game,
  view: BotView,
  territoryId: number,
): number {
  if (!isVisible(view, territoryId))
    return view.remembered.get(territoryId)?.troops ?? 0;
  return game.territoryTroops.get(territoryId) ?? 0;
}

export function shipsAt(
  game: Game,
  view: BotView,
  seaTerritoryId: number,
  playerId: number,
): number {
  if (!isVisible(view, seaTerritoryId)) return 0;
  return game.seaShips.get(seaTerritoryId)?.get(playerId) ?? 0;
}
