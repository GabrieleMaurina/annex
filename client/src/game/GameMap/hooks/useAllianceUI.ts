import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { socket } from '../../../lib/socket';
import { playSound } from '../../../lib/sounds';
import type {
  AllianceDeclinedPayload,
  AllianceFormedPayload,
  AllianceRequestedPayload,
  AllianceTerminatedPayload,
  GameState,
} from '../../../lib/types';

export function useAllianceUI({
  allianceStates,
  playersRef,
  setToasts,
}: {
  allianceStates: GameState['allianceStates'];
  playersRef: RefObject<GameState['players']>;
  setToasts: (
    update: (prev: { id: number; message: string }[]) => {
      id: number;
      message: string;
    }[],
  ) => void;
}) {
  const [alliancePopupFor, setAlliancePopupFor] = useState<number | null>(null);
  const allianceCellRefs = useRef(new Map<number, HTMLElement>());
  const alliancePopupRef = useRef<HTMLDivElement>(null);
  const [allianceCooldownIds, setAllianceCooldownIds] = useState<Set<number>>(
    new Set(),
  );

  function allianceStateWith(playerId: number) {
    return allianceStates.find((a) => a.playerId === playerId)?.state ?? 'none';
  }

  function handleAllianceCellClick(playerId: number) {
    const state = allianceStateWith(playerId);
    if (state === 'none') {
      if (allianceCooldownIds.has(playerId)) return;
      setAlliancePopupFor(null);
      socket.emit('game:offerAlliance', { targetPlayerId: playerId });
    } else if (state === 'requestSent') {
      setAlliancePopupFor(null);
      socket.emit('game:revokeAllianceRequest', { targetPlayerId: playerId });
    } else {
      setAlliancePopupFor((prev) => (prev === playerId ? null : playerId));
    }
  }

  function respondAllianceRequest(fromPlayerId: number, accept: boolean) {
    setAlliancePopupFor(null);
    socket.emit('game:respondAllianceRequest', { fromPlayerId, accept });
  }

  function terminateAlliance(targetPlayerId: number) {
    setAlliancePopupFor(null);
    socket.emit('game:terminateAlliance', { targetPlayerId });
  }

  useEffect(() => {
    function recomputeCooldowns() {
      const now = Date.now();
      setAllianceCooldownIds(
        new Set(
          allianceStates
            .filter(
              (a) => a.cooldownUntil !== undefined && a.cooldownUntil > now,
            )
            .map((a) => a.playerId),
        ),
      );
      return now;
    }
    const now = recomputeCooldowns();
    const timers = allianceStates
      .map((a) => a.cooldownUntil)
      .filter((until): until is number => until !== undefined && until > now)
      .map((until) => setTimeout(recomputeCooldowns, until - now + 50));
    return () => timers.forEach(clearTimeout);
  }, [allianceStates]);

  useEffect(() => {
    function onAllianceRequested(payload: AllianceRequestedPayload) {
      playSound('emoji');
      const name =
        playersRef.current.find((p) => p.id === payload.fromId)?.name ??
        'A player';
      setToasts((prev) => [
        ...prev,
        { id: Date.now(), message: `${name} sent you an alliance request` },
      ]);
    }
    function onAllianceFormed(payload: AllianceFormedPayload) {
      const name =
        playersRef.current.find((p) => p.id === payload.withId)?.name ??
        'A player';
      setToasts((prev) => [
        ...prev,
        { id: Date.now(), message: `Allied with ${name}` },
      ]);
    }
    function onAllianceTerminated(payload: AllianceTerminatedPayload) {
      const name =
        playersRef.current.find((p) => p.id === payload.withId)?.name ??
        'A player';
      setToasts((prev) => [
        ...prev,
        { id: Date.now(), message: `Alliance with ${name} terminated` },
      ]);
    }
    function onAllianceDeclined(payload: AllianceDeclinedPayload) {
      const name =
        playersRef.current.find((p) => p.id === payload.withId)?.name ??
        'A player';
      setToasts((prev) => [
        ...prev,
        { id: Date.now(), message: `${name} declined your alliance request` },
      ]);
    }
    socket.on('game:allianceRequested', onAllianceRequested);
    socket.on('game:allianceFormed', onAllianceFormed);
    socket.on('game:allianceTerminated', onAllianceTerminated);
    socket.on('game:allianceDeclined', onAllianceDeclined);
    return () => {
      socket.off('game:allianceRequested', onAllianceRequested);
      socket.off('game:allianceFormed', onAllianceFormed);
      socket.off('game:allianceTerminated', onAllianceTerminated);
      socket.off('game:allianceDeclined', onAllianceDeclined);
    };
  }, [playersRef, setToasts]);

  useEffect(() => {
    if (alliancePopupFor === null) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (alliancePopupRef.current?.contains(target)) return;
      for (const cell of allianceCellRefs.current.values()) {
        if (cell.contains(target)) return;
      }
      setAlliancePopupFor(null);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [alliancePopupFor]);

  return {
    alliancePopupFor,
    setAlliancePopupFor,
    allianceCellRefs,
    alliancePopupRef,
    allianceCooldownIds,
    allianceStateWith,
    handleAllianceCellClick,
    respondAllianceRequest,
    terminateAlliance,
  };
}
