import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../socketRooms';
import { isInteger, isObject } from '../../validate';

export function registerEmojiHandlers(socket: Socket, engine: Engine) {
  socket.on('game:sendEmoji', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    if (!isObject(data)) return;

    const rawTarget = data.targetPlayerId;
    let targetPlayerId: number | undefined;
    if (rawTarget !== undefined) {
      if (!isInteger(rawTarget)) return;
      targetPlayerId = rawTarget;
    }

    engine.sendEmoji(playerId, data.emoji, targetPlayerId, data.attackTarget);
  });
}
