import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { useWhiteIcon } from '../../common/icon';
import type { ResultRow } from '../../common/ResultsTable';
import { connector } from '../../connector';
import { playerColor } from '../../lib/palette';
import type {
  Ack,
  Alliances,
  Bounties,
  CardsMode,
  Entrenchments,
  Fortification,
  GameMode,
  GameState,
  Mission,
  Starvation,
  SupplyLines,
  Toxins,
  TurnDuration,
  TurnPhase,
} from '../../lib/types';
import { CARD_SET_FLASH_DURATION } from '../animations';
import { CardFace } from '../panels/CardsPanel';
import PlayersPanel from '../panels/PlayersPanel';
import ReplayPanel from '../panels/ReplayPanel';
import { replayPlayerCounts, type ReplayData } from '../replay';
import type { LogEntry } from '../useGameLogs';
import { drawGameMapCanvas } from './draw/drawCanvas';
import {
  computeTooltipLabels,
  getScales,
  getTerritoryScreenPos,
} from './helpers';
import { useAllianceUI } from './hooks/useAllianceUI';
import { useAttackFlow } from './hooks/useAttackFlow';
import { useCanvasInteractions } from './hooks/useCanvasInteractions';
import { useCardsAndDeploy } from './hooks/useCardsAndDeploy';
import { useEmojiUI } from './hooks/useEmojiUI';
import { useGameSocketEvents } from './hooks/useGameSocketEvents';
import { useMapView } from './hooks/useMapView';
import {
  useAnimationActiveFlags,
  useAutoAdvancePhase,
  useLiveGameRefs,
  usePanelStyles,
  useResetTroopInputOnSelection,
  useSupplyLineOverlay,
} from './hooks/useMiscUiState';
import { usePanelsUI } from './hooks/usePanelsUI';
import { useTurnActionFlows } from './hooks/useTurnActionFlows';
import AlliancePopupOverlay from './overlays/AlliancePopupOverlay';
import EmojiOverlay from './overlays/EmojiOverlay';
import MapButtonsColumn from './overlays/MapButtonsColumn';
import TurnActionPanels from './overlays/TurnActionPanels';

export interface GameMapProps {
  game: GameState;
  mapName: string;
  players: GameState['players'];
  spectators: GameState['spectators'];
  ownership: GameState['territories'];
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  gameMode: GameMode;
  isTeamDeathmatch: boolean;
  isCapitals: boolean;
  continentId: number | null;
  mission: Mission | null;
  selfId: number | null;
  roundNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  turnDuration: TurnDuration;
  fortification: Fortification;
  entrenchments: Entrenchments;
  toxins: Toxins;
  toxinTerritories: GameState['toxinTerritories'];
  cards: CardsMode;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  radiationTerritoryIds: number[];
  radiationUpcomingTerritoryIds: number[];
  starvation: Starvation;
  bounties: Bounties;
  supplyLines: SupplyLines;
  alliances: Alliances;
  allianceStates: GameState['allianceStates'];
  territoryTroopsCap: number;
  totalTroopsCap: number;
  troopsToDeploy: number;
  turnStartedAt: number;
  paused: boolean;
  hostId: number;
  onTogglePause: () => void;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  fortifyPathTerritoryIds: number[][];
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  nextSetBaseValues: GameState['nextSetBaseValues'];
  upcomingSetValues: GameState['upcomingSetValues'];
  results: Map<number, ResultRow> | null;
  gameEnded: boolean;
  showReplay: boolean;
  replayData?: ReplayData | null;
  onReplayIndexChange?: (index: number) => void;
  logs: LogEntry[];
  setGame: (game: GameState) => void;
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
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  settingsMenuOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  navigate: (path: string) => void;
}

