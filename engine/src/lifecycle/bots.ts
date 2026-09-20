import {
  isDifficultyInput,
  isPersonalityInput,
  resolveBotProfile,
} from '../bots/randomProfile';
import { botDisplayName } from '../bots/reveal';
import { addHostCandidate } from '../game/host';
import { assignRandomColor, cycleColor } from '../game/mechanics';
import { GameResponse } from '../session/context';
import { createBotPlayer, playersById } from '../session/players';
import { games, respondGameState } from '../session/store';
import { Game, Player } from '../types';

function requireLobbyHost(
  playerId: number,
): { game: Game; player: Player } | GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };

  return { game, player };
}

function findLobbyBot(game: Game, botPlayerId: number): Player | null {
  const bot = playersById.get(botPlayerId);
  if (!bot || !bot.isBot || !game.playerIds.includes(bot.id)) return null;
  return bot;
}

export function addBot(
  playerId: number,
  difficulty: unknown,
  personality: unknown,
): GameResponse {
  const ctx = requireLobbyHost(playerId);
  if ('ok' in ctx) return ctx;
  const { game, player } = ctx;

  if (game.playerIds.length >= game.slots)
    return { ok: false, error: 'no open slots' };

  if (!isDifficultyInput(difficulty))
    return { ok: false, error: 'invalid difficulty' };
  if (!isPersonalityInput(personality))
    return { ok: false, error: 'invalid personality' };

  const profile = resolveBotProfile(difficulty, personality);
  const bot = createBotPlayer(botDisplayName(profile), profile);
  bot.gameName = game.name;
  game.playerIds.push(bot.id);
  game.playerTeams.set(bot.id, 0);
  assignRandomColor(game, bot.id);
  addHostCandidate(game, bot.id);

  return respondGameState(game, player.id);
}

export function setBotProfile(
  playerId: number,
  botPlayerId: number,
  difficulty: unknown,
  personality: unknown,
): GameResponse {
  const ctx = requireLobbyHost(playerId);
  if ('ok' in ctx) return ctx;
  const { game, player } = ctx;

  const bot = findLobbyBot(game, botPlayerId);
  if (!bot) return { ok: false, error: 'invalid bot' };
  if (!isDifficultyInput(difficulty))
    return { ok: false, error: 'invalid difficulty' };
  if (!isPersonalityInput(personality))
    return { ok: false, error: 'invalid personality' };

  const profile = resolveBotProfile(difficulty, personality);
  bot.botProfile = profile;
  bot.name = botDisplayName(profile);

  return respondGameState(game, player.id);
}

export function removeBot(playerId: number, botPlayerId: number): GameResponse {
  const ctx = requireLobbyHost(playerId);
  if ('ok' in ctx) return ctx;
  const { game, player } = ctx;

  const bot = findLobbyBot(game, botPlayerId);
  if (!bot) return { ok: false, error: 'invalid bot' };

  game.playerIds = game.playerIds.filter((id) => id !== bot.id);
  game.playerTeams.delete(bot.id);
  game.playerColors.delete(bot.id);
  playersById.delete(bot.id);

  return respondGameState(game, player.id);
}

export function cycleBotColor(
  playerId: number,
  botPlayerId: number,
): GameResponse {
  const ctx = requireLobbyHost(playerId);
  if ('ok' in ctx) return ctx;
  const { game, player } = ctx;

  const bot = findLobbyBot(game, botPlayerId);
  if (!bot) return { ok: false, error: 'invalid bot' };

  cycleColor(game, bot.id);

  return respondGameState(game, player.id);
}
