import { Component, type ReactNode } from 'react';
import { Button } from 'react-bootstrap';

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
        <Button size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}

export default LoadBoundary;
