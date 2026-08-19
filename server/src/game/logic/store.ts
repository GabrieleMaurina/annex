import { Server } from 'socket.io';
import { Game, HOME_ROOM, Player } from '../../types';
import { addHostCandidate, recomputeHost } from './host';
import { assignRandomColor, maxTeam } from './mechanics';
import { gameState, gameSummary } from './state';
import { clearTurnTimer } from './turns';

export const games = new Map<string, Game>();

export function gameRoomName(name: string): string {
  return `game-${name}`;
}

function hasActivePlayer(game: Game, playersById: Map<number, Player>) {
  return game.playerIds.some(
    (id) =>
      !game.surrenderedIds.has(id) && (playersById.get(id)?.connected ?? false),
  );
}

function evictGameMembers(
  game: Game,
  playersById: Map<number, Player>,
  io: Server,
) {
  for (const id of [...game.playerIds, ...game.spectatorIds]) {
    const member = playersById.get(id);
    if (!member || member.gameName !== game.name) continue;
    member.gameName = null;
    const memberSocket = io.sockets.sockets.get(member.socketId);
    memberSocket?.leave(gameRoomName(game.name));
    memberSocket?.join(HOME_ROOM);
  }
}

export function destroyIfInactive(
  game: Game,
  playersById: Map<number, Player>,
  io: Server,
) {
  if (game.state !== 'playing' || hasActivePlayer(game, playersById)) return;

  clearTurnTimer(game.name);
  games.delete(game.name);
  evictGameMembers(game, playersById, io);
}

function hasEndedGameViewer(game: Game, playersById: Map<number, Player>) {
  return [...game.playerIds, ...game.spectatorIds].some((id) => {
    const member = playersById.get(id);
    return member?.connected && member.gameName === game.name;
  });
}

export function destroyIfEnded(
  game: Game,
  playersById: Map<number, Player>,
  io: Server,
) {
  if (game.state !== 'ended' || hasEndedGameViewer(game, playersById)) return;

  games.delete(game.name);
  evictGameMembers(game, playersById, io);
}

export function removePlayerFromGame(
  game: Game,
  playerId: number,
  playersById: Map<number, Player>,
) {
  game.playerIds = game.playerIds.filter((id) => id !== playerId);
  game.playerTeams.delete(playerId);
  game.playerColors.delete(playerId);

  if (
    game.state === 'lobby' &&
    game.playerIds.length < game.slots &&
    game.spectatorIds.length > 0
  ) {
    const promotedId = game.spectatorIds.shift()!;
    game.playerIds.push(promotedId);
    game.playerTeams.set(promotedId, 0);
    assignRandomColor(game, promotedId);
    addHostCandidate(game, promotedId);
  }

  if (game.playerIds.length === 0) {
    clearTurnTimer(game.name);
    games.delete(game.name);
    return;
  }

  const cap = maxTeam(game);
  for (const id of game.playerIds) {
    if ((game.playerTeams.get(id) ?? 0) > cap) game.playerTeams.set(id, 0);
  }

  recomputeHost(game, playersById);
}

export function leaveGame(
  player: Player,
  playersById: Map<number, Player>,
  io: Server,
) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  if (!game) {
    player.gameName = null;
    return;
  }

  if (game.spectatorIds.includes(player.id)) {
    player.gameName = null;
    game.spectatorIds = game.spectatorIds.filter((id) => id !== player.id);
    if (game.state === 'ended') destroyIfEnded(game, playersById, io);
    return;
  }

  if (game.state === 'playing') {
    recomputeHost(game, playersById);
    destroyIfInactive(game, playersById, io);
    return;
  }

  if (game.state === 'ended') {
    if (player.connected) player.gameName = null;
    destroyIfEnded(game, playersById, io);
    return;
  }

  player.gameName = null;
  removePlayerFromGame(game, player.id, playersById);
}

export function handleReconnect(
  player: Player,
  playersById: Map<number, Player>,
) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  if (game) recomputeHost(game, playersById);
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
