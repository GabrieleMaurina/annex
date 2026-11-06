import { getGameMap } from '../../maps/maps';
import { FLIP_COST, switchStates } from '../../maps/switches';
import { Game } from '../../types';

export function switchesNextTo(game: Game, territoryId: number): number[] {
  return getGameMap(game).switches.flatMap((s, i) =>
    s.neighbors.includes(territoryId) ? [i] : [],
  );
}

export function canFlipFrom(
  game: Game,
  playerId: number,
  territoryId: number,
): boolean {
  return (
    game.territoryOwners.get(territoryId) === playerId &&
    (game.territoryTroops.get(territoryId) ?? 0) >= FLIP_COST + 1 &&
    switchesNextTo(game, territoryId).length > 0
  );
}

export function switchesOn(game: Game): number[] {
  return switchStates(getGameMap(game).switches, game.flippedSwitchIds).flatMap(
    (on, i) => (on ? [i] : []),
  );
}

export function toggleFlipped(flippedIds: Set<number>, switchId: number): void {
  if (flippedIds.has(switchId)) flippedIds.delete(switchId);
  else flippedIds.add(switchId);
}
