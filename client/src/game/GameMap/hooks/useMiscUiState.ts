import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connector } from '../../../connector';
import type { Ack, CardSymbol, GameState, TurnPhase } from '../../../lib/types';
import {
  setContinuousAnimation,
  setFogActive,
  setPortalsActive,
  setRadiationActive,
  setTimedLinksActive,
  setToxinsActive,
} from '../../animations';
import type { SeaTerritory, Territory } from '../../mapData';
import type { ClickableRegions } from '../../regions/clickableRegions';
import type { ConquestArrow } from '../../replay/replay';
import {
  computeSupplyConnectedTerritoryIds,
  computeSupplyLineEdges,
  type RailEdge,
} from '../../supplyLines';
import {
  ATTACK_PANEL_HEIGHT,
  ATTACK_PANEL_WIDTH,
  getScales,
  getScreenOffset,
  SCREEN_EDGE_MARGIN,
  TROOP_PANEL_GAP,
  TROOP_PANEL_HEIGHT,
  TROOP_PANEL_WIDTH,
  TURN_PANEL_RESERVED_HEIGHT,
  type Transform,
} from '../helpers';
import {
  coversObstacles,
  placePanel,
  type PanelObstacle,
} from '../panelPlacement';

export function useLiveGameRefs() {
  const ownerByIdRef = useRef(
    new Map<number, GameState['territories'][number]>(),
  );
  const territoriesRef = useRef<Territory[]>([]);
  const seaTerritoriesRef = useRef<SeaTerritory[]>([]);
  const seasRef = useRef<GameState['seas']>([]);
  const visibleTerritoryIdsRef =
    useRef<GameState['visibleTerritoryIds']>(undefined);
  const colorByPlayerIdRef = useRef(new Map<number, number>());
  const playersRef = useRef<GameState['players']>([]);
  const selfIdRef = useRef<number | null>(null);
  const getTerritoryScreenPosRef = useRef<
    (t: Territory) => { x: number; y: number }
  >(() => ({ x: 0, y: 0 }));
  const getVertexScreenRadiusRef = useRef<() => number>(() => 0);
  const cardImagesRef = useRef<Record<CardSymbol, HTMLImageElement>>({
    soldier: new Image(),
    humvee: new Image(),
    tank: new Image(),
  });

  useEffect(() => {
    for (const symbol of ['soldier', 'humvee', 'tank'] as const) {
      cardImagesRef.current[symbol].src = `/images/${symbol}.svg`;
    }
  }, []);

  return {
    ownerByIdRef,
    territoriesRef,
    seaTerritoriesRef,
    seasRef,
    visibleTerritoryIdsRef,
    colorByPlayerIdRef,
    playersRef,
    selfIdRef,
    getTerritoryScreenPosRef,
    getVertexScreenRadiusRef,
    cardImagesRef,
  };
}

export interface PanelAnchors {
  territories: Territory[];
  seaTerritories: { id: number; x: number; y: number }[];
  size: { w: number; h: number };
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
  getRegions: () => ClickableRegions | null;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackDiceRollTerritoryId: number | undefined;
  sailStartTerritoryId: number | null;
  sailEndTerritoryId: number | null;
  attackSeaTerritoryId: number | null;
  attackSeaDiceRollTerritoryId: number | undefined;
  deploySeaTerritoryId: number | null;
}

