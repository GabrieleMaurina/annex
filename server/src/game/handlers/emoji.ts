import { Engine, fromClient } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../sockets/socketRooms';
import { isInteger, isObject } from '../../validate';

export function registerEmojiHandlers(socket: Socket, engine: Engine) {
  socket.on('game:sendEmoji', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    if (!isObject(data)) return;

    const rawTarget = data.targetPlayerId;
    let targetPlayerId: number | undefined;
    if (rawTarget !== undefined) {
      const target = fromClient(playerId, rawTarget);
      if (!isInteger(target)) return;
      targetPlayerId = target;
    }

    const { attackTarget } = data;
    engine.sendEmoji(
      playerId,
      data.emoji,
      targetPlayerId,
      isObject(attackTarget) && attackTarget.type === 'player'
        ? {
            ...attackTarget,
            playerId: fromClient(playerId, attackTarget.playerId),
          }
        : attackTarget,
    );
  });
}
