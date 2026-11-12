import { ONLINE_PAUSE_SECONDS } from 'engine';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { stepTroops } from '../../../common/inputs/useTroopsInput';
import { connector } from '../../../connector';
import { playerColor } from '../../../lib/palette';
import type {
  BlitzOutcome,
  DiceTies,
  GameState,
  Placement,
  TurnDuration,
  TurnPhase,
} from '../../../lib/types';
import { useDragOffset } from '../../../ui/containers/dragOffset';
import AttackPanel, {
  type AttackType,
  type DiceRoll,
} from '../../panels/attack/AttackPanel';
import AttackSeaPanel from '../../panels/attack/AttackSeaPanel';
import ConfirmPanel from '../../panels/ConfirmPanel';
import TroopPanel from '../../panels/TroopPanel';
import TurnPanel from '../../panels/TurnPanel';
import TurnProgressBar from '../../panels/TurnProgressBar';
import { useCameraTransform, type Camera } from '../camera';
import { CAPITAL_PHASE_DURATION, PLACEMENT_PHASE_DURATION } from '../helpers';
import { usePanelStyles, type PanelAnchors } from '../hooks/useMiscUiState';

export default function TurnActionPanels({
  camera,
  anchors,
  currentTurnPlayer,
  gameEnded,
  turnPhase,
  placement,
  startingCapitals,
  turnDuration,
  paused,
  pausedAt,
  turnStartedAt,
  turnExtension,
  isMyTurn,
  troopsToDeploy,
  deployMaxTroops,
  mustPlaySet,
  nextPhaseEndsTurn,
  tankFire,
  advancePhase,
  canReturnPhase,
  returnPhase,
  deployPanelOpen,
  deployTroops,
  deployInputRef,
  setDeployTroops,
  submitDeploy,
  deploySeaPanelOpen,
  deploySeaComboActive,
  deploySeaShips,
  deploySeaMaxShips,
  deploySeaInputRef,
  setDeploySeaShips,
  submitDeploySea,
  sailPanelOpen,
  sailShips,
  sailMaxShips,
  sailInputRef,
  setSailShips,
  submitSail,
  fortifyPanelOpen,
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
  attackDisplay,
  blitzEnabled,
  attackDice,
  diceTies,
  attackSides,
  defenceSides,
  blitzInputRef,
  attackDiceRoll,
  setAttackDiceRoll,
  setAttackSelectedType,
  setAttackManualTroops,
  setAttackBlitzTroops,
  maxBlitzTroops,
  attackDiceOnly,
  attackShowPendingConquest,
  attackMoveTroops,
  attackMoveMinTroops,
  attackMoveMaxTroops,
  attackMoveInputRef,
  setAttackMoveTroops,
  submitAttackMove,
  submitAttack,
  attackSeaPanelOpen,
  attackSeaDefenders,
  attackSeaDefenderId,
  selectAttackSeaDefender,
  attackSeaSelectedType,
  setAttackSeaSelectedType,
  attackSeaManualShips,
  setAttackSeaManualShips,
  attackSeaBlitzShips,
  setAttackSeaBlitzShips,
  attackSeaMaxManualShips,
  attackSeaMaxBlitzShips,
  attackSeaWinProbabilities,
  attackSeaBlitzOutcomes,
  attackSeaInputRef,
  attackSeaBlitzInputRef,
  attackSeaDiceRoll,
  attackSeaDiceOnly,
  submitAttackSea,
  players,
}: {
  camera: Camera;
  anchors: PanelAnchors;
  currentTurnPlayer: GameState['players'][number] | undefined;
  gameEnded: boolean;
  turnPhase: TurnPhase;
  placement: Placement;
  startingCapitals: number;
  turnDuration: TurnDuration;
  paused: boolean;
  pausedAt: number | null;
  turnStartedAt: number;
  turnExtension: number;
  isMyTurn: boolean;
  troopsToDeploy: number;
  deployMaxTroops: number;
  mustPlaySet: boolean;
  nextPhaseEndsTurn: boolean;
  tankFire: { id: number; dice?: number };
  advancePhase: () => void;
  canReturnPhase: boolean;
  returnPhase: () => void;
  deployPanelOpen: boolean;
  deployTroops: number;
  deployInputRef: RefObject<HTMLInputElement | null>;
  setDeployTroops: Dispatch<SetStateAction<number>>;
  submitDeploy: () => void;
  deploySeaPanelOpen: boolean;
  deploySeaComboActive: boolean;
  deploySeaShips: number;
  deploySeaMaxShips: number;
  deploySeaInputRef: RefObject<HTMLInputElement | null>;
  setDeploySeaShips: Dispatch<SetStateAction<number>>;
  submitDeploySea: () => void;
  sailPanelOpen: boolean;
  sailShips: number;
  sailMaxShips: number;
  sailInputRef: RefObject<HTMLInputElement | null>;
  setSailShips: Dispatch<SetStateAction<number>>;
  submitSail: () => void;
  fortifyPanelOpen: boolean;
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
  attackDisplay: {
    maxBlitzTroops: number;
    blitzWinProbabilities: number[];
    blitzOutcomes: BlitzOutcome[];
    selectedType: AttackType;
    manualTroops: number;
    blitzTroops: number;
    unlock: { x: number; y: number; cost: number } | null;
    flip: { x: number; y: number; cost: number } | null;
  };
  blitzEnabled: boolean;
  attackDice: number;
  diceTies: DiceTies;
  attackSides: number;
  defenceSides: number;
  blitzInputRef: RefObject<HTMLInputElement | null>;
  attackDiceRoll: DiceRoll | null;
  setAttackDiceRoll: Dispatch<SetStateAction<DiceRoll | null>>;
  setAttackSelectedType: Dispatch<SetStateAction<AttackType>>;
  setAttackManualTroops: Dispatch<SetStateAction<number>>;
  setAttackBlitzTroops: Dispatch<SetStateAction<number>>;
  maxBlitzTroops: number;
  attackDiceOnly: boolean;
  attackShowPendingConquest: boolean;
  attackMoveTroops: number;
  attackMoveMinTroops: number;
  attackMoveMaxTroops: number;
  attackMoveInputRef: RefObject<HTMLInputElement | null>;
  setAttackMoveTroops: Dispatch<SetStateAction<number>>;
  submitAttackMove: () => void;
  submitAttack: () => void;
  attackSeaPanelOpen: boolean;
  attackSeaDefenders: { playerId: number; ships: number }[];
  attackSeaDefenderId: number | null;
  selectAttackSeaDefender: (defenderId: number) => void;
  attackSeaSelectedType: AttackType;
  setAttackSeaSelectedType: Dispatch<SetStateAction<AttackType>>;
  attackSeaManualShips: number;
  setAttackSeaManualShips: Dispatch<SetStateAction<number>>;
  attackSeaBlitzShips: number;
  setAttackSeaBlitzShips: Dispatch<SetStateAction<number>>;
  attackSeaMaxManualShips: number;
  attackSeaMaxBlitzShips: number;
  attackSeaWinProbabilities: number[] | null;
  attackSeaBlitzOutcomes: BlitzOutcome[] | null;
  attackSeaInputRef: RefObject<HTMLInputElement | null>;
  attackSeaBlitzInputRef: RefObject<HTMLInputElement | null>;
  attackSeaDiceRoll: DiceRoll | null;
  attackSeaDiceOnly: boolean;
  submitAttackSea: () => void;
  players: GameState['players'];
}) {
  const target = attackDisplay.unlock ?? attackDisplay.flip;
  const drag = useDragOffset(
    [
      turnPhase,
      anchors.selectedTerritoryId,
      anchors.fortifyEndTerritoryId,
      anchors.attackEndTerritoryId ?? anchors.attackDiceRollTerritoryId,
      anchors.sailEndTerritoryId,
      anchors.attackSeaTerritoryId ?? anchors.attackSeaDiceRollTerritoryId,
      anchors.deploySeaTerritoryId,
      target?.x,
      target?.y,
    ].join(':'),
  );
  const styles = usePanelStyles(anchors, useCameraTransform(camera), target);
  const deployPanelStyle = drag.shift(styles.deployPanelStyle);
  const fortifyPanelStyle = drag.shift(styles.fortifyPanelStyle);
  const attackPanelStyle = drag.shift(styles.attackPanelStyle);
  const sailPanelStyle = drag.shift(styles.sailPanelStyle);
  const attackSeaPanelStyle = drag.shift(styles.attackSeaPanelStyle);
  const seaPanelStyle = drag.shift(styles.deploySeaPanelStyle);
  const unlockPanelStyle = drag.shift(styles.unlockPanelStyle);
  const deploySeaPanelStyle = deploySeaComboActive
    ? deployPanelStyle
    : seaPanelStyle;
  if (!currentTurnPlayer) return null;
  return (
    <>
      {!gameEnded && (
        <>
          {paused && pausedAt !== null ? (
            <TurnProgressBar
              turnStartedAt={pausedAt}
              turnDuration={ONLINE_PAUSE_SECONDS}
              color="var(--bs-gray-500)"
              paused={false}
            />
          ) : connector.isTutorial() ? null : (
            <TurnProgressBar
              turnStartedAt={turnStartedAt}
              turnDuration={
                turnPhase === 'capital' ||
                (turnPhase === 'territory' && placement === 'single')
                  ? CAPITAL_PHASE_DURATION
                  : turnPhase === 'territory' || turnPhase === 'troop'
                    ? PLACEMENT_PHASE_DURATION
                    : turnDuration + turnExtension
              }
              color={playerColor(currentTurnPlayer.color)}
              paused={paused}
              heartbeat={isMyTurn && !currentTurnPlayer.surrendered}
            />
          )}
          <TurnPanel
            turnPhase={turnPhase}
            currentPlayerName={currentTurnPlayer.name}
            color={playerColor(currentTurnPlayer.color)}
            isMyTurn={isMyTurn}
            troopsToDeploy={troopsToDeploy}
            troopsRemaining={currentTurnPlayer.troopsRemaining}
            capitalsPlaced={currentTurnPlayer.capitalCount}
            startingCapitals={startingCapitals}
            canLeaveDeploy={troopsToDeploy <= 0 && !mustPlaySet}
            paused={paused}
            endsTurn={nextPhaseEndsTurn}
            tankFire={tankFire}
            advancePhase={advancePhase}
            canReturnPhase={canReturnPhase}
            returnPhase={returnPhase}
          />
        </>
      )}
      <div style={{ display: 'contents' }} onPointerDown={drag.start}>
        {deployPanelOpen && deployPanelStyle && (
          <TroopPanel
            label={turnPhase === 'troop' ? 'Place troops:' : 'Deploy troops:'}
            buttonLabel={turnPhase === 'troop' ? 'Place' : 'Deploy'}
            troops={deployTroops}
            maxTroops={deployMaxTroops}
            inputRef={deployInputRef}
            onChange={setDeployTroops}
            onConfirm={submitDeploy}
            style={deployPanelStyle}
          />
        )}
        {deploySeaPanelOpen && deploySeaPanelStyle && (
          <TroopPanel
            label={deploySeaComboActive ? 'Buy ships:' : 'Deploy ships:'}
            buttonLabel={deploySeaComboActive ? 'Buy' : 'Deploy'}
            troops={deploySeaShips}
            maxTroops={deploySeaMaxShips}
            inputRef={deploySeaInputRef}
            onChange={setDeploySeaShips}
            onConfirm={submitDeploySea}
            style={deploySeaPanelStyle}
          />
        )}
        {sailPanelOpen && sailPanelStyle && (
          <TroopPanel
            label="Sail ships:"
            buttonLabel="Sail"
            troops={sailShips}
            maxTroops={sailMaxShips}
            inputRef={sailInputRef}
            onChange={setSailShips}
            onConfirm={submitSail}
            style={sailPanelStyle}
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
        {attackPanelOpen && unlockPanelStyle && attackDisplay.unlock && (
          <ConfirmPanel
            label="Unlock tile:"
            buttonLabel="Unlock"
            onConfirm={submitAttack}
            style={unlockPanelStyle}
            extra={`Costs ${attackDisplay.unlock.cost} troops`}
          />
        )}
        {attackPanelOpen && unlockPanelStyle && attackDisplay.flip && (
          <ConfirmPanel
            label="Flip switch:"
            buttonLabel="Flip"
            onConfirm={submitAttack}
            style={unlockPanelStyle}
            extra={`Costs ${attackDisplay.flip.cost} troops`}
          />
        )}
        {attackPanelOpen &&
          attackPanelStyle &&
          !attackDisplay.unlock &&
          !attackDisplay.flip && (
            <AttackPanel
              blitzWinProbabilities={attackDisplay.blitzWinProbabilities}
              blitzOutcomes={attackDisplay.blitzOutcomes}
              maxBlitzTroops={attackDisplay.maxBlitzTroops}
              selectedType={attackDisplay.selectedType}
              manualTroops={attackDisplay.manualTroops}
              blitzTroops={attackDisplay.blitzTroops}
              blitzEnabled={blitzEnabled}
              attackDice={attackDice}
              diceTies={diceTies}
              attackSides={attackSides}
              defenceSides={defenceSides}
              blitzInputRef={blitzInputRef}
              diceRoll={attackDiceRoll}
              onSelectManual={(troops) => {
                setAttackDiceRoll(null);
                setAttackSelectedType('manual');
                setAttackManualTroops(troops);
              }}
              onSelectBlitz={() => {
                setAttackDiceRoll(null);
                setAttackSelectedType('blitz');
              }}
              onBlitzTroopsChange={(troops) => {
                setAttackDiceRoll(null);
                setAttackBlitzTroops(troops);
              }}
              onBlitzTroopsWheel={(delta, newGesture) => {
                const at = performance.now();
                setAttackDiceRoll(null);
                setAttackSelectedType('blitz');
                setAttackBlitzTroops((prev) =>
                  stepTroops(prev, delta, 1, maxBlitzTroops, newGesture, at),
                );
              }}
              onConfirm={submitAttack}
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
        {attackSeaPanelOpen && attackSeaPanelStyle && (
          <AttackSeaPanel
            defenders={attackSeaDefenders.map((d) => ({
              ...d,
              color: players.find((p) => p.id === d.playerId)?.color ?? 0,
            }))}
            defenderId={attackSeaDefenderId}
            onSelectDefender={selectAttackSeaDefender}
            blitzWinProbabilities={attackSeaWinProbabilities ?? []}
            blitzOutcomes={attackSeaBlitzOutcomes ?? []}
            maxManualShips={attackSeaMaxManualShips}
            maxBlitzShips={attackSeaMaxBlitzShips}
            selectedType={attackSeaSelectedType}
            manualShips={attackSeaManualShips}
            blitzShips={attackSeaBlitzShips}
            blitzEnabled={blitzEnabled}
            diceTies={diceTies}
            attackSides={attackSides}
            defenceSides={defenceSides}
            inputRef={attackSeaInputRef}
            blitzInputRef={attackSeaBlitzInputRef}
            onSelectManual={() => setAttackSeaSelectedType('manual')}
            onManualShipsChange={setAttackSeaManualShips}
            onSelectBlitz={() => setAttackSeaSelectedType('blitz')}
            onBlitzShipsChange={setAttackSeaBlitzShips}
            onConfirm={submitAttackSea}
            diceRoll={attackSeaDiceRoll}
            diceOnly={attackSeaDiceOnly}
            style={attackSeaPanelStyle}
          />
        )}
      </div>
    </>
  );
}
