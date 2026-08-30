import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Form } from 'react-bootstrap';
import Help from '../common/Help';
import { useWhiteIcon } from '../common/icon';
import Tip from '../common/Tip';
import { connector } from '../connector';
import {
  getGeneratedMapData,
  getMapDisplayName,
  loadGameMap,
} from '../game/mapData';
import { isRegeneratingMap } from '../lib/gameSetup';
import { playSound } from '../lib/sounds';
import type {
  GameMeta,
  GameMode,
  GameSettingsInput,
  GameState,
  GenerateMapInput,
} from '../lib/types';
import GameSettingsFields from './GameSettingsFields';
import MapGenerationPanel, {
  type MapGenerationPanelHandle,
} from './MapGenerationPanel';
import { GAME_MODE_HELP, MAP_HELP } from './settingsHelp';

const LABEL_STYLE = { minWidth: 130, flexShrink: 0 };
const MAP_TEXT_COLOR = 'rgb(222, 226, 230)';
const MAP_TEXT_HOVER_COLOR = 'rgb(59, 59, 59)';
const MAP_TOOLTIP_STYLE = {
  '--bs-tooltip-max-width': '500px',
} as CSSProperties;

const GENERATE_MAP_OPTION = '__generateMap__';

interface Props {
  game: GameState;
  gameMeta?: GameMeta | null;
  isHost: boolean;
  mapNames: string[];
  applySettings: (settings: GameSettingsInput) => void;
  generateMap: (
    input: GenerateMapInput,
    onSettled?: (ok: boolean, mapName?: string) => void,
  ) => void;
  headerActions?: ReactNode;
  collapsible?: boolean;
}

const DEFAULT_SETTINGS: Omit<GameSettingsInput, 'mapName'> = {
  alliances: 'off',
  blitz: 'Balanced',
  bounties: 'off',
  cards: 'Constant',
  defenceDice: 2,
  disconnectBotDifficulty: 'random',
  disconnectBotPersonality: 'random',
  entrenchments: 'off',
  fogOfWar: 'off',
  fortification: 'Connected',
  gameMode: 'Supremacy',
  password: null,
  placement: 'Random',
  portals: 'off',
  radiations: 'off',
  starvation: 'off',
  supplyLines: 'off',
  toxins: 'off',
  turnDuration: 120,
  turnTroops: 'off',
  visibility: 'public',
};

