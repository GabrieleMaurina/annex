import { containsProfanity } from 'engine';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../common/panelStyle';
import { getGeneratedMapData } from '../game/mapData';
import type { GenerateMapInput, MapSize, WaterLevel } from '../lib/types';

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
const SEED_LENGTH = 10;
const RANDOM_SEED_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

function randomSeed(): string {
  let result = '';
  for (let i = 0; i < SEED_LENGTH; i++) {
    result +=
      RANDOM_SEED_ALPHABET[
        Math.floor(Math.random() * RANDOM_SEED_ALPHABET.length)
      ];
  }
  return result;
}

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
    const [seed, setSeed] = useState(randomSeed);
    const [genType, setGenType] = useState<WaterLevel>('mixed');
    const [genSize, setGenSize] = useState<MapSize>('medium');
    const [generating, setGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState<GenerateMapInput | null>(
      null,
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
        lastGenerated.water === genType
      ) {
        effectiveSeed = randomSeed();
        setSeed(effectiveSeed);
      }

      const input: GenerateMapInput = {
        seed: effectiveSeed,
        size: genSize,
        water: genType,
      };
      setGenerating(true);
      generateMap(input, (ok) => {
        setGenerating(false);
        if (ok) setLastGenerated(input);
      });
    }

    useImperativeHandle(ref, () => ({ generate: handleGenerate }));

    function handlePanelClick(e: React.MouseEvent<HTMLDivElement>) {
      if ((e.target as HTMLElement).closest('input, select, button, img'))
        return;
      onHide();
    }

    if (!open) return null;

    const generated = getGeneratedMapData(currentMapName);
    const stats = generated && {
      territories: generated.territories.length,
      continents: new Set(generated.territories.map((t) => t.continentId)).size,
    };

    return (
      <div
        className={`${PANEL_BG_CLASS} ${PANEL_CLASS} mt-2`}
        onClick={handlePanelClick}
      >
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
                onChange={(e) => setGenType(e.target.value as WaterLevel)}
              >
                <option value="land">Land</option>
                <option value="mixed">Mixed</option>
                <option value="ocean">Ocean</option>
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
            </div>
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
            className="rounded bg-black bg-opacity-25 ms-auto"
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
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default MapGenerationPanel;
