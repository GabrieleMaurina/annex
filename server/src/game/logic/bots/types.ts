export interface Weights {
  completeContinent: number;
  breakContinent: number;
  eliminate: number;
  stack: number;
  grudge: number;
  defendFrontier: number;
}

export interface DifficultyParams {
  noise: number;
  planningConfidence: number;
}

export type CampaignType = 'complete' | 'break' | 'eliminate';

export interface CampaignPlan {
  type: CampaignType;
  targetPlayerId: number | null;
  continentId: number | null;
  orderedTargetIds: number[];
  stagingTerritoryId: number;
  probability: number;
  expectedTroopsRemaining: number;
  score: number;
}
