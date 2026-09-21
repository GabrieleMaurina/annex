import { Game } from '../../types';
import {
  continentBreakCandidates,
  continentCompletionCandidates,
} from '../features/continents';
import { navalOpportunities, seaBridgeTargets } from '../features/navy';
import { hostileNeighbors, ownedTerritoryIds } from '../features/territory';
import { Weights } from '../types';
import { BotView, troopsAt } from '../view';

export interface DeployChoice {
  territoryId: number;
  troops: number;
}

function opportunityOf(
  game: Game,
  view: BotView,
  botId: number,
  territoryId: number,
  breakTargets: Set<number>,
  completeTargets: Set<number>,
): number {
  let best = 0;
  for (const n of hostileNeighbors(game, view, botId, territoryId)) {
    let score = 1 / (troopsAt(game, view, n) + 1);
    if (breakTargets.has(n)) score += 2;
    if (completeTargets.has(n)) score += 1;
    if (score > best) best = score;
  }
  return best;
}

export function chooseDeploy(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
): DeployChoice | null {
  const troopsToDeploy = game.troopsToDeploy;
  if (troopsToDeploy <= 0) return null;

  const bordering = ownedTerritoryIds(game, botId).filter(
    (id) => hostileNeighbors(game, view, botId, id).length > 0,
  );
  const seaSources =
    bordering.length > 0
      ? []
      : [
          ...new Set(
            [
              ...seaBridgeTargets(game, view, botId),
              ...navalOpportunities(game, view, botId),
            ].map((o) => o.sourceTerritoryId),
          ),
        ];
  const targets =
    bordering.length > 0
      ? bordering
      : seaSources.length > 0
        ? seaSources
        : ownedTerritoryIds(game, botId);
  if (targets.length === 0) return null;

  if (bordering.length === 0 && seaSources.length === 0) {
    const territoryId = targets.reduce((min, id) =>
      (game.territoryTroops.get(id) ?? 0) < (game.territoryTroops.get(min) ?? 0)
        ? id
        : min,
    );
    return { territoryId, troops: troopsToDeploy };
  }

  const breakTargets = new Set(
    continentBreakCandidates(game, view, botId).map(
      (c) => c.weakestTerritoryId,
    ),
  );
  const completeTargets = new Set(
    continentCompletionCandidates(game, view, botId).flatMap(
      (c) => c.remainingTerritoryIds,
    ),
  );

  const weightOf = (id: number) => {
    const concentration =
      ((game.territoryTroops.get(id) ?? 0) + 1) ** (weights.stack * 3);
    const opportunity = opportunityOf(
      game,
      view,
      botId,
      id,
      breakTargets,
      completeTargets,
    );
    return concentration * (1 + opportunity * 5);
  };
  const totalWeight = targets.reduce((sum, id) => sum + weightOf(id), 0);
  let roll = Math.random() * totalWeight;
  let territoryId = targets[targets.length - 1];
  for (const id of targets) {
    roll -= weightOf(id);
    if (roll <= 0) {
      territoryId = id;
      break;
    }
  }

  return { territoryId, troops: troopsToDeploy };
}
