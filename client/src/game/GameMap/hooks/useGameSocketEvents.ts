import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { connector } from '../../../connector';
import { playerColor } from '../../../lib/palette';
import { playSound } from '../../../lib/sounds';
import type {
  Fortification,
  GameState,
  ReplayAnimation,
} from '../../../lib/types';
import {
  areAnimationsDisabled,
  DICE_ROLL_STEP_DURATION,
  DICE_ROLL_STEPS,
  getAnimationDuration,
  hasActiveAnimations,
  onAnimationsToggle,
  pruneAnimations,
  startAnimation,
} from '../../animations';
import { getFortifyPath } from '../../logic/fortify';
import type { Territory } from '../../mapData';
import { isPortalHop } from '../../portals';
import type { ReplayData } from '../../replay';
import { useReplay } from '../../replay';
import type { Point } from '../helpers';

export function useGameSocketEvents({
  showReplay,
  replayData,
  fortification,
  portalTerritoryIds,
  portalsEnabled,
  visibleTerritoryIds,
  radiationTerritoryIds,
  territoriesRef,
  ownerByIdRef,
  colorByPlayerIdRef,
  visibleTerritoryIdsRef,
  adjustTerritoryTroops,
  adjustToxinTerritories,
  setRadiationTerritoryIds,
  setRadiationUpcomingTerritoryIds,
}: {
  showReplay: boolean;
  replayData?: ReplayData | null;
  fortification: Fortification;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  radiationTerritoryIds: number[];
  territoriesRef: RefObject<Territory[]>;
  ownerByIdRef: RefObject<Map<number, GameState['territories'][number]>>;
  colorByPlayerIdRef: RefObject<Map<number, number>>;
  visibleTerritoryIdsRef: RefObject<GameState['visibleTerritoryIds']>;
  adjustTerritoryTroops: (
    deltas: { territoryId: number; delta: number; ownerId?: number }[],
  ) => void;
  adjustToxinTerritories: (
    changes: (
      | { territoryId: number; remove: true }
      | { territoryId: number; permanent: boolean; roundsRemaining: number }
    )[],
  ) => void;
  setRadiationTerritoryIds: (territoryIds: number[]) => void;
  setRadiationUpcomingTerritoryIds: (territoryIds: number[]) => void;
}) {
  const [, forceRedraw] = useState(0);
  const animationLoopActiveRef = useRef(false);
  const frozenTroopsRef = useRef<Map<number, number>>(new Map());
  const frozenOwnerRef = useRef<Map<number, number>>(new Map());
  const attackRevealDeadlineRef = useRef<Map<number, number>>(new Map());
  const frozenVisibleTerritoryIdsRef = useRef<Set<number> | null>(null);
  const frozenTerritoryDataRef = useRef(
    new Map<number, GameState['territories'][number]>(),
  );
  const toxinPlacedAtRef = useRef<Map<number, number>>(new Map());
  const radiationPlacedAtRef = useRef<Map<number, number>>(new Map());
  const [tankFireId, setTankFireId] = useState(0);

  const startAnimationLoop = useCallback(() => {
    if (animationLoopActiveRef.current) return;
    animationLoopActiveRef.current = true;
    function step() {
      pruneAnimations();
      forceRedraw((n) => n + 1);
      if (hasActiveAnimations()) {
        requestAnimationFrame(step);
      } else {
        animationLoopActiveRef.current = false;
      }
    }
    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    return onAnimationsToggle(() => {
      if (areAnimationsDisabled()) {
        frozenTroopsRef.current.clear();
        frozenOwnerRef.current.clear();
      }
      startAnimationLoop();
    });
  }, [startAnimationLoop]);

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
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      const ownerId =
        playerId ?? ownerByIdRef.current.get(territoryId)?.ownerId;
      if (territory)
        startAnimation(
          kind,
          territory.x,
          territory.y,
          `${kind === 'add' ? '+' : '-'}${troops}`,
          colorForPlayer(ownerId),
          arrowPath,
          arrowFades,
        );
    },
    [colorForPlayer, territoriesRef, ownerByIdRef],
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

  const explode = useCallback(
    (territoryId: number) => {
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      if (!territory) return;
      startAnimation('explosion', territory.x, territory.y);
    },
    [territoriesRef],
  );

  const entrenchEffect = useCallback(
    (territoryId: number) => {
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      if (!territory) return;
      startAnimation('entrench', territory.x, territory.y);
    },
    [territoriesRef],
  );

  const toxinPlaceEffect = useCallback((territoryId: number) => {
    toxinPlacedAtRef.current.set(territoryId, performance.now());
  }, []);

  const radiationPlaceEffect = useCallback((territoryIds: number[]) => {
    const now = performance.now();
    for (const territoryId of territoryIds)
      radiationPlacedAtRef.current.set(territoryId, now);
  }, []);

  const animateStarve = useCallback(
    ({ territoryId, troops }: { territoryId: number; troops: number }) => {
      if (areAnimationsDisabled()) return;
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      const ownerId = ownerByIdRef.current.get(territoryId)?.ownerId;
      if (territory)
        startAnimation(
          'starve',
          territory.x,
          territory.y,
          `-${troops}`,
          colorForPlayer(ownerId),
        );
    },
    [colorForPlayer, territoriesRef, ownerByIdRef],
  );

  const territoryPoints = useCallback(
    (territoryIds: number[]): Point[] =>
      territoryIds
        .map((id) => territoriesRef.current.find((t) => t.id === id))
        .filter((t): t is Territory => !!t)
        .map((t) => ({ x: t.x, y: t.y })),
    [territoriesRef],
  );

  const idRunsForPath = useCallback(
    (territoryIds: number[]): number[][] => {
      const runs: number[][] = [];
      let current: number[] = [];
      for (let i = 0; i < territoryIds.length; i++) {
        if (
          i > 0 &&
          isPortalHop(
            territoryIds[i - 1],
            territoryIds[i],
            portalTerritoryIds,
            portalsEnabled,
          )
        ) {
          if (current.length > 1) runs.push(current);
          current = [];
        }
        current.push(territoryIds[i]);
      }
      if (current.length > 1) runs.push(current);
      return runs;
    },
    [portalTerritoryIds, portalsEnabled],
  );

  const arrowRunsForPath = useCallback(
    (territoryIds: number[]): Point[][] =>
      idRunsForPath(territoryIds)
        .map((run) => territoryPoints(run))
        .filter((points) => points.length > 1),
    [idRunsForPath, territoryPoints],
  );

  const arrowForPath = useCallback(
    (
      pathRuns: number[][],
    ): {
      runs?: Point[][];
      fades?: ('start' | 'end' | undefined)[][];
    } => {
      const visible = visibleTerritoryIds ? new Set(visibleTerritoryIds) : null;
      const runs: Point[][] = [];
      const fades: ('start' | 'end' | undefined)[][] = [];
      for (const pathRun of pathRuns) {
        for (const idRun of idRunsForPath(pathRun)) {
          let currentIds: number[] = [idRun[0]];
          let currentFades: ('start' | 'end' | undefined)[] = [];
          const flush = () => {
            if (currentIds.length > 1) {
              runs.push(territoryPoints(currentIds));
              fades.push(currentFades);
            }
          };
          for (let i = 1; i < idRun.length; i++) {
            const fromId = idRun[i - 1];
            const toId = idRun[i];
            const fromVisible = !visible || visible.has(fromId);
            const toVisible = !visible || visible.has(toId);
            if (!fromVisible && !toVisible) {
              flush();
              currentIds = [toId];
              currentFades = [];
              continue;
            }
            currentIds.push(toId);
            currentFades.push(
              fromVisible && toVisible
                ? undefined
                : fromVisible
                  ? 'end'
                  : 'start',
            );
          }
          flush();
        }
      }
      if (runs.length === 0) return {};
      return { runs, fades };
    },
    [idRunsForPath, territoryPoints, visibleTerritoryIds],
  );

  const flashArrowRuns = useCallback(
    (pathRuns: number[][]) => {
      if (areAnimationsDisabled()) return;
      const arrow = arrowForPath(pathRuns);
      if (!arrow.runs || arrow.runs.length === 0) return;
      const lastRun = arrow.runs[arrow.runs.length - 1];
      const anchor = lastRun[lastRun.length - 1];
      startAnimation(
        'arrow',
        anchor.x,
        anchor.y,
        undefined,
        undefined,
        arrow.runs,
        arrow.fades,
      );
    },
    [arrowForPath],
  );

  const flashArrow = useCallback(
    (territoryIds: number[]) => flashArrowRuns([territoryIds]),
    [flashArrowRuns],
  );

  const playAttackLossEffects = useCallback(
    (
      attackingTerritoryId: number,
      defendingTerritoryId: number,
      attackerId: number,
      defenderId: number | undefined,
      attackLosses: number,
      defenceLosses: number,
      arrowPath?: Point[][],
    ) => {
      if (defenceLosses > 0) {
        explode(defendingTerritoryId);
        animateRemove(
          {
            territoryId: defendingTerritoryId,
            troops: defenceLosses,
            playerId: defenderId,
          },
          arrowPath,
        );
        if (attackLosses > 0) {
          explode(attackingTerritoryId);
          animateRemove({
            territoryId: attackingTerritoryId,
            troops: attackLosses,
            playerId: attackerId,
          });
        }
      } else if (attackLosses > 0) {
        explode(attackingTerritoryId);
        animateRemove(
          {
            territoryId: attackingTerritoryId,
            troops: attackLosses,
            playerId: attackerId,
          },
          arrowPath,
        );
      }
    },
    [explode, animateRemove],
  );

  const playFrameAnimation = useCallback(
    (animation: ReplayAnimation, partOfConquestPair: boolean) => {
      if (animation.type === 'deploy') {
        playSound('deploy');
        animateAdd({
          territoryId: animation.territoryId,
          troops: animation.troops,
          playerId: animation.playerId,
        });
      } else if (animation.type === 'fortify') {
        playSound('fortify');
        let arrowPath: Point[][] | undefined;
        if (!partOfConquestPair) {
          const pathIds = getFortifyPath(
            territoriesRef.current,
            ownerByIdRef.current,
            animation.playerId,
            animation.fromTerritoryId,
            animation.toTerritoryId,
            fortification,
            portalTerritoryIds,
            portalsEnabled,
          );
          arrowPath = arrowRunsForPath(
            pathIds.length > 1
              ? pathIds
              : [animation.fromTerritoryId, animation.toTerritoryId],
          );
        }
        animateRemove({
          territoryId: animation.fromTerritoryId,
          troops: animation.troops,
          playerId: animation.playerId,
        });
        animateAdd(
          {
            territoryId: animation.toTerritoryId,
            troops: animation.troops,
            playerId: animation.playerId,
          },
          arrowPath,
        );
      } else if (animation.type === 'entrench') {
        playSound('entrench');
        entrenchEffect(animation.territoryId);
        animateRemove({
          territoryId: animation.territoryId,
          troops: animation.troops,
          playerId: animation.playerId,
        });
      } else if (animation.type === 'starve') {
        animateStarve({
          territoryId: animation.territoryId,
          troops: animation.troops,
        });
      } else if (animation.type === 'toxins') {
        playSound('toxins');
        toxinPlaceEffect(animation.territoryId);
      } else {
        if (animation.defenderId !== undefined) playSound('explode');
        const arrowPath = partOfConquestPair
          ? undefined
          : arrowRunsForPath([
              animation.attackingTerritoryId,
              animation.defendingTerritoryId,
            ]);
        playAttackLossEffects(
          animation.attackingTerritoryId,
          animation.defendingTerritoryId,
          animation.attackerId,
          animation.defenderId,
          animation.attackLosses,
          animation.defenceLosses,
          arrowPath,
        );
      }
      startAnimationLoop();
    },
    [
      animateAdd,
      animateRemove,
      entrenchEffect,
      animateStarve,
      toxinPlaceEffect,
      playAttackLossEffects,
      arrowRunsForPath,
      fortification,
      portalTerritoryIds,
      portalsEnabled,
      territoriesRef,
      ownerByIdRef,
      startAnimationLoop,
    ],
  );

  const replay = useReplay(
    replayData
      ? { kind: 'static', data: replayData }
      : { kind: 'live', enabled: showReplay },
    playFrameAnimation,
  );

  useEffect(() => {
    function playAddEffect(
      sound: string,
      payload: { territoryId: number; troops: number },
    ) {
      playSound(sound);
      adjustTerritoryTroops([
        { territoryId: payload.territoryId, delta: payload.troops },
      ]);
      animateAdd(payload);
      startAnimationLoop();
    }
    function onDeployed(payload: { territoryId: number; troops: number }) {
      playAddEffect('deploy', payload);
    }
    function onFortified(payload: {
      territoryId: number;
      fromTerritoryId: number;
      troopsRemoved?: number;
      troopsAdded?: number;
      path: number[][];
    }) {
      playSound('fortify');
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
      if (deltas.length > 0) adjustTerritoryTroops(deltas);
      flashArrowRuns(payload.path);
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
      startAnimationLoop();
    }
    function onAttackMoved(payload: {
      territoryId: number;
      fromTerritoryId: number;
      troopsAdded?: number;
    }) {
      if (payload.troopsAdded !== undefined)
        adjustTerritoryTroops([
          { territoryId: payload.territoryId, delta: payload.troopsAdded },
        ]);
      const deadline = attackRevealDeadlineRef.current.get(payload.territoryId);
      const pendingDelay = deadline
        ? Math.max(0, deadline - performance.now())
        : 0;
      const fireAnimation = () => {
        playSound('fortify');
        flashArrow([payload.fromTerritoryId, payload.territoryId]);
        if (payload.troopsAdded !== undefined)
          animateAdd({
            territoryId: payload.territoryId,
            troops: payload.troopsAdded,
          });
        startAnimationLoop();
      };
      if (pendingDelay > 0) setTimeout(fireAnimation, pendingDelay);
      else fireAnimation();
    }
    function onDeployedMany(payload: {
      deposits: { territoryId: number; troops: number }[];
    }) {
      playSound('deploy');
      adjustTerritoryTroops(
        payload.deposits.map((d) => ({
          territoryId: d.territoryId,
          delta: d.troops,
        })),
      );
      for (const deposit of payload.deposits) animateAdd(deposit);
      startAnimationLoop();
    }
    function onEntrenched(payload: {
      territoryId: number;
      troops: number;
      turnsRemaining: number;
    }) {
      playSound('entrench');
      adjustTerritoryTroops([
        { territoryId: payload.territoryId, delta: -payload.troops },
      ]);
      entrenchEffect(payload.territoryId);
      animateRemove(payload);
      startAnimationLoop();
    }
    function onStarved(payload: {
      losses: { territoryId: number; troops: number }[];
    }) {
      for (const loss of payload.losses) animateStarve(loss);
      adjustTerritoryTroops(
        payload.losses.map((l) => ({
          territoryId: l.territoryId,
          delta: -l.troops,
        })),
      );
      startAnimationLoop();
    }
    function onToxined(payload: {
      territoryId: number;
      permanent: boolean;
      roundsRemaining: number;
    }) {
      playSound('toxins');
      toxinPlaceEffect(payload.territoryId);
      adjustToxinTerritories([
        {
          territoryId: payload.territoryId,
          permanent: payload.permanent,
          roundsRemaining: payload.roundsRemaining,
        },
      ]);
      startAnimationLoop();
    }
    function onToxinExpired(payload: { territoryIds: number[] }) {
      adjustToxinTerritories(
        payload.territoryIds.map((territoryId) => ({
          territoryId,
          remove: true,
        })),
      );
    }
    function onRadiationUpcoming(payload: { territoryIds: number[] }) {
      setRadiationUpcomingTerritoryIds(payload.territoryIds);
    }
    function onRadiationChanged(payload: {
      territoryIds: number[];
      eliminatedPlayerIds: number[];
    }) {
      const newlyRadiated = payload.territoryIds.filter(
        (id) => !radiationTerritoryIds.includes(id),
      );
      if (newlyRadiated.length > 0) playSound('radiation');
      radiationPlaceEffect(newlyRadiated);
      setRadiationTerritoryIds(payload.territoryIds);
      setRadiationUpcomingTerritoryIds([]);
      startAnimationLoop();
    }
    connector.on('game:deployed', onDeployed);
    connector.on('game:fortified', onFortified);
    connector.on('game:attackMoved', onAttackMoved);
    connector.on('game:deployedMany', onDeployedMany);
    connector.on('game:entrenched', onEntrenched);
    connector.on('game:starved', onStarved);
    connector.on('game:toxined', onToxined);
    connector.on('game:toxinExpired', onToxinExpired);
    connector.on('game:radiationUpcoming', onRadiationUpcoming);
    connector.on('game:radiationChanged', onRadiationChanged);
    return () => {
      connector.off('game:deployed', onDeployed);
      connector.off('game:fortified', onFortified);
      connector.off('game:attackMoved', onAttackMoved);
      connector.off('game:deployedMany', onDeployedMany);
      connector.off('game:entrenched', onEntrenched);
      connector.off('game:starved', onStarved);
      connector.off('game:toxined', onToxined);
      connector.off('game:toxinExpired', onToxinExpired);
      connector.off('game:radiationUpcoming', onRadiationUpcoming);
      connector.off('game:radiationChanged', onRadiationChanged);
    };
  }, [
    animateAdd,
    animateRemove,
    entrenchEffect,
    animateStarve,
    adjustTerritoryTroops,
    toxinPlaceEffect,
    adjustToxinTerritories,
    radiationPlaceEffect,
    radiationTerritoryIds,
    setRadiationTerritoryIds,
    setRadiationUpcomingTerritoryIds,
    flashArrow,
    flashArrowRuns,
    startAnimationLoop,
  ]);

  useEffect(() => {
    function onAttacked(payload: {
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      defenderId?: number;
      attackingTroops?: number;
      defendingTroops?: number;
      attackLosses?: number;
      defenceLosses?: number;
      conquered?: boolean;
      type: 'regular' | 'blitz';
    }) {
      const attackLosses = payload.attackLosses ?? 0;
      const defenceLosses = payload.defenceLosses ?? 0;
      const conquered = payload.conquered ?? false;
      const freeConquest = payload.defenderId === undefined;
      const delay =
        payload.type === 'regular' && !freeConquest
          ? DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION
          : 0;

      if (conquered && visibleTerritoryIdsRef.current) {
        frozenVisibleTerritoryIdsRef.current = new Set(
          visibleTerritoryIdsRef.current,
        );
        const snapshot = new Map(ownerByIdRef.current);
        const priorDefender = snapshot.get(payload.defendingTerritoryId);
        snapshot.set(payload.defendingTerritoryId, {
          id: payload.defendingTerritoryId,
          ownerId: payload.attackerId,
          troops: Math.max(0, (payload.defendingTroops ?? 0) - defenceLosses),
          isCapital: priorDefender?.isCapital ?? false,
          entrenchedTurns: 0,
        });
        frozenTerritoryDataRef.current = snapshot;
        startAnimationLoop();
        setTimeout(
          () => {
            frozenVisibleTerritoryIdsRef.current = null;
            frozenTerritoryDataRef.current = new Map();
            startAnimationLoop();
          },
          delay + getAnimationDuration('explosion'),
        );
      }

      const deltas: {
        territoryId: number;
        delta: number;
        ownerId?: number;
      }[] = [];
      if (attackLosses > 0)
        deltas.push({
          territoryId: payload.attackingTerritoryId,
          delta: -attackLosses,
        });
      if (defenceLosses > 0 || conquered)
        deltas.push({
          territoryId: payload.defendingTerritoryId,
          delta: -defenceLosses,
          ownerId: conquered ? payload.attackerId : undefined,
        });
      if (deltas.length > 0) adjustTerritoryTroops(deltas);

      if (
        payload.type === 'regular' &&
        payload.defenderId !== undefined &&
        !areAnimationsDisabled()
      ) {
        const defenderId = payload.defenderId;
        const revealAt = performance.now() + delay;
        attackRevealDeadlineRef.current.set(
          payload.attackingTerritoryId,
          revealAt,
        );
        attackRevealDeadlineRef.current.set(
          payload.defendingTerritoryId,
          revealAt,
        );
        if (conquered)
          frozenOwnerRef.current.set(payload.defendingTerritoryId, defenderId);
        const attackerTroops = ownerByIdRef.current.get(
          payload.attackingTerritoryId,
        )?.troops;
        if (attackerTroops !== undefined)
          frozenTroopsRef.current.set(
            payload.attackingTerritoryId,
            attackerTroops,
          );
        const defenderTroops = ownerByIdRef.current.get(
          payload.defendingTerritoryId,
        )?.troops;
        if (defenderTroops !== undefined)
          frozenTroopsRef.current.set(
            payload.defendingTerritoryId,
            defenderTroops,
          );
      }
      setTimeout(() => {
        if (!freeConquest) playSound('explode');
        flashArrow([
          payload.attackingTerritoryId,
          payload.defendingTerritoryId,
        ]);
        frozenTroopsRef.current.delete(payload.attackingTerritoryId);
        frozenTroopsRef.current.delete(payload.defendingTerritoryId);
        if (attackLosses > 0) {
          explode(payload.attackingTerritoryId);
          animateRemove({
            territoryId: payload.attackingTerritoryId,
            troops: attackLosses,
            playerId: payload.attackerId,
          });
        }
        if (defenceLosses > 0) {
          if (conquered)
            frozenOwnerRef.current.delete(payload.defendingTerritoryId);
          explode(payload.defendingTerritoryId);
          animateRemove({
            territoryId: payload.defendingTerritoryId,
            troops: defenceLosses,
            playerId: payload.defenderId,
          });
        }
        startAnimationLoop();
      }, delay);
    }
    connector.on('game:attacked', onAttacked);
    return () => {
      connector.off('game:attacked', onAttacked);
    };
  }, [
    explode,
    animateRemove,
    adjustTerritoryTroops,
    flashArrow,
    ownerByIdRef,
    visibleTerritoryIdsRef,
    startAnimationLoop,
  ]);

  useEffect(() => {
    function onTankFired(payload: {
      type: 'regular' | 'blitz';
      hasDefender: boolean;
    }) {
      const delay =
        payload.type === 'regular' && payload.hasDefender
          ? DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION
          : 0;
      setTimeout(() => setTankFireId((id) => id + 1), delay);
    }
    connector.on('game:tankFired', onTankFired);
    return () => {
      connector.off('game:tankFired', onTankFired);
    };
  }, []);

  useEffect(() => {
    function onSelected() {
      playSound('select');
    }
    connector.on('game:selected', onSelected);
    return () => {
      connector.off('game:selected', onSelected);
    };
  }, []);

  useEffect(() => {
    function onTerritoryClaimed(payload: {
      territoryId: number;
      playerId: number;
    }) {
      playSound('select');
      playSound('deploy');
      animateAdd({
        territoryId: payload.territoryId,
        troops: 1,
        playerId: payload.playerId,
      });
      startAnimationLoop();
    }
    connector.on('game:territoryClaimed', onTerritoryClaimed);
    return () => {
      connector.off('game:territoryClaimed', onTerritoryClaimed);
    };
  }, [animateAdd, startAnimationLoop]);

  return {
    frozenTroopsRef,
    frozenOwnerRef,
    frozenVisibleTerritoryIdsRef,
    frozenTerritoryDataRef,
    toxinPlacedAtRef,
    radiationPlacedAtRef,
    tankFireId,
    startAnimationLoop,
    replay,
  };
}