export function usePanelStyles(
  {
    territories,
    seaTerritories,
    size,
    imgDims,
    VERTEX_RADIUS,
    getRegions,
    selectedTerritoryId,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    attackStartTerritoryId,
    attackEndTerritoryId,
    attackDiceRollTerritoryId,
    sailStartTerritoryId,
    sailEndTerritoryId,
    attackSeaTerritoryId,
    attackSeaDiceRollTerritoryId,
    deploySeaTerritoryId,
  }: PanelAnchors,
  transform: Transform,
  unlockTarget: PanelObstacle | null,
  measuredSize: { w: number; h: number } | null,
) {
  const regions = getRegions();
  const unlockX = unlockTarget?.x;
  const unlockY = unlockTarget?.y;
  const unlockTile = unlockTarget?.tile;
  return useMemo(() => {
    const { scaleX, scaleY } = getScales(
      size.w,
      size.h,
      transform.zoom,
      imgDims,
    );
    const { x: offsetX, y: offsetY } = getScreenOffset(
      size.w,
      size.h,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
      imgDims,
    );
    const view = {
      scaleX,
      scaleY,
      offsetX,
      offsetY,
      vertexRadius: VERTEX_RADIUS,
    };

    function obstacleAt(id: number | null | undefined) {
      if (id === null || id === undefined) return undefined;
      const land = territories.find((t) => t.id === id);
      if (land) return { id, x: land.x, y: land.y };
      const sea = seaTerritories.find((s) => s.id === id);
      return sea && { id, x: sea.x, y: sea.y, sea: true };
    }

    function placedStyle(
      anchor: PanelObstacle | undefined,
      others: (PanelObstacle | undefined)[],
      fallback: { w: number; h: number },
    ): CSSProperties | undefined {
      if (!anchor) return undefined;
      const panel = measuredSize ?? fallback;
      const obstacles = [
        anchor,
        ...others.filter((o): o is PanelObstacle => o !== undefined),
      ];
      return {
        position: 'absolute',
        width: 'max-content',
        maxWidth: size.w - 2 * SCREEN_EDGE_MARGIN,
        ...placePanel({
          anchor: {
            x: anchor.x * scaleX + offsetX,
            y: anchor.y * scaleY + offsetY,
          },
          anchorRadius: VERTEX_RADIUS * scaleX,
          width: panel.w,
          height: panel.h,
          screenW: size.w,
          screenH: size.h,
          gap: TROOP_PANEL_GAP,
          edgeMargin: SCREEN_EDGE_MARGIN,
          reservedBottom: TURN_PANEL_RESERVED_HEIGHT,
          covers: coversObstacles(obstacles, regions, view),
        }),
      };
    }

    const troopPanel = { w: TROOP_PANEL_WIDTH, h: TROOP_PANEL_HEIGHT };
    const attackPanel = { w: ATTACK_PANEL_WIDTH, h: ATTACK_PANEL_HEIGHT };

    return {
      deployPanelStyle: placedStyle(
        obstacleAt(selectedTerritoryId),
        [],
        troopPanel,
      ),
      fortifyPanelStyle: placedStyle(
        obstacleAt(fortifyEndTerritoryId),
        [obstacleAt(fortifyStartTerritoryId)],
        troopPanel,
      ),
      attackPanelStyle: placedStyle(
        obstacleAt(attackEndTerritoryId ?? attackDiceRollTerritoryId),
        [obstacleAt(attackStartTerritoryId)],
        attackPanel,
      ),
      sailPanelStyle: placedStyle(
        obstacleAt(sailEndTerritoryId),
        [obstacleAt(sailStartTerritoryId)],
        troopPanel,
      ),
      attackSeaPanelStyle: placedStyle(
        obstacleAt(attackSeaTerritoryId ?? attackSeaDiceRollTerritoryId),
        [],
        attackPanel,
      ),
      deploySeaPanelStyle: placedStyle(
        obstacleAt(deploySeaTerritoryId),
        [],
        troopPanel,
      ),
      unlockPanelStyle: placedStyle(
        unlockX === undefined || unlockY === undefined
          ? undefined
          : { x: unlockX, y: unlockY, tile: unlockTile },
        [obstacleAt(attackStartTerritoryId)],
        troopPanel,
      ),
    };
  }, [
    territories,
    seaTerritories,
    size,
    imgDims,
    VERTEX_RADIUS,
    regions,
    selectedTerritoryId,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    attackStartTerritoryId,
    attackEndTerritoryId,
    attackDiceRollTerritoryId,
    sailStartTerritoryId,
    sailEndTerritoryId,
    attackSeaTerritoryId,
    attackSeaDiceRollTerritoryId,
    deploySeaTerritoryId,
    transform.zoom,
    transform.offsetX,
    transform.offsetY,
    unlockX,
    unlockY,
    unlockTile,
    measuredSize,
  ]);
}

