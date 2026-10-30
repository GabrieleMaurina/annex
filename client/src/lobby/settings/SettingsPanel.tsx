import type { OsmGeneratedMap } from 'engine';
import type { CSSProperties, ReactNode } from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Form, Modal } from 'react-bootstrap';
import { useWhiteIcon } from '../../common/icon';
import { FIELD_LABEL_CLASS } from '../../common/panelStyle';
import Help from '../../common/tooltips/Help';
import Tip from '../../common/tooltips/Tip';
import { connector } from '../../connector';
import { getGeneratedMapData, loadGameMap } from '../../game/mapData';
import { loadClickableRegions } from '../../game/regions/clickableRegions';
import { isRegeneratingMap } from '../../lib/gameSetup';
import { getGameSettings } from '../../lib/player';
import { playSound, useToggleSound } from '../../lib/sounds';
import type {
  Account,
  GameMeta,
  GameMode,
  GameSettingsInput,
  GameState,
  GenerateMapInput,
} from '../../lib/types';
import { GAME_MODES } from '../../lib/types';
import EarthErrorBoundary from '../../maps/editor/world/EarthErrorBoundary';
import MapBrowser from '../../maps/MapBrowser';
import MapGenerationModal, {
  type MapGenerationModalHandle,
} from '../../maps/MapGenerationModal';
import MapLikeButton from '../MapLikeButton';
import {
  DEFAULT_GAME_SETTINGS,
  randomGameSettings,
  titleCase,
} from './gameSettings';
import GameSettingsFields from './GameSettingsFields';
import { GAME_MODE_HELP, MAP_HELP } from './settingsHelp';

const HEADER_FIELD_STYLE = { minWidth: 220 };
const MAP_TOOLTIP_STYLE = {
  '--bs-tooltip-max-width': '500px',
} as CSSProperties;
const MAP_TOOLTIP_POPPER = {
  modifiers: [
    {
      name: 'flip',
      enabled: true,
      options: { fallbackPlacements: ['bottom', 'left'] },
    },
  ],
};

const WorldMapModal = lazy(
  () => import('../../maps/editor/world/WorldMapModal'),
);

const GENERATE_MAP_OPTION = '__generateMap__';
const LIBRARY_MAP_OPTION = '__libraryMap__';
const EARTH_MAP_OPTION = '__earthMap__';

const COARSE_POINTER =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

interface Props {
  game: GameState;
  gameMeta?: GameMeta | null;
  isHost: boolean;
  account?: Account | null;
  applySettings: (settings: GameSettingsInput) => void;
  generateMap: (
    input: GenerateMapInput,
    onSettled?: (ok: boolean, mapName?: string) => void,
  ) => void;
  selectPlayerMap?: (mapId: string) => void;
  selectEarthMap?: (map: OsmGeneratedMap, onSettled: () => void) => void;
  headerActions?: ReactNode;
  collapsible?: boolean;
}

