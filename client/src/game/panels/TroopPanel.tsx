import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useNumberInput } from '../../common/inputs/useNumberInput';

interface Props {
  label: string;
  buttonLabel: string;
  troops: number;
  minTroops?: number;
  maxTroops: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (troops: number) => void;
  onConfirm: () => void;
  style: React.CSSProperties;
  extra?: React.ReactNode;
}

function TroopPanel({
  label,
  buttonLabel,
  troops,
  minTroops = 1,
  maxTroops,
  inputRef,
  onChange,
  onConfirm,
  style,
  extra,
}: Props) {
  const numberInput = useNumberInput({
    value: troops,
    min: minTroops,
    max: maxTroops,
    onChange,
    inputRef,
  });
  return (
    <div
      className="p-2 px-3 border rounded bg-body bg-opacity-75 d-flex flex-column gap-1"
      data-no-click-sound
      style={{
        ...style,
        zIndex: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <span>{label}</span>
        <Form.Control
          type="number"
          size="sm"
          min={minTroops}
          max={maxTroops}
          value={troops}
          onChange={(e) =>
            onChange(
              Math.min(
                maxTroops,
                Math.max(minTroops, Number(e.target.value) || minTroops),
              ),
            )
          }
          {...numberInput}
          style={{ ...numberInput.style, width: 70 }}
        />
        <Button size="sm" onClick={onConfirm}>
          {buttonLabel}
        </Button>
      </div>
      {extra && <span className="small text-body-secondary">{extra}</span>}
    </div>
  );
}

export default TroopPanel;
