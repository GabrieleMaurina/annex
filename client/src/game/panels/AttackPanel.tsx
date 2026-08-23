import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import {
  DICE_ROLL_STEP_DURATION,
  DICE_ROLL_STEPS,
  generateDiceRollSequence,
} from '../animations';

export type AttackType = 'regular' | 'blitz';

export interface DiceRoll {
  attackerDice: number[];
  defenderDice: number[];
  territoryId: number;
  id: number;
}

interface Props {
  blitzWinProbabilities: number[];
  maxBlitzTroops: number;
  selectedType: AttackType;
  regularTroops: 1 | 2 | 3;
  blitzTroops: number;
  blitzInputRef: RefObject<HTMLInputElement | null>;
  diceRoll: DiceRoll | null;
  onSelectRegular: (troops: 1 | 2 | 3) => void;
  onSelectBlitz: () => void;
  onBlitzTroopsChange: (troops: number) => void;
  onBlitzTroopsWheel: (delta: number) => void;
  onConfirm: () => void;
  revealing: boolean;
  diceOnly: boolean;
  pendingConquest: boolean;
  moveTroops: number;
  moveMinTroops: number;
  moveMaxTroops: number;
  moveInputRef: RefObject<HTMLInputElement | null>;
  onMoveTroopsChange: (troops: number) => void;
  onConfirmMove: () => void;
  style: React.CSSProperties;
}

