import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { connector } from '../../../connector';
import { playSound } from '../../../lib/sounds';
import type {
  Fortification,
  GameState,
  LockedTile,
  ReplayAnimation,
} from '../../../lib/types';
import {
  areAnimationsDisabled,
  DICE_ROLL_STEP_DURATION,
  DICE_ROLL_STEPS,
  getAnimationDuration,
  hasActiveAnimations,
  noteCaptureSource,
  onAnimationsToggle,
  pruneAnimations,
  scheduleDiceReveal,
  skipDiceReveals,
  startAnimation,
  startNukeAnimation,
  startUnlockAnimation,
  withAnimationDelay,
} from '../../animations';
import { NUKE_FLIGHT_MS } from '../../animations/state';
import { zombieSounds } from '../../animations/zombie/seat';
import { getAttackPath } from '../../logic/attack';
import { formatTroops } from '../../logic/formatTroops';
import { getFortifyPath } from '../../logic/fortify';
import type { SeaTerritory, Territory } from '../../mapData';
import {
  continentLandsPending,
  type ClickableRegions,
} from '../../regions/clickableRegions';
import type { ReplayData } from '../../replay/replay';
import { useReplay } from '../../replay/replay';
import { insetPolygon, TILE_LINE_WIDTH } from '../../tiles/tileGeometry';
import type { DrawCanvasParams } from '../draw/drawCanvas';
import { drawGameMapCanvas } from '../draw/drawCanvas';
import { layersSettling } from '../draw/layerCache';
import type { Point } from '../helpers';
import { useArrowFlash } from './canvas/useArrowFlash';
import { useFortifyEvents } from './canvas/useFortifyEvents';
import { useMassDeployEvents } from './canvas/useMassDeployEvents';
import { useTroopAnimations } from './canvas/useTroopAnimations';
import { slideShipsAlongPath } from './sea/shipSlides';
import { useSeaSocketEvents } from './sea/useSeaSocketEvents';
import { useAnimationPathHelpers } from './useAnimationPathHelpers';

