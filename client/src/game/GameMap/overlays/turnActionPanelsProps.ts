import type { ComponentProps } from 'react';
import type { useAttackSeaFlow } from '../hooks/sea/useAttackSeaFlow';
import type { useDeploySeaFlow } from '../hooks/sea/useDeploySeaFlow';
import type { useSailFlow } from '../hooks/sea/useSailFlow';
import type { useAttackFlow } from '../hooks/useAttackFlow';
import type { useCardsAndDeploy } from '../hooks/useCardsAndDeploy';
import type { PanelAnchors } from '../hooks/useMiscUiState';
import type { useTurnActionFlows } from '../hooks/useTurnActionFlows';
import type { GameMapProps } from '../props';
import type TurnActionPanels from './TurnActionPanels';

type Props = ComponentProps<typeof TurnActionPanels>;

type PassThroughKeys =
  | 'camera'
  | 'currentTurnPlayer'
  | 'gameEnded'
  | 'turnPhase'
  | 'turnDuration'
  | 'paused'
  | 'pausedAt'
  | 'turnStartedAt'
  | 'turnExtension'
  | 'isMyTurn'
  | 'troopsToDeploy'
  | 'deployMaxTroops'
  | 'setGame'
  | 'tankFireId'
  | 'deployPanelOpen'
  | 'attackSeaDefenderId'
  | 'players';

type AnchorKeys =
  | 'territories'
  | 'seaTerritories'
  | 'size'
  | 'imgDims'
  | 'VERTEX_RADIUS'
  | 'selectedTerritoryId'
  | 'fortifyEndTerritoryId'
  | 'attackEndTerritoryId'
  | 'sailEndTerritoryId'
  | 'attackSeaTerritoryId';

interface Flows {
  cardsFlow: ReturnType<typeof useCardsAndDeploy>;
  deploySeaFlow: ReturnType<typeof useDeploySeaFlow>;
  sailFlow: ReturnType<typeof useSailFlow>;
  turnFlow: ReturnType<typeof useTurnActionFlows>;
  attackFlow: ReturnType<typeof useAttackFlow>;
  attackSeaFlow: ReturnType<typeof useAttackSeaFlow>;
}

