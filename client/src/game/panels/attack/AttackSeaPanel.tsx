import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useNumberInput } from '../../../common/inputs/useNumberInput';
import { playerColor } from '../../../lib/palette';
import type { BlitzOutcome } from '../../../lib/types';
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

  const regularNumberInput = useNumberInput({
    value: regularShips,
    min: 1,
    max: maxRegularShips,
    onChange: (ships) => {
      onSelectRegular();
      onRegularShipsChange(ships);
    },
    inputRef,
  });
  const blitzNumberInput = useNumberInput({
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
              style={{ backgroundColor: playerColor(d.color), border: 'none' }}
              onClick={() => onSelectDefender(d.playerId)}
            >
              {d.ships}
            </Button>
          ))}
        </div>
      ) : (
        <div className="d-flex align-items-center gap-2">
          <div
            style={attackOptionStyle(selectedType === 'regular')}
            onClick={onSelectRegular}
          >
            <div className="d-flex align-items-center gap-1">
              <span>Ships</span>
              <Form.Control
                type="number"
                size="sm"
                min={1}
                max={maxRegularShips}
                value={regularShips}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  onSelectRegular();
                  onRegularShipsChange(
                    Math.min(
                      maxRegularShips,
                      Math.max(1, Number(e.target.value) || 1),
                    ),
                  );
                }}
                {...regularNumberInput}
                style={{ ...regularNumberInput.style, width: 60 }}
              />
            </div>
          </div>
          {blitzEnabled && (
            <div
              style={attackOptionStyle(selectedType === 'blitz')}
              onClick={onSelectBlitz}
            >
              <div className="d-flex align-items-center gap-1">
                <span>Blitz</span>
                <Form.Control
                  type="number"
                  size="sm"
                  min={1}
                  max={maxBlitzShips}
                  value={blitzShips}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    onSelectBlitz();
                    onBlitzShipsChange(
                      Math.min(
                        maxBlitzShips,
                        Math.max(1, Number(e.target.value) || 1),
                      ),
                    );
                  }}
                  {...blitzNumberInput}
                  style={{ ...blitzNumberInput.style, width: 60 }}
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
        </div>
      )}
      {diceRoll && (
        <DiceRollDisplay
          key={diceRoll.id}
          diceRoll={diceRoll}
          withDivider={!diceOnly}
        />
      )}
    </div>
  );
}

export default AttackSeaPanel;
