import { callbacks } from '../callbacks';
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
} from '../game/alliances';
import { recordLog } from '../game/world/fog';
import { playersById } from '../session/players';
import { games, sendGameState } from '../session/store';
import { Game, Player } from '../types';

function getAllianceContext(
  playerId: number,
): { player: Player; game: Game } | null {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return null;
  const game = games.get(player.gameName);
  if (!game) return null;
  if (game.state !== 'playing' || game.alliances !== 'on') return null;
  if (!game.playerIds.includes(player.id)) return null;
  return { player, game };
}

export function offerAlliance(playerId: number, targetPlayerId: number): void {
  const ctx = getAllianceContext(playerId);
  if (!ctx) return;
  const { player, game } = ctx;

  if (targetPlayerId === player.id) return;
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
    sendGameState(current, player.id);
    sendGameState(current, targetPlayerId);
  });

  callbacks.onAllianceRequested(targetPlayerId, { fromId: player.id });
  sendGameState(game, player.id);
  sendGameState(game, targetPlayerId);
}

export function revokeAllianceRequest(
  playerId: number,
  targetPlayerId: number,
): void {
  const ctx = getAllianceContext(playerId);
  if (!ctx) return;
  const { player, game } = ctx;

  const request = game.allianceRequests.get(pairKey(player.id, targetPlayerId));
  if (!request || request.fromId !== player.id) return;

  removeAllianceRequest(game, player.id, targetPlayerId);
  startAllianceCooldown(game, player.id, targetPlayerId);
  sendGameState(game, player.id);
  sendGameState(game, targetPlayerId);
}

export function respondAllianceRequest(
  playerId: number,
  fromPlayerId: number,
  accept: boolean,
): void {
  const ctx = getAllianceContext(playerId);
  if (!ctx) return;
  const { player, game } = ctx;

  const request = game.allianceRequests.get(pairKey(player.id, fromPlayerId));
  if (!request || request.toId !== player.id) return;

  removeAllianceRequest(game, player.id, fromPlayerId);
  if (accept) {
    formAlliance(game, fromPlayerId, player.id);
    recordLog(game, player.id, 'game:allianceFormed', { withId: fromPlayerId });
    recordLog(game, fromPlayerId, 'game:allianceFormed', { withId: player.id });
    callbacks.onAllianceFormed(player.id, { withId: fromPlayerId });
    callbacks.onAllianceFormed(fromPlayerId, { withId: player.id });
  } else {
    startAllianceCooldown(game, fromPlayerId, player.id);
    callbacks.onAllianceDeclined(fromPlayerId, { withId: player.id });
  }
  sendGameState(game, player.id);
  sendGameState(game, fromPlayerId);
}

export function terminateAlliance(
  playerId: number,
  targetPlayerId: number,
): void {
  const ctx = getAllianceContext(playerId);
  if (!ctx) return;
  const { player, game } = ctx;

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
  callbacks.onAllianceTerminated(player.id, { withId: targetPlayerId });
  callbacks.onAllianceTerminated(targetPlayerId, { withId: player.id });
  sendGameState(game, player.id);
  sendGameState(game, targetPlayerId);
}
