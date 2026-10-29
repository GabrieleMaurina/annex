import { Engine, fromClient } from 'engine';
import { Socket } from 'socket.io';
import { isInteger } from '../../validate';
import { registerGameAction } from '../handlerHelpers';

export function registerBotLobbyHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:addBot', (playerId, data) =>
    engine.addBot(playerId, data.difficulty, data.personality, data.team),
  );

  registerGameAction(socket, 'game:setBotProfile', (playerId, data) => {
    const botPlayerId = fromClient(playerId, data.botPlayerId);
    if (!isInteger(botPlayerId)) return { ok: false, error: 'invalid bot' };
    return engine.setBotProfile(
      playerId,
      botPlayerId,
      data.difficulty,
      data.personality,
    );
  });

  registerGameAction(socket, 'game:removeBot', (playerId, data) => {
    const botPlayerId = fromClient(playerId, data.botPlayerId);
    if (!isInteger(botPlayerId)) return { ok: false, error: 'invalid bot' };
    return engine.removeBot(playerId, botPlayerId);
  });

  registerGameAction(socket, 'game:cycleBotColor', (playerId, data) => {
    const botPlayerId = fromClient(playerId, data.botPlayerId);
    if (!isInteger(botPlayerId)) return { ok: false, error: 'invalid bot' };
    return engine.cycleBotColor(playerId, botPlayerId);
  });
}
