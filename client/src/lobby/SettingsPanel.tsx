import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Form } from 'react-bootstrap';
import Help from '../common/Help';
import Tip from '../common/Tip';
import { loadGameMap } from '../game/mapData';
import { playSound } from '../lib/sounds';
import type { GameMode, GameSettingsInput, GameState } from '../lib/types';
import GameSettingsFields from './GameSettingsFields';

const LABEL_STYLE = { minWidth: 130, flexShrink: 0 };
const MAP_TEXT_COLOR = 'rgb(222, 226, 230)';
const MAP_TEXT_HOVER_COLOR = 'rgb(59, 59, 59)';
const MAP_TOOLTIP_STYLE = {
  '--bs-tooltip-max-width': '500px',
} as CSSProperties;

import { GAME_MODE_HELP, MAP_HELP } from './settingsHelp';

interface Props {
  game: GameState;
  isHost: boolean;
  mapNames: string[];
  applySettings: (settings: GameSettingsInput) => void;
  headerActions?: ReactNode;
  collapsible?: boolean;
}

const DEFAULT_SETTINGS: Omit<GameSettingsInput, 'mapName'> = {
  alliances: 'off',
  blitz: 'Balanced',
  bounties: 'off',
  cards: 'Constant',
  defenceDice: 2,
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
  isHost,
  mapNames,
  applySettings,
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

  function mapTooltip(name: string) {
    const image = mapThumbnails[name];
    const stats = mapStats[name];
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

  const settingsBody = (
    <>
      <GameSettingsFields
        game={game}
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
      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
        <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-2 flex-grow-1 align-self-stretch">
          <div className="col d-flex align-items-center gap-2">
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

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Map
              <Help>{MAP_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Dropdown
                onSelect={(name) => name && applySettings({ mapName: name })}
              >
                <Tip
                  text={mapTooltip(game.mapName)}
                  placement="right"
                  style={MAP_TOOLTIP_STYLE}
                >
                  <Dropdown.Toggle
                    as="button"
                    type="button"
                    bsPrefix="form-select"
                    className="w-auto d-flex align-items-center gap-2"
                    style={{ color: MAP_TEXT_COLOR }}
                  >
                    {mapThumbnails[game.mapName] && (
                      <img
                        src={mapThumbnails[game.mapName]}
                        width={20}
                        height={20}
                        alt=""
                        className="rounded"
                        style={{ objectFit: 'cover' }}
                      />
                    )}
                    {game.mapName}
                  </Dropdown.Toggle>
                </Tip>
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
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Tip
                text={mapTooltip(game.mapName)}
                placement="right"
                style={MAP_TOOLTIP_STYLE}
              >
                <span className="d-flex align-items-center gap-2">
                  {mapThumbnails[game.mapName] && (
                    <img
                      src={mapThumbnails[game.mapName]}
                      width={20}
                      height={20}
                      alt=""
                      className="rounded"
                      style={{ objectFit: 'cover' }}
                    />
                  )}
                  {game.mapName}
                </span>
              </Tip>
            )}
          </div>
        </div>

        {headerActions}
      </div>

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
