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
  DIRECTIONAL_CONNECTIONS_HELP,
  MOUNTAINS_HELP,
  RIVERS_HELP,
  SEAS_HELP,
  SWITCHES_HELP,
  TIMED_CONNECTIONS_HELP,
  UNLOCKABLE_HELP,
} from '../lobby/settings/settingsHelp';
import SpinningGears from '../ui/buttons/SpinningGears';
import Selector from '../ui/forms/Selector';
import { generateMap, type GeneratedEditorMap } from './editor/generateMap';
import { DEFAULT_MAP_GENERATION, randomSeed } from './randomMap';

export interface MapGenerationModalHandle {
  generate: () => void;
}

interface Props {
  show: boolean;
  onHide: () => void;
  initial?: GenerateMapInput | null;
  current?: { imageSrc: string; territories: { continentId: number }[] } | null;
  note?: ReactNode;
  onUse: (
    map: GeneratedEditorMap,
    input: GenerateMapInput,
    onSettled: (ok: boolean) => void,
  ) => void;
}

const MAX_SEED_LENGTH = 20;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const LABEL_STYLE = { width: 56 };

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
    (a.directional ?? false) === b.directional &&
    (a.switched ?? false) === b.switched &&
    a.unlockable === b.unlockable &&
    (b.type !== 'terrain' ||
      ((a.mountains ?? false) === b.mountains &&
        (a.rivers ?? false) === b.rivers))
  );
}

const MapGenerationModal = forwardRef<MapGenerationModalHandle, Props>(
  function MapGenerationModal(
    { show, onHide, initial, current, note, onUse },
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
    const [directional, setDirectional] = useState(
      initial?.directional ?? DEFAULT_MAP_GENERATION.directional,
    );
    const [switchedChecked, setSwitchedChecked] = useState(
      initial?.switched ?? DEFAULT_MAP_GENERATION.switched,
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
    const switched = switchedChecked && (timed || directional) && !unlockable;
    const [generating, setGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState(initial ?? null);
    const [result, setResult] = useState<{
      map: GeneratedEditorMap;
      input: GenerateMapInput;
    } | null>(null);
    const [error, setError] = useState('');
    const [applying, setApplying] = useState(false);
    const [shown, setShown] = useState(show);
    const preview = result?.map ?? current ?? null;

    if (shown !== show) {
      setShown(show);
      if (show) {
        setResult(null);
        setError('');
      }
    }

    const trimmedSeed = seed.trim();
    const seedMessage = seedError(trimmedSeed);

    function handleGenerate() {
      if (generating || applying || seedMessage) return;
      const input: GenerateMapInput = {
        seed: trimmedSeed,
        size,
        type,
        fill,
        tile,
        seas,
        timed,
        directional,
        switched,
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
      setError('');
      generateMap(input)
        .then((map) => {
          setResult({ map, input });
          setLastGenerated(input);
        })
        .catch(() =>
          setError('Could not generate a map. Try a different seed.'),
        )
        .finally(() => setGenerating(false));
    }

    function handleUse() {
      if (!result) return;
      setApplying(true);
      onUse(result.map, result.input, (ok) => {
        setApplying(false);
        if (ok) onHide();
        else setError('Could not use this map. Try again.');
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
                      variant="secondary"
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
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 flex-shrink-0" style={LABEL_STYLE}>
                  Aspect
                </Form.Label>
                <Selector
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
                  label={<Help tip={SEAS_HELP}>Seas</Help>}
                  checked={seas}
                  disabled={unlockable}
                  onChange={(e) => setSeas(e.target.checked)}
                />
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  id="map-generation-timed"
                  label={<Help tip={TIMED_CONNECTIONS_HELP}>Timed links</Help>}
                  checked={timed}
                  disabled={unlockable || (switched && !directional)}
                  onChange={(e) => setTimed(e.target.checked)}
                />
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  id="map-generation-directional"
                  label={
                    <Help tip={DIRECTIONAL_CONNECTIONS_HELP}>
                      Directional links
                    </Help>
                  }
                  checked={directional}
                  disabled={unlockable || (switched && !timed)}
                  onChange={(e) => setDirectional(e.target.checked)}
                />
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  id="map-generation-switches"
                  label={<Help tip={SWITCHES_HELP}>Switches</Help>}
                  checked={switched}
                  disabled={unlockable || (!timed && !directional)}
                  onChange={(e) => setSwitchedChecked(e.target.checked)}
                />
              </div>
              {type === 'tile' && (
                <div className="d-flex align-items-center gap-2">
                  <Form.Check
                    type="checkbox"
                    id="map-generation-unlockable"
                    label={<Help tip={UNLOCKABLE_HELP}>Unlockable</Help>}
                    checked={unlockable}
                    disabled={seas || timed || directional}
                    onChange={(e) => setUnlockableChecked(e.target.checked)}
                  />
                </div>
              )}
              {type === 'terrain' && (
                <>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      id="map-generation-mountains"
                      label={<Help tip={MOUNTAINS_HELP}>Mountains</Help>}
                      checked={mountains}
                      onChange={(e) => setMountains(e.target.checked)}
                    />
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      id="map-generation-rivers"
                      label={<Help tip={RIVERS_HELP}>Rivers</Help>}
                      checked={rivers}
                      onChange={(e) => setRivers(e.target.checked)}
                    />
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
            Cancel
          </Button>
          <Button
            variant="info"
            disabled={generating || applying || !!seedMessage}
            onClick={handleGenerate}
          >
            {generating ? 'Generating…' : 'Generate'}
          </Button>
          <Button disabled={!result || applying} onClick={handleUse}>
            {applying ? 'Applying…' : 'Use this map'}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  },
);

export default MapGenerationModal;
