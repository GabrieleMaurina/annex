import { Button, Modal } from 'react-bootstrap';

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
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Surrender and leave
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default LeaveGameModal;
