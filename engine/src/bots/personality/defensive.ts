import { Game } from '../../types';
import { Weights } from '../types';

export const defensiveWeights: Weights = {
  completeContinent: 2.5,
  breakContinent: 0,
  eliminate: 0.3,
  stack: -1,
  grudge: 0.2,
  defendFrontier: 3,
  antiLeader: 0.3,
  defense: 1.5,
  holdChokepoint: 1.5,
  duelBreak: 0,
  duelStack: 0,
  duelRoll: 0,
  aggression: 0,
  keepStack: 0,
};

export function defensiveBoldness(
  game: Game,
  botId: number,
  friendlyIds: Set<number>,
): number {
  const opponents = game.playerIds.filter(
    (id) => id !== botId && !friendlyIds.has(id),
  );
  if (opponents.length <= 1) return 1;
  const dead = new Set(game.deathOrder);
  const alive = opponents.filter((id) => !dead.has(id)).length;
  return Math.min(1, 1 - (alive - 1) / (opponents.length - 1));
}