function SettingsPanel({
  game,
  gameMeta = null,
  isHost,
  mapNames,
  applySettings,
  generateMap,
  headerActions,
  collapsible = true,
}: Props) {
  const [mapThumbnails, setMapThumbnails] = useState<Record<string, string>>(
    {},
  );
  const [mapStats, setMapStats] = useState<
    Record<string, { territories: number; continents: number }>
  >({});
  const loadedMapNamesRef = useRef(new Set<string>());
  const [mapGenOpen, setMapGenOpen] = useState(false);
  const [mapRegenerating, setMapRegenerating] = useState(isRegeneratingMap);
  const [seenMapName, setSeenMapName] = useState<string | null>(null);
  const mapGenRef = useRef<MapGenerationPanelHandle>(null);
  const whiteMapIcon = useWhiteIcon('/icons/map.svg');

  if (game.mapName !== seenMapName) {
    setSeenMapName(game.mapName);
    if (getGeneratedMapData(game.mapName)) setMapGenOpen(true);
  }

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
    const names = new Set(mapNames);
    names.add(game.mapName);
    for (const name of names) {
      if (loadedMapNamesRef.current.has(name)) continue;
      loadedMapNamesRef.current.add(name);
      loadGameMap(name).then(({ imageSrc, territories }) => {
        if (imageSrc) {
          setMapThumbnails((prev) => ({ ...prev, [name]: imageSrc }));
        }
        setMapStats((prev) => ({
          ...prev,
          [name]: {
            territories: territories.length,
            continents: new Set(territories.map((t) => t.continentId)).size,
          },
        }));
      });
    }
  }, [mapNames, game.mapName]);

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
        {stats && (
          <div>
            {stats.territories} territories, {stats.continents} continents
          </div>
        )}
      </div>
    );
  }

  const currentImageSrc = mapRegenerating
    ? undefined
    : imageSrcFor(game.mapName);
  const currentMapLabel = mapRegenerating
    ? 'Generating…'
    : getMapDisplayName(game.mapName);

  const mapToggle = (
    <Dropdown.Toggle
      as="button"
      type="button"
      bsPrefix="form-select"
      className="w-auto d-flex align-items-center gap-2"
      style={{ color: MAP_TEXT_COLOR }}
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
    <>
      <GameSettingsFields
        game={game}
        gameMeta={gameMeta}
        isHost={isHost}
        applySettings={applySettings}
      />
      {isHost && (
        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() =>
              applySettings({
                ...DEFAULT_SETTINGS,
                mapName: mapNames.includes('World') ? 'World' : mapNames[0],
              })
            }
          >
            Reset
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex-grow-1">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
        <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-2 flex-grow-1 align-self-stretch">
          <div className="col d-flex align-items-center flex-wrap gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Game Mode
              <Help>{GAME_MODE_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.gameMode}
                onChange={(e) =>
                  applySettings({ gameMode: e.target.value as GameMode })
                }
              >
                <option value="Supremacy">Supremacy</option>
                <option value="Supremacy 3/4">Supremacy 3/4</option>
                <option value="Supremacy 2/3">Supremacy 2/3</option>
                <option value="Capitals">Capitals</option>
                <option value="Team Deathmatch">Team Deathmatch</option>
                <option value="Continent">Continent</option>
                <option value="5-Turn">5-Turn</option>
                <option value="10-Turn">10-Turn</option>
                <option value="Assassin">Assassin</option>
                <option value="Mission">Mission</option>
                <option value="Player Kills">Player Kills</option>
                <option value="Troop Kills">Troop Kills</option>
              </Form.Select>
            ) : (
              <span>{game.gameMode}</span>
            )}
          </div>

          <div className="col d-flex align-items-center flex-wrap gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Map
              <Help>{MAP_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Dropdown
                onSelect={(name) => {
                  if (!name) return;
                  if (name === GENERATE_MAP_OPTION) {
                    setMapGenOpen(true);
                    if (!getGeneratedMapData(game.mapName)) {
                      mapGenRef.current?.generate();
                    }
                    return;
                  }
                  setMapGenOpen(false);
                  applySettings({ mapName: name });
                }}
              >
                {mapGenOpen ? (
                  mapToggle
                ) : (
                  <Tip
                    text={mapTooltip(game.mapName)}
                    placement="right"
                    style={MAP_TOOLTIP_STYLE}
                    trigger={['hover']}
                  >
                    {mapToggle}
                  </Tip>
                )}
                <Dropdown.Menu
                  className="rounded-0 p-0 w-100"
                  style={
                    {
                      minWidth: 0,
                      '--bs-dropdown-link-color': MAP_TEXT_COLOR,
                      '--bs-dropdown-link-hover-bg': 'rgb(153, 200, 255)',
                      '--bs-dropdown-link-hover-color': MAP_TEXT_HOVER_COLOR,
                    } as CSSProperties
                  }
                >
                  {mapNames.map((name) => (
                    <Tip
                      key={name}
                      text={mapTooltip(name)}
                      placement="right"
                      style={MAP_TOOLTIP_STYLE}
                    >
                      <Dropdown.Item
                        eventKey={name}
                        className="d-flex align-items-center gap-2"
                      >
                        {mapThumbnails[name] && (
                          <img
                            src={mapThumbnails[name]}
                            width={20}
                            height={20}
                            alt=""
                            className="rounded"
                            style={{ objectFit: 'cover' }}
                          />
                        )}
                        {name}
                      </Dropdown.Item>
                    </Tip>
                  ))}
                  <Dropdown.Item
                    eventKey={GENERATE_MAP_OPTION}
                    className="d-flex align-items-center gap-2"
                  >
                    <img
                      src={whiteMapIcon ?? '/icons/map.svg'}
                      width={20}
                      height={20}
                      alt=""
                    />
                    Generate
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Tip
                text={mapTooltip(game.mapName)}
                placement="right"
                style={MAP_TOOLTIP_STYLE}
              >
                <span className="d-flex align-items-center gap-2">
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
                </span>
              </Tip>
            )}
          </div>
        </div>

        {headerActions}
      </div>

      {isHost && (
        <MapGenerationPanel
          ref={mapGenRef}
          open={mapGenOpen}
          currentMapName={game.mapName}
          onHide={() => setMapGenOpen(false)}
          generateMap={generateMap}
        />
      )}

      {collapsible ? (
        <details className="mb-1" onToggle={() => playSound('click')}>
          <summary className="fw-bold py-2">Settings</summary>
          {settingsBody}
        </details>
      ) : (
        <div className="mb-1">{settingsBody}</div>
      )}
    </div>
  );
}

export default SettingsPanel;
