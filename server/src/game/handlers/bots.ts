import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../socketRooms';
import { isInteger, isObject } from '../../validate';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

export function registerBotLobbyHandlers(socket: Socket, engine: Engine) {
  socket.on(
    'game:addBot',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const difficulty = isObject(data) ? data.difficulty : undefined;
      const personality = isObject(data) ? data.personality : undefined;
      callback(engine.addBot(playerId, difficulty, personality));
    },
  );

  socket.on(
    'game:setBotProfile',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const botPlayerId = isObject(data) ? data.botPlayerId : undefined;
      if (!isInteger(botPlayerId))
        return callback({ ok: false, error: 'invalid bot' });
      const difficulty = isObject(data) ? data.difficulty : undefined;
      const personality = isObject(data) ? data.personality : undefined;
      callback(
        engine.setBotProfile(playerId, botPlayerId, difficulty, personality),
      );
    },
  );

  socket.on(
    'game:removeBot',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const botPlayerId = isObject(data) ? data.botPlayerId : undefined;
      if (!isInteger(botPlayerId))
        return callback({ ok: false, error: 'invalid bot' });
      callback(engine.removeBot(playerId, botPlayerId));
    },
  );

  socket.on(
    'game:cycleBotColor',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const botPlayerId = isObject(data) ? data.botPlayerId : undefined;
      if (!isInteger(botPlayerId))
        return callback({ ok: false, error: 'invalid bot' });
      callback(engine.cycleBotColor(playerId, botPlayerId));
    },
  );
}
