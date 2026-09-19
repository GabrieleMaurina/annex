import type { useAttackSeaFlow } from '../sea/useAttackSeaFlow';
import type { useDeploySeaFlow } from '../sea/useDeploySeaFlow';
import type { useSailFlow } from '../sea/useSailFlow';
import type { useAllianceUI } from '../useAllianceUI';
import type { useAttackFlow } from '../useAttackFlow';
import { useCanvasInteractions } from '../useCanvasInteractions';
import type { useCardsAndDeploy } from '../useCardsAndDeploy';
import type { useEmojiUI } from '../useEmojiUI';
import type { useTurnActionFlows } from '../useTurnActionFlows';

type InteractionsParams = Parameters<typeof useCanvasInteractions>[0];

type OwnParamKeys =
  | 'canvasRef'
  | 'territories'
  | 'seaTerritories'
  | 'sailStartTerritoryId'
  | 'sailEndTerritoryId'
  | 'attackSeaTerritoryId'
  | 'attackSeaDefenderId'
  | 'transform'
  | 'setTransform'
  | 'imgDims'
  | 'VERTEX_RADIUS'
  | 'gameEnded'
  | 'isMyTurn'
  | 'paused'
  | 'turnPhase'
  | 'selfId'
  | 'selectedTerritoryId'
  | 'territoryClaimCandidates'
  | 'troopsToDeploy'
  | 'deployMaxTroops'
  | 'supplyConnectedTerritoryIds'
  | 'ownerById'
  | 'fortifyStartTerritoryId'
  | 'fortifyEndTerritoryId'
  | 'attackStartTerritoryId'
  | 'attackEndTerritoryId'
  | 'nukeTargeting'
  | 'setNukeTargeting'
  | 'antiNukeTerritoryIds'
  | 'setToasts'
  | 'setGame'
  | 'setChatOpen'
  | 'setPanelCollapsed'
  | 'openPanel'
  | 'setOpenPanel'
  | 'cardsOpen'
  | 'deployPanelOpen'
  | 'canAdvancePhase';

interface Flows {
  sailFlow: ReturnType<typeof useSailFlow>;
  attackSeaFlow: ReturnType<typeof useAttackSeaFlow>;
  attackFlow: ReturnType<typeof useAttackFlow>;
  turnFlow: ReturnType<typeof useTurnActionFlows>;
  deploySeaFlow: ReturnType<typeof useDeploySeaFlow>;
  cardsFlow: ReturnType<typeof useCardsAndDeploy>;
  emojiUI: ReturnType<typeof useEmojiUI>;
  allianceUI: ReturnType<typeof useAllianceUI>;
}

