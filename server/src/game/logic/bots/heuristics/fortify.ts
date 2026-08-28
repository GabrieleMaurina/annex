import { Game } from '../../../../types';
import { connectedOwnedTerritories } from '../../world/connectivity';
import {
  frontierTerritories,
  neighborsOf,
  ownedTerritoryIds,
} from '../features/territory';
import { CampaignPlan, Weights } from '../types';
import { BotView } from '../view';

export interface FortifyChoice {
  startId: number;
  endId: number;
  troops: number;
}

function isReachable(
  game: Game,
  botId: number,
  startId: number,
  endId: number,
): boolean {
  if (game.fortification === 'Unrestricted') return true;
  if (game.fortification === 'Neighboring')
    return neighborsOf(game, startId).includes(endId);
  return connectedOwnedTerritories(game, botId, [startId]).has(endId);
}

export function chooseFortify(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
  campaign: CampaignPlan | null,
): FortifyChoice | null {
  const frontier = frontierTerritories(game, view, botId);
  const target =
    campaign?.stagingTerritoryId ??
    frontier.sort(
      (a, b) =>
        (game.territoryTroops.get(a) ?? 0) - (game.territoryTroops.get(b) ?? 0),
    )[0];
  if (target === undefined) return null;

  const frontierSet = new Set(frontier);
  const trapped = ownedTerritoryIds(game, botId)
    .filter((id) => id !== target && !frontierSet.has(id))
    .filter((id) => (game.territoryTroops.get(id) ?? 0) >= 2)
    .filter((id) => isReachable(game, botId, id, target))
    .sort(
      (a, b) =>
        (game.territoryTroops.get(b) ?? 0) - (game.territoryTroops.get(a) ?? 0),
    )[0];
  if (trapped !== undefined) {
    const trappedTroops = game.territoryTroops.get(trapped) ?? 0;
    return { startId: trapped, endId: target, troops: trappedTroops - 1 };
  }

  const owned = ownedTerritoryIds(game, botId).filter((id) => id !== target);
  const sourceCandidates = owned
    .filter((id) => (game.territoryTroops.get(id) ?? 0) >= 2)
    .filter((id) => isReachable(game, botId, id, target))
    .sort(
      (a, b) =>
        (game.territoryTroops.get(b) ?? 0) - (game.territoryTroops.get(a) ?? 0),
    );

  const shouldStack = weights.stack >= 1.5 || campaign !== null;
  if (!shouldStack && sourceCandidates.length === 0) return null;

  const source = sourceCandidates[0];
  if (source === undefined) return null;

  const sourceTroops = game.territoryTroops.get(source) ?? 0;
  if (sourceTroops < 2) return null;
  const troops = shouldStack
    ? sourceTroops - 1
    : Math.max(1, Math.floor((sourceTroops - 1) / 2));
  return { startId: source, endId: target, troops };
}
