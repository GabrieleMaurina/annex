import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';

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
}: Props) {
  return (
    <div
      className="p-2 px-3 border rounded bg-body bg-opacity-75 d-flex align-items-center gap-2"
      style={{
        ...style,
        zIndex: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{label}</span>
      <Form.Control
        ref={inputRef}
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
        style={{ width: 70 }}
      />
      <Button size="sm" onClick={onConfirm}>
        {buttonLabel}
      </Button>
    </div>
  );
}

export default TroopPanel;
