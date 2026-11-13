import { Component, type ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';

interface Props {
  onClose: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class EarthErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Modal show onHide={this.props.onClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Earth</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-1">The Earth view could not start.</p>
          <p className="text-body-secondary small mb-0">
            {this.state.error.message}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="d-inline-flex align-items-center justify-content-center gap-1"
            variant="secondary"
            onClick={this.props.onClose}
          >
            <WhiteIcon path="/icons/close.svg" />
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

export default EarthErrorBoundary;
