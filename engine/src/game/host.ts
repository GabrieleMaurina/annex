import { playersById } from '../session/players';
import { Game } from '../types';

export function addHostCandidate(game: Game, playerId: number) {
  if (!game.hostPriority.includes(playerId)) game.hostPriority.push(playerId);
}

export function recomputeHost(game: Game) {
  for (const id of game.hostPriority) {
    if (game.surrenderedIds.has(id)) continue;
    if (!game.playerIds.includes(id)) continue;
    const member = playersById.get(id);
    if (!member?.connected || member.isBot) continue;
    game.hostId = id;
    return;
  }
}
