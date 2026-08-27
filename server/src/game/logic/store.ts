import { Server } from 'socket.io';
import { Game, HOME_ROOM, Player } from '../../types';
import { addHostCandidate, recomputeHost } from './host';
import { assignRandomColor, maxTeam } from './mechanics';
import { gameRoomName } from './rooms';
import { gameResultsStats, gameState, gameSummary } from './state';
import { clearTurnTimer } from './turns';
import { filterGameStateForViewer } from './world/fog';

export { gameRoomName } from './rooms';

export const games = new Map<string, Game>();

const DESTROY_GRACE_MS = 5000;
const pendingInactiveDestroy = new Map<string, NodeJS.Timeout>();
const pendingEndedDestroy = new Map<string, NodeJS.Timeout>();

function scheduleDestroy(
  pending: Map<string, NodeJS.Timeout>,
  gameName: string,
  check: () => void,
) {
  if (pending.has(gameName)) return;
  const timer = setTimeout(() => {
    pending.delete(gameName);
    check();
  }, DESTROY_GRACE_MS);
  pending.set(gameName, timer);
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

  scheduleDestroy(pendingInactiveDestroy, game.name, () => {
    const current = games.get(game.name);
    if (
      !current ||
      current.state !== 'playing' ||
      hasActivePlayer(current, playersById)
    )
      return;

    clearTurnTimer(current.name);
    games.delete(current.name);
    evictGameMembers(current, playersById, io);
    broadcastHomeGames(io, playersById);
  });
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

  scheduleDestroy(pendingEndedDestroy, game.name, () => {
    const current = games.get(game.name);
    if (
      !current ||
      current.state !== 'ended' ||
      hasEndedGameViewer(current, playersById)
    )
      return;

    games.delete(current.name);
    evictGameMembers(current, playersById, io);
    broadcastHomeGames(io, playersById);
  });
}

export function removePlayerFromGame(
  game: Game,
  playerId: number,
  playersById: Map<number, Player>,
) {
  const idx = game.playerIds.indexOf(playerId);
  game.playerIds = game.playerIds.filter((id) => id !== playerId);
  game.playerTeams.delete(playerId);
  game.playerColors.delete(playerId);

  if (
    idx !== -1 &&
    game.state === 'lobby' &&
    game.playerIds.length < game.slots &&
    game.spectatorIds.length > 0
  ) {
    const promotedId = game.spectatorIds.shift()!;
    game.playerIds.splice(idx, 0, promotedId);
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

function cementSubstitute(game: Game, ownerId: number): boolean {
  for (const [substituteId, owner] of game.substituteFor) {
    if (owner === ownerId) {
      game.substituteFor.delete(substituteId);
      return true;
    }
  }
  return false;
}

function handleLobbyDisconnect(
  game: Game,
  playerId: number,
  playersById: Map<number, Player>,
) {
  const subIndex = game.spectatorIds.findIndex(
    (id) => playersById.get(id)?.connected,
  );
  if (subIndex === -1) {
    recomputeHost(game, playersById);
    return;
  }

  const ownerId = game.substituteFor.get(playerId) ?? playerId;
  game.substituteFor.delete(playerId);

  const idx = game.playerIds.indexOf(playerId);
  const substituteId = game.spectatorIds.splice(subIndex, 1)[0];
  game.playerIds[idx] = substituteId;

  const team = game.playerTeams.get(playerId) ?? 0;
  game.playerTeams.set(substituteId, team);
  game.playerTeams.delete(playerId);

  const color = game.playerColors.get(playerId);
  if (color !== undefined) game.playerColors.set(substituteId, color);
  game.playerColors.delete(playerId);

  addHostCandidate(game, substituteId);
  game.substituteFor.set(substituteId, ownerId);
  recomputeHost(game, playersById);
}

export function reclaimSubstitutedSeat(
  game: Game,
  ownerId: number,
  playersById: Map<number, Player>,
) {
  const entry = [...game.substituteFor.entries()].find(
    ([, owner]) => owner === ownerId,
  );
  if (!entry) return;

  const [substituteId] = entry;
  game.substituteFor.delete(substituteId);

  const idx = game.playerIds.indexOf(substituteId);
  if (idx === -1) return;

  game.playerIds[idx] = ownerId;
  game.playerTeams.delete(substituteId);
  game.playerColors.delete(substituteId);
  game.spectatorIds.unshift(substituteId);

  recomputeHost(game, playersById);
}

export function leaveGame(
  player: Player,
  playersById: Map<number, Player>,
  io: Server,
  permanent: boolean,
) {
  const gameName = player.gameName;
  leaveGameImpl(player, playersById, io, permanent);
  if (!gameName) return;
  broadcastHomeGames(io, playersById);
  const game = games.get(gameName);
  if (game) broadcastGameState(io, game, playersById);
}

function leaveGameImpl(
  player: Player,
  playersById: Map<number, Player>,
  io: Server,
  permanent: boolean,
) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  if (!game) {
    player.gameName = null;
    return;
  }

  if (game.spectatorIds.includes(player.id)) {
    if (!permanent) return;
    player.gameName = null;
    game.spectatorIds = game.spectatorIds.filter((id) => id !== player.id);
    if (game.state === 'ended') destroyIfEnded(game, playersById, io);
    return;
  }

  if (game.state === 'playing') {
    if (game.surrenderedIds.has(player.id) && player.connected)
      player.gameName = null;
    recomputeHost(game, playersById);
    destroyIfInactive(game, playersById, io);
    return;
  }

  if (game.state === 'ended') {
    if (player.connected) player.gameName = null;
    destroyIfEnded(game, playersById, io);
    return;
  }

  if (!permanent) {
    if (game.playerIds.includes(player.id))
      handleLobbyDisconnect(game, player.id, playersById);
    else recomputeHost(game, playersById);
    return;
  }

  player.gameName = null;
  if (!game.playerIds.includes(player.id)) {
    cementSubstitute(game, player.id);
    return;
  }
  removePlayerFromGame(game, player.id, playersById);
}

export function handleReconnect(
  player: Player,
  playersById: Map<number, Player>,
  io: Server,
) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  if (!game) return;

  if (game.state === 'lobby') {
    reclaimSubstitutedSeat(game, player.id, playersById);
    if (
      !game.playerIds.includes(player.id) &&
      !game.spectatorIds.includes(player.id)
    )
      game.spectatorIds.push(player.id);
  }

  recomputeHost(game, playersById);
  broadcastHomeGames(io, playersById);
  broadcastGameState(io, game, playersById);
}

