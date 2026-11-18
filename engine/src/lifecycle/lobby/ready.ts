import { resolveBotProfile } from '../../bots/randomProfile';
import { botDisplayName } from '../../bots/reveal';
import { callbacks } from '../../callbacks';
import { GameResponse, requireGame } from '../../session/context';
import { createBotPlayer, playersById } from '../../session/players';
import { respondGameState } from '../../session/store';
import { Game } from '../../types';

export function setReady(playerId: number, ready: unknown): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.offline) return { ok: false, error: 'offline game' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };
  if (!game.playerIds.includes(playerId))
    return { ok: false, error: 'not a player' };
  if (game.hostId === playerId) return { ok: false, error: 'host is ready' };
  if (typeof ready !== 'boolean') return { ok: false, error: 'invalid ready' };

  if (ready) game.readyIds.add(playerId);
  else game.readyIds.delete(playerId);
  return respondGameState(game, playerId);
}

function replaceWithBot(game: Game, humanId: number) {
  const profile = resolveBotProfile(
    game.disconnectBotDifficulty,
    game.disconnectBotPersonality,
    false,
  );
  const bot = createBotPlayer(botDisplayName(profile), profile);
  bot.gameName = game.name;
  game.playerIds[game.playerIds.indexOf(humanId)] = bot.id;
  game.playerTeams.set(bot.id, game.playerTeams.get(humanId) ?? 0);
  game.playerTeams.delete(humanId);
  const color = game.playerColors.get(humanId);
  if (color !== undefined) game.playerColors.set(bot.id, color);
  game.playerColors.delete(humanId);
  const odds = game.playerOdds.get(humanId);
  if (odds) game.playerOdds.set(bot.id, odds);
  game.playerOdds.delete(humanId);
  game.spectatorIds.push(humanId);
}

export function seatBotsForUnreadyPlayers(game: Game) {
  game.playerIds
    .filter(
      (id) =>
        id !== game.hostId &&
        !game.readyIds.has(id) &&
        !playersById.get(id)?.isBot,
    )
    .forEach((id) => replaceWithBot(game, id));
  game.readyIds.clear();
}

export function humanPlayerCount(game: Game): number {
  return game.playerIds.filter((id) => !playersById.get(id)?.isBot).length;
}

export function kickSpectators(game: Game) {
  for (const id of game.spectatorIds) {
    const spectator = playersById.get(id);
    if (!spectator) continue;
    spectator.gameName = null;
    callbacks.onRoomChanged(id, null);
    callbacks.onKicked(id, { gameName: game.name });
  }
  game.spectatorIds = [];
}
