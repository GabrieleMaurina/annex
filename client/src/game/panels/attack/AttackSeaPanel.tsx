import type { RefObject } from 'react';
import { Button } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import PercentageToggle from '../../../common/inputs/PercentageToggle';
import { useTroopsInput } from '../../../common/inputs/useTroopsInput';
import Tip from '../../../common/tooltips/Tip';
import { contrastTextColor, playerColor } from '../../../lib/palette';
import { playSound } from '../../../lib/sounds';
import type { BlitzOutcome, DiceTies } from '../../../lib/types';
import { PANEL_BG_CLASS } from '../../../ui/containers/panelStyle';
import NumberOdometer from '../../../ui/forms/NumberOdometer';
import TroopSlider from '../TroopSlider';
import { attackOptionStyle, formatProbability } from './attackOptionStyle';
import { DiceRollDisplay, type AttackType, type DiceRoll } from './AttackPanel';

interface Props {
  defenders: {
    playerId: number;
    ships: number;
    color: number;
    name: string | null;
  }[];
  defenderId: number | null;
  onSelectDefender: (defenderId: number) => void;
  blitzWinProbabilities: number[];
  blitzOutcomes: BlitzOutcome[];
  maxManualShips: number;
  maxBlitzShips: number;
  selectedType: AttackType;
  manualShips: number;
  blitzShips: number;
  blitzEnabled: boolean;
  diceTies: DiceTies;
  attackSides: number;
  defenceSides: number;
  blitzInputRef: RefObject<HTMLInputElement | null>;
  onSelectManual: (ships: number) => void;
  onSelectBlitz: () => void;
  onBlitzShipsChange: (ships: number) => void;
  onConfirm: () => void;
  diceRoll: DiceRoll | null;
  diceOnly: boolean;
  style: React.CSSProperties;
}

function AttackSeaPanel({
  defenders,
  defenderId,
  onSelectDefender,
  blitzWinProbabilities,
  blitzOutcomes,
  maxManualShips,
  maxBlitzShips,
  selectedType,
  manualShips,
  blitzShips,
  blitzEnabled,
  diceTies,
  attackSides,
  defenceSides,
  blitzInputRef,
  onSelectManual,
  onSelectBlitz,
  onBlitzShipsChange,
  onConfirm,
  diceRoll,
  diceOnly,
  style,
}: Props) {
  const blitzProbability = blitzWinProbabilities[blitzShips - 1] ?? 0;
  const blitzOutcome = blitzOutcomes[blitzShips - 1];

  const blitzShipsInput = useTroopsInput({
    value: blitzShips,
    min: 1,
    max: maxBlitzShips,
    onChange: (ships) => {
      onSelectBlitz();
      onBlitzShipsChange(ships);
    },
    inputRef: blitzInputRef,
  });

  return (
    <div
      className={`p-2 px-3 border rounded ${PANEL_BG_CLASS} d-flex flex-column gap-2`}
      data-no-click-sound
      style={{ ...style, zIndex: 1, whiteSpace: 'nowrap' }}
    >
      {diceOnly ? null : defenderId === null ? (
        <div className="d-flex align-items-center gap-2">
          <span>Attack which player's ships?</span>
          {defenders.map((d) => (
            <Tip
              key={d.playerId}
              text={
                d.name
                  ? `Attack ${d.name}'s ${d.ships} ships`
                  : `Attack the player with ${d.ships} ships`
              }
            >
              <Button
                size="sm"
                style={{
                  backgroundColor: playerColor(d.color),
                  color: contrastTextColor(playerColor(d.color)),
                  border: 'none',
                }}
                onClick={() => {
                  playSound('click');
                  onSelectDefender(d.playerId);
                }}
              >
                {d.ships}
              </Button>
            </Tip>
          ))}
        </div>
      ) : (
        <div className="d-flex align-items-center gap-2">
          {Array.from({ length: maxManualShips }, (_, i) => {
            const ships = i + 1;
            return (
              <div
                key={ships}
                style={attackOptionStyle(
                  selectedType === 'manual' && manualShips === ships,
                )}
                onClick={() => {
                  playSound('click');
                  onSelectManual(ships);
                }}
              >
                <div>{ships}</div>
              </div>
            );
          })}
          {blitzEnabled && (
            <div
              style={attackOptionStyle(selectedType === 'blitz')}
              onClick={() => {
                playSound('click');
                onSelectBlitz();
              }}
            >
              <div className="d-flex align-items-center gap-1">
                <span>Blitz</span>
                <NumberOdometer
                  onClick={(e) => e.stopPropagation()}
                  {...blitzShipsInput}
                  style={{ minWidth: 60 }}
                />
                <span className="small">
                  {blitzOutcome
                    ? `Lose ${blitzOutcome.attackLosses} / Kill ${blitzOutcome.defenceLosses}`
                    : formatProbability(blitzProbability)}
                </span>
              </div>
            </div>
          )}
          <Button
            className="d-inline-flex align-items-center justify-content-center gap-1"
            size="sm"
            onClick={onConfirm}
          >
            <WhiteIcon path="/icons/swords.svg" />
            Attack
          </Button>
          {blitzEnabled && <PercentageToggle max={maxBlitzShips} />}
        </div>
      )}
      {!diceOnly && defenderId !== null && blitzEnabled && (
        <TroopSlider
          min={blitzShipsInput.min}
          max={blitzShipsInput.max}
          value={blitzShipsInput.value}
          onChange={blitzShipsInput.onChange}
        />
      )}
      {diceRoll && (
        <DiceRollDisplay
          key={diceRoll.id}
          diceRoll={diceRoll}
          diceTies={diceTies}
          attackSides={attackSides}
          defenceSides={defenceSides}
          withDivider={!diceOnly}
        />
      )}
    </div>
  );
}

export default AttackSeaPanel;
