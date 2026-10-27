import { aspectLabel, MAP_ASPECT_VALUES } from 'engine';
import { useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import type { MapAspect, MapSize } from '../../../lib/types';

interface Props {
  show: boolean;
  onHide: () => void;
  dirty: boolean;
  onCreate: (size: MapSize, aspect: MapAspect) => void;
}

function NewMapModal({ show, onHide, dirty, onCreate }: Props) {
  const [size, setSize] = useState<MapSize>('medium');
  const [aspect, setAspect] = useState<MapAspect>('wide');

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>New map</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-2">
        {dirty && (
          <Alert variant="warning" className="py-1 px-2 small mb-0">
            You have unsaved changes. Creating a new map will discard them.
          </Alert>
        )}
        <Form.Group className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0" style={{ minWidth: 50 }}>
            Size
          </Form.Label>
          <Form.Select
            value={size}
            onChange={(e) => setSize(e.target.value as MapSize)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra Large</option>
          </Form.Select>
          <Form.Select
            className="w-auto"
            value={aspect}
            onChange={(e) => setAspect(e.target.value as MapAspect)}
          >
            {MAP_ASPECT_VALUES.map((value) => (
              <option key={value} value={value}>
                {aspectLabel(value)}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onHide();
            onCreate(size, aspect);
          }}
        >
          Create
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default NewMapModal;
