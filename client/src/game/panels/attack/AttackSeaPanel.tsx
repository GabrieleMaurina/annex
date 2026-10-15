import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';
import PercentageToggle from '../../../common/inputs/PercentageToggle';
import { useTroopsInput } from '../../../common/inputs/useTroopsInput';
import { contrastTextColor, playerColor } from '../../../lib/palette';
import { playSound } from '../../../lib/sounds';
import type { BlitzOutcome, DiceTies } from '../../../lib/types';
import { attackOptionStyle, formatProbability } from './attackOptionStyle';
import { DiceRollDisplay, type AttackType, type DiceRoll } from './AttackPanel';

interface Props {
  defenders: { playerId: number; ships: number; color: number }[];
  defenderId: number | null;
  onSelectDefender: (defenderId: number) => void;
  blitzWinProbabilities: number[];
  blitzOutcomes: BlitzOutcome[];
  maxRegularShips: number;
  maxBlitzShips: number;
  selectedType: AttackType;
  regularShips: number;
  blitzShips: number;
  blitzEnabled: boolean;
  diceTies: DiceTies;
  inputRef: RefObject<HTMLInputElement | null>;
  blitzInputRef: RefObject<HTMLInputElement | null>;
  onSelectRegular: () => void;
  onRegularShipsChange: (ships: number) => void;
  onSelectBlitz: () => void;
  onBlitzShipsChange: (ships: number) => void;
  onConfirm: () => void;
  diceRoll: DiceRoll | null;
  revealing: boolean;
  diceOnly: boolean;
  style: React.CSSProperties;
}

function AttackSeaPanel({
  defenders,
  defenderId,
  onSelectDefender,
  blitzWinProbabilities,
  blitzOutcomes,
  maxRegularShips,
  maxBlitzShips,
  selectedType,
  regularShips,
  blitzShips,
  blitzEnabled,
  diceTies,
  inputRef,
  blitzInputRef,
  onSelectRegular,
  onRegularShipsChange,
  onSelectBlitz,
  onBlitzShipsChange,
  onConfirm,
  diceRoll,
  revealing,
  diceOnly,
  style,
}: Props) {
  const blitzProbability = blitzWinProbabilities[blitzShips - 1] ?? 0;
  const blitzOutcome = blitzOutcomes[blitzShips - 1];

  const regularShipsInput = useTroopsInput({
    value: regularShips,
    min: 1,
    max: maxRegularShips,
    onChange: (ships) => {
      onSelectRegular();
      onRegularShipsChange(ships);
    },
    inputRef,
  });
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
      className="p-2 px-3 border rounded bg-body bg-opacity-75 d-flex flex-column gap-2"
      data-no-click-sound
      style={{ ...style, zIndex: 1, whiteSpace: 'nowrap' }}
    >
      {diceOnly ? null : defenderId === null ? (
        <div className="d-flex align-items-center gap-2">
          <span>Attack which player's ships?</span>
          {defenders.map((d) => (
            <Button
              key={d.playerId}
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
          ))}
        </div>
      ) : (
        <div className="d-flex align-items-center gap-2">
          <div
            style={attackOptionStyle(selectedType === 'regular')}
            onClick={() => {
              playSound('click');
              onSelectRegular();
            }}
          >
            <div className="d-flex align-items-center gap-1">
              <span>Ships</span>
              <Form.Control
                type="number"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                {...regularShipsInput}
                style={{ ...regularShipsInput.style, width: 60 }}
              />
            </div>
          </div>
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
                <Form.Control
                  type="number"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  {...blitzShipsInput}
                  style={{ ...blitzShipsInput.style, width: 60 }}
                />
                <span className="small">
                  {blitzOutcome
                    ? `Lose ${blitzOutcome.attackLosses} / Kill ${blitzOutcome.defenceLosses}`
                    : formatProbability(blitzProbability)}
                </span>
              </div>
            </div>
          )}
          <Button size="sm" onClick={onConfirm} disabled={revealing}>
            Attack
          </Button>
          {blitzEnabled && <PercentageToggle max={maxBlitzShips} />}
        </div>
      )}
      {diceRoll && (
        <DiceRollDisplay
          key={diceRoll.id}
          diceRoll={diceRoll}
          diceTies={diceTies}
          withDivider={!diceOnly}
        />
      )}
    </div>
  );
}

export default AttackSeaPanel;
