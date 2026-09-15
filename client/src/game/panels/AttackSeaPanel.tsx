import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useDragNumber } from '../../common/useDragNumber';
import { playerColor } from '../../lib/palette';
import { DiceRollDisplay, type DiceRoll } from './AttackPanel';

interface Props {
  defenders: { playerId: number; ships: number; color: number }[];
  defenderId: number | null;
  onSelectDefender: (defenderId: number) => void;
  ships: number;
  maxShips: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onChangeShips: (ships: number) => void;
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
  ships,
  maxShips,
  inputRef,
  onChangeShips,
  onConfirm,
  diceRoll,
  revealing,
  diceOnly,
  style,
}: Props) {
  const dragNumber = useDragNumber({
    value: ships,
    min: 1,
    max: maxShips,
    onChange: onChangeShips,
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
          <span>Attack ships:</span>
          <Form.Control
            ref={inputRef}
            type="number"
            size="sm"
            min={1}
            max={maxShips}
            value={ships}
            onChange={(e) =>
              onChangeShips(
                Math.min(maxShips, Math.max(1, Number(e.target.value) || 1)),
              )
            }
            {...dragNumber}
            style={{ ...dragNumber.style, width: 70 }}
          />
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
