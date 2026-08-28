import { Server, Socket } from 'socket.io';
import { Game, Player } from '../../types';
import { isInteger, isObject } from '../../validate';
import {
  allianceCooldownUntil,
  allianceInitiator,
  areAllied,
  breakAlliance,
  createAllianceRequest,
  formAlliance,
  pairKey,
  removeAllianceRequest,
  scheduleAllianceRequestExpiry,
  startAllianceCooldown,
} from '../logic/alliances';
import { games, sendGameState, sendToPlayer } from '../logic/store';
import { recordLog } from '../logic/world/fog';

function getAllianceContext(
  socket: Socket,
  playersBySocket: Map<string, Player>,
): { player: Player; game: Game } | null {
  const player = playersBySocket.get(socket.id);
  if (!player || !player.gameName) return null;
  const game = games.get(player.gameName);
  if (!game) return null;
  if (game.state !== 'playing' || game.alliances !== 'on') return null;
  if (!game.playerIds.includes(player.id)) return null;
  return { player, game };
}

export function registerAllianceHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on('game:offerAlliance', (data: unknown) => {
    const ctx = getAllianceContext(socket, playersBySocket);
    if (!ctx) return;
    const { player, game } = ctx;

    const targetPlayerId = isObject(data) ? data.targetPlayerId : undefined;
    if (!isInteger(targetPlayerId) || targetPlayerId === player.id) return;
    if (!game.playerIds.includes(targetPlayerId)) return;
    if (playersById.get(targetPlayerId)?.isBot) return;
    if (areAllied(game, player.id, targetPlayerId)) return;
    if (game.allianceRequests.has(pairKey(player.id, targetPlayerId))) return;
    if (allianceCooldownUntil(game, player.id, targetPlayerId) !== null) return;

    createAllianceRequest(game, player.id, targetPlayerId);
    scheduleAllianceRequestExpiry(game, player.id, targetPlayerId, () => {
      const current = games.get(game.name);
      if (!current) return;
      const request = current.allianceRequests.get(
        pairKey(player.id, targetPlayerId),
      );
      if (
        !request ||
        request.fromId !== player.id ||
        request.toId !== targetPlayerId
      )
        return;
      removeAllianceRequest(current, player.id, targetPlayerId);
      sendGameState(io, playersById, current, player.id);
      sendGameState(io, playersById, current, targetPlayerId);
    });

    sendToPlayer(io, playersById, targetPlayerId, 'game:allianceRequested', {
      fromId: player.id,
    });
    sendGameState(io, playersById, game, player.id);
    sendGameState(io, playersById, game, targetPlayerId);
  });

  socket.on('game:revokeAllianceRequest', (data: unknown) => {
    const ctx = getAllianceContext(socket, playersBySocket);
    if (!ctx) return;
    const { player, game } = ctx;

    const targetPlayerId = isObject(data) ? data.targetPlayerId : undefined;
    if (!isInteger(targetPlayerId)) return;
    const request = game.allianceRequests.get(
      pairKey(player.id, targetPlayerId),
    );
    if (!request || request.fromId !== player.id) return;

    removeAllianceRequest(game, player.id, targetPlayerId);
    startAllianceCooldown(game, player.id, targetPlayerId);
    sendGameState(io, playersById, game, player.id);
    sendGameState(io, playersById, game, targetPlayerId);
  });

  socket.on('game:respondAllianceRequest', (data: unknown) => {
    const ctx = getAllianceContext(socket, playersBySocket);
    if (!ctx) return;
    const { player, game } = ctx;
    if (!isObject(data)) return;

    const fromPlayerId = data.fromPlayerId;
    const accept = data.accept;
    if (!isInteger(fromPlayerId) || typeof accept !== 'boolean') return;
    const request = game.allianceRequests.get(pairKey(player.id, fromPlayerId));
    if (!request || request.toId !== player.id) return;

    removeAllianceRequest(game, player.id, fromPlayerId);
    if (accept) {
      formAlliance(game, fromPlayerId, player.id);
      recordLog(game, player.id, 'game:allianceFormed', {
        withId: fromPlayerId,
      });
      recordLog(game, fromPlayerId, 'game:allianceFormed', {
        withId: player.id,
      });
      sendToPlayer(io, playersById, player.id, 'game:allianceFormed', {
        withId: fromPlayerId,
      });
      sendToPlayer(io, playersById, fromPlayerId, 'game:allianceFormed', {
        withId: player.id,
      });
    } else {
      startAllianceCooldown(game, fromPlayerId, player.id);
      sendToPlayer(io, playersById, fromPlayerId, 'game:allianceDeclined', {
        withId: player.id,
      });
    }
    sendGameState(io, playersById, game, player.id);
    sendGameState(io, playersById, game, fromPlayerId);
  });

  socket.on('game:terminateAlliance', (data: unknown) => {
    const ctx = getAllianceContext(socket, playersBySocket);
    if (!ctx) return;
    const { player, game } = ctx;

    const targetPlayerId = isObject(data) ? data.targetPlayerId : undefined;
    if (!isInteger(targetPlayerId)) return;
    if (!areAllied(game, player.id, targetPlayerId)) return;

    const initiatorId =
      allianceInitiator(game, player.id, targetPlayerId) ?? player.id;
    const otherId = initiatorId === player.id ? targetPlayerId : player.id;
    breakAlliance(game, player.id, targetPlayerId);
    startAllianceCooldown(game, initiatorId, otherId);
    recordLog(game, player.id, 'game:allianceTerminated', {
      withId: targetPlayerId,
    });
    recordLog(game, targetPlayerId, 'game:allianceTerminated', {
      withId: player.id,
    });
    sendToPlayer(io, playersById, player.id, 'game:allianceTerminated', {
      withId: targetPlayerId,
    });
    sendToPlayer(io, playersById, targetPlayerId, 'game:allianceTerminated', {
      withId: player.id,
    });
    sendGameState(io, playersById, game, player.id);
    sendGameState(io, playersById, game, targetPlayerId);
  });
}
