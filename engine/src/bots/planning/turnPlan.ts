import { Game } from '../../types';

export type ObjectiveKind =
  | 'complete'
  | 'break'
  | 'eliminate'
  | 'card'
  | 'defensive'
  | 'merge'
  | 'shrinkBorder'
  | 'holdChokepoint'
  | 'neutralizeThreat'
  | 'antiLeader'
  | 'spoilContinent';

export interface Objective {
  kind: ObjectiveKind;
  targetPlayerId: number | null;
  continentId: number | null;
  mustVisit: number[];
  fortifyHint?: number;
}

export interface Deployment {
  territoryId: number;
  troops: number;
}

export interface AttackStep {
  startId: number;
  endId: number;
  objectiveIndex: number;
  minWinProb: number;
}

export interface FortifyMove {
  startId: number;
  endId: number;
  troops: number;
}

export interface TurnPlan {
  objectives: Objective[];
  cardSet: (number | null)[] | null;
  cardSetPlayed: boolean;
  deployments: Deployment[];
  attackSteps: AttackStep[];
  fortify: FortifyMove | null;
  score: number;
  deployCursor: number;
  step: number;
  attacksIssued: number;
  roundNumber: number;
  playerId: number;
  nukeLaunched?: boolean;
  antiNukeDeployed?: boolean;
}

export function emptyPlan(roundNumber: number, playerId: number): TurnPlan {
  return {
    objectives: [],
    cardSet: null,
    cardSetPlayed: false,
    deployments: [],
    attackSteps: [],
    fortify: null,
    score: 0,
    deployCursor: 0,
    step: 0,
    attacksIssued: 0,
    roundNumber,
    playerId,
  };
}

export function isPlanFresh(
  plan: TurnPlan | null,
  game: Game,
  botId: number,
): plan is TurnPlan {
  return (
    plan !== null &&
    plan.roundNumber === game.roundNumber &&
    plan.playerId === botId
  );
}