function GameMap({
  game,
  mapName,
  players,
  spectators,
  ownership,
  visibleTerritoryIds,
  gameMode,
  isTeamDeathmatch,
  isCapitals,
  continentId,
  mission,
  selfId,
  roundNumber,
  turnPlayerIndex,
  turnPhase,
  turnDuration,
  fortification,
  entrenchments,
  toxins,
  toxinTerritories,
  cards,
  portalTerritoryIds,
  portalsEnabled,
  radiationTerritoryIds,
  radiationUpcomingTerritoryIds,
  starvation,
  bounties,
  supplyLines,
  alliances,
  allianceStates,
  territoryTroopsCap,
  totalTroopsCap,
  troopsToDeploy,
  turnStartedAt,
  paused,
  hostId,
  onTogglePause,
  selectedTerritoryId,
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  fortifyPathTerritoryIds,
  attackStartTerritoryId,
  attackEndTerritoryId,
  attackConquestMinTroops,
  nextSetBaseValues,
  upcomingSetValues,
  results,
  gameEnded,
  showReplay,
  replayData,
  onReplayIndexChange,
  logs,
  setGame,
  adjustTerritoryTroops,
  adjustToxinTerritories,
  setRadiationTerritoryIds,
  setRadiationUpcomingTerritoryIds,
  setChatOpen,
  settingsMenuOpen,
  onPanelOpenChange,
  navigate,
}: GameMapProps) {
  const whiteCardsIcon = useWhiteIcon('/icons/cards.svg');
  const whiteBonusIcon = useWhiteIcon('/icons/bonus.svg');
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');
  const whiteMutedIcon = useWhiteIcon('/icons/muted.svg');
  const whiteUnmutedIcon = useWhiteIcon('/icons/unmuted.svg');
  const whiteLogsIcon = useWhiteIcon('/icons/logs.svg');
  const whiteSettingsIcon = useWhiteIcon('/icons/sliders.svg');

  const {
    canvasRef,
    imageRef,
    territories,
    bonuses,
    transform,
    setTransform,
    imgDims,
    size,
  } = useMapView(mapName);

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

  const vertexDiametersPerLongestSide = 50;
  const VERTEX_RADIUS =
    Math.max(imgDims.w, imgDims.h) / (vertexDiametersPerLongestSide * 2);

  const {
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
  } = useLiveGameRefs();

  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [processedDeployPhaseKey, setProcessedDeployPhaseKey] = useState<
    string | null
  >(null);
  const [capitalModeAnnounced, setCapitalModeAnnounced] = useState(false);
  const [, bumpMuteVersion] = useReducer((c) => c + 1, 0);

  const {
    frozenTroopsRef,
    frozenOwnerRef,
    frozenVisibleTerritoryIdsRef,
    frozenTerritoryDataRef,
    toxinPlacedAtRef,
    radiationPlacedAtRef,
    tankFireId,
    startAnimationLoop,
    replay,
  } = useGameSocketEvents({
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
  });
  const {
    index: replayIndex,
    totalFrames: replayTotalFrames,
    playing: replayPlaying,
    speed: replaySpeed,
    territories: replayTerritories,
    toxinTerritories: replayToxinTerritories,
    radiationTerritories: replayRadiationTerritories,
    radiationUpcoming: replayRadiationUpcoming,
    hands: replayHands,
    turnPhase: replayTurnPhase,
    roundNumber: replayRoundNumber,
    turnPlayerId: replayTurnPlayerId,
    conquestArrow: replayConquestArrow,
    stepForward: replayStepForward,
    stepBackward: replayStepBackward,
    jumpToStart: replayJumpToStart,
    jumpToEnd: replayJumpToEnd,
    seek: replaySeek,
    togglePlay: replayTogglePlay,
    cycleSpeed: replayCycleSpeed,
  } = replay;

  useEffect(() => {
    onReplayIndexChange?.(replayIndex);
  }, [replayIndex, onReplayIndexChange]);

  const currentTurnPlayer = players[turnPlayerIndex];
  const isMyTurn = currentTurnPlayer?.id === selfId;
  const isCapitalById = new Map(ownership.map((o) => [o.id, o.isCapital]));
  const displayedOwnership = replayTerritories
    ? replayTerritories.map((t) => ({
        ...t,
        isCapital: isCapitalById.get(t.id) ?? false,
      }))
    : ownership;
  const ownerById = useMemo(
    () => new Map(displayedOwnership.map((o) => [o.id, o])),
    [displayedOwnership],
  );
  const replayCounts =
    showReplay && replayTerritories
      ? replayPlayerCounts(
          replayTerritories,
          replayHands ?? [],
          new Set(
            displayedOwnership.filter((o) => o.isCapital).map((o) => o.id),
          ),
        )
      : null;
  const displayedPlayers = replayCounts
    ? players.map((p) => ({
        ...p,
        territoryCount: 0,
        troopCount: 0,
        capitalCount: 0,
        cardCount: 0,
        ...replayCounts.get(p.id),
      }))
    : players;
  const playersWithAccounts = displayedPlayers.map((p) => ({
    ...p,
    userId: results?.get(p.id)?.userId ?? p.userId,
  }));
  const panelRoundNumber =
    showReplay && replayRoundNumber !== null ? replayRoundNumber : roundNumber;
  const panelTurnPhase =
    showReplay && replayTurnPhase !== null ? replayTurnPhase : turnPhase;
  const displayedToxinTerritories = replayToxinTerritories ?? toxinTerritories;
  const toxinById = useMemo(
    () => new Set(displayedToxinTerritories.map((t) => t.id)),
    [displayedToxinTerritories],
  );
  const displayedRadiationTerritories =
    replayRadiationTerritories ?? radiationTerritoryIds;
  const radiationById = useMemo(
    () => new Set(displayedRadiationTerritories),
    [displayedRadiationTerritories],
  );
  const radiationUpcomingById = useMemo(
    () =>
      new Set(
        (showReplay
          ? (replayRadiationUpcoming ?? [])
          : radiationUpcomingTerritoryIds
        ).filter((id) => !radiationById.has(id)),
      ),
    [
      showReplay,
      replayRadiationUpcoming,
      radiationUpcomingTerritoryIds,
      radiationById,
    ],
  );
  const unusableTerritoryById = useMemo(
    () => new Set([...toxinById, ...radiationById]),
    [toxinById, radiationById],
  );
  const visibleTerritoryById = useMemo(
    () => (visibleTerritoryIds ? new Set(visibleTerritoryIds) : null),
    [visibleTerritoryIds],
  );
  const ownedTerritoryIds = new Set(
    ownership.filter((o) => o.ownerId === selfId).map((o) => o.id),
  );

  useEffect(() => {
    ownerByIdRef.current = ownerById;
    territoriesRef.current = territories;
    visibleTerritoryIdsRef.current = visibleTerritoryIds;
    colorByPlayerIdRef.current = new Map(
      players.map((pl) => [pl.id, pl.color]),
    );
    playersRef.current = players;
    selfIdRef.current = selfId;
    getTerritoryScreenPosRef.current = (t) =>
      getTerritoryScreenPos(t, size, transform, imgDims);
    vertexScreenRadiusRef.current =
      VERTEX_RADIUS * getScales(size.w, size.h, transform.zoom, imgDims).scaleX;
  });

  const attackFlow = useAttackFlow({
    attackStartTerritoryId,
    attackEndTerritoryId,
    attackConquestMinTroops,
    territories,
    ownerById,
    selfId,
    portalTerritoryIds,
    portalsEnabled,
    unusableTerritoryById,
    turnPhase,
    isMyTurn,
    paused,
    setGame,
  });

  const turnFlow = useTurnActionFlows({
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    territories,
    ownerById,
    selfId,
    fortification,
    portalTerritoryIds,
    portalsEnabled,
    turnPhase,
    isMyTurn,
    paused,
    selectedTerritoryId,
    toxins,
    cards,
    nextSetBaseValues,
    blockedById: unusableTerritoryById,
    setGame,
  });

  const {
    openPanel,
    setOpenPanel,
    cardsOpen,
    bonusesOpen,
    logsOpen,
    settingsOpen,
    cardsButtonsTop,
    cardsPanelRef,
    cardsButtonRef,
    bonusesButtonRef,
    logsButtonRef,
    logsPanelRef,
    settingsButtonRef,
    settingsPanelRef,
    buttonColumnRef,
    logsPanelTop,
    settingsPanelTop,
    panelCollapsed,
    setPanelCollapsed,
  } = usePanelsUI();

  useEffect(() => {
    onPanelOpenChange(openPanel !== null);
  }, [openPanel, onPanelOpenChange]);

  const cardsFlow = useCardsAndDeploy({
    turnPhase,
    isMyTurn,
    paused,
    selectedTerritoryId,
    gameEnded,
    ownedTerritoryIds,
    nextSetBaseValues,
    selfId,
    playersRef,
    cardsOpen: cardsOpen,
    setOpenPanel: setOpenPanel,
    setToasts,
    setGame,
  });

  const emojiUI = useEmojiUI({
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
  });

  const allianceUI = useAllianceUI({ allianceStates, playersRef, setToasts });

  const { supplyLineEdgesByPlayer, supplyConnectedTerritoryIds } =
    useSupplyLineOverlay({
      supplyLines,
      territories,
      ownerById,
      portalTerritoryIds,
      portalsEnabled,
      imgWidth: imgDims.w,
      imgHeight: imgDims.h,
      showReplay,
      visibleTerritoryIds,
      selfId,
    });
  const replayPlayer = players.find((p) => p.id === replayTurnPlayerId);
  const replayPlayerColor = replayPlayer
    ? playerColor(replayPlayer.color)
    : '#ffffff';

  const territoryClaimCandidates =
    turnPhase === 'territory' && isMyTurn
      ? new Set(
          territories
            .filter((t) => !ownerById.has(t.id) && !radiationById.has(t.id))
            .map((t) => t.id),
        )
      : new Set<number>();
  const canAdvancePhase =
    isMyTurn &&
    !paused &&
    turnPhase !== 'territory' &&
    turnPhase !== 'troop' &&
    turnPhase !== 'capital' &&
    (turnPhase !== 'deploy' || (troopsToDeploy <= 0 && !cardsFlow.mustPlaySet));
  const nextPhaseEndsTurn =
    turnPhase === 'toxins' ||
    (turnPhase === 'entrench' &&
      (toxins === 'off' || turnFlow.toxinsCandidates.size === 0)) ||
    (turnPhase === 'fortify' &&
      (entrenchments !== 'on' || turnFlow.entrenchCandidates.size === 0) &&
      (toxins === 'off' || turnFlow.toxinsCandidates.size === 0));

  const interactions = useCanvasInteractions({
    canvasRef,
    territories,
    transform,
    setTransform,
    imgDims,
    VERTEX_RADIUS,
    gameEnded,
    isMyTurn,
    paused,
    turnPhase,
    selfId,
    selectedTerritoryId,
    territoryClaimCandidates,
    troopsToDeploy,
    supplyConnectedTerritoryIds,
    ownerById,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    fortifyStartCandidates: turnFlow.fortifyStartCandidates,
    fortifyEndCandidates: turnFlow.fortifyEndCandidates,
    fortifyMaxTroops: turnFlow.fortifyMaxTroops,
    fortifyInputRef: turnFlow.fortifyInputRef,
    attackPendingConquest: attackFlow.attackPendingConquest,
    attackStartTerritoryId,
    attackEndTerritoryId,
    attackStartCandidates: attackFlow.attackStartCandidates,
    attackEndCandidates: attackFlow.attackEndCandidates,
    attackMoveMinTroops: attackFlow.attackMoveMinTroops,
    attackMoveMaxTroops: attackFlow.attackMoveMaxTroops,
    attackDiceRoll: attackFlow.attackDiceRoll,
    setAttackDiceRoll: attackFlow.setAttackDiceRoll,
    attackRevealing: attackFlow.attackRevealing,
    attackDiceOnly: attackFlow.attackDiceOnly,
    maxBlitzTroops: attackFlow.maxBlitzTroops,
    setAttackSelectedType: attackFlow.setAttackSelectedType,
    setAttackBlitzTroops: attackFlow.setAttackBlitzTroops,
    attackMoveInputRef: attackFlow.attackMoveInputRef,
    blitzInputRef: attackFlow.blitzInputRef,
    entrenchCandidates: turnFlow.entrenchCandidates,
    entrenchMaxTroops: turnFlow.entrenchMaxTroops,
    entrenchInputRef: turnFlow.entrenchInputRef,
    toxinsCandidates: turnFlow.toxinsCandidates,
    pendingAttackEmoji: emojiUI.pendingAttackEmoji,
    setPendingAttackEmoji: emojiUI.setPendingAttackEmoji,
    sendEmoji: emojiUI.sendEmoji,
    emojiPickerFor: emojiUI.emojiPickerFor,
    setEmojiPickerFor: emojiUI.setEmojiPickerFor,
    alliancePopupFor: allianceUI.alliancePopupFor,
    setAlliancePopupFor: allianceUI.setAlliancePopupFor,
    setToasts,
    setGame,
    setChatOpen,
    setPanelCollapsed: setPanelCollapsed,
    openPanel: openPanel,
    setOpenPanel: setOpenPanel,
    cardsOpen: cardsOpen,
    selectedCombo: cardsFlow.selectedCombo,
    playCardSet: cardsFlow.playCardSet,
    deployPanelOpen: cardsFlow.deployPanelOpen,
    deployInputRef: cardsFlow.deployInputRef,
    setDeployTroops: cardsFlow.setDeployTroops,
    submitDeploy: cardsFlow.submitDeploy,
    fortifyPanelOpen: turnFlow.fortifyPanelOpen,
    setFortifyTroops: turnFlow.setFortifyTroops,
    cancelFortify: turnFlow.cancelFortify,
    selectFortifyStart: turnFlow.selectFortifyStart,
    selectFortifyEnd: turnFlow.selectFortifyEnd,
    submitFortify: turnFlow.submitFortify,
    entrenchPanelOpen: turnFlow.entrenchPanelOpen,
    setEntrenchTroops: turnFlow.setEntrenchTroops,
    submitEntrench: turnFlow.submitEntrench,
    toxinsPanelOpen: turnFlow.toxinsPanelOpen,
    submitToxins: turnFlow.submitToxins,
    attackPanelOpen: attackFlow.attackPanelOpen,
    attackShowPendingConquest: attackFlow.attackShowPendingConquest,
    setAttackMoveTroops: attackFlow.setAttackMoveTroops,
    cycleAttackOption: attackFlow.cycleAttackOption,
    selectAttackStart: attackFlow.selectAttackStart,
    selectAttackEnd: attackFlow.selectAttackEnd,
    submitAttackMove: attackFlow.submitAttackMove,
    cancelAttack: attackFlow.cancelAttack,
    submitAttack: attackFlow.submitAttack,
    canAdvancePhase,
  });

  const tooltipLabels = computeTooltipLabels(
    interactions.tooltipTerritoryId,
    portalTerritoryIds,
    radiationById,
    visibleTerritoryById,
    ownerById,
    toxinById,
  );

  useAutoAdvancePhase({
    isMyTurn,
    paused,
    turnPhase,
    attackPendingConquest: attackFlow.attackPendingConquest,
    attackStartCandidatesSize: attackFlow.attackStartCandidates.size,
    fortifyStartCandidatesSize: turnFlow.fortifyStartCandidates.size,
    entrenchCandidatesSize: turnFlow.entrenchCandidates.size,
    toxinsCandidatesSize: turnFlow.toxinsCandidates.size,
    roundNumber,
    turnPlayerIndex,
    autoAdvanceKeyRef,
    setGame,
  });

  const deployPhaseKey =
    turnPhase === 'deploy' && currentTurnPlayer
      ? `${roundNumber}-${turnPlayerIndex}`
      : null;
  if (
    deployPhaseKey !== null &&
    processedDeployPhaseKey !== deployPhaseKey &&
    currentTurnPlayer
  ) {
    setProcessedDeployPhaseKey(deployPhaseKey);
    setToasts((prev) => [
      ...prev,
      {
        id: Date.now(),
        message: `${currentTurnPlayer.name} received ${troopsToDeploy} troops at the start of their turn`,
      },
      ...(isMyTurn && cardsFlow.hasSetToPlay
        ? [
            {
              id: Date.now() + 1,
              message: 'You have a card set available to play!',
            },
          ]
        : []),
    ]);
  }

  if (isCapitals && !capitalModeAnnounced && roundNumber >= 2) {
    setCapitalModeAnnounced(true);
    setToasts((prev) => [
      ...prev,
      { id: Date.now(), message: 'Capitals mode activated' },
    ]);
  }

  useResetTroopInputOnSelection({
    selectedTerritoryId,
    turnPhase,
    troopsToDeploy,
    setEntrenchTroops: turnFlow.setEntrenchTroops,
    setDeployTroops: cardsFlow.setDeployTroops,
  });

  const hasToxinTerritories = displayedToxinTerritories.length > 0;
  useAnimationActiveFlags({
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
  });

  const {
    zoomedRadius,
    tooltipScreenPos,
    deployPanelStyle,
    fortifyPanelStyle,
    attackPanelStyle,
  } = usePanelStyles({
    territories,
    size,
    transform,
    imgDims,
    VERTEX_RADIUS,
    tooltipTerritoryId: interactions.tooltipTerritoryId,
    selectedTerritoryId,
    fortifyEndTerritoryId,
    attackEndTerritoryId,
    attackDiceRollTerritoryId: attackFlow.attackDiceRoll?.territoryId,
  });

  useEffect(() => {
    drawGameMapCanvas({
      canvasRef,
      size,
      imgDims,
      transform,
      imageRef,
      supplyLineEdgesByPlayer,
      territories,
      fortifyPathTerritoryIds,
      portalTerritoryIds,
      portalsEnabled,
      attackStartTerritoryId,
      attackEndTerritoryId,
      replayConquestArrow,
      bonusesOpen: bonusesOpen,
      gameMode,
      continentId,
      players,
      displayedToxinTerritories,
      radiationById,
      radiationPlacedAtRef,
      visibleTerritoryIds,
      frozenVisibleTerritoryIdsRef,
      radiationUpcomingById,
      ownerById,
      frozenTerritoryDataRef,
      nodeState: interactions.nodeState,
      frozenOwnerRef,
      VERTEX_RADIUS,
      toxinPlacedAtRef,
      isMyTurn,
      attackPendingConquest: attackFlow.attackPendingConquest,
      attackMoveTroops: attackFlow.attackMoveTroops,
      deployPanelOpen: cardsFlow.deployPanelOpen,
      selectedTerritoryId,
      deployTroops: cardsFlow.deployTroops,
      fortifyPanelOpen: turnFlow.fortifyPanelOpen,
      fortifyEndTerritoryId,
      fortifyTroops: turnFlow.fortifyTroops,
      fortifyStartTerritoryId,
      frozenTroopsRef,
      cardByTerritoryId: cardsFlow.cardByTerritoryId,
      ownedTerritoryIds,
      cardsOpen: cardsOpen,
      selectedCombo: cardsFlow.selectedCombo,
      cardImagesRef,
      bonuses,
    });
  });

  const attackDisplay = attackFlow.attackDisplay;
  const hand = cardsFlow.hand;
  const combos = cardsFlow.combos;
  const hasSetToPlay = cardsFlow.hasSetToPlay;

  const surrender = useCallback(() => {
    connector.surrender((res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  }, [setGame]);

  return (
    <div className="position-fixed top-0 bottom-0 start-0 end-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={interactions.handleMouseDown}
        onMouseMove={interactions.handleMouseMove}
        onMouseUp={interactions.handleMouseUp}
        onMouseLeave={interactions.handleMouseLeave}
        onContextMenu={interactions.handleContextMenu}
        onTouchStart={interactions.handleTouchStart}
        onTouchMove={interactions.handleTouchMove}
        onTouchEnd={interactions.handleTouchEnd}
        onTouchCancel={interactions.handleTouchCancel}
        style={{
          display: 'block',
          width: size.w,
          height: size.h,
          touchAction: 'none',
          cursor: emojiUI.pendingAttackEmoji
            ? 'crosshair'
            : interactions.hoveredId !== null
              ? 'pointer'
              : interactions.isDragging
                ? 'grabbing'
                : 'grab',
        }}
      />
      {tooltipScreenPos && tooltipLabels.length > 0 && (
        <div
          className="position-absolute px-2 py-1 rounded text-white small"
          style={{
            left: tooltipScreenPos.x,
            top: tooltipScreenPos.y - zoomedRadius - 8,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(0, 0, 0, 0.85)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          {tooltipLabels.join(' · ')}
        </div>
      )}
      <MapButtonsColumn
        cardsButtonsTop={cardsButtonsTop}
        buttonColumnRef={buttonColumnRef}
        bonusesButtonRef={bonusesButtonRef}
        whiteBonusIcon={whiteBonusIcon}
        setOpenPanel={setOpenPanel}
        bonusesOpen={bonusesOpen}
        cardsOpen={cardsOpen}
        cardsPanelRef={cardsPanelRef}
        hand={hand}
        ownedTerritoryIds={ownedTerritoryIds}
        upcomingSetValues={upcomingSetValues}
        combos={combos}
        selectedCombo={cardsFlow.selectedCombo}
        setSelectedComboKey={cardsFlow.setSelectedComboKey}
        isMyTurn={isMyTurn}
        turnPhase={turnPhase}
        playCardSet={cardsFlow.playCardSet}
        cardsButtonRef={cardsButtonRef}
        whiteCardsIcon={whiteCardsIcon}
        gameEnded={gameEnded}
        hasSetToPlay={hasSetToPlay}
        setAwardedCards={cardsFlow.setAwardedCards}
        logsOpen={logsOpen}
        logsPanelRef={logsPanelRef}
        logs={logs}
        logsPanelTop={logsPanelTop}
        logsButtonRef={logsButtonRef}
        whiteLogsIcon={whiteLogsIcon}
        settingsOpen={settingsOpen}
        settingsPanelRef={settingsPanelRef}
        settingsPanelTop={settingsPanelTop}
        settingsButtonRef={settingsButtonRef}
        whiteSettingsIcon={whiteSettingsIcon}
        settingsMenuOpen={settingsMenuOpen}
        game={game}
        awardedCards={cardsFlow.awardedCards}
      />
      <PlayersPanel
        players={displayedPlayers}
        spectators={spectators}
        gameMode={gameMode}
        isTeamDeathmatch={isTeamDeathmatch}
        isCapitals={isCapitals}
        starvation={starvation}
        bounties={bounties}
        territoryTroopsCap={territoryTroopsCap}
        totalTroopsCap={totalTroopsCap}
        toxins={toxins}
        toxinsCost={turnFlow.toxinsCostValue}
        mission={mission}
        selfId={selfId}
        roundNumber={panelRoundNumber}
        turnPhase={panelTurnPhase}
        turnPlayerId={
          showReplay && replayTurnPlayerId !== null
            ? replayTurnPlayerId
            : (currentTurnPlayer?.id ?? null)
        }
        hostId={hostId}
        paused={paused}
        onTogglePause={onTogglePause}
        onSurrender={surrender}
        gameEnded={gameEnded}
        collapsed={panelCollapsed}
        setCollapsed={setPanelCollapsed}
        navigate={navigate}
        rowRefs={emojiUI.rowRefs}
        onRowClick={emojiUI.handlePlayerRowClick}
        emojiTargeting={emojiUI.pendingAttackEmoji !== null}
        emojiPops={emojiUI.emojiPops}
        emojiAllowedIds={emojiUI.emojiAllowedIds}
        alliances={alliances}
        allianceStates={allianceStates}
        allianceCellRefs={allianceUI.allianceCellRefs}
        onAllianceCellClick={allianceUI.handleAllianceCellClick}
        allianceCooldownIds={allianceUI.allianceCooldownIds}
      />
      <AlliancePopupOverlay
        alliancePopupFor={allianceUI.alliancePopupFor}
        allianceStateWith={allianceUI.allianceStateWith}
        allianceCellRefs={allianceUI.allianceCellRefs}
        alliancePopupRef={allianceUI.alliancePopupRef}
        respondAllianceRequest={allianceUI.respondAllianceRequest}
        setAlliancePopupFor={allianceUI.setAlliancePopupFor}
        terminateAlliance={allianceUI.terminateAlliance}
      />
      <EmojiOverlay
        emojiPickerFor={emojiUI.emojiPickerFor}
        rowRefs={emojiUI.rowRefs}
        emojiPickerRef={emojiUI.emojiPickerRef}
        size={size}
        handleEmojiPick={emojiUI.handleEmojiPick}
        whiteMutedIcon={whiteMutedIcon}
        whiteUnmutedIcon={whiteUnmutedIcon}
        whiteGlobeIcon={whiteGlobeIcon}
        emojiPops={emojiUI.emojiPops}
        emojiFlights={emojiUI.emojiFlights}
        bumpMuteVersion={bumpMuteVersion}
        gameEnded={gameEnded}
        players={playersWithAccounts}
        navigate={navigate}
      />
      {showReplay && replayTerritories && (
        <ReplayPanel
          index={replayIndex}
          totalFrames={replayTotalFrames}
          playing={replayPlaying}
          speed={replaySpeed}
          roundNumber={(replayRoundNumber ?? 0) + 1}
          color={replayPlayerColor}
          onTogglePlay={replayTogglePlay}
          onStepBack={replayStepBackward}
          onStepForward={replayStepForward}
          onJumpStart={replayJumpToStart}
          onJumpEnd={replayJumpToEnd}
          onSeek={replaySeek}
          onCycleSpeed={replayCycleSpeed}
        />
      )}
      <TurnActionPanels
        currentTurnPlayer={currentTurnPlayer}
        gameEnded={gameEnded}
        turnPhase={turnPhase}
        turnDuration={turnDuration}
        paused={paused}
        turnStartedAt={turnStartedAt}
        isMyTurn={isMyTurn}
        troopsToDeploy={troopsToDeploy}
        mustPlaySet={cardsFlow.mustPlaySet}
        setGame={setGame}
        nextPhaseEndsTurn={nextPhaseEndsTurn}
        tankFireId={tankFireId}
        deployPanelOpen={cardsFlow.deployPanelOpen}
        deployPanelStyle={deployPanelStyle}
        deployTroops={cardsFlow.deployTroops}
        deployInputRef={cardsFlow.deployInputRef}
        setDeployTroops={cardsFlow.setDeployTroops}
        submitDeploy={cardsFlow.submitDeploy}
        fortifyPanelOpen={turnFlow.fortifyPanelOpen}
        fortifyPanelStyle={fortifyPanelStyle}
        fortifyTroops={turnFlow.fortifyTroops}
        fortifyMaxTroops={turnFlow.fortifyMaxTroops}
        fortifyInputRef={turnFlow.fortifyInputRef}
        setFortifyTroops={turnFlow.setFortifyTroops}
        submitFortify={turnFlow.submitFortify}
        entrenchPanelOpen={turnFlow.entrenchPanelOpen}
        entrenchTroops={turnFlow.entrenchTroops}
        entrenchMaxTroops={turnFlow.entrenchMaxTroops}
        entrenchCurrentTurns={turnFlow.entrenchCurrentTurns}
        entrenchInputRef={turnFlow.entrenchInputRef}
        setEntrenchTroops={turnFlow.setEntrenchTroops}
        submitEntrench={turnFlow.submitEntrench}
        toxinsPanelOpen={turnFlow.toxinsPanelOpen}
        toxinsWastedTroops={turnFlow.toxinsWastedTroops}
        submitToxins={turnFlow.submitToxins}
        attackPanelOpen={attackFlow.attackPanelOpen}
        attackPanelStyle={attackPanelStyle}
        attackDisplay={attackDisplay}
        blitzInputRef={attackFlow.blitzInputRef}
        attackDiceRoll={attackFlow.attackDiceRoll}
        setAttackDiceRoll={attackFlow.setAttackDiceRoll}
        setAttackSelectedType={attackFlow.setAttackSelectedType}
        setAttackRegularTroops={attackFlow.setAttackRegularTroops}
        setAttackBlitzTroops={attackFlow.setAttackBlitzTroops}
        maxBlitzTroops={attackFlow.maxBlitzTroops}
        attackRevealing={attackFlow.attackRevealing}
        attackDiceOnly={attackFlow.attackDiceOnly}
        attackShowPendingConquest={attackFlow.attackShowPendingConquest}
        attackMoveTroops={attackFlow.attackMoveTroops}
        attackMoveMinTroops={attackFlow.attackMoveMinTroops}
        attackMoveMaxTroops={attackFlow.attackMoveMaxTroops}
        attackMoveInputRef={attackFlow.attackMoveInputRef}
        setAttackMoveTroops={attackFlow.setAttackMoveTroops}
        submitAttackMove={attackFlow.submitAttackMove}
        submitAttack={attackFlow.submitAttack}
      />
      <ToastContainer
        position="top-center"
        className="position-fixed p-3"
        style={{ zIndex: 3 }}
      >
        <Toast
          show={paused && !gameEnded}
          className="mx-auto"
          style={{ width: 'fit-content', maxWidth: 'none' }}
        >
          <Toast.Body className="text-nowrap fw-bold">Game Paused</Toast.Body>
        </Toast>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            onClose={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            autohide
            delay={5000}
            className="mx-auto"
            style={{ width: 'fit-content', maxWidth: 'none' }}
          >
            <Toast.Body className="text-nowrap">{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
      {!gameEnded && cardsFlow.cardSetFlash && (
        <div
          key={cardsFlow.cardSetFlash.id}
          className="position-fixed top-50 start-50 d-flex gap-3 bg-body bg-opacity-75 border rounded p-3"
          style={{
            zIndex: 4,
            pointerEvents: 'none',
            animation: `annexCardSetFlash ${CARD_SET_FLASH_DURATION / 1000}s ease-out forwards`,
          }}
        >
          <style>{`
            @keyframes annexCardSetFlash {
              0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
              15% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
              25% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              85% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0; }
            }
          `}</style>
          {cardsFlow.cardSetFlash.cards.map((card, i) => (
            <CardFace key={i} card={card} size={90} />
          ))}
        </div>
      )}
    </div>
  );
}

export default GameMap;
