import { Button, Modal } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';

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
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          variant="secondary"
          onClick={onHide}
        >
          <WhiteIcon path="/icons/close.svg" />
          Cancel
        </Button>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          variant="danger"
          onClick={onLeave}
        >
          <WhiteIcon path="/icons/exit.svg" />
          Leave
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default LeaveEditorModal;
