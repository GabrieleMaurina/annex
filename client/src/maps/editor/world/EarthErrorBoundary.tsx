import { Component, type ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';

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
          <Button variant="secondary" onClick={this.props.onClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

export default EarthErrorBoundary;
