import { callbacks } from '../callbacks';
import { emojiTargetAllowed } from '../game/alliances';
import { getGameMap } from '../maps/maps';
import { requireGame } from '../session/context';
import { playersById } from '../session/players';
import { EmojiAttackTarget, EmojiValue, Game } from '../types';

const EMOJI_VALUES: EmojiValue[] = [
  '👍',
  '👎',
  '❤️',
  '🙂',
  '🙁',
  '😲',
  '🙏',
  '⚔️',
];
const ATTACK_EMOJI: EmojiValue = '⚔️';

function parseAttackTarget(raw: unknown, game: Game): EmojiAttackTarget | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const target = raw as Record<string, unknown>;
  if (target.type === 'player') {
    const targetPlayerId = target.playerId;
    if (
      typeof targetPlayerId === 'number' &&
      game.playerIds.includes(targetPlayerId)
    )
      return { type: 'player', playerId: targetPlayerId };
    return null;
  }
  if (target.type === 'territory') {
    const territoryId = target.territoryId;
    const map = getGameMap(game);
    if (
      typeof territoryId === 'number' &&
      territoryId >= 0 &&
      territoryId < map.territories.length
    )
      return { type: 'territory', territoryId };
    return null;
  }
  return null;
}

export function sendEmoji(
  playerId: number,
  rawEmoji: unknown,
  targetPlayerId: number | undefined,
  rawAttackTarget: unknown,
): void {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return;
  const { game } = ctx;
  if (game.offline) return;
  if (!game.playerIds.includes(playerId)) return;
  if (!EMOJI_VALUES.includes(rawEmoji as EmojiValue)) return;
  const emoji = rawEmoji as EmojiValue;

  if (targetPlayerId !== undefined) {
    if (
      !game.playerIds.includes(targetPlayerId) ||
      targetPlayerId === playerId ||
      playersById.get(targetPlayerId)?.isBot ||
      !emojiTargetAllowed(game, playerId, targetPlayerId)
    )
      return;
  }

  if (emoji === ATTACK_EMOJI && targetPlayerId === undefined) return;

  let attackTarget: EmojiAttackTarget | undefined;
  if (emoji === ATTACK_EMOJI) {
    const parsed = parseAttackTarget(rawAttackTarget, game);
    if (!parsed) return;
    attackTarget = parsed;
  } else if (rawAttackTarget !== undefined) {
    return;
  }

  const payload = { senderId: playerId, targetPlayerId, emoji, attackTarget };

  if (targetPlayerId === undefined) {
    for (const id of game.playerIds) callbacks.onEmojiSent(id, payload);
  } else {
    callbacks.onEmojiSent(playerId, payload);
    callbacks.onEmojiSent(targetPlayerId, payload);
  }

  if (game.state === 'playing') {
    game.replayEmoji.push({
      senderId: playerId,
      targetPlayerId: targetPlayerId ?? null,
      emoji,
      attackTarget: attackTarget ?? null,
      afterFrame: game.replayFrames.length,
    });
  }
}