export function listGameSummaries(playersById: Map<number, Player>) {
  return [...games.values()]
    .filter((game) => game.visibility === 'public')
    .map((game) => gameSummary(game, playersById));
}

export function broadcastHomeGames(
  io: Server,
  playersById: Map<number, Player>,
) {
  io.to(HOME_ROOM).emit('home:games', listGameSummaries(playersById));
}

export function sendToPlayer(
  io: Server,
  playersById: Map<number, Player>,
  playerId: number,
  event: string,
  payload: unknown,
) {
  const socketId = playersById.get(playerId)?.socketId;
  if (socketId) io.to(socketId).emit(event, payload);
}

export function broadcastMissions(
  io: Server,
  game: Game,
  playersById: Map<number, Player>,
) {
  for (const [playerId, mission] of game.playerMissions) {
    sendToPlayer(io, playersById, playerId, 'game:mission', { mission });
  }
}

export function sendPlayerMission(
  io: Server,
  playersById: Map<number, Player>,
  game: Game,
  playerId: number,
) {
  const mission = game.playerMissions.get(playerId);
  if (mission)
    sendToPlayer(io, playersById, playerId, 'game:mission', { mission });
}

export function sendPlayerCards(
  io: Server,
  playersById: Map<number, Player>,
  game: Game,
  playerId: number,
) {
  sendToPlayer(io, playersById, playerId, 'game:cards', {
    cards: game.playerCards.get(playerId) ?? [],
  });
}

export function sendPlayerLogs(
  io: Server,
  playersById: Map<number, Player>,
  game: Game,
  playerId: number,
) {
  sendToPlayer(io, playersById, playerId, 'game:logs', {
    entries: game.logs.get(playerId) ?? [],
  });
}

export function sendGameResults(
  io: Server,
  playersById: Map<number, Player>,
  game: Game,
  playerId: number,
) {
  sendToPlayer(io, playersById, playerId, 'game:results', {
    stats: gameResultsStats(game),
  });
}

export function broadcastGameResults(
  io: Server,
  game: Game,
  playersById: Map<number, Player>,
) {
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    sendGameResults(io, playersById, game, viewerId);
  }
}

export function sendGameState(
  io: Server,
  playersById: Map<number, Player>,
  game: Game,
  playerId: number,
) {
  sendToPlayer(
    io,
    playersById,
    playerId,
    'game:state',
    filterGameStateForViewer(gameState(game, playersById), game, playerId),
  );
}

export function broadcastGameState(
  io: Server,
  game: Game,
  playersById: Map<number, Player>,
) {
  const base = gameState(game, playersById);
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    sendToPlayer(
      io,
      playersById,
      viewerId,
      'game:state',
      filterGameStateForViewer(base, game, viewerId),
    );
  }
}

export function broadcastGameStateExcept(
  io: Server,
  playersById: Map<number, Player>,
  game: Game,
  excludePlayerId: number,
) {
  const base = gameState(game, playersById);
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    if (viewerId === excludePlayerId) continue;
    sendToPlayer(
      io,
      playersById,
      viewerId,
      'game:state',
      filterGameStateForViewer(base, game, viewerId),
    );
  }
}

export function respondWithGameState(
  io: Server,
  playersById: Map<number, Player>,
  game: Game,
  playerId: number,
  callback: (response: {
    ok: true;
    game: ReturnType<typeof gameState>;
  }) => void,
) {
  callback({
    ok: true,
    game: filterGameStateForViewer(
      gameState(game, playersById),
      game,
      playerId,
    ),
  });
  broadcastGameStateExcept(io, playersById, game, playerId);
}
