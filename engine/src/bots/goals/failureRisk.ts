import { evaluateBoard } from '../planning/board';
import { PlanContext, SimState, cloneState } from '../planning/context';

export const RISKY_STEP_WIN = 0.8;
const FAILURE_SURVIVAL = 0.5;
const MAX_FAILURE_POINTS = 2;

export interface StepRisk {
  before: SimState;
  fromId: number;
  toId: number;
  attackers: number;
  defenders: number;
  reach: number;
  win: number;
}

function failureBoard(risk: StepRisk): SimState {
  const board = cloneState(risk.before);
  board.troops.set(risk.fromId, 1);
  board.troops.set(
    risk.toId,
    Math.max(1, Math.round(risk.defenders * FAILURE_SURVIVAL)),
  );
  board.troopsLost += risk.attackers;
  return board;
}

export function expectedScore(
  ctx: PlanContext,
  risks: StepRisk[],
  successScore: number,
): number {
  const mass = (risk: StepRisk) => risk.reach * (1 - risk.win);
  return [...risks]
    .sort((a, b) => mass(b) - mass(a))
    .slice(0, MAX_FAILURE_POINTS)
    .reduce(
      (score, risk) =>
        score -
        mass(risk) *
          Math.max(0, successScore - evaluateBoard(ctx, failureBoard(risk))),
      successScore,
    );
}
