import { Server, Socket } from 'socket.io';
import { maps } from '../../maps';
import { EmojiAttackTarget, EmojiValue, Game, Player } from '../../types';
import { isInteger, isObject } from '../../validate';
import { games, sendToPlayer } from '../logic/store';

const EMOJI_VALUES: EmojiValue[] = ['👍', '👎', '❤️', '🙂', '🙁', '⚔️'];
const ATTACK_EMOJI: EmojiValue = '⚔️';

function parseAttackTarget(raw: unknown, game: Game): EmojiAttackTarget | null {
  if (!isObject(raw)) return null;
  if (raw.type === 'player') {
    const playerId = raw.playerId;
    if (isInteger(playerId) && game.playerIds.includes(playerId))
      return { type: 'player', playerId };
    return null;
  }
  if (raw.type === 'territory') {
    const territoryId = raw.territoryId;
    const map = maps.get(game.mapName)!;
    if (
      isInteger(territoryId) &&
      territoryId >= 0 &&
      territoryId < map.territories.length
    )
      return { type: 'territory', territoryId };
    return null;
  }
  return null;
}

export function registerEmojiHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on('game:sendEmoji', (data: unknown) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName) return;

    const game = games.get(player.gameName);
    if (!game) return;
    if (game.state !== 'playing') return;
    if (!game.playerIds.includes(player.id)) return;
    if (!isObject(data)) return;

    const emoji = data.emoji;
    if (!EMOJI_VALUES.includes(emoji as EmojiValue)) return;

    const targetPlayerId = data.targetPlayerId;
    if (
      !isInteger(targetPlayerId) ||
      !game.playerIds.includes(targetPlayerId) ||
      targetPlayerId === player.id
    )
      return;

    let attackTarget: EmojiAttackTarget | undefined;
    if (emoji === ATTACK_EMOJI) {
      const parsed = parseAttackTarget(data.attackTarget, game);
      if (!parsed) return;
      attackTarget = parsed;
    } else if (data.attackTarget !== undefined) {
      return;
    }

    const payload = {
      senderId: player.id,
      targetPlayerId,
      emoji: emoji as EmojiValue,
      attackTarget,
    };
    socket.emit('game:emojiSent', payload);
    sendToPlayer(io, playersById, targetPlayerId, 'game:emojiSent', payload);
  });
}
