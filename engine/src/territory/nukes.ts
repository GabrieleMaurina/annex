import { hasAnyAttack } from '../game/combat/autoSkip';
import { checkGameEnd } from '../game/end';
import {
  advanceNukeProject,
  deployAntiNuke,
  hasReadyNuke,
  launchNuke,
  startNukeProject,
} from '../game/nukes/nukes';
import { hasPlayableSet } from '../game/progression/cards';
import { advanceTurnPhase } from '../game/turns';
import { GameContext, GameResponse, requireGame } from '../session/context';
import { respondGameState } from '../session/store';
import { Game } from '../types';
import { isInteger } from '../util/validate';

function requireNukePhase(
  playerId: number,
  phase: Game['turnPhase'],
): GameContext {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game, playerId: pid } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.nukes !== 'on') return { ok: false, error: 'nukes disabled' };
  if (game.playerIds[game.turnPlayerIndex] !== pid)
    return { ok: false, error: 'not your turn' };
  if (game.turnPhase !== phase)
    return { ok: false, error: `not ${phase} phase` };
  return ctx;
}

function maybeAdvanceDeploy(game: Game, playerId: number): void {
  const hand = game.playerCards.get(playerId) ?? [];
  if (
    game.troopsToDeploy <= 0 &&
    hand.length < 5 &&
    (game.deployCardMandate || !hasPlayableSet(hand))
  )
    advanceTurnPhase(game);
}

function maybeAdvanceAttack(game: Game, playerId: number): void {
  if (
    game.state === 'playing' &&
    game.turnPhase === 'attack' &&
    game.attackConquestMinTroops === null &&
    !hasAnyAttack(game, playerId) &&
    !hasReadyNuke(game, playerId)
  )
    advanceTurnPhase(game);
}

export function buildNuke(playerId: number): GameResponse {
  const ctx = requireNukePhase(playerId, 'deploy');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  const result = startNukeProject(game, playerId, 'nuke');
  if (!result.ok) return result;
  maybeAdvanceDeploy(game, playerId);
  return respondGameState(game, playerId);
}

export function buildAntiNuke(playerId: number): GameResponse {
  const ctx = requireNukePhase(playerId, 'deploy');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  const result = startNukeProject(game, playerId, 'antiNuke');
  if (!result.ok) return result;
  maybeAdvanceDeploy(game, playerId);
  return respondGameState(game, playerId);
}

export function advanceNuke(playerId: number, rawIndex: unknown): GameResponse {
  const ctx = requireNukePhase(playerId, 'deploy');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (!isInteger(rawIndex)) return { ok: false, error: 'invalid project' };
  const result = advanceNukeProject(game, playerId, rawIndex);
  if (!result.ok) return result;
  maybeAdvanceDeploy(game, playerId);
  return respondGameState(game, playerId);
}

export function launchNukeAction(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireNukePhase(playerId, 'attack');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const result = launchNuke(game, playerId, rawTerritoryId);
  if (!result.ok) return result;
  if (result.eliminatedPlayerIds.length > 0) checkGameEnd(game);
  maybeAdvanceAttack(game, playerId);
  return respondGameState(game, playerId);
}

export function deployAntiNukeAction(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireNukePhase(playerId, 'attack');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const result = deployAntiNuke(game, playerId, rawTerritoryId);
  if (!result.ok) return result;
  maybeAdvanceAttack(game, playerId);
  return respondGameState(game, playerId);
}