export function useAnimationActiveFlags({
  turnPhase,
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  attackStartTerritoryId,
  attackEndTerritoryId,
  sailStartTerritoryId,
  sailEndTerritoryId,
  replayConquestArrow,
  portalsEnabled,
  portalTerritoryIds,
  hasToxinTerritories,
  hasTimedLinks,
  radiationById,
  radiationUpcomingById,
  visibleTerritoryIds,
  territories,
  seaTerritories,
  startAnimationLoop,
}: {
  turnPhase: TurnPhase;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  sailStartTerritoryId: number | null;
  sailEndTerritoryId: number | null;
  replayConquestArrow: ConquestArrow | null;
  portalsEnabled: boolean;
  portalTerritoryIds: number[];
  hasToxinTerritories: boolean;
  hasTimedLinks: boolean;
  radiationById: Set<number>;
  radiationUpcomingById: Set<number>;
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  territories: Territory[];
  seaTerritories: { id: number }[];
  startAnimationLoop: () => void;
}) {
  useEffect(() => {
    const arrowActive =
      (turnPhase === 'fortify' &&
        fortifyStartTerritoryId !== null &&
        fortifyEndTerritoryId !== null) ||
      (turnPhase === 'attack' &&
        attackStartTerritoryId !== null &&
        attackEndTerritoryId !== null) ||
      (turnPhase === 'sail' &&
        sailStartTerritoryId !== null &&
        sailEndTerritoryId !== null);
    setContinuousAnimation(arrowActive);
    if (arrowActive) startAnimationLoop();
    return () => setContinuousAnimation(false);
  }, [
    turnPhase,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    attackStartTerritoryId,
    attackEndTerritoryId,
    sailStartTerritoryId,
    sailEndTerritoryId,
    startAnimationLoop,
  ]);

  useEffect(() => {
    const arrowActive = replayConquestArrow !== null;
    setContinuousAnimation(arrowActive);
    if (arrowActive) startAnimationLoop();
    return () => setContinuousAnimation(false);
  }, [replayConquestArrow, startAnimationLoop]);

  useEffect(() => {
    const active = portalsEnabled && portalTerritoryIds.length > 0;
    setPortalsActive(active);
    if (active) startAnimationLoop();
    return () => setPortalsActive(false);
  }, [portalsEnabled, portalTerritoryIds, startAnimationLoop]);

  useEffect(() => {
    setToxinsActive(hasToxinTerritories);
    if (hasToxinTerritories) startAnimationLoop();
    return () => setToxinsActive(false);
  }, [hasToxinTerritories, startAnimationLoop]);

  useEffect(() => {
    setTimedLinksActive(hasTimedLinks);
    if (hasTimedLinks) startAnimationLoop();
    return () => setTimedLinksActive(false);
  }, [hasTimedLinks, startAnimationLoop]);

  const hasRadiationTerritories =
    radiationById.size > 0 || radiationUpcomingById.size > 0;
  useEffect(() => {
    setRadiationActive(hasRadiationTerritories);
    if (hasRadiationTerritories) startAnimationLoop();
    return () => setRadiationActive(false);
  }, [hasRadiationTerritories, startAnimationLoop]);

  const hasFogTerritories = useMemo(() => {
    if (!visibleTerritoryIds) return false;
    const visible = new Set(visibleTerritoryIds);
    return (
      territories.some((t) => !visible.has(t.id)) ||
      seaTerritories.some((s) => !visible.has(s.id))
    );
  }, [visibleTerritoryIds, territories, seaTerritories]);
  useEffect(() => {
    setFogActive(hasFogTerritories);
    if (hasFogTerritories) startAnimationLoop();
    return () => setFogActive(false);
  }, [hasFogTerritories, startAnimationLoop]);
}

export function useSupplyLineOverlay({
  supplyLines,
  territories,
  seaTerritories,
  seas,
  ownerById,
  portalTerritoryIds,
  portalsEnabled,
  imgWidth,
  imgHeight,
  showReplay,
  visibleTerritoryIds,
  selfId,
  zombieId,
}: {
  supplyLines: GameState['supplyLines'];
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  seas: GameState['seas'];
  ownerById: Map<number, GameState['territories'][number]>;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  imgWidth: number;
  imgHeight: number;
  showReplay: boolean;
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  selfId: number | null;
  zombieId: number | null;
}) {
  const nodes = useMemo(
    () => [...territories, ...seaTerritories],
    [territories, seaTerritories],
  );
  const supplyLineEdgesByPlayer = useMemo(() => {
    if (supplyLines !== 'on' || territories.length === 0)
      return new Map<number, RailEdge[]>();
    const edges = computeSupplyLineEdges(
      nodes,
      seas,
      ownerById,
      portalTerritoryIds,
      portalsEnabled,
      imgWidth,
      imgHeight,
      zombieId,
    );
    if (!showReplay && visibleTerritoryIds && selfId !== null) {
      const ownEdges = edges.get(selfId);
      return ownEdges
        ? new Map([[selfId, ownEdges]])
        : new Map<number, RailEdge[]>();
    }
    return edges;
  }, [
    supplyLines,
    territories,
    nodes,
    seas,
    ownerById,
    portalTerritoryIds,
    portalsEnabled,
    imgWidth,
    imgHeight,
    showReplay,
    visibleTerritoryIds,
    selfId,
    zombieId,
  ]);
  const supplyConnectedTerritoryIds = useMemo(
    () =>
      supplyLines === 'on' && selfId !== null
        ? computeSupplyConnectedTerritoryIds(
            nodes,
            seas,
            ownerById,
            selfId,
            portalTerritoryIds,
            portalsEnabled,
          )
        : null,
    [
      supplyLines,
      nodes,
      seas,
      ownerById,
      selfId,
      portalTerritoryIds,
      portalsEnabled,
    ],
  );
  return { supplyLineEdgesByPlayer, supplyConnectedTerritoryIds };
}

