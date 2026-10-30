import { useEffect, useReducer } from 'react';
import { useWhiteIcon } from '../../common/icon';
import PlayersPanel from '../panels/PlayersPanel';
import ReplayPanel from '../panels/ReplayPanel';
import { loadHourglassIcons } from './draw/drawTimedLinks';
import GameCanvas from './GameCanvas';
import {
  getScales,
  getTerritoryScreenPos,
  maxDeployTroops,
  unclaimedTerritoryIds,
} from './helpers';
import { useDeploySeaFlow } from './hooks/sea/useDeploySeaFlow';
import { useAllianceUI } from './hooks/useAllianceUI';
import { useCardsAndDeploy } from './hooks/useCardsAndDeploy';
import { useEmojiUI } from './hooks/useEmojiUI';
import { useGameSocketEvents } from './hooks/useGameSocketEvents';
import { useMapView } from './hooks/useMapView';
import {
  useAnimationActiveFlags,
  useAutoAdvancePhase,
  useGameEndActions,
  useLiveGameRefs,
  useLockViewportZoom,
  useResetTroopInputOnSelection,
  useSupplyLineOverlay,
} from './hooks/useMiscUiState';
import { usePanelsUI } from './hooks/usePanelsUI';
import { useActionFlows } from './hooks/view/useActionFlows';
import { useDisplayedGame } from './hooks/view/useDisplayedGame';
import { useGameCanvasInteractions } from './hooks/view/useGameCanvasInteractions';
import { useMapGraph } from './hooks/view/useMapGraph';
import { useNukeControls } from './hooks/view/useNukeControls';
import { useTurnToasts } from './hooks/view/useTurnToasts';
import AlliancePopupOverlay from './overlays/AlliancePopupOverlay';
import CardSetFlash from './overlays/CardSetFlash';
import EmojiOverlay from './overlays/EmojiOverlay';
import GameToasts from './overlays/GameToasts';
import MapButtonsColumn from './overlays/MapButtonsColumn';
import TurnActionPanels from './overlays/TurnActionPanels';
import { turnActionPanelsProps } from './overlays/turnActionPanelsProps';
import type { GameMapProps } from './props';
import { useGameToasts } from './useGameToasts';

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
  leaderTerritoryCount,
  territoriesToWin,
  troopsToDeploy,
  turnStartedAt,
  turnExtension,
  paused,
  pauseUsed,
  pausedAt,
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
    territories: mapTerritories,
    seaTerritories,
    bonuses,
    timedConnections,
    lockedTiles,
    forcedWraps,
    regions: mapRegions,
    placeNames,
    camera,
    imgDims,
    size,
  } = useMapView(mapName, game.playerMapId);

  useLockViewportZoom();

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
    getVertexScreenRadiusRef,
    autoAdvanceKeyRef,
    cardImagesRef,
  } = useLiveGameRefs();

  const { toasts, setToasts, addToasts } = useGameToasts();
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
    drawParamsRef,
    startAnimationLoop,
    replay,
  } = useGameSocketEvents({
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
    upcomingUnusableTerritoryById,
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
    placeNames,
  });
  const { territories, openTerritories, regions, closedTiles, timedLinks } =
    useMapGraph({
      mapTerritories,
      mapRegions,
      timedConnections,
      lockedTiles,
      unlockedTileIds: replay.unlockedTileIds ?? game.unlockedTileIds,
      round: showReplay ? (replay.roundNumber ?? 0) : roundNumber,
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
      getTerritoryScreenPos(t, size, camera.get(), imgDims);
    getVertexScreenRadiusRef.current = () =>
      VERTEX_RADIUS *
      getScales(size.w, size.h, camera.get().zoom, imgDims).scaleX;
  });

  const { attackFlow, sailFlow, attackSeaFlow, turnFlow } = useActionFlows({
    attackStartTerritoryId,
    attackEndTerritoryId,
    attackConquestMinTroops,
    sailStartTerritoryId,
    sailEndTerritoryId,
    attackSeaTerritoryId,
    attackSeaDefenderId,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    selectedTerritoryId,
    territories,
    seaTerritories,
    seas,
    ownerById,
    selfId,
    fortification,
    portalTerritoryIds,
    portalsEnabled,
    unusableTerritoryById,
    upcomingUnusableTerritoryById,
    turnPhase,
    isMyTurn,
    paused,
    game,
    toxins,
    closedTiles,
    cards,
    nextSetBaseValues,
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
  } = usePanelsUI(settingsMenuOpen, onPanelOpenChange);

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
    botSpeed,
    cardsOpen: cardsOpen,
    setOpenPanel: setOpenPanel,
    setToasts,
    setGame,
  });

  const deployMaxTroops = maxDeployTroops(
    troopsToDeploy,
    ownerById.get(selectedTerritoryId ?? -1)?.troops ?? 0,
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
    getVertexScreenRadiusRef,
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
    (turnPhase === 'territory' ||
      (turnPhase === 'capital' && game.placement === 'single')) &&
    isMyTurn
      ? unclaimedTerritoryIds(territories, ownerById, radiationById)
      : new Set<number>();
  const canAdvancePhase =
    isMyTurn &&
    !paused &&
    turnPhase !== 'territory' &&
    turnPhase !== 'troop' &&
    turnPhase !== 'capital' &&
    (turnPhase !== 'deploy' || (troopsToDeploy <= 0 && !cardsFlow.mustPlaySet));

  const interactions = useGameCanvasInteractions({
    canvasRef,
    territories,
    seaTerritories,
    sailStartTerritoryId,
    sailEndTerritoryId,
    attackSeaTerritoryId,
    attackSeaDefenderId,
    camera,
    regions,
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
    blitzEnabled: game.blitz !== 'off',
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
    bonusesEnabled: game.continents !== 'off',
    cardsEnabled: game.cards !== 'off',
    nukesEnabled: nukes !== null,
    settingsMenuOpen,
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
    botSpeed,
    isMyTurn,
    hasSetToPlay: cardsFlow.hasSetToPlay,
    earlyWin: game.earlyWin && !gameEnded,
    selfId,
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
    hasTimedLinks: timedLinks.length > 0,
    radiationById,
    radiationUpcomingById,
    visibleTerritoryIds,
    territories,
    seaTerritories,
    startAnimationLoop,
  });

  useEffect(
    () => camera.subscribe(startAnimationLoop),
    [camera, startAnimationLoop],
  );

  useEffect(() => {
    loadHourglassIcons().then(startAnimationLoop);
  }, [startAnimationLoop]);

  useEffect(() => {
    drawParamsRef.current = {
      canvasRef,
      size,
      imgDims,
      camera,
      imageRef,
      supplyLineEdgesByPlayer,
      territories: openTerritories,
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
      hillTerritoryIds: game.hillTerritoryIds,
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
      showReplay,
      continentsEnabled: game.continents !== 'off',
      cardsOpen: cardsOpen,
      selectedCombo: cardsFlow.selectedCombo,
      cardImagesRef,
      bonuses:
        game.continentBonuses.length > 0 ? game.continentBonuses : bonuses,
      forcedWraps,
      regions,
      timedLinks,
      unlockTiles: attackFlow.unlockTiles,
      placeNames,
    };
    startAnimationLoop();
  });

  const { surrender, endGame } = useGameEndActions(setGame);

  return (
    <div className="position-fixed top-0 bottom-0 start-0 end-0 overflow-hidden">
      <GameCanvas
        canvasRef={canvasRef}
        interactions={interactions}
        pendingAttackEmoji={emojiUI.pendingAttackEmoji}
        camera={camera}
        territories={territories}
        size={size}
        imgDims={imgDims}
        VERTEX_RADIUS={VERTEX_RADIUS}
        portalTerritoryIds={portalTerritoryIds}
        radiationById={radiationById}
        visibleTerritoryById={visibleTerritoryById}
        ownerById={ownerById}
        toxinById={toxinById}
        placeNames={placeNames}
      />
      <MapButtonsColumn
        cardsButtonsTop={cardsButtonsTop}
        buttonColumnRef={buttonColumnRef}
        bonusesButtonRef={bonusesButtonRef}
        whiteBonusIcon={whiteBonusIcon}
        setOpenPanel={setOpenPanel}
        bonusesOpen={bonusesOpen}
        cardsOpen={cardsOpen}
        cardsPanelRef={cardsPanelRef}
        hand={showReplay ? replayHandCards : cardsFlow.hand}
        ownedTerritoryIds={
          showReplay ? replayActingOwnedIds : ownedTerritoryIds
        }
        upcomingSetValues={upcomingSetValues}
        combos={showReplay ? [] : cardsFlow.combos}
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
        hasSetToPlay={showReplay ? false : cardsFlow.hasSetToPlay}
        setAwardedCards={cardsFlow.setAwardedCards}
        logsOpen={logsOpen}
        logsPanelRef={logsPanelRef}
        logs={displayedLogs}
        logsStats={
          showReplay ? undefined : players.find((p) => p.id === selfId)
        }
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
        cards={cards}
        territoryTroopsCap={territoryTroopsCap}
        totalTroopsCap={totalTroopsCap}
        leaderTerritoryCount={leaderTerritoryCount}
        territoriesToWin={territoriesToWin}
        maxPoints={game.maxPoints}
        toxins={toxins}
        toxinsCost={turnFlow.toxinsCostValue}
        mission={mission}
        continentNames={placeNames.continents}
        selfId={selfId}
        roundNumber={panelRoundNumber}
        turnPhase={panelTurnPhase}
        turnPlayerId={panelTurnPlayerId}
        hostId={hostId}
        paused={paused}
        pauseUsed={pauseUsed}
        botSpeed={botSpeed}
        onTogglePause={onTogglePause}
        onCycleBotSpeed={onCycleBotSpeed}
        onSurrender={surrender}
        earlyWin={game.earlyWin}
        onEndGame={endGame}
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
        {...turnActionPanelsProps({
          camera,
          territories,
          seaTerritories,
          size,
          imgDims,
          VERTEX_RADIUS,
          selectedTerritoryId,
          fortifyEndTerritoryId,
          attackEndTerritoryId,
          sailEndTerritoryId,
          attackSeaTerritoryId,
          attackSeaDefenderId,
          currentTurnPlayer,
          gameEnded,
          turnPhase,
          game,
          toxins,
          entrenchments,
          turnDuration,
          paused,
          pausedAt,
          turnStartedAt,
          turnExtension,
          isMyTurn,
          troopsToDeploy,
          deployMaxTroops,
          setGame,
          tankFireId,
          deployPanelOpen: deployTroopsPanelOpen,
          players,
          cardsFlow,
          deploySeaFlow,
          sailFlow,
          turnFlow,
          attackFlow,
          attackSeaFlow,
        })}
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
