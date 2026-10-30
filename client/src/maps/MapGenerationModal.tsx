import {
  aspectLabel,
  containsProfanity,
  MAP_ASPECT_VALUES,
  TILE_SHAPE_VALUES,
  tileShapeLabel,
} from 'engine';
import type { ReactNode } from 'react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Button, Form, InputGroup, Modal, Spinner } from 'react-bootstrap';
import Help from '../common/tooltips/Help';
import Tip from '../common/tooltips/Tip';
import type {
  Fill,
  GenerateMapInput,
  GenerationType,
  MapAspect,
  MapSize,
  TileShape,
} from '../lib/types';
import {
  MOUNTAINS_HELP,
  RIVERS_HELP,
  SEAS_HELP,
  TIMED_CONNECTIONS_HELP,
  UNLOCKABLE_HELP,
} from '../lobby/settings/settingsHelp';
import SpinningGears from '../ui/buttons/SpinningGears';
import Selector from '../ui/forms/Selector';
import { DEFAULT_MAP_GENERATION, randomSeed } from './randomMap';

export interface MapGenerationModalHandle {
  generate: () => void;
}

interface Props {
  show: boolean;
  onHide: () => void;
  initial?: GenerateMapInput | null;
  preview: { imageSrc: string; territories: { continentId: number }[] } | null;
  generate: (input: GenerateMapInput, onSettled: (ok: boolean) => void) => void;
  error?: string;
  note?: ReactNode;
  confirm?: ReactNode;
}

const MAX_SEED_LENGTH = 20;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const LABEL_STYLE = { width: 48 };

function seedError(seed: string): string | null {
  if (
    seed.length < 1 ||
    seed.length > MAX_SEED_LENGTH ||
    !PRINTABLE_ASCII.test(seed)
  ) {
    return `Seed must be 1-${MAX_SEED_LENGTH} printable characters`;
  }
  if (containsProfanity(seed)) return 'Seed contains profanity';
  return null;
}

function sameInput(a: GenerateMapInput, b: GenerateMapInput): boolean {
  return (
    a.seed === b.seed &&
    a.size === b.size &&
    (a.aspect ?? 'wide') === b.aspect &&
    a.type === b.type &&
    a.fill === b.fill &&
    (b.type !== 'tile' || a.tile === b.tile) &&
    a.seas === b.seas &&
    a.timed === b.timed &&
    a.unlockable === b.unlockable &&
    (b.type !== 'terrain' ||
      ((a.mountains ?? false) === b.mountains &&
        (a.rivers ?? false) === b.rivers))
  );
}

