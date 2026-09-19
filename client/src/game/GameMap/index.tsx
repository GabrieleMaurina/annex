import { MAX_TERRITORY_TROOPS } from 'engine';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useWhiteIcon } from '../../common/icon';
import { connector } from '../../connector';
import type { Ack } from '../../lib/types';
import { buildForcedWraps } from '../mapMath';
import PlayersPanel from '../panels/PlayersPanel';
import ReplayPanel from '../panels/ReplayPanel';
import { drawGameMapCanvas } from './draw/drawCanvas';
import {
  computeTooltipLabels,
  getScales,
  getTerritoryScreenPos,
} from './helpers';
import { useAttackSeaFlow } from './hooks/sea/useAttackSeaFlow';
import { useDeploySeaFlow } from './hooks/sea/useDeploySeaFlow';
import { useSailFlow } from './hooks/sea/useSailFlow';
import { useAllianceUI } from './hooks/useAllianceUI';
import { useAttackFlow } from './hooks/useAttackFlow';
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
import { useDisplayedGame } from './hooks/view/useDisplayedGame';
import { useGameCanvasInteractions } from './hooks/view/useGameCanvasInteractions';
import { useNukeControls } from './hooks/view/useNukeControls';
import { useTurnToasts } from './hooks/view/useTurnToasts';
import AlliancePopupOverlay from './overlays/AlliancePopupOverlay';
import CardSetFlash from './overlays/CardSetFlash';
import EmojiOverlay from './overlays/EmojiOverlay';
import GameToasts, { type GameToast } from './overlays/GameToasts';
import MapButtonsColumn from './overlays/MapButtonsColumn';
import TurnActionPanels from './overlays/TurnActionPanels';
import type { GameMapProps } from './props';

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
  botSpeed,
  hostId,
  onTogglePause,
  onCycleBotSpeed,
  selectedTerritoryId,
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  fortifyPathTerritoryIds,
  attackStartTerritoryId,
  attackEndTerritoryId,
  attackConquestMinTroops,
  attackPathTerritoryIds,
  sailStartTerritoryId,
  sailEndTerritoryId,
  sailPathTerritoryIds,
  attackSeaTerritoryId,
  attackSeaDefenderId,
  seas,
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
  const whiteNukesIcon = useWhiteIcon('/icons/nuke.svg');

  const {
    canvasRef,
    imageRef,
    territories,
    seaTerritories,
    bonuses,
    wraps,
    transform,
    setTransform,
    imgDims,
    size,
  } = useMapView(mapName, game.playerMapId);

  const forcedWraps = useMemo(
    () => buildForcedWraps([...territories, ...seaTerritories], wraps),
    [territories, seaTerritories, wraps],
  );

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
  } = useLiveGameRefs();

  const [toasts, setToasts] = useState<GameToast[]>([]);
  const addToasts = useCallback(
    (messages: string[]) =>
      setToasts((prev) => [
        ...prev,
        ...messages.map((message, i) => ({ id: Date.now() + i, message })),
      ]),
    [],
  );
  const [, bumpMuteVersion] = useReducer((c) => c + 1, 0);

  const {
    frozenTroopsRef,
    frozenOwnerRef,
    frozenVisibleTerritoryIdsRef,
    frozenTerritoryDataRef,
    frozenSeaShipsRef,
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
    seaTerritoriesRef,
    seasRef,
    ownerByIdRef,
    colorByPlayerIdRef,
    visibleTerritoryIdsRef,
    adjustTerritoryTroops,
    adjustToxinTerritories,
    setRadiationTerritoryIds,
    setRadiationUpcomingTerritoryIds,
  });
  useEffect(() => {
    onReplayIndexChange?.(replay.index);
  }, [replay.index, onReplayIndexChange]);

  const currentTurnPlayer = players[turnPlayerIndex];
  const isMyTurn = currentTurnPlayer?.id === selfId;
  const {
    ownerById,
    displayedSeas,
    displayedPlayers,
    playersWithAccounts,
    panelRoundNumber,
    panelTurnPhase,
    panelTurnPlayerId,
    displayedToxinTerritories,
    toxinById,
    radiationById,
    radiationUpcomingById,
    unusableTerritoryById,
    antiNukeById,
    visibleTerritoryById,
    replayPlayer,
    replayPlayerColor,
    replayHandCards,
    replayActingOwnedIds,
    displayedLogs,
    nukesGame,
  } = useDisplayedGame({
    game,
    players,
    ownership,
    seas,
    results,
    roundNumber,
    turnPhase,
    turnPlayerIndex,
    toxinTerritories,
    radiationTerritoryIds,
    radiationUpcomingTerritoryIds,
    visibleTerritoryIds,
    logs,
    showReplay,
    replay,
  });
  const ownedTerritoryIds = new Set(
    ownership.filter((o) => o.ownerId === selfId).map((o) => o.id),
  );

  useEffect(() => {
    ownerByIdRef.current = ownerById;
    territoriesRef.current = territories;
    seaTerritoriesRef.current = seaTerritories;
    seasRef.current = seas;
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
    seaTerritories,
    seas,
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

  const sailFlow = useSailFlow({
    sailStartTerritoryId,
    sailEndTerritoryId,
    seaTerritories,
    seas,
    selfId,
    turnPhase,
    isMyTurn,
    paused,
    setGame,
  });

  const attackSeaFlow = useAttackSeaFlow({
    attackSeaTerritoryId,
    attackSeaDefenderId,
    seaTerritories,
    seas,
    selfId,
    turnPhase,
    isMyTurn,
    paused,
    setGame,
  });

  const turnFlow = useTurnActionFlows({
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    territories,
    seaTerritories,
    seas,
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
    nukesOpen,
    cardsButtonsTop,
    cardsPanelRef,
    cardsButtonRef,
    bonusesButtonRef,
    logsButtonRef,
    logsPanelRef,
    settingsButtonRef,
    settingsPanelRef,
    nukesButtonRef,
    nukesPanelRef,
    buttonColumnRef,
    logsPanelTop,
    settingsPanelTop,
    panelCollapsed,
    setPanelCollapsed,
  } = usePanelsUI();

  useEffect(() => {
    onPanelOpenChange(openPanel !== null);
  }, [openPanel, onPanelOpenChange]);

  const { nukeReady, nukeTargeting, setNukeTargeting, nukes } = useNukeControls(
    {
      game,
      roundNumber,
      turnPlayerIndex,
      turnPhase,
      paused,
      showReplay,
      setGame,
      isMyTurn,
      nukesOpen,
      setToasts,
    },
  );

  const deploySeaFlow = useDeploySeaFlow({
    selectedTerritoryId,
    territories,
    seaTerritories,
    ownerById,
    troopsToDeploy,
    turnPhase,
    isMyTurn,
    paused,
    selfId,
    setGame,
  });

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

  const deployMaxTroops = Math.max(
    0,
    Math.min(
      troopsToDeploy,
      MAX_TERRITORY_TROOPS -
        (ownerById.get(selectedTerritoryId ?? -1)?.troops ?? 0),
    ),
  );
  const deployTroopsPanelOpen =
    cardsFlow.deployPanelOpen &&
    !deploySeaFlow.comboActive &&
    deployMaxTroops > 0;

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
      seaTerritories,
      seas: displayedSeas,
      ownerById,
      portalTerritoryIds,
      portalsEnabled,
      imgWidth: imgDims.w,
      imgHeight: imgDims.h,
      showReplay,
      visibleTerritoryIds,
      selfId,
    });
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

  const interactions = useGameCanvasInteractions({
    canvasRef,
    territories,
    seaTerritories,
    sailStartTerritoryId,
    sailEndTerritoryId,
    attackSeaTerritoryId,
    attackSeaDefenderId,
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
    deployMaxTroops,
    supplyConnectedTerritoryIds,
    ownerById,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    attackStartTerritoryId,
    attackEndTerritoryId,
    nukeTargeting,
    setNukeTargeting,
    antiNukeTerritoryIds: game.antiNukeTerritoryIds,
    setToasts,
    setGame,
    setChatOpen,
    setPanelCollapsed,
    openPanel,
    setOpenPanel,
    cardsOpen,
    deployPanelOpen: deployTroopsPanelOpen,
    canAdvancePhase,
    sailFlow,
    attackSeaFlow,
    attackFlow,
    turnFlow,
    deploySeaFlow,
    cardsFlow,
    emojiUI,
    allianceUI,
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
    nukeReady,
    fortifyStartCandidatesSize: turnFlow.fortifyStartCandidates.size,
    entrenchCandidatesSize: turnFlow.entrenchCandidates.size,
    toxinsCandidatesSize: turnFlow.toxinsCandidates.size,
    roundNumber,
    turnPlayerIndex,
    autoAdvanceKeyRef,
    setGame,
  });

  useTurnToasts({
    turnPhase,
    roundNumber,
    turnPlayerIndex,
    troopsToDeploy,
    isCapitals,
    players,
    isMyTurn,
    hasSetToPlay: cardsFlow.hasSetToPlay,
    addToasts,
  });

  useResetTroopInputOnSelection({
    selectedTerritoryId,
    turnPhase,
    deployMaxTroops,
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
    sailStartTerritoryId,
    sailEndTerritoryId,
    replayConquestArrow: replay.conquestArrow,
    portalsEnabled,
    portalTerritoryIds,
    hasToxinTerritories,
    radiationById,
    radiationUpcomingById,
    visibleTerritoryIds,
    territories,
    seaTerritories,
    startAnimationLoop,
  });

  const {
    zoomedRadius,
    tooltipScreenPos,
    deployPanelStyle,
    fortifyPanelStyle,
    attackPanelStyle,
    sailPanelStyle,
    attackSeaPanelStyle,
    deploySeaPanelStyle,
  } = usePanelStyles({
    territories,
    seaTerritories,
    size,
    transform,
    imgDims,
    VERTEX_RADIUS,
    tooltipTerritoryId: interactions.tooltipTerritoryId,
    selectedTerritoryId,
    fortifyEndTerritoryId,
    attackEndTerritoryId,
    attackDiceRollTerritoryId: attackFlow.attackDiceRoll?.territoryId,
    sailEndTerritoryId,
    attackSeaTerritoryId,
    attackSeaDiceRollTerritoryId: attackSeaFlow.attackSeaDiceRoll?.territoryId,
    deploySeaTerritoryId: deploySeaFlow.deploySeaTerritoryId,
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
      seaTerritories,
      seas: displayedSeas,
      fortifyPathTerritoryIds,
      attackPathTerritoryIds,
      sailPathTerritoryIds,
      portalTerritoryIds,
      portalsEnabled,
      attackStartTerritoryId,
      attackEndTerritoryId,
      replayConquestArrow: replay.conquestArrow,
      bonusesOpen: bonusesOpen,
      gameMode,
      continentId,
      players,
      displayedToxinTerritories,
      radiationById,
      antiNukeById,
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
      deployPanelOpen: deployTroopsPanelOpen,
      selectedTerritoryId,
      deployTroops: cardsFlow.deployTroops,
      fortifyPanelOpen: turnFlow.fortifyPanelOpen,
      fortifyEndTerritoryId,
      fortifyTroops: turnFlow.fortifyTroops,
      fortifyStartTerritoryId,
      frozenTroopsRef,
      frozenSeaShipsRef,
      cardByTerritoryId: cardsFlow.cardByTerritoryId,
      ownedTerritoryIds,
      cardsOpen: cardsOpen,
      selectedCombo: cardsFlow.selectedCombo,
      cardImagesRef,
      bonuses,
      forcedWraps,
    });
  });

  const attackDisplay = attackFlow.attackDisplay;
  const hand = showReplay ? replayHandCards : cardsFlow.hand;
  const combos = showReplay ? [] : cardsFlow.combos;
  const hasSetToPlay = showReplay ? false : cardsFlow.hasSetToPlay;

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
        ownedTerritoryIds={
          showReplay ? replayActingOwnedIds : ownedTerritoryIds
        }
        upcomingSetValues={upcomingSetValues}
        combos={combos}
        selectedCombo={showReplay ? undefined : cardsFlow.selectedCombo}
        setSelectedComboKey={cardsFlow.setSelectedComboKey}
        isMyTurn={showReplay ? false : isMyTurn}
        turnPhase={turnPhase}
        playCardSet={cardsFlow.playCardSet}
        cardsButtonRef={cardsButtonRef}
        whiteCardsIcon={whiteCardsIcon}
        gameEnded={gameEnded}
        showReplay={showReplay}
        cardsTitle={
          showReplay && replayPlayer
            ? `${replayPlayer.name}'s Cards`
            : undefined
        }
        hasSetToPlay={hasSetToPlay}
        setAwardedCards={cardsFlow.setAwardedCards}
        logsOpen={logsOpen}
        logsPanelRef={logsPanelRef}
        logs={displayedLogs}
        logsPanelTop={logsPanelTop}
        logsButtonRef={logsButtonRef}
        whiteLogsIcon={whiteLogsIcon}
        settingsOpen={settingsOpen}
        settingsPanelRef={settingsPanelRef}
        settingsPanelTop={settingsPanelTop}
        settingsButtonRef={settingsButtonRef}
        whiteSettingsIcon={whiteSettingsIcon}
        settingsMenuOpen={settingsMenuOpen}
        game={nukesGame}
        awardedCards={cardsFlow.awardedCards}
        nukesButtonRef={nukesButtonRef}
        nukesPanelRef={nukesPanelRef}
        whiteNukesIcon={whiteNukesIcon}
        nukes={nukes}
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
        turnPlayerId={panelTurnPlayerId}
        hostId={hostId}
        paused={paused}
        botSpeed={botSpeed}
        onTogglePause={onTogglePause}
        onCycleBotSpeed={onCycleBotSpeed}
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
      {showReplay && replay.territories && (
        <ReplayPanel
          index={replay.index}
          totalFrames={replay.totalFrames}
          playing={replay.playing}
          speed={replay.speed}
          roundNumber={(replay.roundNumber ?? 0) + 1}
          color={replayPlayerColor}
          onTogglePlay={replay.togglePlay}
          onStepBack={replay.stepBackward}
          onStepForward={replay.stepForward}
          onJumpStart={replay.jumpToStart}
          onJumpEnd={replay.jumpToEnd}
          onSeek={replay.seek}
          onCycleSpeed={replay.cycleSpeed}
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
        deployMaxTroops={deployMaxTroops}
        mustPlaySet={cardsFlow.mustPlaySet}
        setGame={setGame}
        nextPhaseEndsTurn={nextPhaseEndsTurn}
        tankFireId={tankFireId}
        deployPanelOpen={deployTroopsPanelOpen}
        deployPanelStyle={deployPanelStyle}
        deployTroops={cardsFlow.deployTroops}
        deployInputRef={cardsFlow.deployInputRef}
        setDeployTroops={cardsFlow.setDeployTroops}
        submitDeploy={cardsFlow.submitDeploy}
        deploySeaPanelOpen={deploySeaFlow.deploySeaPanelOpen}
        deploySeaPanelStyle={
          deploySeaFlow.comboActive ? deployPanelStyle : deploySeaPanelStyle
        }
        deploySeaComboActive={deploySeaFlow.comboActive}
        deploySeaShips={deploySeaFlow.deploySeaShips}
        deploySeaMaxShips={deploySeaFlow.deploySeaMaxShips}
        deploySeaInputRef={deploySeaFlow.deploySeaInputRef}
        setDeploySeaShips={deploySeaFlow.setDeploySeaShips}
        submitDeploySea={deploySeaFlow.submitDeploySea}
        sailPanelOpen={sailFlow.sailPanelOpen}
        sailPanelStyle={sailPanelStyle}
        sailShips={sailFlow.sailShips}
        sailMaxShips={sailFlow.sailMaxShips}
        sailInputRef={sailFlow.sailInputRef}
        setSailShips={sailFlow.setSailShips}
        submitSail={sailFlow.submitSail}
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
        attackSeaPanelOpen={attackSeaFlow.attackSeaPanelOpen}
        attackSeaPanelStyle={attackSeaPanelStyle}
        attackSeaDefenders={attackSeaFlow.attackSeaDefenders}
        attackSeaDefenderId={attackSeaDefenderId}
        selectAttackSeaDefender={attackSeaFlow.selectAttackSeaDefender}
        attackSeaSelectedType={attackSeaFlow.attackSeaSelectedType}
        setAttackSeaSelectedType={attackSeaFlow.setAttackSeaSelectedType}
        attackSeaRegularShips={attackSeaFlow.attackSeaRegularShips}
        setAttackSeaRegularShips={attackSeaFlow.setAttackSeaRegularShips}
        attackSeaBlitzShips={attackSeaFlow.attackSeaBlitzShips}
        setAttackSeaBlitzShips={attackSeaFlow.setAttackSeaBlitzShips}
        attackSeaMaxRegularShips={attackSeaFlow.attackSeaMaxRegularShips}
        attackSeaMaxBlitzShips={attackSeaFlow.attackSeaMaxBlitzShips}
        attackSeaWinProbabilities={attackSeaFlow.attackSeaWinProbabilities}
        attackSeaBlitzOutcomes={attackSeaFlow.attackSeaBlitzOutcomes}
        attackSeaInputRef={attackSeaFlow.attackSeaInputRef}
        attackSeaBlitzInputRef={attackSeaFlow.attackSeaBlitzInputRef}
        attackSeaDiceRoll={attackSeaFlow.attackSeaDiceRoll}
        attackSeaRevealing={attackSeaFlow.attackSeaRevealing}
        attackSeaDiceOnly={attackSeaFlow.attackSeaDiceOnly}
        submitAttackSea={attackSeaFlow.submitAttackSea}
        players={players}
      />
      <GameToasts
        paused={paused}
        gameEnded={gameEnded}
        toasts={toasts}
        setToasts={setToasts}
      />
      {!gameEnded && cardsFlow.cardSetFlash && (
        <CardSetFlash
          key={cardsFlow.cardSetFlash.id}
          cards={cardsFlow.cardSetFlash.cards}
        />
      )}
    </div>
  );
}

export default GameMap;
