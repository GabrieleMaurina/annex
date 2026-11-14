import { Game } from '../../types';
import { TurnPlan } from '../planning/turnPlan';

export function plannedMove(game: Game, plan: TurnPlan): number | null {
  const startId = game.attackStartTerritoryId;
  const endId = game.attackEndTerritoryId;
  const step = plan.attackSteps
    .slice(Math.max(0, plan.step - 1), plan.step + 1)
    .find((s) => s.startId === startId && s.endId === endId);
  if (step?.move === undefined) return null;
  const min = game.attackConquestMinTroops ?? 1;
  const max = (game.territoryTroops.get(startId!) ?? 0) - 1;
  return Math.min(max, Math.max(min, step.move));
}
