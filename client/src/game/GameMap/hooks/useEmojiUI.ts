import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isPlayerMuted } from '../../../common/mutedPlayers';
import { connector } from '../../../connector';
import { playerColor } from '../../../lib/palette';
import { playSound } from '../../../lib/sounds';
import type {
  EmojiSentPayload,
  EmojiValue,
  GameState,
} from '../../../lib/types';
import {
  ATTACK_EMOJI,
  EMOJI_POP_DURATION,
  EMOJI_TERRITORY_SIDE_GAP,
  emojiFlightDurations,
  GLOBAL_TARGET_ID,
  type EmojiPop,
} from '../../logic/emoji';
import type { Territory } from '../../mapData';
import type { Point } from '../helpers';

export function useEmojiUI({
  selfId,
  isTeamDeathmatch,
  players,
  alliances,
  allianceStates,
  territoriesRef,
  playersRef,
  ownerByIdRef,
  selfIdRef,
  canvasRef,
  getTerritoryScreenPosRef,
  vertexScreenRadiusRef,
}: {
  selfId: number | null;
  isTeamDeathmatch: boolean;
  players: GameState['players'];
  alliances: GameState['alliances'];
  allianceStates: GameState['allianceStates'];
  territoriesRef: RefObject<Territory[]>;
  playersRef: RefObject<GameState['players']>;
  ownerByIdRef: RefObject<Map<number, GameState['territories'][number]>>;
  selfIdRef: RefObject<number | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  getTerritoryScreenPosRef: RefObject<(t: Territory) => Point>;
  vertexScreenRadiusRef: RefObject<number>;
}) {
  const [emojiPickerFor, setEmojiPickerFor] = useState<number | null>(null);
  const [pendingAttackEmoji, setPendingAttackEmoji] = useState<{
    targetPlayerId: number;
  } | null>(null);
  const [emojiPops, setEmojiPops] = useState<EmojiPop[]>([]);
  const emojiPopIdRef = useRef(0);
  const [emojiFlights, setEmojiFlights] = useState<
    {
      id: number;
      emoji: EmojiValue;
      from: Point;
      to: Point;
      totalDuration: number;
      travelPercent: number;
    }[]
  >([]);
  const emojiFlightIdRef = useRef(0);
  const emojiTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const rowRefs = useRef(new Map<number, HTMLElement>());
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  function sendEmoji(
    targetPlayerId: number,
    emoji: EmojiValue,
    attackTarget?: EmojiSentPayload['attackTarget'],
  ) {
    if (connector.isOffline()) return;
    connector.sendEmoji({
      targetPlayerId:
        targetPlayerId === GLOBAL_TARGET_ID ? undefined : targetPlayerId,
      emoji,
      attackTarget,
    });
  }

  function handlePlayerRowClick(playerId: number) {
    if (pendingAttackEmoji) {
      sendEmoji(pendingAttackEmoji.targetPlayerId, ATTACK_EMOJI, {
        type: 'player',
        playerId,
      });
      setPendingAttackEmoji(null);
      return;
    }
    if (playerId === selfId) return;
    setEmojiPickerFor((prev) => (prev === playerId ? null : playerId));
  }

  function handleEmojiPick(targetPlayerId: number, emoji: EmojiValue) {
    setEmojiPickerFor(null);
    if (emoji === ATTACK_EMOJI) {
      setPendingAttackEmoji({ targetPlayerId });
      return;
    }
    sendEmoji(targetPlayerId, emoji);
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

  const emojiAllowedIds = useMemo(() => {
    if (selfId === null) return null;
    if (isTeamDeathmatch) {
      const selfTeam = players.find((p) => p.id === selfId)?.team;
      return new Set(
        players
          .filter((p) => p.id !== selfId && p.team === selfTeam)
          .map((p) => p.id),
      );
    }
    if (alliances === 'on') {
      return new Set(
        allianceStates
          .filter((a) => a.state === 'allied')
          .map((a) => a.playerId),
      );
    }
    return null;
  }, [isTeamDeathmatch, alliances, players, allianceStates, selfId]);

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
        : payload.senderId === selfIdRef.current
          ? targetPlayerId
          : payload.senderId;
      let attackText: string | undefined;
      let attackColor: string | undefined;

      const attackTarget = payload.attackTarget;
      if (attackTarget?.type === 'player') {
        const target = playersRef.current.find(
          (p) => p.id === attackTarget.playerId,
        );
        attackText = target?.name ?? '?';
        attackColor = target ? playerColor(target.color) : undefined;
      } else if (attackTarget?.type === 'territory') {
        const territoryId = attackTarget.territoryId;
        attackText = `#${territoryId + 1}`;
        const ownerId = ownerByIdRef.current.get(territoryId)?.ownerId;
        const owner = playersRef.current.find((p) => p.id === ownerId);
        attackColor = owner ? playerColor(owner.color) : undefined;

        const territory = territoriesRef.current.find(
          (t) => t.id === territoryId,
        );
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const rowRect = rowRefs.current
          .get(rowPlayerId)
          ?.getBoundingClientRect();
        if (territory && canvasRect && rowRect) {
          const local = getTerritoryScreenPosRef.current(territory);
          const sideOffset =
            vertexScreenRadiusRef.current + EMOJI_TERRITORY_SIDE_GAP;
          const to = {
            x: canvasRect.left + local.x + sideOffset,
            y: canvasRect.top + local.y,
          };
          const from = { x: rowRect.left, y: rowRect.top + rowRect.height / 2 };
          const flightId = ++emojiFlightIdRef.current;
          const distance = Math.hypot(to.x - from.x, to.y - from.y);
          const { totalDuration, travelPercent } =
            emojiFlightDurations(distance);
          setEmojiFlights((prev) => [
            ...prev,
            {
              id: flightId,
              emoji: payload.emoji,
              from,
              to,
              totalDuration,
              travelPercent,
            },
          ]);
          const flightTimer = setTimeout(() => {
            emojiTimers.delete(flightTimer);
            setEmojiFlights((prev) => prev.filter((f) => f.id !== flightId));
          }, totalDuration);
          emojiTimers.add(flightTimer);
        }
      }

      setEmojiPops((prev) => [
        ...prev.filter((p) => p.rowPlayerId !== rowPlayerId),
        {
          id,
          rowPlayerId,
          emoji: payload.emoji,
          attackText,
          attackColor,
          global,
        },
      ]);
      const popTimer = setTimeout(() => {
        emojiTimers.delete(popTimer);
        setEmojiPops((prev) => prev.filter((p) => p.id !== id));
      }, EMOJI_POP_DURATION);
      emojiTimers.add(popTimer);
    }
    connector.on('game:emojiSent', onEmojiSent);
    return () => {
      connector.off('game:emojiSent', onEmojiSent);
      emojiTimers.forEach(clearTimeout);
      emojiTimers.clear();
    };
  }, [
    selfIdRef,
    playersRef,
    ownerByIdRef,
    territoriesRef,
    canvasRef,
    getTerritoryScreenPosRef,
    vertexScreenRadiusRef,
  ]);

  return {
    emojiPickerFor,
    setEmojiPickerFor,
    pendingAttackEmoji,
    setPendingAttackEmoji,
    emojiPops,
    emojiFlights,
    rowRefs,
    emojiPickerRef,
    sendEmoji,
    handlePlayerRowClick,
    handleEmojiPick,
    emojiAllowedIds,
  };
}
