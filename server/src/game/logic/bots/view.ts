import { Game } from '../../../types';
import { visibleTerritoryIdsOrAll } from '../world/fog';

export interface BotView {
  visibleIds: Set<number> | null;
}

export function getBotView(game: Game, botId: number): BotView {
  return { visibleIds: visibleTerritoryIdsOrAll(game, botId) };
}

export function isVisible(view: BotView, territoryId: number): boolean {
  return view.visibleIds === null || view.visibleIds.has(territoryId);
}

export function ownerOf(
  game: Game,
  view: BotView,
  territoryId: number,
): number | undefined {
  if (!isVisible(view, territoryId)) return undefined;
  return game.territoryOwners.get(territoryId);
}

export function troopsAt(
  game: Game,
  view: BotView,
  territoryId: number,
): number {
  if (!isVisible(view, territoryId)) return 0;
  return game.territoryTroops.get(territoryId) ?? 0;
}
