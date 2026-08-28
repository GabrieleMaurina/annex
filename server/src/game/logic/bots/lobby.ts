import { Server, Socket } from 'socket.io';
import { BotProfile, Player } from '../../../types';
import { isInteger, isObject } from '../../../validate';
import { assignRandomColor } from '../mechanics';
import { gameState } from '../state';
import { games, respondWithGameState } from '../store';
import {
  isDifficultyInput,
  isPersonalityInput,
  resolveDifficulty,
  resolvePersonality,
} from './randomProfile';
import { createBotPlayer, unregisterBotSocket } from './socket';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Reusable across multiple bots in the same game, deliberately not made
// unique: the name is meant to describe what the bot is, not to identify it.
function botDisplayName(profile: BotProfile): string {
  return `${capitalize(profile.personality)} (${capitalize(profile.difficulty)})`;
}

export function registerBotLobbyHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:addBot',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.hostId !== player.id)
        return callback({ ok: false, error: 'not the host' });
      if (game.state !== 'lobby')
        return callback({ ok: false, error: 'game already started' });
      if (game.playerIds.length >= game.slots)
        return callback({ ok: false, error: 'no open slots' });

      const difficulty = isObject(data) ? data.difficulty : undefined;
      const personality = isObject(data) ? data.personality : undefined;
      if (!isDifficultyInput(difficulty))
        return callback({ ok: false, error: 'invalid difficulty' });
      if (!isPersonalityInput(personality))
        return callback({ ok: false, error: 'invalid personality' });

      const profile: BotProfile = {
        difficulty: resolveDifficulty(difficulty),
        personality: resolvePersonality(personality),
      };
      const bot = createBotPlayer(
        io,
        playersById,
        playersBySocket,
        botDisplayName(profile),
        profile,
      );
      bot.gameName = game.name;
      game.playerIds.push(bot.id);
      game.playerTeams.set(bot.id, 0);
      assignRandomColor(game, bot.id);

      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );

  socket.on(
    'game:setBotProfile',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.hostId !== player.id)
        return callback({ ok: false, error: 'not the host' });
      if (game.state !== 'lobby')
        return callback({ ok: false, error: 'game already started' });

      const botPlayerId = isObject(data) ? data.botPlayerId : undefined;
      const difficulty = isObject(data) ? data.difficulty : undefined;
      const personality = isObject(data) ? data.personality : undefined;
      if (!isInteger(botPlayerId))
        return callback({ ok: false, error: 'invalid bot' });
      const bot = playersById.get(botPlayerId);
      if (!bot || !bot.isBot || !game.playerIds.includes(bot.id))
        return callback({ ok: false, error: 'invalid bot' });
      if (!isDifficultyInput(difficulty))
        return callback({ ok: false, error: 'invalid difficulty' });
      if (!isPersonalityInput(personality))
        return callback({ ok: false, error: 'invalid personality' });

      const profile: BotProfile = {
        difficulty: resolveDifficulty(difficulty),
        personality: resolvePersonality(personality),
      };
      bot.botProfile = profile;
      bot.name = botDisplayName(profile);

      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );

  socket.on(
    'game:removeBot',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.hostId !== player.id)
        return callback({ ok: false, error: 'not the host' });
      if (game.state !== 'lobby')
        return callback({ ok: false, error: 'game already started' });

      const botPlayerId = isObject(data) ? data.botPlayerId : undefined;
      if (!isInteger(botPlayerId))
        return callback({ ok: false, error: 'invalid bot' });
      const bot = playersById.get(botPlayerId);
      if (!bot || !bot.isBot || !game.playerIds.includes(bot.id))
        return callback({ ok: false, error: 'invalid bot' });

      game.playerIds = game.playerIds.filter((id) => id !== bot.id);
      game.playerTeams.delete(bot.id);
      game.playerColors.delete(bot.id);
      unregisterBotSocket(bot.socketId);
      playersBySocket.delete(bot.socketId);
      playersById.delete(bot.id);

      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );
}
