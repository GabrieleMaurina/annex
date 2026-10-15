import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';
import PercentageToggle from '../../common/inputs/PercentageToggle';
import { useTroopsInput } from '../../common/inputs/useTroopsInput';

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
  const troopsInput = useTroopsInput({
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
          {...troopsInput}
          style={{ ...troopsInput.style, width: 70 }}
        />
        <Button size="sm" onClick={onConfirm}>
          {buttonLabel}
        </Button>
        <PercentageToggle max={maxTroops} />
      </div>
      {extra && <span className="small text-body-secondary">{extra}</span>}
    </div>
  );
}

export default TroopPanel;