export function turnActionPanelsProps({
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
  turnPhase,
  game,
  toxins,
  entrenchments,
  cardsFlow,
  deploySeaFlow,
  sailFlow,
  turnFlow,
  attackFlow,
  attackSeaFlow,
  ...passThrough
}: Pick<Props, PassThroughKeys> &
  Pick<PanelAnchors, AnchorKeys> &
  Pick<GameMapProps, 'game' | 'toxins' | 'entrenchments'> &
  Flows): Props {
  return {
    ...passThrough,
    turnPhase,
    anchors: {
      territories,
      seaTerritories,
      size,
      imgDims,
      VERTEX_RADIUS,
      selectedTerritoryId,
      fortifyEndTerritoryId,
      attackEndTerritoryId,
      attackDiceRollTerritoryId: attackFlow.attackDiceRoll?.territoryId,
      sailEndTerritoryId,
      attackSeaTerritoryId,
      attackSeaDiceRollTerritoryId:
        attackSeaFlow.attackSeaDiceRoll?.territoryId,
      deploySeaTerritoryId: deploySeaFlow.deploySeaTerritoryId,
    },
    placement: game.placement,
    mustPlaySet: cardsFlow.mustPlaySet,
    nextPhaseEndsTurn:
      turnPhase === 'toxins' ||
      (turnPhase === 'entrench' &&
        (toxins === 'off' || turnFlow.toxinsCandidates.size === 0)) ||
      (turnPhase === 'fortify' &&
        (entrenchments !== 'on' || turnFlow.entrenchCandidates.size === 0) &&
        (toxins === 'off' || turnFlow.toxinsCandidates.size === 0)),
    deployTroops: cardsFlow.deployTroops,
    deployInputRef: cardsFlow.deployInputRef,
    setDeployTroops: cardsFlow.setDeployTroops,
    submitDeploy: cardsFlow.submitDeploy,
    deploySeaPanelOpen: deploySeaFlow.deploySeaPanelOpen,
    deploySeaComboActive: deploySeaFlow.comboActive,
    deploySeaShips: deploySeaFlow.deploySeaShips,
    deploySeaMaxShips: deploySeaFlow.deploySeaMaxShips,
    deploySeaInputRef: deploySeaFlow.deploySeaInputRef,
    setDeploySeaShips: deploySeaFlow.setDeploySeaShips,
    submitDeploySea: deploySeaFlow.submitDeploySea,
    sailPanelOpen: sailFlow.sailPanelOpen,
    sailShips: sailFlow.sailShips,
    sailMaxShips: sailFlow.sailMaxShips,
    sailInputRef: sailFlow.sailInputRef,
    setSailShips: sailFlow.setSailShips,
    submitSail: sailFlow.submitSail,
    fortifyPanelOpen: turnFlow.fortifyPanelOpen,
    fortifyTroops: turnFlow.fortifyTroops,
    fortifyMaxTroops: turnFlow.fortifyMaxTroops,
    fortifyInputRef: turnFlow.fortifyInputRef,
    setFortifyTroops: turnFlow.setFortifyTroops,
    submitFortify: turnFlow.submitFortify,
    entrenchPanelOpen: turnFlow.entrenchPanelOpen,
    entrenchTroops: turnFlow.entrenchTroops,
    entrenchMaxTroops: turnFlow.entrenchMaxTroops,
    entrenchCurrentTurns: turnFlow.entrenchCurrentTurns,
    entrenchInputRef: turnFlow.entrenchInputRef,
    setEntrenchTroops: turnFlow.setEntrenchTroops,
    submitEntrench: turnFlow.submitEntrench,
    toxinsPanelOpen: turnFlow.toxinsPanelOpen,
    toxinsWastedTroops: turnFlow.toxinsWastedTroops,
    submitToxins: turnFlow.submitToxins,
    attackPanelOpen: attackFlow.attackPanelOpen,
    attackDisplay: attackFlow.attackDisplay,
    blitzEnabled: game.blitz !== 'off',
    attackDice: game.attackDice,
    diceTies: game.diceTies,
    blitzInputRef: attackFlow.blitzInputRef,
    attackDiceRoll: attackFlow.attackDiceRoll,
    setAttackDiceRoll: attackFlow.setAttackDiceRoll,
    setAttackSelectedType: attackFlow.setAttackSelectedType,
    setAttackRegularTroops: attackFlow.setAttackRegularTroops,
    setAttackBlitzTroops: attackFlow.setAttackBlitzTroops,
    maxBlitzTroops: attackFlow.maxBlitzTroops,
    attackRevealing: attackFlow.attackRevealing,
    attackDiceOnly: attackFlow.attackDiceOnly,
    attackShowPendingConquest: attackFlow.attackShowPendingConquest,
    attackMoveTroops: attackFlow.attackMoveTroops,
    attackMoveMinTroops: attackFlow.attackMoveMinTroops,
    attackMoveMaxTroops: attackFlow.attackMoveMaxTroops,
    attackMoveInputRef: attackFlow.attackMoveInputRef,
    setAttackMoveTroops: attackFlow.setAttackMoveTroops,
    submitAttackMove: attackFlow.submitAttackMove,
    submitAttack: attackFlow.submitAttack,
    attackSeaPanelOpen: attackSeaFlow.attackSeaPanelOpen,
    attackSeaDefenders: attackSeaFlow.attackSeaDefenders,
    selectAttackSeaDefender: attackSeaFlow.selectAttackSeaDefender,
    attackSeaSelectedType: attackSeaFlow.attackSeaSelectedType,
    setAttackSeaSelectedType: attackSeaFlow.setAttackSeaSelectedType,
    attackSeaRegularShips: attackSeaFlow.attackSeaRegularShips,
    setAttackSeaRegularShips: attackSeaFlow.setAttackSeaRegularShips,
    attackSeaBlitzShips: attackSeaFlow.attackSeaBlitzShips,
    setAttackSeaBlitzShips: attackSeaFlow.setAttackSeaBlitzShips,
    attackSeaMaxRegularShips: attackSeaFlow.attackSeaMaxRegularShips,
    attackSeaMaxBlitzShips: attackSeaFlow.attackSeaMaxBlitzShips,
    attackSeaWinProbabilities: attackSeaFlow.attackSeaWinProbabilities,
    attackSeaBlitzOutcomes: attackSeaFlow.attackSeaBlitzOutcomes,
    attackSeaInputRef: attackSeaFlow.attackSeaInputRef,
    attackSeaBlitzInputRef: attackSeaFlow.attackSeaBlitzInputRef,
    attackSeaDiceRoll: attackSeaFlow.attackSeaDiceRoll,
    attackSeaRevealing: attackSeaFlow.attackSeaRevealing,
    attackSeaDiceOnly: attackSeaFlow.attackSeaDiceOnly,
    submitAttackSea: attackSeaFlow.submitAttackSea,
  };
}
