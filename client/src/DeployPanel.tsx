import type { RefObject } from 'react';
import { Button, Form } from 'react-bootstrap';
import { contrastTextColor, withAlpha } from './palette';

interface Props {
  troops: number;
  maxTroops: number;
  color: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (troops: number) => void;
  onDeploy: () => void;
  style: React.CSSProperties;
}

function DeployPanel({
  troops,
  maxTroops,
  color,
  inputRef,
  onChange,
  onDeploy,
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
      <span>Deploy troops:</span>
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
      <Button size="sm" onClick={onDeploy}>
        Deploy
      </Button>
    </div>
  );
}

export default DeployPanel;
