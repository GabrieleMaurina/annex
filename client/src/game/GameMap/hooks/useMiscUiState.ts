import type { CSSProperties, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../../../lib/socket';
import type { Ack, CardSymbol, GameState, TurnPhase } from '../../../lib/types';
import {
  setContinuousAnimation,
  setFogActive,
  setPortalsActive,
  setRadiationActive,
  setToxinsActive,
} from '../../animations';
import type { Territory } from '../../mapData';
import { getAnchoredPanelPosition } from '../../mapMath';
import type { ConquestArrow } from '../../replay';
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
  size,
  transform,
  imgDims,
  VERTEX_RADIUS,
  tooltipTerritoryId,
  selectedTerritoryId,
  fortifyEndTerritoryId,
  attackEndTerritoryId,
  attackDiceRollTerritoryId,
}: {
  territories: Territory[];
  size: { w: number; h: number };
  transform: Transform;
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
  tooltipTerritoryId: number | null;
  selectedTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackDiceRollTerritoryId: number | undefined;
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

  return {
    zoomedRadius,
    tooltipScreenPos,
    deployPanelStyle,
    fortifyPanelStyle,
    attackPanelStyle,
  };
}

export function useAnimationActiveFlags({
  turnPhase,
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  attackStartTerritoryId,
  attackEndTerritoryId,
  replayConquestArrow,
  portalsEnabled,
  portalTerritoryIds,
  hasToxinTerritories,
  radiationById,
  radiationUpcomingById,
  visibleTerritoryIds,
  territories,
  startAnimationLoop,
}: {
  turnPhase: TurnPhase;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  replayConquestArrow: ConquestArrow | null;
  portalsEnabled: boolean;
  portalTerritoryIds: number[];
  hasToxinTerritories: boolean;
  radiationById: Set<number>;
  radiationUpcomingById: Set<number>;
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  territories: Territory[];
  startAnimationLoop: () => void;
}) {
  useEffect(() => {
    const arrowActive =
      (turnPhase === 'fortify' &&
        fortifyStartTerritoryId !== null &&
        fortifyEndTerritoryId !== null) ||
      (turnPhase === 'attack' &&
        attackStartTerritoryId !== null &&
        attackEndTerritoryId !== null);
    setContinuousAnimation(arrowActive);
    if (arrowActive) startAnimationLoop();
    return () => setContinuousAnimation(false);
  }, [
    turnPhase,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    attackStartTerritoryId,
    attackEndTerritoryId,
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
    return territories.some((t) => !visible.has(t.id));
  }, [visibleTerritoryIds, territories]);
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
  fortifyStartCandidatesSize,
  entrenchCandidatesSize,
  toxinsCandidatesSize,
  turnNumber,
  turnPlayerIndex,
  autoAdvanceKeyRef,
  setGame,
}: {
  isMyTurn: boolean;
  paused: boolean;
  turnPhase: TurnPhase;
  attackPendingConquest: boolean;
  attackStartCandidatesSize: number;
  fortifyStartCandidatesSize: number;
  entrenchCandidatesSize: number;
  toxinsCandidatesSize: number;
  turnNumber: number;
  turnPlayerIndex: number;
  autoAdvanceKeyRef: RefObject<string | null>;
  setGame: (game: GameState) => void;
}) {
  useEffect(() => {
    if (!isMyTurn || paused) return;
    const noAttackPossible =
      turnPhase === 'attack' &&
      !attackPendingConquest &&
      attackStartCandidatesSize === 0;
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

    const key = `${turnNumber}-${turnPlayerIndex}-${turnPhase}`;
    if (autoAdvanceKeyRef.current === key) return;
    autoAdvanceKeyRef.current = key;

    socket.emit('game:nextPhase', (res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  });
}

export function useResetTroopInputOnSelection({
  selectedTerritoryId,
  turnPhase,
  troopsToDeploy,
  setEntrenchTroops,
  setDeployTroops,
}: {
  selectedTerritoryId: number | null;
  turnPhase: TurnPhase;
  troopsToDeploy: number;
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
      else setDeployTroops(troopsToDeploy);
    }
  }
}
