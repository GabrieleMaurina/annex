import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../socketRooms';
import { isObject } from '../validate';

export type GameResponse =
  { ok: true; game: unknown } | { ok: false; error: string };

export function registerGameAction(
  socket: Socket,
  event: string,
  run: (playerId: number, data: Record<string, unknown>) => GameResponse,
): void {
  socket.on(
    event,
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      callback(run(playerId, isObject(data) ? data : {}));
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
