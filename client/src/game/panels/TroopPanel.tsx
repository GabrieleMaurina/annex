import type { RefObject } from 'react';
import { Button } from 'react-bootstrap';
import PercentageToggle from '../../common/inputs/PercentageToggle';
import { useTroopsInput } from '../../common/inputs/useTroopsInput';
import { PANEL_BG_CLASS } from '../../ui/containers/panelStyle';
import NumberOdometer from '../../ui/forms/NumberOdometer';

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
      className={`p-2 px-3 border rounded ${PANEL_BG_CLASS} d-flex flex-column gap-1`}
      data-no-click-sound
      style={{
        ...style,
        zIndex: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <span>{label}</span>
        <NumberOdometer {...troopsInput} style={{ minWidth: 70 }} />
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