const MapGenerationModal = forwardRef<MapGenerationModalHandle, Props>(
  function MapGenerationModal(
    { show, onHide, initial, preview, generate, error, note, confirm },
    ref,
  ) {
    const [seed, setSeed] = useState(() => initial?.seed ?? randomSeed());
    const [type, setType] = useState<GenerationType>(
      initial?.type ?? DEFAULT_MAP_GENERATION.type,
    );
    const [fill, setFill] = useState<Fill>(
      initial?.fill ?? DEFAULT_MAP_GENERATION.fill,
    );
    const [size, setSize] = useState<MapSize>(
      initial?.size ?? DEFAULT_MAP_GENERATION.size,
    );
    const [aspect, setAspect] = useState<MapAspect>(
      initial?.aspect ?? DEFAULT_MAP_GENERATION.aspect,
    );
    const [tile, setTile] = useState<TileShape>(
      initial?.tile ?? DEFAULT_MAP_GENERATION.tile,
    );
    const [seas, setSeas] = useState(
      initial?.seas ?? DEFAULT_MAP_GENERATION.seas,
    );
    const [timed, setTimed] = useState(
      initial?.timed ?? DEFAULT_MAP_GENERATION.timed,
    );
    const [unlockableChecked, setUnlockableChecked] = useState(
      initial?.unlockable ?? DEFAULT_MAP_GENERATION.unlockable,
    );
    const [mountains, setMountains] = useState(
      initial?.mountains ?? DEFAULT_MAP_GENERATION.mountains,
    );
    const [rivers, setRivers] = useState(
      initial?.rivers ?? DEFAULT_MAP_GENERATION.rivers,
    );
    const unlockable = type === 'tile' && unlockableChecked;
    const [generating, setGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState(initial ?? null);

    const trimmedSeed = seed.trim();
    const seedMessage = seedError(trimmedSeed);

    function handleGenerate() {
      if (generating || seedMessage) return;
      const input: GenerateMapInput = {
        seed: trimmedSeed,
        size,
        type,
        fill,
        tile,
        seas,
        timed,
        unlockable,
        aspect,
        mountains,
        rivers,
      };
      if (lastGenerated && sameInput(lastGenerated, input)) {
        input.seed = randomSeed();
        setSeed(input.seed);
      }
      setGenerating(true);
      generate(input, (ok) => {
        setGenerating(false);
        if (ok) setLastGenerated(input);
      });
    }

    useImperativeHandle(ref, () => ({ generate: handleGenerate }));

    const stats = preview && {
      territories: preview.territories.length,
      continents: new Set(preview.territories.map((t) => t.continentId)).size,
    };

    return (
      <Modal show={show} onHide={onHide} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Generate a map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex flex-column flex-lg-row gap-4">
            <div
              className="d-flex flex-column gap-2 flex-shrink-0"
              style={{ width: 280 }}
            >
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 flex-shrink-0" style={LABEL_STYLE}>
                  Seed
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    value={seed}
                    maxLength={MAX_SEED_LENGTH}
                    isInvalid={!!seedMessage}
                    onChange={(e) => setSeed(e.target.value)}
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <Tip text="Random seed">
                    <Button
                      variant="outline-secondary"
                      className="d-flex align-items-center"
                      aria-label="Random seed"
                      onClick={() => setSeed(randomSeed())}
                    >
                      <SpinningGears />
                    </Button>
                  </Tip>
                </InputGroup>
              </div>
              {seedMessage && (
                <div className="text-danger small">{seedMessage}</div>
              )}
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 flex-shrink-0" style={LABEL_STYLE}>
                  Type
                </Form.Label>
                <Selector
                  value={type}
                  onChange={(value) => {
                    setType(value as GenerationType);
                    if (value !== 'tile') setUnlockableChecked(false);
                  }}
                >
                  <option value="terrain">Terrain</option>
                  <option value="dungeon">Dungeon</option>
                  <option value="temple">Temple</option>
                  <option value="tile">Tile</option>
                </Selector>
              </div>
              {type === 'tile' && (
                <div className="d-flex align-items-center gap-2">
                  <Form.Label
                    className="mb-0 flex-shrink-0"
                    style={LABEL_STYLE}
                  >
                    Tile
                  </Form.Label>
                  <Selector
                    value={tile}
                    onChange={(value) => setTile(value as TileShape)}
                  >
                    {TILE_SHAPE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {tileShapeLabel(value)}
                      </option>
                    ))}
                  </Selector>
                </div>
              )}
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 flex-shrink-0" style={LABEL_STYLE}>
                  Fill
                </Form.Label>
                <Selector
                  value={fill}
                  onChange={(value) => setFill(value as Fill)}
                >
                  <option value="full">Full</option>
                  <option value="mixed">Mixed</option>
                  <option value="sparse">Sparse</option>
                </Selector>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 flex-shrink-0" style={LABEL_STYLE}>
                  Size
                </Form.Label>
                <Selector
                  value={size}
                  onChange={(value) => setSize(value as MapSize)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="xlarge">Extra Large</option>
                </Selector>
                <Selector
                  className="w-auto"
                  value={aspect}
                  onChange={(value) => setAspect(value as MapAspect)}
                >
                  {MAP_ASPECT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {aspectLabel(value)}
                    </option>
                  ))}
                </Selector>
              </div>
              <div className="d-flex align-items-center gap-2 mt-1">
                <Form.Check
                  type="checkbox"
                  id="map-generation-seas"
                  label="Seas"
                  checked={seas}
                  disabled={unlockable}
                  onChange={(e) => setSeas(e.target.checked)}
                />
                <Help>{SEAS_HELP}</Help>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  id="map-generation-timed"
                  label="Timed connections"
                  checked={timed}
                  disabled={unlockable}
                  onChange={(e) => setTimed(e.target.checked)}
                />
                <Help>{TIMED_CONNECTIONS_HELP}</Help>
              </div>
              {type === 'tile' && (
                <div className="d-flex align-items-center gap-2">
                  <Form.Check
                    type="checkbox"
                    id="map-generation-unlockable"
                    label="Unlockable"
                    checked={unlockable}
                    disabled={seas || timed}
                    onChange={(e) => setUnlockableChecked(e.target.checked)}
                  />
                  <Help>{UNLOCKABLE_HELP}</Help>
                </div>
              )}
              {type === 'terrain' && (
                <>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      id="map-generation-mountains"
                      label="Mountains"
                      checked={mountains}
                      onChange={(e) => setMountains(e.target.checked)}
                    />
                    <Help>{MOUNTAINS_HELP}</Help>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      id="map-generation-rivers"
                      label="Rivers"
                      checked={rivers}
                      onChange={(e) => setRivers(e.target.checked)}
                    />
                    <Help>{RIVERS_HELP}</Help>
                  </div>
                </>
              )}
              {stats && (
                <div className="text-body-secondary mt-2">
                  {stats.territories} territories, {stats.continents} continents
                </div>
              )}
              {error && <div className="text-danger small">{error}</div>}
              {note && <div className="text-body-secondary small">{note}</div>}
            </div>
            <div
              className="flex-grow-1 d-flex align-items-center justify-content-center border rounded bg-body"
              style={{ minWidth: 0, aspectRatio: '16 / 9' }}
            >
              {preview ? (
                <img
                  src={preview.imageSrc}
                  alt=""
                  className="rounded d-block mw-100 mh-100"
                />
              ) : generating ? (
                <Spinner animation="border" />
              ) : (
                <span className="text-body-secondary">
                  Generate a map to preview it here
                </span>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            {confirm ? 'Cancel' : 'Close'}
          </Button>
          <Button
            variant={confirm ? 'outline-secondary' : 'primary'}
            disabled={generating || !!seedMessage}
            onClick={handleGenerate}
          >
            {generating ? 'Generating…' : 'Generate'}
          </Button>
          {confirm}
        </Modal.Footer>
      </Modal>
    );
  },
);

export default MapGenerationModal;