export function useGameSocketEvents({
  replayData,
  fortification,
  portalTerritoryIds,
  portalsEnabled,
  visibleTerritoryIds,
  radiationTerritoryIds,
  territoriesRef,
  seaTerritoriesRef,
  seasRef,
  lockedTiles,
  regions,
  ownerByIdRef,
  colorByPlayerIdRef,
  zombieId,
  visibleTerritoryIdsRef,
  adjustTerritoryTroops,
  adjustToxinTerritories,
  setRadiationTerritoryIds,
  setRadiationUpcomingTerritoryIds,
}: {
  replayData?: ReplayData | null;
  fortification: Fortification;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  radiationTerritoryIds: number[];
  territoriesRef: RefObject<Territory[]>;
  seaTerritoriesRef: RefObject<SeaTerritory[]>;
  seasRef: RefObject<GameState['seas']>;
  lockedTiles: LockedTile[];
  regions: ClickableRegions | null;
  ownerByIdRef: RefObject<Map<number, GameState['territories'][number]>>;
  colorByPlayerIdRef: RefObject<Map<number, number>>;
  zombieId: number | null;
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
  const drawParamsRef = useRef<DrawCanvasParams | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frozenTroopsRef = useRef<Map<number, number>>(new Map());
  const frozenOwnerRef = useRef<Map<number, number>>(new Map());
  const attackRevealDeadlineRef = useRef<Map<number, number>>(new Map());
  const frozenVisibleTerritoryIdsRef = useRef<Set<number> | null>(null);
  const frozenVisibleOwnersRef = useRef<Set<number>>(new Set());
  const nextFreezeIdRef = useRef(0);
  const frozenTerritoryDataRef = useRef(
    new Map<number, GameState['territories'][number]>(),
  );
  const [tankFire, setTankFire] = useState<{ id: number; dice?: number }>({
    id: 0,
  });

  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current !== null) return;
    function step() {
      pruneAnimations();
      if (drawParamsRef.current) drawGameMapCanvas(drawParamsRef.current);
      animationFrameRef.current =
        hasActiveAnimations() || layersSettling() || continentLandsPending()
          ? requestAnimationFrame(step)
          : null;
    }
    animationFrameRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null)
        cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    },
    [],
  );

  useEffect(() => {
    return onAnimationsToggle(() => {
      if (areAnimationsDisabled()) {
        frozenTroopsRef.current.clear();
        frozenOwnerRef.current.clear();
      }
      startAnimationLoop();
    });
  }, [startAnimationLoop]);

  const { findPosition, territoryPoints, idRunsForPath, arrowRunsForPath } =
    useAnimationPathHelpers({
      territoriesRef,
      seaTerritoriesRef,
      lockedTiles,
      portalTerritoryIds,
      portalsEnabled,
    });

  const {
    colorForPlayer,
    animateAdd,
    animateRemove,
    scheduleRefund,
    staggerTroops,
    afterRefund,
  } = useTroopAnimations({
    colorByPlayerIdRef,
    ownerByIdRef,
    frozenTroopsRef,
    findPosition,
    startAnimationLoop,
  });

  const playMassFrame = useMassDeployEvents({
    zombieId,
    findPosition,
    adjustTerritoryTroops,
    animateAdd,
    staggerTroops,
    startAnimationLoop,
  });

  const regionsRef = useRef(regions);
  useEffect(() => {
    regionsRef.current = regions;
  });

  const slideShips = useCallback(
    (pathRuns: number[][], shipOwnerId: number | undefined, actionInMs = 0) =>
      slideShipsAlongPath(
        pathRuns,
        shipOwnerId,
        regionsRef.current,
        seaTerritoriesRef.current,
        findPosition,
        actionInMs,
      ),
    [seaTerritoriesRef, findPosition],
  );

  const explode = useCallback(
    (territoryId: number) => {
      const territory = findPosition(territoryId);
      if (!territory) return;
      startAnimation('explosion', territory.x, territory.y);
    },
    [findPosition],
  );

  const unlockEffect = useCallback(
    (tileId: number) => {
      const tile = lockedTiles.find((t) => t.id === tileId);
      if (tile)
        startUnlockAnimation({
          ...tile,
          points: insetPolygon(tile.points, TILE_LINE_WIDTH / 2),
        });
      explode(tileId);
    },
    [lockedTiles, explode],
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

  const nukeEffect = useCallback(
    (payload: {
      fromTerritoryId: number;
      targetTerritoryId: number;
      intercepted: boolean;
      interceptFromTerritoryId: number | null;
    }) => {
      const territory = (id: number) =>
        territoriesRef.current.find((t) => t.id === id);
      const target = territory(payload.targetTerritoryId);
      if (!target) return;
      if (areAnimationsDisabled()) {
        playSound('explode');
        return;
      }
      const from = territory(payload.fromTerritoryId) ?? target;
      const interceptFrom =
        payload.interceptFromTerritoryId !== null
          ? territory(payload.interceptFromTerritoryId)
          : undefined;

      startNukeAnimation(
        { x: from.x, y: from.y },
        { x: target.x, y: target.y },
        payload.intercepted,
        interceptFrom ? { x: interceptFrom.x, y: interceptFrom.y } : null,
      );

      if (!payload.intercepted) {
        const before = ownerByIdRef.current.get(payload.targetTerritoryId);
        if (before)
          frozenTerritoryDataRef.current.set(payload.targetTerritoryId, {
            ...before,
          });
      }

      window.setTimeout(() => {
        playSound('explode');
        frozenTerritoryDataRef.current.delete(payload.targetTerritoryId);
        startAnimationLoop();
      }, NUKE_FLIGHT_MS);
    },
    [territoriesRef, ownerByIdRef, startAnimationLoop],
  );

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
          `-${formatTroops(troops)}`,
          colorForPlayer(ownerId),
        );
    },
    [colorForPlayer, territoriesRef, ownerByIdRef],
  );

  const flashArrowRuns = useArrowFlash({
    visibleTerritoryIds,
    idRunsForPath,
    territoryPoints,
  });

  useFortifyEvents({
    zombieId,
    ownerByIdRef,
    adjustTerritoryTroops,
    slideShips,
    flashArrowRuns,
    animateAdd,
    animateRemove,
    staggerTroops,
    startAnimationLoop,
  });

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

  const { frozenSeaShipsRef, playSeaFrameAnimation } = useSeaSocketEvents({
    territoriesRef,
    seaTerritoriesRef,
    seasRef,
    lockedTiles,
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
  });

  const playFrameAnimation = useCallback(
    (animation: ReplayAnimation, partOfConquestPair: boolean) => {
      if (animation.type === 'deploy') {
        playSound('deploy');
        animateAdd({
          territoryId: animation.territoryId,
          troops: animation.troops,
          playerId: animation.playerId,
        });
      } else if (
        animation.type === 'deployMany' ||
        animation.type === 'infect'
      ) {
        playMassFrame(animation);
      } else if (animation.type === 'fortify') {
        playSound('fortify');
        let arrowPath: Point[][] | undefined;
        let slideExtraMs = 0;
        if (!partOfConquestPair) {
          const pathIds = getFortifyPath(
            territoriesRef.current,
            seaTerritoriesRef.current,
            seasRef.current,
            ownerByIdRef.current,
            animation.playerId,
            animation.fromTerritoryId,
            animation.toTerritoryId,
            fortification,
            portalTerritoryIds,
            portalsEnabled,
          );
          const arrowIds =
            pathIds.length > 1
              ? pathIds
              : [animation.fromTerritoryId, animation.toTerritoryId];
          arrowPath = arrowRunsForPath(arrowIds, animation.playerId);
          slideExtraMs = slideShips([arrowIds], animation.playerId);
        }
        animateRemove({
          territoryId: animation.fromTerritoryId,
          troops: animation.troops,
          playerId: animation.playerId,
        });
        afterRefund(animation.toTerritoryId, () => {
          withAnimationDelay(slideExtraMs, () =>
            animateAdd(
              {
                territoryId: animation.toTerritoryId,
                troops: animation.troops + (animation.troopsRefunded ?? 0),
                playerId: animation.playerId,
              },
              arrowPath,
            ),
          );
          startAnimationLoop();
        });
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
      } else if (animation.type === 'nuke') {
        nukeEffect(animation);
      } else if (animation.type === 'unlock') {
        playSound('explode');
        unlockEffect(animation.tileId);
        animateRemove({
          territoryId: animation.fromTerritoryId,
          troops: animation.cost,
          playerId: animation.playerId,
        });
      } else if (animation.type === 'switch') {
        playSound('click');
        animateRemove({
          territoryId: animation.fromTerritoryId,
          troops: animation.cost,
          playerId: animation.playerId,
        });
      } else if (
        animation.type === 'buyShips' ||
        animation.type === 'sail' ||
        animation.type === 'attackSea'
      ) {
        playSeaFrameAnimation(animation);
      } else {
        if (animation.defenderId !== undefined) playSound('explode');
        const attackPathIds = getAttackPath(
          territoriesRef.current,
          seaTerritoriesRef.current,
          animation.attackingTerritoryId,
          animation.defendingTerritoryId,
          portalTerritoryIds,
          portalsEnabled,
        );
        const arrowPath = partOfConquestPair
          ? undefined
          : arrowRunsForPath(attackPathIds, animation.attackerId);
        const slideExtraMs = partOfConquestPair
          ? 0
          : slideShips([attackPathIds], animation.attackerId);
        withAnimationDelay(slideExtraMs, () =>
          playAttackLossEffects(
            animation.attackingTerritoryId,
            animation.defendingTerritoryId,
            animation.attackerId,
            animation.defenderId,
            animation.attackLosses,
            animation.defenceLosses,
            arrowPath,
          ),
        );
        if (animation.troopsRefunded)
          scheduleRefund(
            animation.defendingTerritoryId,
            animation.troopsRefunded,
            getAnimationDuration('remove'),
          );
      }
      startAnimationLoop();
    },
    [
      animateAdd,
      playMassFrame,
      animateRemove,
      scheduleRefund,
      afterRefund,
      entrenchEffect,
      animateStarve,
      nukeEffect,
      unlockEffect,
      playAttackLossEffects,
      arrowRunsForPath,
      slideShips,
      playSeaFrameAnimation,
      fortification,
      portalTerritoryIds,
      portalsEnabled,
      territoriesRef,
      seaTerritoriesRef,
      seasRef,
      ownerByIdRef,
      startAnimationLoop,
    ],
  );

  const replay = useReplay(replayData ?? null, playFrameAnimation, zombieId);

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
    function onAttackMoved(payload: {
      territoryId: number;
      fromTerritoryId: number;
      path: number[][];
      troopsAdded?: number;
      troopsRefunded?: number;
    }) {
      if (payload.troopsAdded !== undefined)
        adjustTerritoryTroops([
          {
            territoryId: payload.territoryId,
            delta: payload.troopsAdded + (payload.troopsRefunded ?? 0),
          },
        ]);
      const deadline = attackRevealDeadlineRef.current.get(payload.territoryId);
      const pendingDelay = deadline
        ? Math.max(0, deadline - performance.now())
        : 0;
      const fireAnimation = () => {
        playSound('fortify');
        const shipOwnerId = ownerByIdRef.current.get(
          payload.fromTerritoryId,
        )?.ownerId;
        withAnimationDelay(slideShips(payload.path, shipOwnerId), () => {
          flashArrowRuns(payload.path, shipOwnerId);
          if (payload.troopsAdded !== undefined)
            animateAdd({
              territoryId: payload.territoryId,
              troops: payload.troopsAdded + (payload.troopsRefunded ?? 0),
            });
        });
        startAnimationLoop();
      };
      const fireAfterRefund = () =>
        afterRefund(payload.territoryId, fireAnimation);
      if (pendingDelay > 0) setTimeout(fireAfterRefund, pendingDelay);
      else fireAfterRefund();
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
      adjustToxinTerritories([
        {
          territoryId: payload.territoryId,
          permanent: payload.permanent,
          roundsRemaining: payload.roundsRemaining,
        },
      ]);
      startAnimationLoop();
    }
    function onUnlocked(payload: {
      fromTerritoryId: number;
      tileId: number;
      cost: number;
    }) {
      playSound('explode');
      adjustTerritoryTroops([
        { territoryId: payload.fromTerritoryId, delta: -payload.cost },
      ]);
      unlockEffect(payload.tileId);
      animateRemove({
        territoryId: payload.fromTerritoryId,
        troops: payload.cost,
      });
      startAnimationLoop();
    }
    function onSwitchFlipped(payload: {
      fromTerritoryId: number;
      cost: number;
    }) {
      playSound('click');
      adjustTerritoryTroops([
        { territoryId: payload.fromTerritoryId, delta: -payload.cost },
      ]);
      animateRemove({
        territoryId: payload.fromTerritoryId,
        troops: payload.cost,
      });
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
      setRadiationTerritoryIds(payload.territoryIds);
      setRadiationUpcomingTerritoryIds([]);
      startAnimationLoop();
    }
    function onNukeLaunched(payload: {
      fromTerritoryId: number;
      targetTerritoryId: number;
      intercepted: boolean;
      interceptFromTerritoryId: number | null;
    }) {
      nukeEffect(payload);
      startAnimationLoop();
    }
    connector.on('game:deployed', onDeployed);
    connector.on('game:attackMoved', onAttackMoved);
    connector.on('game:entrenched', onEntrenched);
    connector.on('game:starved', onStarved);
    connector.on('game:toxined', onToxined);
    connector.on('game:unlocked', onUnlocked);
    connector.on('game:switchFlipped', onSwitchFlipped);
    connector.on('game:toxinExpired', onToxinExpired);
    connector.on('game:radiationUpcoming', onRadiationUpcoming);
    connector.on('game:radiationChanged', onRadiationChanged);
    connector.on('game:nukeLaunched', onNukeLaunched);
    return () => {
      connector.off('game:deployed', onDeployed);
      connector.off('game:attackMoved', onAttackMoved);
      connector.off('game:entrenched', onEntrenched);
      connector.off('game:starved', onStarved);
      connector.off('game:toxined', onToxined);
      connector.off('game:unlocked', onUnlocked);
      connector.off('game:switchFlipped', onSwitchFlipped);
      connector.off('game:toxinExpired', onToxinExpired);
      connector.off('game:radiationUpcoming', onRadiationUpcoming);
      connector.off('game:radiationChanged', onRadiationChanged);
      connector.off('game:nukeLaunched', onNukeLaunched);
    };
  }, [
    animateAdd,
    animateRemove,
    afterRefund,
    entrenchEffect,
    animateStarve,
    adjustTerritoryTroops,
    unlockEffect,
    adjustToxinTerritories,
    radiationTerritoryIds,
    setRadiationTerritoryIds,
    setRadiationUpcomingTerritoryIds,
    nukeEffect,
    flashArrowRuns,
    slideShips,
    ownerByIdRef,
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
      troopsRefunded?: number;
      type: 'manual' | 'blitz';
      path: number[][];
    }) {
      skipDiceReveals();
      const attackLosses = payload.attackLosses ?? 0;
      const defenceLosses = payload.defenceLosses ?? 0;
      const troopsRefunded = payload.troopsRefunded ?? 0;
      const conquered = payload.conquered ?? false;
      const freeConquest = payload.defenderId === undefined;
      if (conquered)
        noteCaptureSource(
          payload.defendingTerritoryId,
          payload.path.at(-1)?.at(-2) ?? payload.attackingTerritoryId,
        );
      const delay =
        payload.type === 'manual' && !freeConquest
          ? DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION
          : 0;

      if (conquered && visibleTerritoryIdsRef.current) {
        const freezeId = ++nextFreezeIdRef.current;
        frozenVisibleOwnersRef.current.add(freezeId);
        if (frozenVisibleTerritoryIdsRef.current === null) {
          frozenVisibleTerritoryIdsRef.current = new Set(
            visibleTerritoryIdsRef.current,
          );
        }
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
        scheduleDiceReveal(
          () =>
            setTimeout(() => {
              frozenVisibleOwnersRef.current.delete(freezeId);
              if (frozenVisibleOwnersRef.current.size === 0) {
                frozenVisibleTerritoryIdsRef.current = null;
              }
              frozenTerritoryDataRef.current = new Map();
              startAnimationLoop();
            }, getAnimationDuration('explosion')),
          delay,
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
          delta: troopsRefunded - defenceLosses,
          ownerId: conquered ? payload.attackerId : undefined,
        });
      if (deltas.length > 0) adjustTerritoryTroops(deltas);

      if (
        payload.type === 'manual' &&
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
      const slideExtraMs = slideShips(payload.path, payload.attackerId, delay);
      scheduleDiceReveal(() => {
        attackRevealDeadlineRef.current.delete(payload.attackingTerritoryId);
        attackRevealDeadlineRef.current.delete(payload.defendingTerritoryId);
        if (!freeConquest) playSound('explode');
        for (const sound of zombieSounds(
          zombieId,
          payload.attackerId,
          payload.defenderId,
          conquered,
        ))
          playSound(sound);
        frozenTroopsRef.current.delete(payload.attackingTerritoryId);
        if (troopsRefunded > 0 && !areAnimationsDisabled())
          frozenTroopsRef.current.set(payload.defendingTerritoryId, 0);
        else frozenTroopsRef.current.delete(payload.defendingTerritoryId);
        withAnimationDelay(slideExtraMs, () => {
          flashArrowRuns(payload.path, payload.attackerId);
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
        });
        startAnimationLoop();
      }, delay);
      if (troopsRefunded > 0)
        scheduleRefund(
          payload.defendingTerritoryId,
          troopsRefunded,
          delay + getAnimationDuration('explosion'),
        );
    }
    connector.on('game:attacked', onAttacked);
    return () => {
      connector.off('game:attacked', onAttacked);
    };
  }, [
    explode,
    animateRemove,
    scheduleRefund,
    adjustTerritoryTroops,
    flashArrowRuns,
    slideShips,
    ownerByIdRef,
    visibleTerritoryIdsRef,
    frozenVisibleTerritoryIdsRef,
    frozenVisibleOwnersRef,
    nextFreezeIdRef,
    startAnimationLoop,
    zombieId,
  ]);

  useEffect(() => {
    function onTankFired(payload: {
      type: 'manual' | 'blitz';
      hasDefender: boolean;
      dice?: number;
    }) {
      const delay =
        payload.type === 'manual' && payload.hasDefender
          ? DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION
          : 0;
      scheduleDiceReveal(
        () => setTankFire((prev) => ({ id: prev.id + 1, dice: payload.dice })),
        delay,
      );
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
      troops: number;
    }) {
      playSound('select');
      playSound('deploy');
      animateAdd({
        territoryId: payload.territoryId,
        troops: payload.troops,
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
    frozenSeaShipsRef,
    tankFire,
    drawParamsRef,
    startAnimationLoop,
    replay,
  };
}
