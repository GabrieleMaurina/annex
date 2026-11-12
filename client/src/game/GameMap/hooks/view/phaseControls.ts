import { connector } from '../../../../connector';
import type { GameState, TurnPhase } from '../../../../lib/types';
import type { useDeploySeaFlow } from '../sea/useDeploySeaFlow';
import type { useSailFlow } from '../sea/useSailFlow';
import type { useAttackFlow } from '../useAttackFlow';
import type { useCardsAndDeploy } from '../useCardsAndDeploy';
import { requestNextPhase, requestPreviousPhase } from '../useMiscUiState';
import type { useTurnActionFlows } from '../useTurnActionFlows';

interface PhaseControlsParams {
  isMyTurn: boolean;
  paused: boolean;
  turnPhase: TurnPhase;
  phaseReturnable: boolean;
  troopsToDeploy: number;
  cardsFlow: ReturnType<typeof useCardsAndDeploy>;
  turnFlow: ReturnType<typeof useTurnActionFlows>;
  sailFlow: ReturnType<typeof useSailFlow>;
  deploySeaFlow: ReturnType<typeof useDeploySeaFlow>;
  attackFlow: ReturnType<typeof useAttackFlow>;
  setGame: (game: GameState) => void;
}

export function phaseControls({
  isMyTurn,
  paused,
  turnPhase,
  phaseReturnable,
  troopsToDeploy,
  cardsFlow,
  turnFlow,
  sailFlow,
  deploySeaFlow,
  attackFlow,
  setGame,
}: PhaseControlsParams) {
  const canAdvancePhase =
    isMyTurn &&
    !paused &&
    turnPhase !== 'territory' &&
    turnPhase !== 'troop' &&
    turnPhase !== 'capital' &&
    (turnPhase !== 'deploy' || (troopsToDeploy <= 0 && !cardsFlow.mustPlaySet));

  function advancePhase() {
    if (turnFlow.fortifyPanelOpen) turnFlow.submitFortify();
    else if (turnFlow.entrenchPanelOpen) turnFlow.confirmEntrenchAndAdvance();
    else if (sailFlow.sailPanelOpen) sailFlow.submitSail();
    else if (deploySeaFlow.deploySeaPanelOpen)
      deploySeaFlow.confirmDeploySeaAndAdvance();
    else if (attackFlow.attackShowPendingConquest)
      attackFlow.confirmAttackMoveAndAdvance();
    else requestNextPhase(setGame);
  }

  const canReturnPhase =
    isMyTurn &&
    !paused &&
    phaseReturnable &&
    connector.tutorialAllows('game:previousPhase');

  function returnPhase() {
    requestPreviousPhase(setGame);
  }

  return { canAdvancePhase, advancePhase, canReturnPhase, returnPhase };
}
