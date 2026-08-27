import type { CSSProperties, Dispatch, RefObject, SetStateAction } from 'react';
import { playerColor } from '../../../lib/palette';
import type { GameState, TurnDuration, TurnPhase } from '../../../lib/types';
import AttackPanel, {
  type AttackType,
  type DiceRoll,
} from '../../panels/AttackPanel';
import ConfirmPanel from '../../panels/ConfirmPanel';
import TroopPanel from '../../panels/TroopPanel';
import TurnPanel from '../../panels/TurnPanel';
import TurnProgressBar from '../../panels/TurnProgressBar';
import { CAPITAL_PHASE_DURATION, PLACEMENT_PHASE_DURATION } from '../helpers';

export default function TurnActionPanels({
  currentTurnPlayer,
  gameEnded,
  turnPhase,
  turnDuration,
  paused,
  turnStartedAt,
  isMyTurn,
  troopsToDeploy,
  mustPlaySet,
  setGame,
  nextPhaseEndsTurn,
  tankFireId,
  deployPanelOpen,
  deployPanelStyle,
  deployTroops,
  deployInputRef,
  setDeployTroops,
  submitDeploy,
  fortifyPanelOpen,
  fortifyPanelStyle,
  fortifyTroops,
  fortifyMaxTroops,
  fortifyInputRef,
  setFortifyTroops,
  submitFortify,
  entrenchPanelOpen,
  entrenchTroops,
  entrenchMaxTroops,
  entrenchCurrentTurns,
  entrenchInputRef,
  setEntrenchTroops,
  submitEntrench,
  toxinsPanelOpen,
  toxinsWastedTroops,
  submitToxins,
  attackPanelOpen,
  attackPanelStyle,
  attackDisplay,
  blitzInputRef,
  attackDiceRoll,
  setAttackDiceRoll,
  setAttackSelectedType,
  setAttackRegularTroops,
  setAttackBlitzTroops,
  maxBlitzTroops,
  attackRevealing,
  attackDiceOnly,
  attackShowPendingConquest,
  attackMoveTroops,
  attackMoveMinTroops,
  attackMoveMaxTroops,
  attackMoveInputRef,
  setAttackMoveTroops,
  submitAttackMove,
  submitAttack,
}: {
  currentTurnPlayer: GameState['players'][number] | undefined;
  gameEnded: boolean;
  turnPhase: TurnPhase;
  turnDuration: TurnDuration;
  paused: boolean;
  turnStartedAt: number;
  isMyTurn: boolean;
  troopsToDeploy: number;
  mustPlaySet: boolean;
  setGame: (game: GameState) => void;
  nextPhaseEndsTurn: boolean;
  tankFireId: number;
  deployPanelOpen: boolean;
  deployPanelStyle: CSSProperties | undefined;
  deployTroops: number;
  deployInputRef: RefObject<HTMLInputElement | null>;
  setDeployTroops: Dispatch<SetStateAction<number>>;
  submitDeploy: () => void;
  fortifyPanelOpen: boolean;
  fortifyPanelStyle: CSSProperties | undefined;
  fortifyTroops: number;
  fortifyMaxTroops: number;
  fortifyInputRef: RefObject<HTMLInputElement | null>;
  setFortifyTroops: Dispatch<SetStateAction<number>>;
  submitFortify: () => void;
  entrenchPanelOpen: boolean;
  entrenchTroops: number;
  entrenchMaxTroops: number;
  entrenchCurrentTurns: number;
  entrenchInputRef: RefObject<HTMLInputElement | null>;
  setEntrenchTroops: Dispatch<SetStateAction<number>>;
  submitEntrench: () => void;
  toxinsPanelOpen: boolean;
  toxinsWastedTroops: number;
  submitToxins: () => void;
  attackPanelOpen: boolean;
  attackPanelStyle: CSSProperties | undefined;
  attackDisplay: {
    maxBlitzTroops: number;
    blitzWinProbabilities: number[];
    selectedType: AttackType;
    regularTroops: 1 | 2 | 3;
    blitzTroops: number;
  };
  blitzInputRef: RefObject<HTMLInputElement | null>;
  attackDiceRoll: DiceRoll | null;
  setAttackDiceRoll: Dispatch<SetStateAction<DiceRoll | null>>;
  setAttackSelectedType: Dispatch<SetStateAction<AttackType>>;
  setAttackRegularTroops: Dispatch<SetStateAction<1 | 2 | 3>>;
  setAttackBlitzTroops: Dispatch<SetStateAction<number>>;
  maxBlitzTroops: number;
  attackRevealing: boolean;
  attackDiceOnly: boolean;
  attackShowPendingConquest: boolean;
  attackMoveTroops: number;
  attackMoveMinTroops: number;
  attackMoveMaxTroops: number;
  attackMoveInputRef: RefObject<HTMLInputElement | null>;
  setAttackMoveTroops: Dispatch<SetStateAction<number>>;
  submitAttackMove: () => void;
  submitAttack: () => void;
}) {
  if (!currentTurnPlayer) return null;
  return (
    <>
      {!gameEnded && (
        <>
          <TurnProgressBar
            turnStartedAt={turnStartedAt}
            turnDuration={
              turnPhase === 'territory' || turnPhase === 'troop'
                ? PLACEMENT_PHASE_DURATION
                : turnPhase === 'capital'
                  ? CAPITAL_PHASE_DURATION
                  : turnDuration
            }
            color={playerColor(currentTurnPlayer.color)}
            paused={paused}
          />
          <TurnPanel
            turnPhase={turnPhase}
            currentPlayerName={currentTurnPlayer.name}
            color={playerColor(currentTurnPlayer.color)}
            isMyTurn={isMyTurn}
            troopsToDeploy={troopsToDeploy}
            troopsRemaining={currentTurnPlayer.troopsRemaining}
            canLeaveDeploy={troopsToDeploy <= 0 && !mustPlaySet}
            paused={paused}
            setGame={setGame}
            endsTurn={nextPhaseEndsTurn}
            tankFireId={tankFireId}
          />
        </>
      )}
      {deployPanelOpen && deployPanelStyle && (
        <TroopPanel
          label={turnPhase === 'troop' ? 'Place troops:' : 'Deploy troops:'}
          buttonLabel={turnPhase === 'troop' ? 'Place' : 'Deploy'}
          troops={deployTroops}
          maxTroops={troopsToDeploy}
          inputRef={deployInputRef}
          onChange={setDeployTroops}
          onConfirm={submitDeploy}
          style={deployPanelStyle}
        />
      )}
      {fortifyPanelOpen && fortifyPanelStyle && (
        <TroopPanel
          label="Move troops:"
          buttonLabel="Fortify"
          troops={fortifyTroops}
          maxTroops={fortifyMaxTroops}
          inputRef={fortifyInputRef}
          onChange={setFortifyTroops}
          onConfirm={submitFortify}
          style={fortifyPanelStyle}
        />
      )}
      {entrenchPanelOpen && deployPanelStyle && (
        <TroopPanel
          label="Entrench troops:"
          buttonLabel="Entrench"
          troops={entrenchTroops}
          maxTroops={entrenchMaxTroops}
          inputRef={entrenchInputRef}
          onChange={setEntrenchTroops}
          onConfirm={submitEntrench}
          style={deployPanelStyle}
          extra={`Entrenched: ${entrenchCurrentTurns} → ${entrenchCurrentTurns + entrenchTroops} turns`}
        />
      )}
      {toxinsPanelOpen && deployPanelStyle && (
        <ConfirmPanel
          label="Release toxin:"
          buttonLabel="Confirm"
          onConfirm={submitToxins}
          style={deployPanelStyle}
          extra={
            toxinsWastedTroops > 0
              ? `Warning: ${toxinsWastedTroops} troops wasted`
              : undefined
          }
        />
      )}
      {attackPanelOpen && attackPanelStyle && (
        <AttackPanel
          blitzWinProbabilities={attackDisplay.blitzWinProbabilities}
          maxBlitzTroops={attackDisplay.maxBlitzTroops}
          selectedType={attackDisplay.selectedType}
          regularTroops={attackDisplay.regularTroops}
          blitzTroops={attackDisplay.blitzTroops}
          blitzInputRef={blitzInputRef}
          diceRoll={attackDiceRoll}
          onSelectRegular={(troops) => {
            setAttackDiceRoll(null);
            setAttackSelectedType('regular');
            setAttackRegularTroops(troops);
          }}
          onSelectBlitz={() => {
            setAttackDiceRoll(null);
            setAttackSelectedType('blitz');
          }}
          onBlitzTroopsChange={(troops) => {
            setAttackDiceRoll(null);
            setAttackBlitzTroops(troops);
          }}
          onBlitzTroopsWheel={(delta) => {
            setAttackDiceRoll(null);
            setAttackSelectedType('blitz');
            setAttackBlitzTroops((prev) =>
              Math.min(maxBlitzTroops, Math.max(1, prev + delta)),
            );
          }}
          onConfirm={submitAttack}
          revealing={attackRevealing}
          diceOnly={attackDiceOnly}
          pendingConquest={attackShowPendingConquest}
          moveTroops={attackMoveTroops}
          moveMinTroops={attackMoveMinTroops}
          moveMaxTroops={attackMoveMaxTroops}
          moveInputRef={attackMoveInputRef}
          onMoveTroopsChange={setAttackMoveTroops}
          onConfirmMove={submitAttackMove}
          style={attackPanelStyle}
        />
      )}
    </>
  );
}
