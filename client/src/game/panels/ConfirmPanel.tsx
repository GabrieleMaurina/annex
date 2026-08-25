import { Button } from 'react-bootstrap';

interface Props {
  label: string;
  buttonLabel: string;
  onConfirm: () => void;
  style: React.CSSProperties;
  extra?: React.ReactNode;
}

function ConfirmPanel({ label, buttonLabel, onConfirm, style, extra }: Props) {
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
        <Button size="sm" onClick={onConfirm}>
          {buttonLabel}
        </Button>
      </div>
      {extra && <span className="small text-body-secondary">{extra}</span>}
    </div>
  );
}

export default ConfirmPanel;
