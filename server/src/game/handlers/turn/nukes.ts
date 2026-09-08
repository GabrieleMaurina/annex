import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerNukeHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:buildNuke', (playerId) =>
    engine.buildNuke(playerId),
  );

  registerGameAction(socket, 'game:buildAntiNuke', (playerId) =>
    engine.buildAntiNuke(playerId),
  );

  registerGameAction(socket, 'game:advanceNuke', (playerId, data) =>
    engine.advanceNuke(playerId, data.index),
  );

  registerGameAction(socket, 'game:launchNuke', (playerId, data) =>
    engine.launchNuke(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:deployAntiNuke', (playerId, data) =>
    engine.deployAntiNuke(playerId, data.territoryId),
  );
}
