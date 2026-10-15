import { callbacks } from '../callbacks';
import { anonymousName, isAnonymous } from '../game/anonymous';
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

  const name = playersById.get(playerId)?.name ?? '';
  const payload = {
    id: playerId,
    name: isAnonymous(game) ? anonymousName(game, playerId) : name,
    message: trimmed,
  };
  for (const id of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onChatMessage(id, payload, game.name);
  }

  if (game.state === 'playing' && game.playerIds.includes(playerId)) {
    game.replayChat.push({
      senderId: playerId,
      name,
      message: trimmed,
      afterFrame: game.replayFrames.length,
    });
  }
}
