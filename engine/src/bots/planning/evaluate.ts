import { expectedOutcome } from '../features/combat';

export interface CampaignEvaluation {
  feasible: boolean;
  probability: number;
  expectedTroopsRemaining: number;
}

const FEASIBILITY_BAR = 0.05;

export function evaluateCampaign(
  startingTroops: number,
  orderedTargetIds: number[],
  troopsAt: (territoryId: number) => number,
  defendingDiceFor: (territoryId: number) => number,
): CampaignEvaluation {
  if (orderedTargetIds.length === 0)
    return { feasible: false, probability: 0, expectedTroopsRemaining: 0 };

  let troops = startingTroops;
  let probability = 1;
  for (const targetId of orderedTargetIds) {
    const defenders = troopsAt(targetId);
    const attackers = Math.max(0, troops - 1);
    const outcome = expectedOutcome(
      attackers,
      defenders,
      defendingDiceFor(targetId),
    );
    probability *= outcome.winProbability;
    troops = Math.max(1, Math.round(outcome.attackerSurvivorsMean));
    if (probability < 0.01) break;
  }

  return {
    feasible: probability >= FEASIBILITY_BAR,
    probability,
    expectedTroopsRemaining: troops,
  };
}
