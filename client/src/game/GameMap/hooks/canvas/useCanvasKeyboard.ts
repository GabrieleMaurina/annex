import { useCallback, useEffect } from 'react';
import {
  modifierStep,
  wheelDirection,
} from '../../../../common/inputs/useNumberInput';
import { stepTroops } from '../../../../common/inputs/useTroopsInput';
import { connector } from '../../../../connector';
import {
  isTroopsPercentage,
  saveTroopsPercentage,
} from '../../../../lib/player';
import { playSound } from '../../../../lib/sounds';
import type { Ack } from '../../../../lib/types';
import { isTypingTarget } from '../../helpers';
import type { CanvasInteractionsParams } from './types';
import type { useMapViewportAnimation } from './useMapViewportAnimation';

export function useCanvasKeyboard({
  sailStartTerritoryId,
  sailPanelOpen,
  sailInputRef,
  sailMaxShips,
  setSailShips,
  submitSail,
  cancelSail,
  attackSeaTerritoryId,
  attackSeaDefenderId,
  attackSeaPanelOpen,
  attackSeaInputRef,
  attackSeaBlitzInputRef,
  attackSeaRevealing,
  attackSeaDiceOnly,
  setAttackSeaDiceRoll,
  submitAttackSea,
  cancelAttackSea,
  isMyTurn,
  turnPhase,
  selectedTerritoryId,
  deployMaxTroops,
  fortifyStartTerritoryId,
  fortifyMaxTroops,
  fortifyInputRef,
  attackPendingConquest,
  attackStartTerritoryId,
  attackMoveMinTroops,
  attackMoveMaxTroops,
  setAttackDiceRoll,
  attackRevealing,
  attackDiceOnly,
  attackMoveInputRef,
  blitzInputRef,
  entrenchMaxTroops,
  entrenchInputRef,
  nukeTargeting,
  setNukeTargeting,
  pendingAttackEmoji,
  setPendingAttackEmoji,
  emojiPickerFor,
  setEmojiPickerFor,
  alliancePopupFor,
  setAlliancePopupFor,
  setGame,
  setToasts,
  setChatOpen,
  setPanelCollapsed,
  openPanel,
  setOpenPanel,
  cardsOpen,
  bonusesEnabled,
  cardsEnabled,
  nukesEnabled,
  settingsMenuOpen,
  setAwardedCards,
  selectedCombo,
  playCardSet,
  deployPanelOpen,
  deployInputRef,
  setDeployTroops,
  submitDeploy,
  deploySeaTerritoryId,
  cancelDeploySea,
  submitDeploySea,
  deploySeaPanelOpen,
  deploySeaInputRef,
  setDeploySeaShips,
  deploySeaMaxShips,
  fortifyPanelOpen,
  setFortifyTroops,
  cancelFortify,
  submitFortify,
  entrenchPanelOpen,
  setEntrenchTroops,
  submitEntrench,
  toxinsPanelOpen,
  submitToxins,
  attackPanelOpen,
  attackShowPendingConquest,
  unlockTileId,
  setAttackMoveTroops,
  cycleAttackOption,
  submitAttackMove,
  cancelAttack,
  submitAttack,
  canAdvancePhase,
  selectTerritory,
  zoomAround,
}: CanvasInteractionsParams & {
  selectTerritory: (territoryId: number | null) => void;
  zoomAround: ReturnType<typeof useMapViewportAnimation>['zoomAround'];
}) {
  const stepTroopPanel = useCallback(
    (delta: number) => {
      if (deployPanelOpen) {
        setDeployTroops((prev) => stepTroops(prev, delta, 1, deployMaxTroops));
        return true;
      }
      if (deploySeaPanelOpen) {
        setDeploySeaShips((prev) =>
          stepTroops(prev, delta, 1, deploySeaMaxShips),
        );
        return true;
      }
      if (sailPanelOpen) {
        setSailShips((prev) => stepTroops(prev, delta, 1, sailMaxShips));
        return true;
      }
      if (fortifyPanelOpen) {
        setFortifyTroops((prev) =>
          stepTroops(prev, delta, 1, fortifyMaxTroops),
        );
        return true;
      }
      if (entrenchPanelOpen) {
        setEntrenchTroops((prev) =>
          stepTroops(prev, delta, 1, entrenchMaxTroops),
        );
        return true;
      }
      if (attackPanelOpen && attackShowPendingConquest) {
        setAttackMoveTroops((prev) =>
          stepTroops(prev, delta, attackMoveMinTroops, attackMoveMaxTroops),
        );
        return true;
      }
      return false;
    },
    [
      deployPanelOpen,
      deployMaxTroops,
      deploySeaPanelOpen,
      deploySeaMaxShips,
      sailPanelOpen,
      sailMaxShips,
      fortifyPanelOpen,
      fortifyMaxTroops,
      entrenchPanelOpen,
      entrenchMaxTroops,
      attackPanelOpen,
      attackShowPendingConquest,
      attackMoveMinTroops,
      attackMoveMaxTroops,
      setDeployTroops,
      setDeploySeaShips,
      setSailShips,
      setFortifyTroops,
      setEntrenchTroops,
      setAttackMoveTroops,
    ],
  );

  useEffect(() => {
    function togglePanel(
      panel: 'cards' | 'bonuses' | 'logs' | 'settings' | 'nukes',
    ) {
      if (settingsMenuOpen) return;
      setOpenPanel(openPanel === panel ? null : panel);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pendingAttackEmoji) {
          playSound('click');
          setPendingAttackEmoji(null);
          return;
        }
        if (emojiPickerFor !== null) {
          playSound('click');
          setEmojiPickerFor(null);
          return;
        }
        if (alliancePopupFor !== null) {
          setAlliancePopupFor(null);
          return;
        }
        if (nukeTargeting) {
          playSound('click');
          setNukeTargeting(null);
          return;
        }
        if (openPanel !== null) {
          setOpenPanel(null);
          return;
        }
        if (isMyTurn && turnPhase === 'sail' && sailStartTerritoryId !== null) {
          cancelSail();
          return;
        }
        if (
          isMyTurn &&
          turnPhase === 'fortify' &&
          fortifyStartTerritoryId !== null
        ) {
          cancelFortify();
          return;
        }
        if (
          isMyTurn &&
          turnPhase === 'attack' &&
          attackSeaTerritoryId !== null &&
          !attackSeaRevealing
        ) {
          cancelAttackSea();
          return;
        }
        if (
          isMyTurn &&
          turnPhase === 'attack' &&
          attackStartTerritoryId !== null &&
          !attackPendingConquest
        ) {
          cancelAttack();
          return;
        }
        if (isMyTurn && turnPhase === 'attack' && attackSeaDiceOnly) {
          playSound('click');
          setAttackSeaDiceRoll(null);
          return;
        }
        if (isMyTurn && turnPhase === 'attack' && attackDiceOnly) {
          playSound('click');
          setAttackDiceRoll(null);
          return;
        }
        if (
          isMyTurn &&
          turnPhase === 'deploy' &&
          deploySeaTerritoryId !== null
        ) {
          playSound('click');
          cancelDeploySea();
          return;
        }
        if (isMyTurn && selectedTerritoryId !== null) {
          playSound('click');
          selectTerritory(null);
          return;
        }
        setPanelCollapsed(true);
        setChatOpen(false);
        return;
      }
      const isConfirmKey = e.key === 'Enter' || e.key === ' ';
      if (
        isConfirmKey &&
        cardsOpen &&
        isMyTurn &&
        turnPhase === 'deploy' &&
        selectedCombo
      ) {
        if (!isTypingTarget(e.target)) {
          e.preventDefault();
          playCardSet(selectedCombo);
          return;
        }
      }
      if (isConfirmKey && deployPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === deployInputRef.current) {
          e.preventDefault();
          submitDeploy();
          return;
        }
      }
      if (isConfirmKey && deploySeaPanelOpen) {
        if (
          !isTypingTarget(e.target) ||
          e.target === deploySeaInputRef.current
        ) {
          e.preventDefault();
          submitDeploySea();
          return;
        }
      }
      if (isConfirmKey && sailPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === sailInputRef.current) {
          e.preventDefault();
          submitSail();
          return;
        }
      }
      if (isConfirmKey && fortifyPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === fortifyInputRef.current) {
          e.preventDefault();
          submitFortify();
          return;
        }
      }
      if (isConfirmKey && entrenchPanelOpen) {
        if (
          !isTypingTarget(e.target) ||
          e.target === entrenchInputRef.current
        ) {
          e.preventDefault();
          submitEntrench();
          return;
        }
      }
      if (isConfirmKey && toxinsPanelOpen) {
        if (!isTypingTarget(e.target)) {
          e.preventDefault();
          submitToxins();
          return;
        }
      }
      if (isConfirmKey && attackPanelOpen && attackShowPendingConquest) {
        if (
          !isTypingTarget(e.target) ||
          e.target === attackMoveInputRef.current
        ) {
          e.preventDefault();
          submitAttackMove();
          return;
        }
      }
      if (
        isConfirmKey &&
        attackSeaPanelOpen &&
        attackSeaDefenderId !== null &&
        !attackSeaDiceOnly &&
        !attackSeaRevealing
      ) {
        if (
          !isTypingTarget(e.target) ||
          e.target === attackSeaInputRef.current ||
          e.target === attackSeaBlitzInputRef.current
        ) {
          e.preventDefault();
          submitAttackSea();
          return;
        }
      }
      if (
        isConfirmKey &&
        attackPanelOpen &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        !attackRevealing
      ) {
        if (!isTypingTarget(e.target) || e.target === blitzInputRef.current) {
          e.preventDefault();
          submitAttack();
          return;
        }
      }
      const isArrowKey =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight';
      const arrowDelta = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1;
      if (
        isArrowKey &&
        !isTypingTarget(e.target) &&
        stepTroopPanel(arrowDelta * modifierStep(e))
      ) {
        e.preventDefault();
        playSound('click');
        return;
      }
      if (
        attackPanelOpen &&
        unlockTileId === null &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        !isTypingTarget(e.target) &&
        isArrowKey
      ) {
        e.preventDefault();
        const direction =
          e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        playSound('click');
        cycleAttackOption(direction);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (canAdvancePhase) {
          connector.nextPhase((res: Ack) => {
            if (res.ok) setGame(res.game);
          });
        } else {
          setPanelCollapsed((prev) => !prev);
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'p') setPanelCollapsed((prev) => !prev);
        else if (key === 'b' && bonusesEnabled) togglePanel('bonuses');
        else if (key === 'l') togglePanel('logs');
        else if (key === 's') togglePanel('settings');
        else if (key === 'n' && nukesEnabled) togglePanel('nukes');
        else if (key === 't' && cardsEnabled && !settingsMenuOpen) {
          togglePanel('cards');
          setAwardedCards([]);
        } else if (key === '%') {
          const percentage = !isTroopsPercentage();
          playSound('click');
          saveTroopsPercentage(percentage);
          setToasts((prev) => [
            ...prev,
            {
              id: Date.now(),
              message: `Troops percentage ${percentage ? 'on' : 'off'}`,
            },
          ]);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    pendingAttackEmoji,
    setPendingAttackEmoji,
    emojiPickerFor,
    alliancePopupFor,
    nukeTargeting,
    setNukeTargeting,
    openPanel,
    isMyTurn,
    turnPhase,
    selectedTerritoryId,
    selectTerritory,
    setChatOpen,
    deployPanelOpen,
    submitDeploy,
    deploySeaTerritoryId,
    cancelDeploySea,
    deploySeaPanelOpen,
    submitDeploySea,
    sailStartTerritoryId,
    cancelSail,
    sailPanelOpen,
    submitSail,
    fortifyStartTerritoryId,
    cancelFortify,
    fortifyPanelOpen,
    submitFortify,
    entrenchPanelOpen,
    submitEntrench,
    toxinsPanelOpen,
    submitToxins,
    attackSeaTerritoryId,
    attackSeaDefenderId,
    attackSeaRevealing,
    attackSeaDiceOnly,
    attackSeaPanelOpen,
    cancelAttackSea,
    submitAttackSea,
    attackStartTerritoryId,
    attackPendingConquest,
    attackShowPendingConquest,
    attackDiceOnly,
    attackRevealing,
    cancelAttack,
    attackPanelOpen,
    unlockTileId,
    submitAttack,
    submitAttackMove,
    stepTroopPanel,
    cycleAttackOption,
    cardsOpen,
    bonusesEnabled,
    cardsEnabled,
    nukesEnabled,
    settingsMenuOpen,
    setAwardedCards,
    selectedCombo,
    playCardSet,
    canAdvancePhase,
    setGame,
    setToasts,
    setEmojiPickerFor,
    setAlliancePopupFor,
    setOpenPanel,
    setPanelCollapsed,
    setAttackSeaDiceRoll,
    setAttackDiceRoll,
    deployInputRef,
    deploySeaInputRef,
    sailInputRef,
    fortifyInputRef,
    entrenchInputRef,
    attackMoveInputRef,
    attackSeaInputRef,
    attackSeaBlitzInputRef,
    blitzInputRef,
  ]);

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (stepTroopPanel(wheelDirection(e) * modifierStep(e))) {
        playSound('click');
        return;
      }
      if (
        attackPanelOpen &&
        unlockTileId === null &&
        !attackShowPendingConquest &&
        !attackDiceOnly
      ) {
        playSound('click');
        cycleAttackOption(e.deltaY < 0 ? -1 : 1);
        return;
      }
      if (attackPanelOpen && unlockTileId === null) return;
      zoomAround(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [
    stepTroopPanel,
    attackPanelOpen,
    unlockTileId,
    attackShowPendingConquest,
    attackDiceOnly,
    cycleAttackOption,
    zoomAround,
  ]);
}
