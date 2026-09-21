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
  | 'spoilContinent'
  | 'prey'
  | 'roll'
  | 'capture'
  | 'expand'
  | 'deny';

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

export interface MapTopology {
  neighbors: Map<number, number[]>;
  seaLinks: Map<number, number[]>;
  continentTerritories: Map<number, number[]>;
  territoryContinent: Map<number, number>;
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
  overwhelmingAttacksIssued: number;
  shipAttacksIssued: number;
  entrenchesIssued: number;
  roundNumber: number;
  playerId: number;
  nukeLaunched?: boolean;
  antiNukeDeployed?: boolean;
  topology?: MapTopology;
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
    overwhelmingAttacksIssued: 0,
    shipAttacksIssued: 0,
    entrenchesIssued: 0,
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
