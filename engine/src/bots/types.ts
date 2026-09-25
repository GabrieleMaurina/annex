export interface Weights {
  completeContinent: number;
  breakContinent: number;
  eliminate: number;
  stack: number;
  grudge: number;
  defendFrontier: number;
  antiLeader: number;
  defense: number;
  holdChokepoint: number;
  duelBreak: number;
  duelStack: number;
  duelRoll: number;
  aggression: number;
}

export interface DifficultyParams {
  noise: number;
  planningConfidence: number;
  maxPlanDepth: number;
  optimizeFortify: boolean;
  maxCampaigns: number;
  duelSkill: number;
}
