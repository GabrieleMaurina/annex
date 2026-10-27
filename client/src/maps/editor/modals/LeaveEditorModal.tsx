import { Button, Modal } from 'react-bootstrap';

interface Props {
  show: boolean;
  onHide: () => void;
  onLeave: () => void;
}

function LeaveEditorModal({ show, onHide, onLeave }: Props) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Leave editor</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        You have unsaved changes. Are you sure you want to leave?
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onLeave}>
          Leave
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default LeaveEditorModal;
