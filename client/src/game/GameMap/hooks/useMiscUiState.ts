import type { CSSProperties, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { connector } from '../../../connector';
import type { Ack, CardSymbol, GameState, TurnPhase } from '../../../lib/types';
import {
  setContinuousAnimation,
  setFogActive,
  setPortalsActive,
  setRadiationActive,
  setToxinsActive,
} from '../../animations';
import type { SeaTerritory, Territory } from '../../mapData';
import { getAnchoredPanelPosition } from '../../mapMath';
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
  getTerritoryScreenPos,
  SCREEN_EDGE_MARGIN,
  TROOP_PANEL_GAP,
  TROOP_PANEL_HEIGHT,
  TROOP_PANEL_WIDTH,
  TURN_PANEL_RESERVED_HEIGHT,
  type Transform,
} from '../helpers';

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
  const vertexScreenRadiusRef = useRef(0);
  const autoAdvanceKeyRef = useRef<string | null>(null);
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
    vertexScreenRadiusRef,
    autoAdvanceKeyRef,
    cardImagesRef,
  };
}

function anchoredStyle(
  screenPos: { x: number; y: number } | null,
  zoomedRadius: number,
  width: number,
  height: number,
  size: { w: number; h: number },
): CSSProperties | undefined {
  if (!screenPos) return undefined;
  return {
    position: 'absolute',
    ...getAnchoredPanelPosition(
      screenPos,
      zoomedRadius,
      width,
      height,
      size.w,
      size.h,
      TROOP_PANEL_GAP,
      SCREEN_EDGE_MARGIN,
      TURN_PANEL_RESERVED_HEIGHT,
    ),
  };
}

