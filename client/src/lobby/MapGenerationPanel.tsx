import {
  aspectLabel,
  containsProfanity,
  MAP_ASPECT_VALUES,
  TILE_SHAPE_VALUES,
  tileShapeLabel,
} from 'engine';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import Help from '../common/tooltips/Help';
import { getGeneratedMapData } from '../game/mapData';
import { getGameSettings } from '../lib/player';
import type {
  Fill,
  GenerateMapInput,
  GenerationType,
  MapAspect,
  MapSize,
  TileShape,
} from '../lib/types';
import { DEFAULT_MAP_GENERATION, randomSeed } from '../maps/randomMap';
import {
  MOUNTAINS_HELP,
  RIVERS_HELP,
  SEAS_HELP,
  TIMED_CONNECTIONS_HELP,
  UNLOCKABLE_HELP,
} from './settings/settingsHelp';

export interface MapGenerationPanelHandle {
  generate: () => void;
}

interface Props {
  open: boolean;
  currentMapName: string;
  onHide: () => void;
  generateMap: (
    input: GenerateMapInput,
    onSettled?: (ok: boolean, mapName?: string) => void,
  ) => void;
}

const MAX_SEED_LENGTH = 20;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

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

const MapGenerationPanel = forwardRef<MapGenerationPanelHandle, Props>(
  function MapGenerationPanel(
    { open, currentMapName, onHide, generateMap },
    ref,
  ) {
    const saved = getGameSettings().mapGeneration;
    const [seed, setSeed] = useState(() => saved?.seed ?? randomSeed());
    const [genType, setGenType] = useState<GenerationType>(
      saved?.type ?? DEFAULT_MAP_GENERATION.type,
    );
    const [genFill, setGenFill] = useState<Fill>(
      saved?.fill ?? DEFAULT_MAP_GENERATION.fill,
    );
    const [genSize, setGenSize] = useState<MapSize>(
      saved?.size ?? DEFAULT_MAP_GENERATION.size,
    );
    const [genAspect, setGenAspect] = useState<MapAspect>(
      saved?.aspect ?? DEFAULT_MAP_GENERATION.aspect,
    );
    const [genTile, setGenTile] = useState<TileShape>(
      saved?.tile ?? DEFAULT_MAP_GENERATION.tile,
    );
    const [genSeas, setGenSeas] = useState(
      saved?.seas ?? DEFAULT_MAP_GENERATION.seas,
    );
    const [genTimed, setGenTimed] = useState(
      saved?.timed ?? DEFAULT_MAP_GENERATION.timed,
    );
    const [genUnlockable, setGenUnlockable] = useState(
      saved?.unlockable ?? DEFAULT_MAP_GENERATION.unlockable,
    );
    const [genMountains, setGenMountains] = useState(
      saved?.mountains ?? DEFAULT_MAP_GENERATION.mountains,
    );
    const [genRivers, setGenRivers] = useState(
      saved?.rivers ?? DEFAULT_MAP_GENERATION.rivers,
    );
    const unlockable = genType === 'tile' && genUnlockable;
    const [generating, setGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState<GenerateMapInput | null>(
      saved ?? null,
    );
    const whiteMapIcon = useWhiteIcon('/icons/map.svg');

    const trimmedSeed = seed.trim();
    const seedErrorMessage = seedError(trimmedSeed);
    const seedValid = seedErrorMessage === null;

    function handleGenerate() {
      if (generating || !seedValid) return;

      let effectiveSeed = trimmedSeed;
      if (
        lastGenerated &&
        lastGenerated.seed === trimmedSeed &&
        lastGenerated.size === genSize &&
        (lastGenerated.aspect ?? 'wide') === genAspect &&
        lastGenerated.type === genType &&
        lastGenerated.fill === genFill &&
        (genType !== 'tile' || lastGenerated.tile === genTile) &&
        lastGenerated.seas === genSeas &&
        lastGenerated.timed === genTimed &&
        lastGenerated.unlockable === unlockable &&
        (genType !== 'terrain' ||
          ((lastGenerated.mountains ?? false) === genMountains &&
            (lastGenerated.rivers ?? false) === genRivers))
      ) {
        effectiveSeed = randomSeed();
        setSeed(effectiveSeed);
      }

      const input: GenerateMapInput = {
        seed: effectiveSeed,
        size: genSize,
        type: genType,
        fill: genFill,
        tile: genTile,
        seas: genSeas,
        timed: genTimed,
        unlockable,
        aspect: genAspect,
        mountains: genMountains,
        rivers: genRivers,
      };
      setGenerating(true);
      generateMap(input, (ok) => {
        setGenerating(false);
        if (ok) setLastGenerated(input);
      });
    }

    useImperativeHandle(ref, () => ({ generate: handleGenerate }));

    const generated = getGeneratedMapData(currentMapName);
    const stats = generated && {
      territories: generated.territories.length,
      continents: new Set(generated.territories.map((t) => t.continentId)).size,
    };

    return (
      <Modal show={open} onHide={onHide} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Generate a map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex flex-column flex-lg-row gap-3">
            <div
              className="d-flex flex-column gap-2"
              style={{ flex: '0 0 auto', width: 260 }}
            >
              <div className="d-flex align-items-start gap-2">
                <Form.Label className="mb-0 pt-2" style={{ minWidth: 40 }}>
                  Seed
                </Form.Label>
                <div>
                  <Form.Control
                    style={{ maxWidth: 200 }}
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    onClick={(e) => e.currentTarget.select()}
                    maxLength={MAX_SEED_LENGTH}
                    isInvalid={!seedValid}
                  />
                  <Form.Control.Feedback type="invalid">
                    {seedErrorMessage}
                  </Form.Control.Feedback>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0" style={{ minWidth: 40 }}>
                  Type
                </Form.Label>
                <Form.Select
                  className="w-auto"
                  value={genType}
                  onChange={(e) => {
                    setGenType(e.target.value as GenerationType);
                    if (e.target.value !== 'tile') setGenUnlockable(false);
                  }}
                >
                  <option value="terrain">Terrain</option>
                  <option value="dungeon">Dungeon</option>
                  <option value="temple">Temple</option>
                  <option value="tile">Tile</option>
                </Form.Select>
              </div>
              {genType === 'tile' && (
                <div className="d-flex align-items-center gap-2">
                  <Form.Label className="mb-0" style={{ minWidth: 40 }}>
                    Tile
                  </Form.Label>
                  <Form.Select
                    className="w-auto"
                    value={genTile}
                    onChange={(e) => setGenTile(e.target.value as TileShape)}
                  >
                    {TILE_SHAPE_VALUES.map((tile) => (
                      <option key={tile} value={tile}>
                        {tileShapeLabel(tile)}
                      </option>
                    ))}
                  </Form.Select>
                </div>
              )}
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0" style={{ minWidth: 40 }}>
                  Fill
                </Form.Label>
                <Form.Select
                  className="w-auto"
                  value={genFill}
                  onChange={(e) => setGenFill(e.target.value as Fill)}
                >
                  <option value="full">Full</option>
                  <option value="mixed">Mixed</option>
                  <option value="sparse">Sparse</option>
                </Form.Select>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0" style={{ minWidth: 40 }}>
                  Size
                </Form.Label>
                <Form.Select
                  className="w-auto"
                  value={genSize}
                  onChange={(e) => setGenSize(e.target.value as MapSize)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="xlarge">Extra Large</option>
                </Form.Select>
                <Form.Select
                  className="w-auto"
                  value={genAspect}
                  onChange={(e) => setGenAspect(e.target.value as MapAspect)}
                >
                  {MAP_ASPECT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {aspectLabel(value)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  label="Seas"
                  checked={genSeas}
                  disabled={unlockable}
                  onChange={(e) => setGenSeas(e.target.checked)}
                />
                <Help>{SEAS_HELP}</Help>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  label="Timed connections"
                  checked={genTimed}
                  disabled={unlockable}
                  onChange={(e) => setGenTimed(e.target.checked)}
                />
                <Help>{TIMED_CONNECTIONS_HELP}</Help>
              </div>
              {genType === 'tile' && (
                <div className="d-flex align-items-center gap-2">
                  <Form.Check
                    type="checkbox"
                    label="Unlockable"
                    checked={unlockable}
                    disabled={genSeas || genTimed}
                    onChange={(e) => setGenUnlockable(e.target.checked)}
                  />
                  <Help>{UNLOCKABLE_HELP}</Help>
                </div>
              )}
              {genType === 'terrain' && (
                <>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      label="Mountains"
                      checked={genMountains}
                      onChange={(e) => setGenMountains(e.target.checked)}
                    />
                    <Help>{MOUNTAINS_HELP}</Help>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      label="Rivers"
                      checked={genRivers}
                      onChange={(e) => setGenRivers(e.target.checked)}
                    />
                    <Help>{RIVERS_HELP}</Help>
                  </div>
                </>
              )}
              <div>
                <Button
                  disabled={generating || !seedValid}
                  onClick={handleGenerate}
                  className="d-flex align-items-center gap-2"
                >
                  <img
                    src={whiteMapIcon ?? '/icons/map.svg'}
                    width={16}
                    height={16}
                    alt=""
                  />
                  {generating ? 'Generating…' : 'Generate'}
                </Button>
              </div>
              {stats && (
                <div className="text-body-secondary mt-2">
                  {stats.territories} territories, {stats.continents} continents
                </div>
              )}
            </div>
            <div
              className="ms-auto d-flex align-items-center justify-content-center"
              style={{
                flex: '1 1 auto',
                width: '100%',
                maxWidth: 900,
                aspectRatio: '16 / 9',
              }}
            >
              {generated && (
                <img
                  src={generated.imageSrc}
                  alt=""
                  className="rounded"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'block',
                  }}
                />
              )}
            </div>
          </div>
        </Modal.Body>
      </Modal>
    );
  },
);

export default MapGenerationPanel;
