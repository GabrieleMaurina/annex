import { Component, type ReactNode } from 'react';
import { Button } from 'react-bootstrap';
import WhiteIcon from '../icons/WhiteIcon';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

class LoadBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="text-center py-4">
        <p>This page could not be loaded.</p>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          size="sm"
          onClick={() => window.location.reload()}
        >
          <WhiteIcon path="/icons/restart.svg" />
          Reload
        </Button>
      </div>
    );
  }
}

export default LoadBoundary;
