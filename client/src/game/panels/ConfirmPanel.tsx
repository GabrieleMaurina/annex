import { Button } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import { PANEL_BG_CLASS } from '../../ui/containers/panelStyle';

interface Props {
  label: string;
  buttonLabel: string;
  icon: string;
  onConfirm: () => void;
  style: React.CSSProperties;
  extra?: React.ReactNode;
}

function ConfirmPanel({
  label,
  buttonLabel,
  icon,
  onConfirm,
  style,
  extra,
}: Props) {
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
        <Button
          size="sm"
          className="d-inline-flex align-items-center justify-content-center gap-1"
          onClick={onConfirm}
        >
          <WhiteIcon path={`/icons/${icon}.svg`} />
          {buttonLabel}
        </Button>
      </div>
      {extra && <span className="small text-body-secondary">{extra}</span>}
    </div>
  );
}

export default ConfirmPanel;
