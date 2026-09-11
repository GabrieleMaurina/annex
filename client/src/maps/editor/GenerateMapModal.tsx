import { containsProfanity } from 'engine';
import { useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import type { Fill, GenerationType, MapSize } from '../../lib/types';
import {
  generateMap,
  type GeneratedEditorMap,
  type GenerateInput,
} from './generateMap';

const MAX_SEED_LENGTH = 20;
const SEED_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

function randomSeed(): string {
  let s = '';
  for (let i = 0; i < 10; i++)
    s += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  return s;
}

function seedError(seed: string): string | null {
  if (
    seed.length < 1 ||
    seed.length > MAX_SEED_LENGTH ||
    !PRINTABLE_ASCII.test(seed)
  )
    return `Seed must be 1-${MAX_SEED_LENGTH} printable characters`;
  if (containsProfanity(seed)) return 'Seed contains profanity';
  return null;
}

interface Props {
  show: boolean;
  onHide: () => void;
  onGenerated: (map: GeneratedEditorMap, input: GenerateInput) => void;
}

function GenerateMapModal({ show, onHide, onGenerated }: Props) {
  const [seed, setSeed] = useState(randomSeed);
  const [type, setType] = useState<GenerationType>('terrain');
  const [fill, setFill] = useState<Fill>('mixed');
  const [size, setSize] = useState<MapSize>('medium');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const trimmed = seed.trim();
  const seedMessage = seedError(trimmed);

  function handleGenerate() {
    if (generating || seedMessage) return;
    setGenerating(true);
    setError('');
    const input: GenerateInput = { seed: trimmed, size, type, fill };
    generateMap(input)
      .then((map) => {
        setGenerating(false);
        onGenerated(map, input);
        onHide();
      })
      .catch(() => {
        setGenerating(false);
        setError('Could not generate a map. Try a different seed.');
      });
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Generate a map</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-2">
        <Form.Group className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0" style={{ minWidth: 50 }}>
            Seed
          </Form.Label>
          <Form.Control
            value={seed}
            maxLength={MAX_SEED_LENGTH}
            isInvalid={!!seedMessage}
            onChange={(e) => setSeed(e.target.value)}
          />
          <Button
            variant="outline-secondary"
            onClick={() => setSeed(randomSeed())}
          >
            ↻
          </Button>
        </Form.Group>
        {seedMessage && <div className="text-danger small">{seedMessage}</div>}
        <Form.Group className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0" style={{ minWidth: 50 }}>
            Type
          </Form.Label>
          <Form.Select
            value={type}
            onChange={(e) => setType(e.target.value as GenerationType)}
          >
            <option value="terrain">Terrain</option>
            <option value="dungeon">Dungeon</option>
            <option value="temple">Temple</option>
          </Form.Select>
        </Form.Group>
        <Form.Group className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0" style={{ minWidth: 50 }}>
            Fill
          </Form.Label>
          <Form.Select
            value={fill}
            onChange={(e) => setFill(e.target.value as Fill)}
          >
            <option value="full">Full</option>
            <option value="mixed">Mixed</option>
            <option value="sparse">Sparse</option>
          </Form.Select>
        </Form.Group>
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
        </Form.Group>
        {error && <div className="text-danger small">{error}</div>}
        <p className="text-muted small mb-0">
          Generating replaces the current territories and background image. You
          can then edit and draw on top before saving.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button onClick={handleGenerate} disabled={generating || !!seedMessage}>
          {generating ? 'Generating…' : 'Generate'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default GenerateMapModal;
