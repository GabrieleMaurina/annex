import { Button, Modal } from 'react-bootstrap';
import WhiteIcon from '../common/icons/WhiteIcon';
import { useToggleSound } from '../lib/sounds';

interface Props {
  show: boolean;
  onHide: () => void;
  onContinue: () => void;
  onTutorials: () => void;
}

function TutorialInviteModal({ show, onHide, onContinue, onTutorials }: Props) {
  useToggleSound(show);
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>New to Annex?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Would you like to try the tutorials first? They take a minute each and
        teach you the basics on a tiny map.
      </Modal.Body>
      <Modal.Footer>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          variant="secondary"
          onClick={onContinue}
        >
          <WhiteIcon path="/icons/close.svg" />
          Not now
        </Button>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          onClick={onTutorials}
        >
          <WhiteIcon path="/icons/book.svg" />
          Try the tutorials
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default TutorialInviteModal;