function formatProbability(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

const WIN_COLOR = '#d0d0d0';

function Die({
  value,
  outcome,
}: {
  value: number | undefined;
  outcome?: 'win' | 'lose';
}) {
  if (value === undefined) return <div style={{ width: 28, height: 28 }} />;
  const isWin = outcome === 'win';
  return (
    <div
      className={`d-flex align-items-center justify-content-center border rounded fw-bold${isWin ? '' : ' bg-body text-body'}`}
      style={{
        width: 28,
        height: 28,
        fontSize: 16,
        opacity: outcome === 'lose' ? 0.4 : 1,
        backgroundColor: isWin ? WIN_COLOR : undefined,
        color: isWin ? '#000000' : undefined,
        borderColor: isWin ? WIN_COLOR : undefined,
        borderWidth: isWin ? 2 : undefined,
        boxShadow: isWin ? '0 0 5px 1px rgba(255, 255, 255, 0.5)' : undefined,
        transform: isWin ? 'scale(1.08)' : undefined,
      }}
    >
      {value}
    </div>
  );
}

function DiceRollDisplay({
  diceRoll,
  withDivider,
}: {
  diceRoll: DiceRoll;
  withDivider: boolean;
}) {
  const pairs = Math.min(
    diceRoll.attackerDice.length,
    diceRoll.defenderDice.length,
  );
  const diceCount = Math.max(
    diceRoll.attackerDice.length,
    diceRoll.defenderDice.length,
  );
  const [step, setStep] = useState(0);
  const [sequences] = useState(() => ({
    attacker: diceRoll.attackerDice.map((value) =>
      generateDiceRollSequence(value, DICE_ROLL_STEPS),
    ),
    defender: diceRoll.defenderDice.map((value) =>
      generateDiceRollSequence(value, DICE_ROLL_STEPS),
    ),
  }));

  useEffect(() => {
    if (step >= DICE_ROLL_STEPS - 1) return;
    const timer = setTimeout(
      () => setStep((prev) => prev + 1),
      DICE_ROLL_STEP_DURATION,
    );
    return () => clearTimeout(timer);
  }, [step]);

  const settled = step === DICE_ROLL_STEPS - 1;

  function outcomeFor(
    side: 'attacker' | 'defender',
    i: number,
  ): 'win' | 'lose' | undefined {
    if (!settled || i >= pairs) return undefined;
    const attackerWins = diceRoll.attackerDice[i] > diceRoll.defenderDice[i];
    return side === 'attacker'
      ? attackerWins
        ? 'win'
        : 'lose'
      : attackerWins
        ? 'lose'
        : 'win';
  }

  return (
    <div
      className={`d-flex flex-column gap-1${withDivider ? ' border-top pt-2' : ''}`}
    >
      <div className="d-flex align-items-center gap-2">
        <span className="small" style={{ width: 64 }}>
          Attacker
        </span>
        <div className="d-flex gap-2">
          {Array.from({ length: diceCount }, (_, i) => (
            <Die
              key={i}
              value={sequences.attacker[i]?.[step]}
              outcome={outcomeFor('attacker', i)}
            />
          ))}
        </div>
      </div>
      <div className="d-flex align-items-center gap-2">
        <span className="small" style={{ width: 64 }}>
          Defender
        </span>
        <div className="d-flex gap-2">
          {Array.from({ length: diceCount }, (_, i) => (
            <Die
              key={i}
              value={sequences.defender[i]?.[step]}
              outcome={outcomeFor('defender', i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AttackPanel({
  blitzWinProbabilities,
  maxBlitzTroops,
  selectedType,
  regularTroops,
  blitzTroops,
  blitzInputRef,
  diceRoll,
  onSelectRegular,
  onSelectBlitz,
  onBlitzTroopsChange,
  onBlitzTroopsWheel,
  onConfirm,
  revealing,
  diceOnly,
  pendingConquest,
  moveTroops,
  moveMinTroops,
  moveMaxTroops,
  moveInputRef,
  onMoveTroopsChange,
  onConfirmMove,
  style,
}: Props) {
  const blitzProbability = blitzWinProbabilities[blitzTroops - 1] ?? 0;
  const maxRegularTroops = Math.min(maxBlitzTroops, 3);

  function optionStyle(selected: boolean): React.CSSProperties {
    return {
      cursor: 'pointer',
      borderRadius: 4,
      padding: '2px 8px',
      border: selected ? '2px solid currentColor' : '2px solid transparent',
      textAlign: 'center',
    };
  }

  return (
    <div
      className="p-2 px-3 border rounded bg-body bg-opacity-75 d-flex flex-column gap-2"
      style={{
        ...style,
        zIndex: 1,
      }}
    >
      {diceOnly ? null : pendingConquest ? (
        <div
          className="d-flex align-items-center gap-2"
          style={{ whiteSpace: 'nowrap' }}
        >
          <span>Move troops:</span>
          <Form.Control
            ref={moveInputRef}
            type="number"
            size="sm"
            min={moveMinTroops}
            max={moveMaxTroops}
            value={moveTroops}
            onChange={(e) =>
              onMoveTroopsChange(
                Math.min(
                  moveMaxTroops,
                  Math.max(
                    moveMinTroops,
                    Number(e.target.value) || moveMinTroops,
                  ),
                ),
              )
            }
            style={{ width: 70 }}
          />
          <Button size="sm" onClick={onConfirmMove}>
            Confirm
          </Button>
        </div>
      ) : (
        <div
          className="d-flex align-items-center gap-2"
          style={{ whiteSpace: 'nowrap' }}
        >
          {Array.from({ length: maxRegularTroops }, (_, i) => {
            const troops = (i + 1) as 1 | 2 | 3;
            return (
              <div
                key={troops}
                style={optionStyle(
                  selectedType === 'regular' && regularTroops === troops,
                )}
                onClick={() => onSelectRegular(troops)}
              >
                <div>{troops}</div>
              </div>
            );
          })}
          <div
            style={optionStyle(selectedType === 'blitz')}
            onClick={onSelectBlitz}
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBlitzTroopsWheel(e.deltaY < 0 ? 1 : -1);
            }}
          >
            <div className="d-flex align-items-center gap-1">
              <span>Blitz</span>
              <Form.Control
                ref={blitzInputRef}
                type="number"
                size="sm"
                min={1}
                max={maxBlitzTroops}
                value={blitzTroops}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  onSelectBlitz();
                  onBlitzTroopsChange(
                    Math.min(
                      maxBlitzTroops,
                      Math.max(1, Number(e.target.value) || 1),
                    ),
                  );
                }}
                style={{ width: 60 }}
              />
              <span className="small">
                {formatProbability(blitzProbability)}
              </span>
            </div>
          </div>
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

export default AttackPanel;
