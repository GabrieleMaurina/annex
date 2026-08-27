import { useEffect, useRef, useState } from 'react';
import { EMOJI_POP_DURATION, GLOBAL_TARGET_ID } from '../../game/logic/emoji';
import { socket } from '../../lib/socket';
import { playSound } from '../../lib/sounds';
import type { EmojiSentPayload, EmojiValue } from '../../lib/types';
import { isPlayerMuted } from '../mutedPlayers';

export interface TableEmojiPop {
  id: number;
  rowPlayerId: number;
  emoji: EmojiValue;
  global?: boolean;
}

export function useTableEmojiReactions(selfId: number | null) {
  const [emojiPickerFor, setEmojiPickerFor] = useState<number | null>(null);
  const [emojiPops, setEmojiPops] = useState<TableEmojiPop[]>([]);
  const emojiPopIdRef = useRef(0);
  const emojiTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<number, HTMLElement>());
  const nameCellRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    const emojiTimers = emojiTimersRef.current;
    function onEmojiSent(payload: EmojiSentPayload) {
      if (isPlayerMuted(payload.senderId)) return;
      playSound('emoji');
      const id = ++emojiPopIdRef.current;
      const targetPlayerId = payload.targetPlayerId;
      const global = targetPlayerId === undefined;
      const rowPlayerId = global
        ? payload.senderId
        : payload.senderId === selfId
          ? targetPlayerId
          : payload.senderId;
      setEmojiPops((prev) => [
        ...prev.filter((p) => p.rowPlayerId !== rowPlayerId),
        { id, rowPlayerId, emoji: payload.emoji, global },
      ]);
      const timer = setTimeout(() => {
        emojiTimers.delete(timer);
        setEmojiPops((prev) => prev.filter((p) => p.id !== id));
      }, EMOJI_POP_DURATION);
      emojiTimers.add(timer);
    }
    socket.on('game:emojiSent', onEmojiSent);
    return () => {
      socket.off('game:emojiSent', onEmojiSent);
      emojiTimers.forEach(clearTimeout);
      emojiTimers.clear();
    };
  }, [selfId]);

  function handleRowClick(playerId: number) {
    if (playerId === selfId) return;
    setEmojiPickerFor((prev) => (prev === playerId ? null : playerId));
  }

  function handleEmojiPick(targetPlayerId: number, emoji: EmojiValue) {
    setEmojiPickerFor(null);
    socket.emit('game:sendEmoji', {
      targetPlayerId:
        targetPlayerId === GLOBAL_TARGET_ID ? undefined : targetPlayerId,
      emoji,
    });
  }

  useEffect(() => {
    if (emojiPickerFor === null) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (emojiPickerRef.current?.contains(target)) return;
      for (const row of rowRefs.current.values()) {
        if (row.contains(target)) return;
      }
      setEmojiPickerFor(null);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [emojiPickerFor]);

  return {
    emojiPickerFor,
    emojiPops,
    handleRowClick,
    handleEmojiPick,
    emojiPickerRef,
    rowRefs,
    nameCellRefs,
  };
}