export function usePanelStyles({
  territories,
  seaTerritories,
  size,
  transform,
  imgDims,
  VERTEX_RADIUS,
  tooltipTerritoryId,
  selectedTerritoryId,
  fortifyEndTerritoryId,
  attackEndTerritoryId,
  attackDiceRollTerritoryId,
  sailEndTerritoryId,
  attackSeaTerritoryId,
  attackSeaDiceRollTerritoryId,
  deploySeaTerritoryId,
}: {
  territories: Territory[];
  seaTerritories: { id: number; x: number; y: number }[];
  size: { w: number; h: number };
  transform: Transform;
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
  tooltipTerritoryId: number | null;
  selectedTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackDiceRollTerritoryId: number | undefined;
  sailEndTerritoryId: number | null;
  attackSeaTerritoryId: number | null;
  attackSeaDiceRollTerritoryId: number | undefined;
  deploySeaTerritoryId: number | null;
}) {
  const zoomedRadius =
    VERTEX_RADIUS * getScales(size.w, size.h, transform.zoom, imgDims).scaleX;

  const tooltipTerritory =
    tooltipTerritoryId !== null
      ? territories.find((t) => t.id === tooltipTerritoryId)
      : undefined;
  const tooltipScreenPos = tooltipTerritory
    ? getTerritoryScreenPos(tooltipTerritory, size, transform, imgDims)
    : null;

  const selectedTerritory =
    selectedTerritoryId !== null
      ? territories.find((t) => t.id === selectedTerritoryId)
      : undefined;
  const selectedScreenPos = selectedTerritory
    ? getTerritoryScreenPos(selectedTerritory, size, transform, imgDims)
    : null;
  const deployPanelStyle = anchoredStyle(
    selectedScreenPos,
    zoomedRadius,
    TROOP_PANEL_WIDTH,
    TROOP_PANEL_HEIGHT,
    size,
  );

  const fortifyEndTerritory =
    fortifyEndTerritoryId !== null
      ? territories.find((t) => t.id === fortifyEndTerritoryId)
      : undefined;
  const fortifyScreenPos = fortifyEndTerritory
    ? getTerritoryScreenPos(fortifyEndTerritory, size, transform, imgDims)
    : null;
  const fortifyPanelStyle = anchoredStyle(
    fortifyScreenPos,
    zoomedRadius,
    TROOP_PANEL_WIDTH,
    TROOP_PANEL_HEIGHT,
    size,
  );

  const attackAnchorTerritoryId =
    attackEndTerritoryId ?? attackDiceRollTerritoryId ?? null;
  const attackEndTerritory =
    attackAnchorTerritoryId !== null
      ? territories.find((t) => t.id === attackAnchorTerritoryId)
      : undefined;
  const attackScreenPos = attackEndTerritory
    ? getTerritoryScreenPos(attackEndTerritory, size, transform, imgDims)
    : null;
  const attackPanelStyle = anchoredStyle(
    attackScreenPos,
    zoomedRadius,
    ATTACK_PANEL_WIDTH,
    ATTACK_PANEL_HEIGHT,
    size,
  );

  const sailEndSea =
    sailEndTerritoryId !== null
      ? seaTerritories.find((s) => s.id === sailEndTerritoryId)
      : undefined;
  const sailScreenPos = sailEndSea
    ? getTerritoryScreenPos(sailEndSea, size, transform, imgDims)
    : null;
  const sailPanelStyle = anchoredStyle(
    sailScreenPos,
    zoomedRadius,
    TROOP_PANEL_WIDTH,
    TROOP_PANEL_HEIGHT,
    size,
  );

  const attackSeaAnchorTerritoryId =
    attackSeaTerritoryId ?? attackSeaDiceRollTerritoryId ?? null;
  const attackSeaSea =
    attackSeaAnchorTerritoryId !== null
      ? seaTerritories.find((s) => s.id === attackSeaAnchorTerritoryId)
      : undefined;
  const attackSeaScreenPos = attackSeaSea
    ? getTerritoryScreenPos(attackSeaSea, size, transform, imgDims)
    : null;
  const attackSeaPanelStyle = anchoredStyle(
    attackSeaScreenPos,
    zoomedRadius,
    ATTACK_PANEL_WIDTH,
    ATTACK_PANEL_HEIGHT,
    size,
  );

  const deploySea =
    deploySeaTerritoryId !== null
      ? seaTerritories.find((s) => s.id === deploySeaTerritoryId)
      : undefined;
  const deploySeaScreenPos = deploySea
    ? getTerritoryScreenPos(deploySea, size, transform, imgDims)
    : null;
  const deploySeaPanelStyle = anchoredStyle(
    deploySeaScreenPos,
    zoomedRadius,
    TROOP_PANEL_WIDTH,
    TROOP_PANEL_HEIGHT,
    size,
  );

  return {
    zoomedRadius,
    tooltipScreenPos,
    deployPanelStyle,
    fortifyPanelStyle,
    attackPanelStyle,
    sailPanelStyle,
    attackSeaPanelStyle,
    deploySeaPanelStyle,
  };
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

export function useAutoAdvancePhase({
  isMyTurn,
  paused,
  turnPhase,
  attackPendingConquest,
  attackStartCandidatesSize,
  nukeReady,
  fortifyStartCandidatesSize,
  entrenchCandidatesSize,
  toxinsCandidatesSize,
  roundNumber,
  turnPlayerIndex,
  autoAdvanceKeyRef,
  setGame,
}: {
  isMyTurn: boolean;
  paused: boolean;
  turnPhase: TurnPhase;
  attackPendingConquest: boolean;
  attackStartCandidatesSize: number;
  nukeReady: boolean;
  fortifyStartCandidatesSize: number;
  entrenchCandidatesSize: number;
  toxinsCandidatesSize: number;
  roundNumber: number;
  turnPlayerIndex: number;
  autoAdvanceKeyRef: RefObject<string | null>;
  setGame: (game: GameState) => void;
}) {
  useEffect(() => {
    if (!isMyTurn || paused) return;
    const noAttackPossible =
      turnPhase === 'attack' &&
      !attackPendingConquest &&
      attackStartCandidatesSize === 0 &&
      !nukeReady;
    const noFortifyPossible =
      turnPhase === 'fortify' && fortifyStartCandidatesSize === 0;
    const noEntrenchPossible =
      turnPhase === 'entrench' && entrenchCandidatesSize === 0;
    const noToxinsPossible =
      turnPhase === 'toxins' && toxinsCandidatesSize === 0;
    if (
      !noAttackPossible &&
      !noFortifyPossible &&
      !noEntrenchPossible &&
      !noToxinsPossible
    )
      return;

    const key = `${roundNumber}-${turnPlayerIndex}-${turnPhase}`;
    if (autoAdvanceKeyRef.current === key) return;
    autoAdvanceKeyRef.current = key;

    connector.nextPhase((res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  });
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
