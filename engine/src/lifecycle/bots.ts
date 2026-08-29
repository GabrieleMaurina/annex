import {
  isDifficultyInput,
  isPersonalityInput,
  resolveDifficulty,
  resolvePersonality,
} from '../bots/randomProfile';
import { assignRandomColor, cycleColor } from '../game/mechanics';
import { GameResponse } from '../session/context';
import { createBotPlayer, playersById } from '../session/players';
import { games, respondGameState } from '../session/store';
import { BotProfile } from '../types';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Reusable across multiple bots in the same game, deliberately not made
// unique: the name is meant to describe what the bot is, not to identify it.
function botDisplayName(profile: BotProfile): string {
  return `${capitalize(profile.personality)} (${capitalize(profile.difficulty)})`;
}

export function addBot(
  playerId: number,
  difficulty: unknown,
  personality: unknown,
): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };
  if (game.playerIds.length >= game.slots)
    return { ok: false, error: 'no open slots' };

  if (!isDifficultyInput(difficulty))
    return { ok: false, error: 'invalid difficulty' };
  if (!isPersonalityInput(personality))
    return { ok: false, error: 'invalid personality' };

  const profile: BotProfile = {
    difficulty: resolveDifficulty(difficulty),
    personality: resolvePersonality(personality),
  };
  const bot = createBotPlayer(botDisplayName(profile), profile);
  bot.gameName = game.name;
  game.playerIds.push(bot.id);
  game.playerTeams.set(bot.id, 0);
  assignRandomColor(game, bot.id);

  return respondGameState(game, player.id);
}

export function setBotProfile(
  playerId: number,
  botPlayerId: number,
  difficulty: unknown,
  personality: unknown,
): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };

  const bot = playersById.get(botPlayerId);
  if (!bot || !bot.isBot || !game.playerIds.includes(bot.id))
    return { ok: false, error: 'invalid bot' };
  if (!isDifficultyInput(difficulty))
    return { ok: false, error: 'invalid difficulty' };
  if (!isPersonalityInput(personality))
    return { ok: false, error: 'invalid personality' };

  const profile: BotProfile = {
    difficulty: resolveDifficulty(difficulty),
    personality: resolvePersonality(personality),
  };
  bot.botProfile = profile;
  bot.name = botDisplayName(profile);

  return respondGameState(game, player.id);
}

export function removeBot(playerId: number, botPlayerId: number): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };

  const bot = playersById.get(botPlayerId);
  if (!bot || !bot.isBot || !game.playerIds.includes(bot.id))
    return { ok: false, error: 'invalid bot' };

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
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };

  const bot = playersById.get(botPlayerId);
  if (!bot || !bot.isBot || !game.playerIds.includes(bot.id))
    return { ok: false, error: 'invalid bot' };

  cycleColor(game, bot.id);

  return respondGameState(game, player.id);
}
