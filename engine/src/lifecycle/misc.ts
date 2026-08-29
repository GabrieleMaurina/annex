import { checkGameEnd, computeGameEndWinnerIds } from '../game/end';
import { recomputeHost } from '../game/host';
import {
  cycleColor as cycleColorImpl,
  ownsAnyTerritory,
} from '../game/mechanics';
import {
  advanceTurnPhase,
  forceEndTurnImpl,
  pauseTurnTimer,
  resumeTurnTimer,
} from '../game/turns';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import {
  broadcastHomeGames,
  destroyIfInactive,
  games,
  respondGameState,
  sendGameResults,
  sendGameState,
} from '../session/store';

export function requestState(playerId: number): void {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return;
  const game = games.get(player.gameName);
  if (!game) return;
  sendGameState(game, player.id);
}

export function requestResults(playerId: number): void {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return;
  const game = games.get(player.gameName);
  if (!game || game.state !== 'ended') return;
  sendGameResults(game, player.id);
}

export function cycleColor(playerId: number): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (!game.playerIds.includes(player.id))
    return { ok: false, error: 'not a player' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };

  cycleColorImpl(game, player.id);
  return respondGameState(game, player.id);
}

export function nextPhase(playerId: number): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== player.id)
    return { ok: false, error: 'not your turn' };
  if (
    game.turnPhase === 'territory' ||
    game.turnPhase === 'troop' ||
    game.turnPhase === 'capital'
  )
    return { ok: false, error: `cannot skip ${game.turnPhase} phase` };
  if (game.turnPhase === 'deploy') {
    if (game.troopsToDeploy > 0)
      return { ok: false, error: 'cannot skip deploy phase' };
    if ((game.playerCards.get(player.id)?.length ?? 0) >= 5)
      return { ok: false, error: 'must play a card set' };
  }
  if (game.turnPhase === 'attack' && game.attackConquestMinTroops !== null)
    return { ok: false, error: 'pending conquest move' };

  advanceTurnPhase(game);
  return respondGameState(game, player.id);
}

export function pauseGame(playerId: number): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };

  if (game.paused) resumeTurnTimer(game);
  else pauseTurnTimer(game);

  return respondGameState(game, player.id);
}

export function surrender(playerId: number): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (!game.playerIds.includes(player.id))
    return { ok: false, error: 'not a player' };
  if (game.turnPhase !== 'territory' && !ownsAnyTerritory(game, player.id))
    return { ok: false, error: 'already eliminated' };

  game.surrenderedIds.add(player.id);
  if (!game.deathOrder.includes(player.id)) game.deathOrder.push(player.id);
  const wasTheirTurn = game.playerIds[game.turnPlayerIndex] === player.id;
  if (wasTheirTurn) {
    const endsGame = computeGameEndWinnerIds(game) !== null;
    forceEndTurnImpl(game, endsGame);
  }
  checkGameEnd(game, wasTheirTurn);
  recomputeHost(game);
  destroyIfInactive(game);
  broadcastHomeGames();

  return respondGameState(game, player.id);
}