export function useGameCanvasInteractions({
  sailFlow,
  attackSeaFlow,
  attackFlow,
  turnFlow,
  deploySeaFlow,
  cardsFlow,
  emojiUI,
  allianceUI,
  ...own
}: Pick<InteractionsParams, OwnParamKeys> & Flows) {
  return useCanvasInteractions({
    ...own,
    sailStartCandidates: sailFlow.sailStartCandidates,
    sailEndCandidates: sailFlow.sailEndCandidates,
    sailPanelOpen: sailFlow.sailPanelOpen,
    sailInputRef: sailFlow.sailInputRef,
    sailMaxShips: sailFlow.sailMaxShips,
    setSailShips: sailFlow.setSailShips,
    selectSailStart: sailFlow.selectSailStart,
    selectSailEnd: sailFlow.selectSailEnd,
    submitSail: sailFlow.submitSail,
    cancelSail: sailFlow.cancelSail,
    attackSeaStartCandidates: attackSeaFlow.attackSeaStartCandidates,
    attackSeaPanelOpen: attackSeaFlow.attackSeaPanelOpen,
    attackSeaInputRef: attackSeaFlow.attackSeaInputRef,
    attackSeaBlitzInputRef: attackSeaFlow.attackSeaBlitzInputRef,
    attackSeaRevealing: attackSeaFlow.attackSeaRevealing,
    attackSeaDiceOnly: attackSeaFlow.attackSeaDiceOnly,
    setAttackSeaDiceRoll: attackSeaFlow.setAttackSeaDiceRoll,
    selectAttackSeaStart: attackSeaFlow.selectAttackSeaStart,
    submitAttackSea: attackSeaFlow.submitAttackSea,
    cancelAttackSea: attackSeaFlow.cancelAttackSea,
    fortifyStartCandidates: turnFlow.fortifyStartCandidates,
    fortifyEndCandidates: turnFlow.fortifyEndCandidates,
    fortifyMaxTroops: turnFlow.fortifyMaxTroops,
    fortifyInputRef: turnFlow.fortifyInputRef,
    fortifyPanelOpen: turnFlow.fortifyPanelOpen,
    setFortifyTroops: turnFlow.setFortifyTroops,
    cancelFortify: turnFlow.cancelFortify,
    selectFortifyStart: turnFlow.selectFortifyStart,
    selectFortifyEnd: turnFlow.selectFortifyEnd,
    submitFortify: turnFlow.submitFortify,
    entrenchCandidates: turnFlow.entrenchCandidates,
    entrenchMaxTroops: turnFlow.entrenchMaxTroops,
    entrenchInputRef: turnFlow.entrenchInputRef,
    entrenchPanelOpen: turnFlow.entrenchPanelOpen,
    setEntrenchTroops: turnFlow.setEntrenchTroops,
    submitEntrench: turnFlow.submitEntrench,
    toxinsCandidates: turnFlow.toxinsCandidates,
    toxinsPanelOpen: turnFlow.toxinsPanelOpen,
    submitToxins: turnFlow.submitToxins,
    attackPendingConquest: attackFlow.attackPendingConquest,
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
    attackPanelOpen: attackFlow.attackPanelOpen,
    attackShowPendingConquest: attackFlow.attackShowPendingConquest,
    setAttackMoveTroops: attackFlow.setAttackMoveTroops,
    cycleAttackOption: attackFlow.cycleAttackOption,
    selectAttackStart: attackFlow.selectAttackStart,
    selectAttackEnd: attackFlow.selectAttackEnd,
    submitAttackMove: attackFlow.submitAttackMove,
    cancelAttack: attackFlow.cancelAttack,
    submitAttack: attackFlow.submitAttack,
    pendingAttackEmoji: emojiUI.pendingAttackEmoji,
    setPendingAttackEmoji: emojiUI.setPendingAttackEmoji,
    sendEmoji: emojiUI.sendEmoji,
    emojiPickerFor: emojiUI.emojiPickerFor,
    setEmojiPickerFor: emojiUI.setEmojiPickerFor,
    alliancePopupFor: allianceUI.alliancePopupFor,
    setAlliancePopupFor: allianceUI.setAlliancePopupFor,
    selectedCombo: cardsFlow.selectedCombo,
    playCardSet: cardsFlow.playCardSet,
    deployInputRef: cardsFlow.deployInputRef,
    setDeployTroops: cardsFlow.setDeployTroops,
    submitDeploy: cardsFlow.submitDeploy,
    deploySeaCandidates: deploySeaFlow.deploySeaCandidates,
    deploySeaTerritoryId: deploySeaFlow.deploySeaTerritoryId,
    selectDeploySea: deploySeaFlow.selectDeploySea,
    cancelDeploySea: deploySeaFlow.cancelDeploySea,
    submitDeploySea: deploySeaFlow.submitDeploySea,
    deploySeaPanelOpen: deploySeaFlow.deploySeaPanelOpen,
    deploySeaInputRef: deploySeaFlow.deploySeaInputRef,
    setDeploySeaShips: deploySeaFlow.setDeploySeaShips,
    deploySeaMaxShips: deploySeaFlow.deploySeaMaxShips,
    comboActive: deploySeaFlow.comboActive,
    isSeaAdjacentToTerritory: deploySeaFlow.isSeaAdjacentToTerritory,
  });
}
