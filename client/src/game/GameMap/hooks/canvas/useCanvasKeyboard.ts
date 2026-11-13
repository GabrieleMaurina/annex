import { useCallback, useEffect } from 'react';
import { isNewWheelGesture } from '../../../../common/inputs/edgeWrap';
import {
  modifierStep,
  wheelDirection,
} from '../../../../common/inputs/useNumberInput';
import { stepTroops } from '../../../../common/inputs/useTroopsInput';
import { getShortcutsOpen } from '../../../../common/menus/shortcuts/shortcutsOpen';
import {
  isTroopsPercentage,
  saveTroopsPercentage,
} from '../../../../lib/player';
import { playSound } from '../../../../lib/sounds';
import { isTypingTarget } from '../../helpers';
import { nextToastId } from '../../toastId';
import type { CanvasInteractionsParams } from './types';
import type { useMapViewportAnimation } from './useMapViewportAnimation';

function isInsideScrollable(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    )
      return true;
    el = el.parentElement;
  }
  return false;
}

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
  attackSeaBlitzInputRef,
  stepAttackSeaBlitzShips,
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
  flipVertexId,
  setAttackMoveTroops,
  cycleAttackOption,
  stepBlitzTroops,
  submitAttackMove,
  cancelAttack,
  submitAttack,
  canAdvancePhase,
  advancePhase,
  canReturnPhase,
  returnPhase,
  selectTerritory,
  zoomAround,
}: CanvasInteractionsParams & {
  selectTerritory: (territoryId: number | null) => void;
  zoomAround: ReturnType<typeof useMapViewportAnimation>['zoomAround'];
}) {
  const stepTroopPanel = useCallback(
    (delta: number, newGesture: boolean) => {
      const at = performance.now();
      if (deployPanelOpen) {
        setDeployTroops((prev) =>
          stepTroops(prev, delta, 1, deployMaxTroops, newGesture, at),
        );
        return true;
      }
      if (deploySeaPanelOpen) {
        setDeploySeaShips((prev) =>
          stepTroops(prev, delta, 1, deploySeaMaxShips, newGesture, at),
        );
        return true;
      }
      if (sailPanelOpen) {
        setSailShips((prev) =>
          stepTroops(prev, delta, 1, sailMaxShips, newGesture, at),
        );
        return true;
      }
      if (fortifyPanelOpen) {
        setFortifyTroops((prev) =>
          stepTroops(prev, delta, 1, fortifyMaxTroops, newGesture, at),
        );
        return true;
      }
      if (entrenchPanelOpen) {
        setEntrenchTroops((prev) =>
          stepTroops(prev, delta, 1, entrenchMaxTroops, newGesture, at),
        );
        return true;
      }
      if (attackPanelOpen && attackShowPendingConquest) {
        setAttackMoveTroops((prev) =>
          stepTroops(
            prev,
            delta,
            attackMoveMinTroops,
            attackMoveMaxTroops,
            newGesture,
            at,
          ),
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
      if (getShortcutsOpen()) return;
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
        !attackSeaDiceOnly
      ) {
        if (
          !isTypingTarget(e.target) ||
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
        !attackDiceOnly
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
        stepTroopPanel(arrowDelta * modifierStep(e), !e.repeat)
      ) {
        e.preventDefault();
        return;
      }
      if (
        attackPanelOpen &&
        unlockTileId === null &&
        flipVertexId === null &&
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
      if (
        /^[0-9]$/.test(e.key) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        const troopInput = deployPanelOpen
          ? deployInputRef.current
          : deploySeaPanelOpen
            ? deploySeaInputRef.current
            : sailPanelOpen
              ? sailInputRef.current
              : fortifyPanelOpen
                ? fortifyInputRef.current
                : entrenchPanelOpen
                  ? entrenchInputRef.current
                  : attackSeaPanelOpen
                    ? attackSeaBlitzInputRef.current
                    : attackPanelOpen
                      ? attackShowPendingConquest
                        ? attackMoveInputRef.current
                        : blitzInputRef.current
                      : null;
        if (troopInput) {
          troopInput.focus();
          troopInput.select();
        }
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canReturnPhase) returnPhase();
        } else if (canAdvancePhase) advancePhase();
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
              id: nextToastId(),
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
    cancelAttack,
    attackPanelOpen,
    unlockTileId,
    flipVertexId,
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
    advancePhase,
    canReturnPhase,
    returnPhase,
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
    attackSeaBlitzInputRef,
    blitzInputRef,
  ]);

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (isInsideScrollable(e.target)) return;
      e.preventDefault();
      const delta = wheelDirection(e) * modifierStep(e);
      const newGesture = isNewWheelGesture();
      if (stepTroopPanel(delta, newGesture)) return;
      if (attackSeaPanelOpen && !attackSeaDiceOnly) {
        stepAttackSeaBlitzShips(delta, newGesture);
        return;
      }
      if (
        attackPanelOpen &&
        unlockTileId === null &&
        flipVertexId === null &&
        !attackShowPendingConquest &&
        !attackDiceOnly
      ) {
        if (stepBlitzTroops(delta, newGesture)) return;
        playSound('click');
        cycleAttackOption(e.deltaY < 0 ? -1 : 1);
        return;
      }
      if (attackPanelOpen && unlockTileId === null && flipVertexId === null)
        return;
      zoomAround(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [
    stepTroopPanel,
    attackSeaPanelOpen,
    attackSeaDiceOnly,
    stepAttackSeaBlitzShips,
    attackPanelOpen,
    unlockTileId,
    flipVertexId,
    attackShowPendingConquest,
    attackDiceOnly,
    cycleAttackOption,
    stepBlitzTroops,
    zoomAround,
  ]);
}
