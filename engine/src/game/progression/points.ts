import { getGameMap } from '../../maps/maps';
import { Game, GameMode } from '../../types';
import { calculateDeployTroopsBreakdown, shuffle } from '../mechanics';
import { countTerritories } from './stats';

export const MAX_POINTS_VALUES = [
  ...Array.from({ length: 17 }, (_, i) => 20 + i * 5),
  ...Array.from({ length: 38 }, (_, i) => 150 + i * 50),
];
export const MIN_HILLS = 1;
export const MAX_HILLS = 20;

const DEFAULT_MAX_POINTS: Partial<Record<GameMode, number>> = {
  'king of the hill': 20,
  empire: 500,
};

export function defaultMaxPoints(gameMode: GameMode): number | undefined {
  return DEFAULT_MAX_POINTS[gameMode];
}

export function isPointsMode(gameMode: GameMode): boolean {
  return defaultMaxPoints(gameMode) !== undefined;
}

export function initializeHills(game: Game): void {
  game.hillTerritoryIds =
    game.gameMode === 'king of the hill'
      ? shuffle(
          getGameMap(game)
            .territories.map((t) => t.id)
            .filter((id) => !game.radiationTerritoryIds.has(id)),
        ).slice(0, game.hills)
      : [];
}

function pointsGain(game: Game, playerId: number): number {
  if (game.gameMode === 'king of the hill')
    return game.hillTerritoryIds.filter(
      (id) => game.territoryOwners.get(id) === playerId,
    ).length;
  if (game.gameMode === 'empire')
    return (
      countTerritories(game, playerId) +
      calculateDeployTroopsBreakdown(game, playerId).bonuses
    );
  return 0;
}

export function awardTurnPoints(game: Game, playerId: number): void {
  if (
    !isPointsMode(game.gameMode) ||
    game.roundNumber < 1 ||
    game.surrenderedIds.has(playerId)
  )
    return;
  game.points.set(
    playerId,
    (game.points.get(playerId) ?? 0) + pointsGain(game, playerId),
  );
}

export function pointsWinner(
  game: Game,
  candidateIds: number[],
): number | undefined {
  return candidateIds.find(
    (id) => (game.points.get(id) ?? 0) >= game.maxPoints,
  );
}
