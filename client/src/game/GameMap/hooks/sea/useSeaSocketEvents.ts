import type { MutableRefObject, RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { connector } from '../../../../connector';
import { playSound } from '../../../../lib/sounds';
import type { GameState, ReplayAnimation } from '../../../../lib/types';
import {
  areAnimationsDisabled,
  DICE_ROLL_STEP_DURATION,
  DICE_ROLL_STEPS,
} from '../../../animations';
import { getSailPath } from '../../../logic/sail';
import type { SeaTerritory, Territory } from '../../../mapData';
import type { Point } from '../../helpers';
import { useAnimationPathHelpers } from '../useAnimationPathHelpers';
import { SHIP_COST } from './useDeploySeaFlow';

type SeaFrameAnimation = Extract<
  ReplayAnimation,
  { type: 'buyShips' | 'sail' | 'attackSea' }
>;

export function useSeaSocketEvents({
  territoriesRef,
  seaTerritoriesRef,
  seasRef,
  portalTerritoryIds,
  portalsEnabled,
  visibleTerritoryIdsRef,
  frozenVisibleTerritoryIdsRef,
  frozenVisibleOwnersRef,
  nextFreezeIdRef,
  adjustTerritoryTroops,
  animateAdd,
  animateRemove,
  explode,
  flashArrowRuns,
  startAnimationLoop,
}: {
  territoriesRef: RefObject<Territory[]>;
  seaTerritoriesRef: RefObject<SeaTerritory[]>;
  seasRef: RefObject<GameState['seas']>;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  visibleTerritoryIdsRef: RefObject<GameState['visibleTerritoryIds']>;
  frozenVisibleTerritoryIdsRef: MutableRefObject<Set<number> | null>;
  frozenVisibleOwnersRef: RefObject<Set<number>>;
  nextFreezeIdRef: MutableRefObject<number>;
  adjustTerritoryTroops: (
    deltas: { territoryId: number; delta: number; ownerId?: number }[],
  ) => void;
  animateAdd: (
    payload: { territoryId: number; troops: number; playerId?: number },
    arrowPath?: Point[][],
    arrowFades?: ('start' | 'end' | undefined)[][],
  ) => void;
  animateRemove: (
    payload: { territoryId: number; troops: number; playerId?: number },
    arrowPath?: Point[][],
    arrowFades?: ('start' | 'end' | undefined)[][],
  ) => void;
  explode: (territoryId: number) => void;
  flashArrowRuns: (pathRuns: number[][]) => void;
  startAnimationLoop: () => void;
}) {
  const frozenSeaShipsRef = useRef<
    Map<number, GameState['seas'][number]['ships']>
  >(new Map());

  const { arrowRunsForPath } = useAnimationPathHelpers({
    territoriesRef,
    seaTerritoriesRef,
    portalTerritoryIds,
    portalsEnabled,
  });

  const playSeaFrameAnimation = useCallback(
    (animation: SeaFrameAnimation) => {
      if (animation.type === 'buyShips') {
        playSound('deploy');
        animateAdd({
          territoryId: animation.seaTerritoryId,
          troops: animation.ships,
          playerId: animation.playerId,
        });
      } else if (animation.type === 'sail') {
        playSound('fortify');
        const pathIds = getSailPath(
          seaTerritoriesRef.current,
          animation.fromSeaTerritoryId,
          animation.toSeaTerritoryId,
        );
        const arrowPath = arrowRunsForPath(
          pathIds.length > 1
            ? pathIds
            : [animation.fromSeaTerritoryId, animation.toSeaTerritoryId],
        );
        animateRemove({
          territoryId: animation.fromSeaTerritoryId,
          troops: animation.ships,
          playerId: animation.playerId,
        });
        animateAdd(
          {
            territoryId: animation.toSeaTerritoryId,
            troops: animation.ships,
            playerId: animation.playerId,
          },
          arrowPath,
        );
      } else {
        if (animation.attackLosses > 0 || animation.defenceLosses > 0) {
          playSound('explode');
          explode(animation.seaTerritoryId);
        }
        if (animation.attackLosses > 0)
          animateRemove({
            territoryId: animation.seaTerritoryId,
            troops: animation.attackLosses,
            playerId: animation.attackerId,
          });
        if (animation.defenceLosses > 0)
          animateRemove({
            territoryId: animation.seaTerritoryId,
            troops: animation.defenceLosses,
            playerId: animation.defenderId,
          });
      }
    },
    [animateAdd, animateRemove, explode, seaTerritoriesRef, arrowRunsForPath],
  );

  useEffect(() => {
    function onShipsBought(payload: {
      sourceTerritoryId: number;
      seaTerritoryId: number;
      ships: number;
      fromPool: boolean;
      playerId: number;
    }) {
      playSound('deploy');
      if (!payload.fromPool) {
        adjustTerritoryTroops([
          {
            territoryId: payload.sourceTerritoryId,
            delta: -payload.ships * SHIP_COST,
          },
        ]);
        animateRemove({
          territoryId: payload.sourceTerritoryId,
          troops: payload.ships * SHIP_COST,
          playerId: payload.playerId,
        });
      }
      animateAdd({
        territoryId: payload.seaTerritoryId,
        troops: payload.ships,
        playerId: payload.playerId,
      });
      startAnimationLoop();
    }
    function onSailed(payload: {
      seaTerritoryId: number;
      fromSeaTerritoryId: number;
      playerId: number;
      path: number[][];
      shipsRemoved?: number;
      shipsAdded?: number;
    }) {
      playSound('fortify');
      flashArrowRuns(payload.path);
      if (payload.shipsRemoved !== undefined)
        animateRemove({
          territoryId: payload.fromSeaTerritoryId,
          troops: payload.shipsRemoved,
          playerId: payload.playerId,
        });
      if (payload.shipsAdded !== undefined)
        animateAdd({
          territoryId: payload.seaTerritoryId,
          troops: payload.shipsAdded,
          playerId: payload.playerId,
        });
      startAnimationLoop();
    }
    connector.on('game:shipsBought', onShipsBought);
    connector.on('game:sailed', onSailed);
    return () => {
      connector.off('game:shipsBought', onShipsBought);
      connector.off('game:sailed', onSailed);
    };
  }, [
    animateAdd,
    animateRemove,
    adjustTerritoryTroops,
    flashArrowRuns,
    startAnimationLoop,
  ]);

  useEffect(() => {
    function onSeaAttacked(payload: {
      seaTerritoryId: number;
      attackerId: number;
      defenderId: number;
      type: 'regular' | 'blitz';
      attackingShips: number;
      attackLosses: number;
      defendingShips: number;
      defenceLosses: number;
    }) {
      const delay =
        payload.type === 'regular' && !areAnimationsDisabled()
          ? DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION
          : 0;
      const wipedOut =
        payload.attackingShips - payload.attackLosses <= 0 ||
        payload.defendingShips - payload.defenceLosses <= 0;
      let freezeId: number | null = null;
      if (delay > 0) {
        const current = seasRef.current.find(
          (s) => s.id === payload.seaTerritoryId,
        );
        if (current)
          frozenSeaShipsRef.current.set(payload.seaTerritoryId, current.ships);
        if (wipedOut && visibleTerritoryIdsRef.current) {
          freezeId = ++nextFreezeIdRef.current;
          frozenVisibleOwnersRef.current.add(freezeId);
          if (frozenVisibleTerritoryIdsRef.current === null) {
            frozenVisibleTerritoryIdsRef.current = new Set(
              visibleTerritoryIdsRef.current,
            );
          }
        }
        startAnimationLoop();
      }
      setTimeout(() => {
        frozenSeaShipsRef.current.delete(payload.seaTerritoryId);
        if (freezeId !== null) {
          frozenVisibleOwnersRef.current.delete(freezeId);
          if (frozenVisibleOwnersRef.current.size === 0) {
            frozenVisibleTerritoryIdsRef.current = null;
          }
        }
        if (payload.attackLosses > 0 || payload.defenceLosses > 0) {
          playSound('explode');
          explode(payload.seaTerritoryId);
        }
        if (payload.attackLosses > 0)
          animateRemove({
            territoryId: payload.seaTerritoryId,
            troops: payload.attackLosses,
            playerId: payload.attackerId,
          });
        if (payload.defenceLosses > 0)
          animateRemove({
            territoryId: payload.seaTerritoryId,
            troops: payload.defenceLosses,
            playerId: payload.defenderId,
          });
        startAnimationLoop();
      }, delay);
    }
    connector.on('game:seaAttacked', onSeaAttacked);
    return () => {
      connector.off('game:seaAttacked', onSeaAttacked);
    };
  }, [
    seasRef,
    visibleTerritoryIdsRef,
    frozenVisibleTerritoryIdsRef,
    frozenVisibleOwnersRef,
    nextFreezeIdRef,
    explode,
    animateRemove,
    startAnimationLoop,
  ]);

  return { frozenSeaShipsRef, playSeaFrameAnimation };
}
