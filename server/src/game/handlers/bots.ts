import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { isInteger } from '../../validate';
import { registerGameAction } from '../handlerHelpers';

export function registerBotLobbyHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:addBot', (playerId, data) =>
    engine.addBot(playerId, data.difficulty, data.personality),
  );

  registerGameAction(socket, 'game:setBotProfile', (playerId, data) => {
    if (!isInteger(data.botPlayerId))
      return { ok: false, error: 'invalid bot' };
    return engine.setBotProfile(
      playerId,
      data.botPlayerId,
      data.difficulty,
      data.personality,
    );
  });

  registerGameAction(socket, 'game:removeBot', (playerId, data) => {
    if (!isInteger(data.botPlayerId))
      return { ok: false, error: 'invalid bot' };
    return engine.removeBot(playerId, data.botPlayerId);
  });

  registerGameAction(socket, 'game:cycleBotColor', (playerId, data) => {
    if (!isInteger(data.botPlayerId))
      return { ok: false, error: 'invalid bot' };
    return engine.cycleBotColor(playerId, data.botPlayerId);
  });
}
