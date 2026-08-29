import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../socketRooms';

export function registerReplayHandlers(socket: Socket, engine: Engine) {
  socket.on('game:replay', (callback: (response: unknown) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(engine.requestReplay(playerId));
  });
}
