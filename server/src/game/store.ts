import { Server } from 'socket.io';
import { Game, Player } from '../types';
import { assignRandomColor, maxTeam } from './mechanics';
import { gameState, gameSummary } from './state';

export const games = new Map<string, Game>();

export function gameRoomName(name: string): string {
  return `game-${name}`;
}

export function removePlayerFromGame(game: Game, playerId: number) {
  game.playerIds = game.playerIds.filter((id) => id !== playerId);
  game.playerTeams.delete(playerId);
  game.playerColors.delete(playerId);

  if (
    game.phase === 'lobby' &&
    game.playerIds.length < game.slots &&
    game.spectatorIds.length > 0
  ) {
    const promotedId = game.spectatorIds.shift()!;
    game.playerIds.push(promotedId);
    game.playerTeams.set(promotedId, 0);
    assignRandomColor(game, promotedId);
  }

  if (game.playerIds.length === 0) {
    games.delete(game.name);
    return;
  }

  if (game.hostId === playerId) {
    game.hostId = game.playerIds[0];
  }

  const cap = maxTeam(game);
  for (const id of game.playerIds) {
    if ((game.playerTeams.get(id) ?? 0) > cap) game.playerTeams.set(id, 0);
  }
}

export function leaveGame(player: Player) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  player.gameName = null;
  if (!game) return;

  if (game.spectatorIds.includes(player.id)) {
    game.spectatorIds = game.spectatorIds.filter((id) => id !== player.id);
    return;
  }
  removePlayerFromGame(game, player.id);
}

export function listGameSummaries() {
  return [...games.values()].map(gameSummary);
}

export function broadcastGameStates(
  io: Server,
  playersById: Map<number, Player>,
) {
  for (const game of games.values()) {
    io.to(gameRoomName(game.name)).emit(
      'game:state',
      gameState(game, playersById),
    );
  }
}
