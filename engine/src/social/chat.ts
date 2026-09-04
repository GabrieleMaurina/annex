import { callbacks } from '../callbacks';
import { requireGame } from '../session/context';
import { playersById } from '../session/players';
import { containsProfanity } from '../util/profanity';

export function sendChat(playerId: number, message: string): void {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return;
  const { game } = ctx;
  if (game.offline) return;

  const trimmed = message.trim();
  if (!trimmed) return;
  if (containsProfanity(trimmed)) return;

  const payload = {
    id: playerId,
    name: playersById.get(playerId)?.name ?? '',
    message: trimmed,
  };
  for (const id of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onChatMessage(id, payload);
  }

  if (game.state === 'playing' && game.playerIds.includes(playerId)) {
    game.replayChat.push({
      senderId: playerId,
      name: payload.name,
      message: trimmed,
      afterFrame: game.replayFrames.length,
    });
  }
}
