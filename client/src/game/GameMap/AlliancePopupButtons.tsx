import { Button } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import Tip from '../../common/tooltips/Tip';

export default function AlliancePopupButtons({
  confirmText,
  denyText,
  onConfirm,
  onDeny,
}: {
  confirmText: string;
  denyText: string;
  onConfirm: () => void;
  onDeny: () => void;
}) {
  return (
    <>
      <Tip text={confirmText} placement="bottom">
        <Button
          size="sm"
          variant="success"
          className="rounded-0 d-inline-flex align-items-center justify-content-center"
          onClick={onConfirm}
        >
          <WhiteIcon path="/icons/check.svg" size={14} />
        </Button>
      </Tip>
      <Tip text={denyText} placement="bottom">
        <Button
          size="sm"
          variant="danger"
          className="rounded-0 d-inline-flex align-items-center justify-content-center"
          onClick={onDeny}
        >
          <WhiteIcon path="/icons/close.svg" size={14} />
        </Button>
      </Tip>
    </>
  );
}
