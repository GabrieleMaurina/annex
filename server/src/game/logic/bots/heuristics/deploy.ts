import { Game } from '../../../../types';
import { frontierTerritories, ownedTerritoryIds } from '../features/territory';
import { CampaignPlan, Weights } from '../types';
import { BotView } from '../view';

export interface DeployChoice {
  territoryId: number;
  troops: number;
}

export function chooseDeploy(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
  campaign: CampaignPlan | null,
): DeployChoice | null {
  const troopsToDeploy = game.troopsToDeploy;
  if (troopsToDeploy <= 0) return null;

  if (campaign) {
    return {
      territoryId: campaign.stagingTerritoryId,
      troops: troopsToDeploy,
    };
  }

  const frontier = frontierTerritories(game, view, botId);
  const targets =
    frontier.length > 0 ? frontier : ownedTerritoryIds(game, botId);
  if (targets.length === 0) return null;

  if (weights.stack >= 1.5) {
    const strongest = targets.reduce((best, id) =>
      (game.territoryTroops.get(id) ?? 0) >
      (game.territoryTroops.get(best) ?? 0)
        ? id
        : best,
    );
    return { territoryId: strongest, troops: troopsToDeploy };
  }

  const territoryId = targets[Math.floor(Math.random() * targets.length)];
  const share = Math.max(
    1,
    Math.ceil(troopsToDeploy / Math.min(3, targets.length)),
  );
  return { territoryId, troops: Math.min(share, troopsToDeploy) };
}