export function useResetTroopInputOnSelection({
  selectedTerritoryId,
  turnPhase,
  deployMaxTroops,
  setEntrenchTroops,
  setDeployTroops,
}: {
  selectedTerritoryId: number | null;
  turnPhase: TurnPhase;
  deployMaxTroops: number;
  setEntrenchTroops: (troops: number) => void;
  setDeployTroops: (troops: number) => void;
}) {
  const [trackedSelectedTerritoryId, setTrackedSelectedTerritoryId] = useState<
    number | null
  >(null);
  if (trackedSelectedTerritoryId !== selectedTerritoryId) {
    setTrackedSelectedTerritoryId(selectedTerritoryId);
    if (selectedTerritoryId !== null) {
      if (turnPhase === 'entrench') setEntrenchTroops(1);
      else setDeployTroops(deployMaxTroops);
    }
  }
}

export function useGameEndActions(setGame: (game: GameState) => void) {
  const applyAck = useCallback(
    (res: Ack) => {
      if (res.ok) setGame(res.game);
    },
    [setGame],
  );
  const surrender = useCallback(
    () => connector.surrender(applyAck),
    [applyAck],
  );
  const endGame = useCallback(() => connector.endGame(applyAck), [applyAck]);
  const toggleDraw = useCallback(
    () => connector.toggleDraw(applyAck),
    [applyAck],
  );
  const toggleAbort = useCallback(
    () => connector.toggleAbort(applyAck),
    [applyAck],
  );
  return { surrender, endGame, toggleDraw, toggleAbort };
}

export function requestNextPhase(setGame: (game: GameState) => void) {
  connector.nextPhase((res: Ack) => {
    if (res.ok) setGame(res.game);
  });
}

export function requestPreviousPhase(setGame: (game: GameState) => void) {
  connector.previousPhase((res: Ack) => {
    if (res.ok) setGame(res.game);
  });
}

export function useLeaveGameGuard({
  players,
  spectators,
  selfId,
  gameEnded,
  navigate,
}: {
  players: GameState['players'];
  spectators: GameState['spectators'];
  selfId: number | null;
  gameEnded: boolean;
  navigate: (path: string) => void;
}) {
  const isSpectator = spectators.some((s) => s.id === selfId);
  const self = players.find((p) => p.id === selfId);
  const guardActive =
    !gameEnded &&
    !connector.isTutorial() &&
    !isSpectator &&
    !!self &&
    !self.eliminated &&
    !self.surrendered;
  const guardActiveRef = useRef(guardActive);
  useEffect(() => {
    guardActiveRef.current = guardActive;
  }, [guardActive]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingPathRef = useRef('/');

  useEffect(() => {
    if (!guardActive) return;
    window.history.pushState(null, '', window.location.href);
    function onPopState() {
      if (!guardActiveRef.current) return;
      window.history.pushState(null, '', window.location.href);
      pendingPathRef.current = '/';
      setConfirmOpen(true);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [guardActive]);

  useEffect(() => {
    if (!guardActive) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [guardActive]);

  const guardedNavigate = useCallback(
    (path: string) => {
      if (guardActiveRef.current) {
        pendingPathRef.current = path;
        setConfirmOpen(true);
        return;
      }
      navigate(path);
    },
    [navigate],
  );

  const confirmLeave = useCallback(() => {
    setConfirmOpen(false);
    connector.surrender((res: Ack) => {
      if (res.ok) navigate(pendingPathRef.current);
    });
  }, [navigate]);

  const cancelLeave = useCallback(() => setConfirmOpen(false), []);

  return {
    navigate: guardedNavigate,
    leaveConfirmOpen: confirmOpen,
    confirmLeave,
    cancelLeave,
  };
}

export function useLockViewportZoom() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute('content') ?? null;
    meta?.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
    );
    return () => {
      if (meta && original !== null) meta.setAttribute('content', original);
    };
  }, []);
}
