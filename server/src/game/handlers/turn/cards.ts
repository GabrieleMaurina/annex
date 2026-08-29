import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction, registerGameEvent } from '../../handlerHelpers';

export function registerCardHandlers(socket: Socket, engine: Engine) {
  registerGameEvent(socket, 'game:requestCards', (playerId) =>
    engine.requestCards(playerId),
  );

  registerGameAction(socket, 'game:playCardSet', (playerId, data) =>
    engine.playCardSet(playerId, data.cards),
  );
}
