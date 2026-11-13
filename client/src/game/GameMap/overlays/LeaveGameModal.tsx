import { Button, Modal } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';

interface Props {
  show: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function LeaveGameModal({ show, onCancel, onConfirm }: Props) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Leave game</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Are you sure you want to leave this game? This counts as a surrender.
      </Modal.Body>
      <Modal.Footer>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          variant="secondary"
          onClick={onCancel}
        >
          <WhiteIcon path="/icons/close.svg" />
          Cancel
        </Button>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          variant="danger"
          onClick={onConfirm}
        >
          <WhiteIcon path="/icons/flag.svg" />
          Surrender and leave
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default LeaveGameModal;
