import { addHostCandidate, recomputeHost } from '../game/host';
import { assignRandomColor } from '../game/mechanics';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import {
  broadcastHomeGames,
  games,
  respondGameState,
  sendGeneratedMapIfAny,
} from '../session/store';
import { canTakeSeat } from './eligibility';
import { hasRoom, openTeam } from './teams';

export function joinGame(playerId: number, gameName: string): GameResponse {
  const player = playersById.get(playerId);
  if (!player) return { ok: false, error: 'not identified' };
  if (player.gameName) return { ok: false, error: 'already in a game' };

  const game = games.get(gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.bannedIds.has(player.id))
    return { ok: false, error: 'banned from this game' };

  if (game.playerIds.includes(player.id)) {
    recomputeHost(game);
  } else if (
    game.state === 'lobby' &&
    game.playerIds.length < game.slots &&
    canTakeSeat(game, player.id)
  ) {
    const departed = game.lobbyDeparted.get(player.id);
    game.lobbyDeparted.delete(player.id);
    const colorTaken =
      departed !== undefined &&
      [...game.playerColors.values()].includes(departed.color);
    game.playerTeams.set(
      player.id,
      departed && hasRoom(game, departed.team) ? departed.team : openTeam(game),
    );
    game.playerIds.push(player.id);
    if (departed && !colorTaken)
      game.playerColors.set(player.id, departed.color);
    else assignRandomColor(game, player.id);
    addHostCandidate(game, player.id);
    if (departed)
      game.playerIds.sort(
        (a, b) => game.hostPriority.indexOf(a) - game.hostPriority.indexOf(b),
      );
    recomputeHost(game);
  } else {
    game.lobbyDeparted.delete(player.id);
    game.spectatorIds.push(player.id);
  }
  player.gameName = game.name;

  sendGeneratedMapIfAny(game, player.id);
  broadcastHomeGames();
  return respondGameState(game, player.id);
}
