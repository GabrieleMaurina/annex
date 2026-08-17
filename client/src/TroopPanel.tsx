import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';
import { contrastTextColor, withAlpha } from './palette';

interface Props {
  label: string;
  buttonLabel: string;
  troops: number;
  maxTroops: number;
  color: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (troops: number) => void;
  onConfirm: () => void;
  style: React.CSSProperties;
}

function TroopPanel({
  label,
  buttonLabel,
  troops,
  maxTroops,
  color,
  inputRef,
  onChange,
  onConfirm,
  style,
}: Props) {
  return (
    <div
      className="p-2 px-3 border rounded d-flex align-items-center gap-2"
      style={{
        ...style,
        zIndex: 1,
        whiteSpace: 'nowrap',
        backgroundColor: withAlpha(color, 0.75),
        color: contrastTextColor(color),
      }}
    >
      <span>{label}</span>
      <Form.Control
        ref={inputRef}
        type="number"
        size="sm"
        min={1}
        max={maxTroops}
        value={troops}
        onChange={(e) =>
          onChange(
            Math.min(maxTroops, Math.max(1, Number(e.target.value) || 1)),
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
