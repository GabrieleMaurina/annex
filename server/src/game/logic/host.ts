import { Game, Player } from '../../types';

export function addHostCandidate(game: Game, playerId: number) {
  if (!game.hostPriority.includes(playerId)) game.hostPriority.push(playerId);
}

export function recomputeHost(game: Game, playersById: Map<number, Player>) {
  for (const id of game.hostPriority) {
    if (game.surrenderedIds.has(id)) continue;
    if (!game.playerIds.includes(id)) continue;
    if (!playersById.get(id)?.connected) continue;
    game.hostId = id;
    return;
  }
}
