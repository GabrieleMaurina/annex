import { ONLINE_PAUSE_SECONDS } from 'engine';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { stepTroops } from '../../../common/inputs/useTroopsInput';
import { playerColor } from '../../../lib/palette';
import type {
  BlitzOutcome,
  DiceTies,
  GameState,
  Placement,
  TurnDuration,
  TurnPhase,
} from '../../../lib/types';
import Fuse from '../../../ui/themed/Fuse';
import AttackPanel, {
  type AttackType,
  type DiceRoll,
} from '../../panels/attack/AttackPanel';
import AttackSeaPanel from '../../panels/attack/AttackSeaPanel';
import ConfirmPanel from '../../panels/ConfirmPanel';
import TroopPanel from '../../panels/TroopPanel';
import TurnPanel from '../../panels/TurnPanel';
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
  turnDuration,
  paused,
  pausedAt,
  turnStartedAt,
  turnExtension,
  isMyTurn,
  troopsToDeploy,
  deployMaxTroops,
  mustPlaySet,
  setGame,
  nextPhaseEndsTurn,
  tankFireId,
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
  attackSeaPanelOpen,
  attackSeaDefenders,
  attackSeaDefenderId,
  selectAttackSeaDefender,
  attackSeaSelectedType,
  setAttackSeaSelectedType,
  attackSeaRegularShips,
  setAttackSeaRegularShips,
  attackSeaBlitzShips,
  setAttackSeaBlitzShips,
  attackSeaMaxRegularShips,
  attackSeaMaxBlitzShips,
  attackSeaWinProbabilities,
  attackSeaBlitzOutcomes,
  attackSeaInputRef,
  attackSeaBlitzInputRef,
  attackSeaDiceRoll,
  attackSeaRevealing,
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
  turnDuration: TurnDuration;
  paused: boolean;
  pausedAt: number | null;
  turnStartedAt: number;
  turnExtension: number;
  isMyTurn: boolean;
  troopsToDeploy: number;
  deployMaxTroops: number;
  mustPlaySet: boolean;
  setGame: (game: GameState) => void;
  nextPhaseEndsTurn: boolean;
  tankFireId: number;
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
    regularTroops: number;
    blitzTroops: number;
    unlock: { x: number; y: number; cost: number } | null;
  };
  blitzEnabled: boolean;
  attackDice: number;
  diceTies: DiceTies;
  blitzInputRef: RefObject<HTMLInputElement | null>;
  attackDiceRoll: DiceRoll | null;
  setAttackDiceRoll: Dispatch<SetStateAction<DiceRoll | null>>;
  setAttackSelectedType: Dispatch<SetStateAction<AttackType>>;
  setAttackRegularTroops: Dispatch<SetStateAction<number>>;
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
  attackSeaPanelOpen: boolean;
  attackSeaDefenders: { playerId: number; ships: number }[];
  attackSeaDefenderId: number | null;
  selectAttackSeaDefender: (defenderId: number) => void;
  attackSeaSelectedType: AttackType;
  setAttackSeaSelectedType: Dispatch<SetStateAction<AttackType>>;
  attackSeaRegularShips: number;
  setAttackSeaRegularShips: Dispatch<SetStateAction<number>>;
  attackSeaBlitzShips: number;
  setAttackSeaBlitzShips: Dispatch<SetStateAction<number>>;
  attackSeaMaxRegularShips: number;
  attackSeaMaxBlitzShips: number;
  attackSeaWinProbabilities: number[] | null;
  attackSeaBlitzOutcomes: BlitzOutcome[] | null;
  attackSeaInputRef: RefObject<HTMLInputElement | null>;
  attackSeaBlitzInputRef: RefObject<HTMLInputElement | null>;
  attackSeaDiceRoll: DiceRoll | null;
  attackSeaRevealing: boolean;
  attackSeaDiceOnly: boolean;
  submitAttackSea: () => void;
  players: GameState['players'];
}) {
  const {
    deployPanelStyle,
    fortifyPanelStyle,
    attackPanelStyle,
    sailPanelStyle,
    attackSeaPanelStyle,
    deploySeaPanelStyle: seaPanelStyle,
    unlockPanelStyle,
  } = usePanelStyles(anchors, useCameraTransform(camera), attackDisplay.unlock);
  const deploySeaPanelStyle = deploySeaComboActive
    ? deployPanelStyle
    : seaPanelStyle;
  if (!currentTurnPlayer) return null;
  return (
    <>
      {!gameEnded && (
        <>
          {paused && pausedAt !== null ? (
            <Fuse
              startedAt={pausedAt}
              duration={ONLINE_PAUSE_SECONDS}
              color="var(--bs-gray-500)"
              paused={false}
            />
          ) : (
            <Fuse
              startedAt={turnStartedAt}
              duration={
                turnPhase === 'capital' ||
                (turnPhase === 'territory' && placement === 'single')
                  ? CAPITAL_PHASE_DURATION
                  : turnPhase === 'territory' || turnPhase === 'troop'
                    ? PLACEMENT_PHASE_DURATION
                    : turnDuration + turnExtension
              }
              color={playerColor(currentTurnPlayer.color)}
              paused={paused}
            />
          )}
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
      {attackPanelOpen && attackPanelStyle && !attackDisplay.unlock && (
        <AttackPanel
          blitzWinProbabilities={attackDisplay.blitzWinProbabilities}
          blitzOutcomes={attackDisplay.blitzOutcomes}
          maxBlitzTroops={attackDisplay.maxBlitzTroops}
          selectedType={attackDisplay.selectedType}
          regularTroops={attackDisplay.regularTroops}
          blitzTroops={attackDisplay.blitzTroops}
          blitzEnabled={blitzEnabled}
          attackDice={attackDice}
          diceTies={diceTies}
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
              stepTroops(prev, delta, 1, maxBlitzTroops),
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
          maxRegularShips={attackSeaMaxRegularShips}
          maxBlitzShips={attackSeaMaxBlitzShips}
          selectedType={attackSeaSelectedType}
          regularShips={attackSeaRegularShips}
          blitzShips={attackSeaBlitzShips}
          blitzEnabled={blitzEnabled}
          diceTies={diceTies}
          inputRef={attackSeaInputRef}
          blitzInputRef={attackSeaBlitzInputRef}
          onSelectRegular={() => setAttackSeaSelectedType('regular')}
          onRegularShipsChange={setAttackSeaRegularShips}
          onSelectBlitz={() => setAttackSeaSelectedType('blitz')}
          onBlitzShipsChange={setAttackSeaBlitzShips}
          onConfirm={submitAttackSea}
          diceRoll={attackSeaDiceRoll}
          revealing={attackSeaRevealing}
          diceOnly={attackSeaDiceOnly}
          style={attackSeaPanelStyle}
        />
      )}
    </>
  );
}
