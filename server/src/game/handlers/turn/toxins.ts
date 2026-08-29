import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerToxinsHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:toxins', (playerId, data) =>
    engine.toxin(playerId, data.territoryId),
  );
}