function SettingsPanel({
  game,
  gameMeta = null,
  isHost,
  account = null,
  applySettings,
  generateMap,
  selectPlayerMap,
  selectEarthMap,
  headerActions,
  collapsible = true,
}: Props) {
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  useToggleSound(mapPickerOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapThumbnails, setMapThumbnails] = useState<Record<string, string>>(
    {},
  );
  const [mapStats, setMapStats] = useState<
    Record<string, { territories: number; continents: number }>
  >({});
  const loadedMapNamesRef = useRef(new Set<string>());
  const [mapGenOpen, setMapGenOpen] = useState(false);
  useToggleSound(mapGenOpen);
  const [earthOpen, setEarthOpen] = useState(false);
  useToggleSound(earthOpen);
  const [earthUploading, setEarthUploading] = useState(false);
  const [mapRegenerating, setMapRegenerating] = useState(isRegeneratingMap);
  const [seedCopied, setSeedCopied] = useState(false);
  const mapGenRef = useRef<MapGenerationModalHandle>(null);
  const whiteMapIcon = useWhiteIcon('/icons/map.svg');
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');

  useEffect(() => {
    function onRegenerating(value: boolean) {
      setMapRegenerating(value);
    }
    connector.on('map:regenerating', onRegenerating);
    return () => {
      connector.off('map:regenerating', onRegenerating);
    };
  }, []);

  useEffect(() => {
    const name = game.mapName;
    const key = `${name}|${game.playerMapId ?? ''}`;
    if (loadedMapNamesRef.current.has(key)) return;
    loadedMapNamesRef.current.add(key);
    loadGameMap(name, game.playerMapId).then(({ imageSrc, territories }) => {
      loadClickableRegions(name, game.playerMapId);
      if (imageSrc) {
        setMapThumbnails((prev) => ({ ...prev, [name]: imageSrc }));
      }
      setMapStats((prev) => ({
        ...prev,
        [name]: {
          territories: territories.length,
          continents: new Set(
            territories.map((t) => t.continentId).filter((c) => c >= 0),
          ).size,
        },
      }));
    });
  }, [game.mapName, game.playerMapId]);

  function imageSrcFor(name: string): string | undefined {
    return getGeneratedMapData(name)?.imageSrc ?? mapThumbnails[name];
  }

  function statsFor(
    name: string,
  ): { territories: number; continents: number } | undefined {
    const generated = getGeneratedMapData(name);
    if (generated) {
      return {
        territories: generated.territories.length,
        continents: new Set(generated.territories.map((t) => t.continentId))
          .size,
      };
    }
    return mapStats[name];
  }

  function mapTooltip(name: string) {
    const image = imageSrcFor(name);
    const stats = statsFor(name);
    const seed = name === game.mapName ? game.mapGeneration?.seed : undefined;
    return (
      <div className="text-start">
        {image && (
          <img
            src={image}
            width={480}
            height={270}
            alt=""
            className="rounded d-block pt-1 mb-1"
            style={{ objectFit: 'cover' }}
          />
        )}
        {(stats || seed) && (
          <div>
            {stats &&
              `${stats.territories} territories, ${stats.continents} continents`}
            {stats && seed && ', '}
            {seed && `Seed: ${seed}`}
          </div>
        )}
      </div>
    );
  }

  const mapPending = mapRegenerating || earthUploading;
  const currentImageSrc = mapPending ? undefined : imageSrcFor(game.mapName);
  const currentMapLabel = mapPending
    ? 'Generating…'
    : game.mapName || 'Pick a map';
  const currentSeed = mapRegenerating ? undefined : game.mapGeneration?.seed;

  function copySeed() {
    if (!currentSeed) return;
    navigator.clipboard
      .writeText(currentSeed)
      .then(() => {
        setSeedCopied(true);
        setTimeout(() => setSeedCopied(false), 1500);
      })
      .catch(() => {});
  }

  const mapToggle = (
    <Dropdown.Toggle
      as="button"
      type="button"
      bsPrefix="form-select"
      className="w-auto d-flex align-items-center gap-2"
    >
      {currentImageSrc && (
        <img
          src={currentImageSrc}
          width={20}
          height={20}
          alt=""
          className="rounded"
          style={{ objectFit: 'cover' }}
        />
      )}
      {currentMapLabel}
    </Dropdown.Toggle>
  );

  const settingsBody = (
    <GameSettingsFields
      game={game}
      gameMeta={gameMeta}
      isHost={isHost}
      account={account}
      applySettings={applySettings}
    />
  );

  function settingsAction(label: string, onClick: () => void) {
    return (
      <Button
        size="sm"
        variant="outline-secondary"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
      >
        {label}
      </Button>
    );
  }

  const settingsActions = isHost && (
    <>
      {settingsAction('Reset', () =>
        applySettings({
          ...DEFAULT_GAME_SETTINGS,
          ...(connector.isOffline() ? { anonymous: undefined } : {}),
        }),
      )}
      {settingsAction('Randomize', () => applySettings(randomGameSettings()))}
    </>
  );

  return (
    <div className="flex-grow-1">
      <div className="d-flex flex-wrap align-items-end gap-3 mb-2">
        <div className="d-flex flex-column" style={HEADER_FIELD_STYLE}>
          <Form.Label className={FIELD_LABEL_CLASS}>
            Game Mode
            <Help>{GAME_MODE_HELP}</Help>
          </Form.Label>
          {isHost ? (
            <Form.Select
              value={game.gameMode}
              onChange={(e) =>
                applySettings({ gameMode: e.target.value as GameMode })
              }
            >
              {GAME_MODES.map((m) => (
                <option key={m} value={m}>
                  {titleCase(m)}
                </option>
              ))}
            </Form.Select>
          ) : (
            <span>{titleCase(game.gameMode)}</span>
          )}
        </div>

        <div className="d-flex flex-column" style={HEADER_FIELD_STYLE}>
          <Form.Label className={FIELD_LABEL_CLASS}>
            Map
            <Help>{MAP_HELP}</Help>
          </Form.Label>
          <div className="d-flex align-items-center gap-2">
            {isHost ? (
              <Dropdown
                onToggle={() => playSound('click')}
                onSelect={(key) => {
                  if (!key) return;
                  if (key === GENERATE_MAP_OPTION) {
                    setMapGenOpen(true);
                    if (!getGeneratedMapData(game.mapName)) {
                      mapGenRef.current?.generate();
                    }
                    return;
                  }
                  if (key === LIBRARY_MAP_OPTION) {
                    setMapGenOpen(false);
                    setMapPickerOpen(true);
                  }
                  if (key === EARTH_MAP_OPTION) {
                    setMapGenOpen(false);
                    setEarthOpen(true);
                  }
                }}
              >
                {mapGenOpen || COARSE_POINTER ? (
                  mapToggle
                ) : (
                  <Tip
                    text={mapTooltip(game.mapName)}
                    placement="right"
                    style={MAP_TOOLTIP_STYLE}
                    trigger={['hover', 'focus']}
                    popperConfig={MAP_TOOLTIP_POPPER}
                  >
                    {mapToggle}
                  </Tip>
                )}
                <Dropdown.Menu className="rounded-0 p-0">
                  <Dropdown.Item
                    as="button"
                    eventKey={GENERATE_MAP_OPTION}
                    className="d-flex align-items-center gap-2 text-nowrap"
                  >
                    <img
                      src={whiteMapIcon ?? '/icons/map.svg'}
                      width={20}
                      height={20}
                      alt=""
                    />
                    Generate
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="button"
                    eventKey={LIBRARY_MAP_OPTION}
                    className="d-flex align-items-center gap-2 text-nowrap"
                  >
                    <img
                      src={whiteMapIcon ?? '/icons/map.svg'}
                      width={20}
                      height={20}
                      alt=""
                    />
                    Choose from library
                  </Dropdown.Item>
                  {selectEarthMap && (
                    <Dropdown.Item
                      as="button"
                      eventKey={EARTH_MAP_OPTION}
                      className="d-flex align-items-center gap-2 text-nowrap"
                    >
                      <img
                        src={whiteGlobeIcon ?? '/icons/globe.svg'}
                        width={20}
                        height={20}
                        alt=""
                      />
                      Earth
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Tip
                text={mapTooltip(game.mapName)}
                placement="right"
                style={MAP_TOOLTIP_STYLE}
                popperConfig={MAP_TOOLTIP_POPPER}
              >
                <span
                  className="d-flex align-items-center gap-2"
                  role={currentSeed ? 'button' : undefined}
                  style={currentSeed ? { cursor: 'pointer' } : undefined}
                  onClick={currentSeed ? copySeed : undefined}
                >
                  {currentImageSrc && (
                    <img
                      src={currentImageSrc}
                      width={20}
                      height={20}
                      alt=""
                      className="rounded"
                      style={{ objectFit: 'cover' }}
                    />
                  )}
                  {seedCopied ? 'Seed copied!' : currentMapLabel}
                </span>
              </Tip>
            )}
            {game.playerMapId && <MapLikeButton mapId={game.playerMapId} />}
          </div>
        </div>

        {headerActions && <div className="ms-auto">{headerActions}</div>}
      </div>

      {isHost && (
        <MapGenerationModal
          ref={mapGenRef}
          show={mapGenOpen}
          onHide={() => setMapGenOpen(false)}
          initial={getGameSettings().mapGeneration}
          preview={getGeneratedMapData(game.mapName) ?? null}
          generate={generateMap}
        />
      )}

      {isHost && (
        <Modal
          show={mapPickerOpen}
          onHide={() => setMapPickerOpen(false)}
          size="xl"
        >
          <Modal.Header closeButton>
            <Modal.Title>Choose a map</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <MapBrowser
              account={account}
              mode="pick"
              onRowClick={(row) => {
                selectPlayerMap?.(row.id);
                setMapPickerOpen(false);
              }}
            />
          </Modal.Body>
        </Modal>
      )}

      {earthOpen && selectEarthMap && (
        <EarthErrorBoundary onClose={() => setEarthOpen(false)}>
          <Suspense fallback={null}>
            <WorldMapModal
              onHide={() => setEarthOpen(false)}
              onGenerated={(map) => {
                setEarthUploading(true);
                selectEarthMap(map, () => setEarthUploading(false));
              }}
            />
          </Suspense>
        </EarthErrorBoundary>
      )}

      {collapsible ? (
        <details
          className="mb-1"
          onToggle={(e) => {
            playSound('click');
            setSettingsOpen(e.currentTarget.open);
          }}
        >
          <summary className="fw-bold py-2 position-relative">
            Settings
            {settingsOpen && (
              <div className="position-absolute top-50 end-0 translate-middle-y d-flex gap-2">
                {settingsActions}
              </div>
            )}
          </summary>
          {settingsBody}
        </details>
      ) : (
        <div className="mb-1">{settingsBody}</div>
      )}
    </div>
  );
}

export default SettingsPanel;
