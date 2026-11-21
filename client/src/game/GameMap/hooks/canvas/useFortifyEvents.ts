import type { RefObject } from 'react';
import { useEffect } from 'react';
import { connector } from '../../../../connector';
import { playSound } from '../../../../lib/sounds';
import type { GameState } from '../../../../lib/types';
import { withAnimationDelay } from '../../../animations';

interface FortifiedPayload {
  territoryId: number;
  fromTerritoryId: number;
  playerId: number;
  troopsRemoved?: number;
  troopsAdded?: number;
  path: number[][];
}

export function useFortifyEvents({
  zombieId,
  ownerByIdRef,
  adjustTerritoryTroops,
  slideShips,
  flashArrowRuns,
  animateAdd,
  animateRemove,
  staggerTroops,
  startAnimationLoop,
}: {
  zombieId: number | null;
  ownerByIdRef: RefObject<Map<number, GameState['territories'][number]>>;
  adjustTerritoryTroops: (
    deltas: { territoryId: number; delta: number }[],
  ) => void;
  slideShips: (
    pathRuns: number[][],
    shipOwnerId: number | undefined,
    actionInMs?: number,
  ) => number;
  flashArrowRuns: (pathRuns: number[][], shipOwnerId?: number) => void;
  animateAdd: (payload: { territoryId: number; troops: number }) => void;
  animateRemove: (payload: { territoryId: number; troops: number }) => void;
  staggerTroops: (territoryIds: number[], play: () => void) => void;
  startAnimationLoop: () => void;
}) {
  useEffect(() => {
    function onFortified(payload: FortifiedPayload) {
      const play = () => {
        playSound('fortify');
        const shipOwnerId = ownerByIdRef.current.get(
          payload.fromTerritoryId,
        )?.ownerId;
        withAnimationDelay(slideShips(payload.path, shipOwnerId), () => {
          flashArrowRuns(payload.path, shipOwnerId);
          if (payload.troopsRemoved !== undefined)
            animateRemove({
              territoryId: payload.fromTerritoryId,
              troops: payload.troopsRemoved,
            });
          if (payload.troopsAdded !== undefined)
            animateAdd({
              territoryId: payload.territoryId,
              troops: payload.troopsAdded,
            });
        });
        startAnimationLoop();
      };
      const deltas: { territoryId: number; delta: number }[] = [];
      if (payload.troopsRemoved !== undefined)
        deltas.push({
          territoryId: payload.fromTerritoryId,
          delta: -payload.troopsRemoved,
        });
      if (payload.troopsAdded !== undefined)
        deltas.push({
          territoryId: payload.territoryId,
          delta: payload.troopsAdded,
        });
      const zombie = zombieId !== null && payload.playerId === zombieId;
      if (zombie)
        staggerTroops([payload.fromTerritoryId, payload.territoryId], play);
      if (deltas.length > 0) adjustTerritoryTroops(deltas);
      if (!zombie) play();
    }
    connector.on('game:fortified', onFortified);
    return () => {
      connector.off('game:fortified', onFortified);
    };
  }, [
    zombieId,
    ownerByIdRef,
    adjustTerritoryTroops,
    slideShips,
    flashArrowRuns,
    animateAdd,
    animateRemove,
    staggerTroops,
    startAnimationLoop,
  ]);
}
