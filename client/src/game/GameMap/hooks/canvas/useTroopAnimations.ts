import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { playerColor } from '../../../../lib/palette';
import type { GameState } from '../../../../lib/types';
import {
  areAnimationsDisabled,
  getAnimationDuration,
  startAnimation,
} from '../../../animations';
import { formatTroops } from '../../../logic/formatTroops';

const MAX_STAGGER_MS = 2000;

export function useTroopAnimations({
  colorByPlayerIdRef,
  ownerByIdRef,
  frozenTroopsRef,
  findPosition,
  startAnimationLoop,
}: {
  colorByPlayerIdRef: RefObject<Map<number, number>>;
  ownerByIdRef: RefObject<Map<number, GameState['territories'][number]>>;
  frozenTroopsRef: RefObject<Map<number, number>>;
  findPosition: (id: number) => { x: number; y: number } | undefined;
  startAnimationLoop: () => void;
}) {
  const pendingRefundsRef = useRef(
    new Map<
      number,
      { timer: ReturnType<typeof setTimeout>; fire: () => void }
    >(),
  );

  const colorForPlayer = useCallback(
    (playerId: number | undefined): string => {
      if (playerId === undefined) return '#ffffff';
      const colorIndex = colorByPlayerIdRef.current.get(playerId);
      return colorIndex !== undefined ? playerColor(colorIndex) : '#ffffff';
    },
    [colorByPlayerIdRef],
  );

  const animateTroopChange = useCallback(
    (
      kind: 'add' | 'remove',
      {
        territoryId,
        troops,
        playerId,
      }: {
        territoryId: number;
        troops: number;
        playerId?: number;
      },
      arrowPath?: { x: number; y: number }[][],
      arrowFades?: ('start' | 'end' | undefined)[][],
    ) => {
      if (areAnimationsDisabled()) return;
      const territory = findPosition(territoryId);
      const ownerId =
        playerId ?? ownerByIdRef.current.get(territoryId)?.ownerId;
      if (territory)
        startAnimation(
          kind,
          territory.x,
          territory.y,
          `${kind === 'add' ? '+' : '-'}${formatTroops(troops)}`,
          colorForPlayer(ownerId),
          arrowPath,
          arrowFades,
        );
    },
    [colorForPlayer, findPosition, ownerByIdRef],
  );

  const animateAdd = useCallback(
    (
      payload: { territoryId: number; troops: number; playerId?: number },
      arrowPath?: { x: number; y: number }[][],
      arrowFades?: ('start' | 'end' | undefined)[][],
    ) => animateTroopChange('add', payload, arrowPath, arrowFades),
    [animateTroopChange],
  );

  const animateRemove = useCallback(
    (
      payload: { territoryId: number; troops: number; playerId?: number },
      arrowPath?: { x: number; y: number }[][],
      arrowFades?: ('start' | 'end' | undefined)[][],
    ) => animateTroopChange('remove', payload, arrowPath, arrowFades),
    [animateTroopChange],
  );

  const scheduleRefund = useCallback(
    (territoryId: number, troops: number, delayMs: number) => {
      const fire = () => {
        pendingRefundsRef.current.delete(territoryId);
        frozenTroopsRef.current.delete(territoryId);
        animateAdd({ territoryId, troops });
        startAnimationLoop();
      };
      pendingRefundsRef.current.set(territoryId, {
        timer: setTimeout(fire, delayMs),
        fire,
      });
    },
    [animateAdd, frozenTroopsRef, startAnimationLoop],
  );

  const staggeredCountRef = useRef(new Map<number, number>());
  const staggerTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = staggerTimersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  const staggerTroops = useCallback(
    (territoryIds: number[], play: () => void) => {
      if (areAnimationsDisabled()) return play();
      const frozen = frozenTroopsRef.current;
      const counts = staggeredCountRef.current;
      const timers = staggerTimersRef.current;
      const owned: number[] = [];
      for (const id of territoryIds) {
        const count = counts.get(id);
        if (count === undefined && frozen.has(id)) continue;
        if (count === undefined)
          frozen.set(id, ownerByIdRef.current.get(id)?.troops ?? 0);
        counts.set(id, (count ?? 0) + 1);
        owned.push(id);
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        play();
        for (const id of owned) {
          const left = (counts.get(id) ?? 1) - 1;
          if (left > 0) {
            counts.set(id, left);
          } else {
            counts.delete(id);
            frozen.delete(id);
          }
        }
        startAnimationLoop();
      }, Math.random() * MAX_STAGGER_MS);
      timers.add(timer);
    },
    [frozenTroopsRef, ownerByIdRef, startAnimationLoop],
  );

  const afterRefund = useCallback((territoryId: number, play: () => void) => {
    const pending = pendingRefundsRef.current.get(territoryId);
    if (!pending) return play();
    clearTimeout(pending.timer);
    pending.fire();
    setTimeout(play, getAnimationDuration('add'));
  }, []);

  return {
    colorForPlayer,
    animateAdd,
    animateRemove,
    scheduleRefund,
    staggerTroops,
    afterRefund,
  };
}
