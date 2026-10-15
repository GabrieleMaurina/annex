import { ViewableResponse, viewResponse } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../sockets/socketRooms';
import { isObject } from '../validate';

export function registerGameAction(
  socket: Socket,
  event: string,
  run: (playerId: number, data: Record<string, unknown>) => ViewableResponse,
): void {
  socket.on(
    event,
    (data: unknown, callback: (response: ViewableResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      callback(
        viewResponse(playerId, run(playerId, isObject(data) ? data : {})),
      );
    },
  );
}

export function registerGameEvent(
  socket: Socket,
  event: string,
  run: (playerId: number, data: Record<string, unknown>) => void,
): void {
  socket.on(event, (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    run(playerId, isObject(data) ? data : {});
  });
}
