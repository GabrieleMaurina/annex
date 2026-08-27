import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Help from '../common/Help';
import { playSound } from '../lib/sounds';
import type {
  Alliances,
  Blitz,
  Bounties,
  CardsMode,
  DefenceDice,
  Entrenchments,
  FogOfWar,
  Fortification,
  GameMode,
  GameSettingsInput,
  GameState,
  Placement,
  Portals,
  Radiations,
  Starvation,
  SupplyLines,
  Toxins,
  TurnDuration,
  TurnTroops,
  Visibility,
} from '../lib/types';

const TURN_DURATIONS: TurnDuration[] = [60, 90, 120, 150, 180, 300];

const LABEL_STYLE = { minWidth: 130, flexShrink: 0 };

import {
  ALLIANCES_HELP,
  BLITZ_HELP,
  BOUNTIES_HELP,
  CARDS_HELP,
  DEFENCE_DICE_HELP,
  ENTRENCHMENTS_HELP,
  FOG_OF_WAR_HELP,
  FORTIFICATION_HELP,
  GAME_MODE_HELP,
  MAP_HELP,
  PASSWORD_HELP,
  PLACEMENT_HELP,
  PORTALS_HELP,
  RADIATIONS_HELP,
  STARVATION_HELP,
  SUPPLY_LINES_HELP,
  TOXINS_HELP,
  TURN_DURATION_HELP,
  TURN_TROOPS_HELP,
  VISIBILITY_HELP,
} from './settingsHelp';

interface Props {
  game: GameState;
  isHost: boolean;
  mapNames: string[];
  applySettings: (settings: GameSettingsInput) => void;
}

const DEFAULT_SETTINGS: Omit<GameSettingsInput, 'mapName'> = {
  gameMode: 'Supremacy',
  blitz: 'Balanced',
  defenceDice: 2,
  cards: 'Constant',
  placement: 'Random',
  fortification: 'Connected',
  entrenchments: 'off',
  toxins: 'off',
  portals: 'off',
  radiations: 'off',
  starvation: 'off',
  turnTroops: 'off',
  bounties: 'off',
  supplyLines: 'off',
  fogOfWar: 'off',
  alliances: 'off',
  turnDuration: 120,
  password: null,
  visibility: 'public',
};

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} sec`;
}

function SettingsPanel({ game, isHost, mapNames, applySettings }: Props) {
  const [passwordInput, setPasswordInput] = useState('');

  return (
    <div className="flex-grow-1">
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-2 mb-2">
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
            <Form.Select
              className="w-auto"
              value={game.mapName}
              onChange={(e) => applySettings({ mapName: e.target.value })}
            >
              {mapNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Form.Select>
          ) : (
            <span>{game.mapName}</span>
          )}
        </div>
      </div>

      <details className="mb-3" onToggle={() => playSound('click')}>
        <summary className="fw-bold py-2">Settings</summary>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-2 mt-1">
          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Blitz
              <Help>{BLITZ_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.blitz}
                onChange={(e) =>
                  applySettings({
                    blitz: e.target.value as Blitz,
                  })
                }
              >
                <option value="Balanced">Balanced</option>
                <option value="True">True</option>
              </Form.Select>
            ) : (
              <span>{game.blitz}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Defence Dice
              <Help>{DEFENCE_DICE_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.defenceDice}
                onChange={(e) =>
                  applySettings({
                    defenceDice: Number(e.target.value) as DefenceDice,
                  })
                }
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
              </Form.Select>
            ) : (
              <span>{game.defenceDice}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Cards
              <Help>{CARDS_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.cards}
                onChange={(e) =>
                  applySettings({ cards: e.target.value as CardsMode })
                }
              >
                <option value="Constant">Constant</option>
                <option value="Linear">Linear</option>
                <option value="Exponential">Exponential</option>
                <option value="Linear Per Player">Linear Per Player</option>
                <option value="Exponential Per Player">
                  Exponential Per Player
                </option>
              </Form.Select>
            ) : (
              <span>{game.cards}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Placement
              <Help>{PLACEMENT_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.placement}
                onChange={(e) =>
                  applySettings({ placement: e.target.value as Placement })
                }
              >
                <option value="Random">Random</option>
                <option value="Semi">Semi</option>
                <option value="Custom">Custom</option>
              </Form.Select>
            ) : (
              <span>{game.placement}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Fortification
              <Help>{FORTIFICATION_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.fortification}
                onChange={(e) =>
                  applySettings({
                    fortification: e.target.value as Fortification,
                  })
                }
              >
                <option value="Connected">Connected</option>
                <option value="Neighboring">Neighboring</option>
                <option value="Unrestricted">Unrestricted</option>
              </Form.Select>
            ) : (
              <span>{game.fortification}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Portals
              <Help>{PORTALS_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.portals}
                onChange={(e) =>
                  applySettings({ portals: e.target.value as Portals })
                }
              >
                <option value="off">Off</option>
                <option value="static">Static</option>
                <option value="dynamic">Dynamic</option>
              </Form.Select>
            ) : (
              <span>
                {game.portals === 'off'
                  ? 'Off'
                  : game.portals === 'static'
                    ? 'Static'
                    : 'Dynamic'}
              </span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Entrenchments
              <Help>{ENTRENCHMENTS_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.entrenchments}
                disabled={game.defenceDice !== 2}
                onChange={(e) =>
                  applySettings({
                    entrenchments: e.target.value as Entrenchments,
                  })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span>{game.entrenchments === 'on' ? 'On' : 'Off'}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Toxins
              <Help>{TOXINS_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.toxins}
                onChange={(e) =>
                  applySettings({ toxins: e.target.value as Toxins })
                }
              >
                <option value="off">Off</option>
                <option value="temporary">Temporary</option>
                <option value="permanent">Permanent</option>
              </Form.Select>
            ) : (
              <span>
                {game.toxins === 'off'
                  ? 'Off'
                  : game.toxins === 'temporary'
                    ? 'Temporary'
                    : 'Permanent'}
              </span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Radiations
              <Help>{RADIATIONS_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.radiations}
                onChange={(e) =>
                  applySettings({ radiations: e.target.value as Radiations })
                }
              >
                <option value="off">Off</option>
                <option value="static">Static</option>
                <option value="dynamic">Dynamic</option>
                <option value="expanding">Expanding</option>
              </Form.Select>
            ) : (
              <span>
                {game.radiations === 'off'
                  ? 'Off'
                  : game.radiations === 'static'
                    ? 'Static'
                    : game.radiations === 'dynamic'
                      ? 'Dynamic'
                      : 'Expanding'}
              </span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Starvation
              <Help>{STARVATION_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.starvation}
                onChange={(e) =>
                  applySettings({ starvation: e.target.value as Starvation })
                }
              >
                <option value="off">Off</option>
                <option value="territory">Territory</option>
                <option value="total">Total</option>
                <option value="percent">Percent</option>
              </Form.Select>
            ) : (
              <span>
                {game.starvation === 'off'
                  ? 'Off'
                  : game.starvation === 'territory'
                    ? 'Territory'
                    : game.starvation === 'total'
                      ? 'Total'
                      : 'Percent'}
              </span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Turn Troops
              <Help>{TURN_TROOPS_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.turnTroops}
                onChange={(e) =>
                  applySettings({
                    turnTroops: e.target.value as TurnTroops,
                  })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span>{game.turnTroops === 'on' ? 'On' : 'Off'}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Bounties
              <Help>{BOUNTIES_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.bounties}
                onChange={(e) =>
                  applySettings({ bounties: e.target.value as Bounties })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span>{game.bounties === 'on' ? 'On' : 'Off'}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Supply Lines
              <Help>{SUPPLY_LINES_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.supplyLines}
                onChange={(e) =>
                  applySettings({ supplyLines: e.target.value as SupplyLines })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span>{game.supplyLines === 'on' ? 'On' : 'Off'}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Fog Of War
              <Help>{FOG_OF_WAR_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.fogOfWar}
                onChange={(e) =>
                  applySettings({ fogOfWar: e.target.value as FogOfWar })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span>{game.fogOfWar === 'on' ? 'On' : 'Off'}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Alliances
              <Help>{ALLIANCES_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.alliances}
                disabled={game.gameMode === 'Team Deathmatch'}
                onChange={(e) =>
                  applySettings({ alliances: e.target.value as Alliances })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span>{game.alliances === 'on' ? 'On' : 'Off'}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Turn Duration
              <Help>{TURN_DURATION_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.turnDuration}
                onChange={(e) =>
                  applySettings({
                    turnDuration: Number(e.target.value) as TurnDuration,
                  })
                }
              >
                {TURN_DURATIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatDuration(seconds)}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <span>{formatDuration(game.turnDuration)}</span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Visibility
              <Help>{VISIBILITY_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.visibility}
                onChange={(e) =>
                  applySettings({ visibility: e.target.value as Visibility })
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Form.Select>
            ) : (
              <span>
                {game.visibility === 'private' ? 'Private' : 'Public'}
              </span>
            )}
          </div>

          <div className="col d-flex align-items-center gap-2">
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Password
              <Help>{PASSWORD_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  type="text"
                  className="w-auto"
                  htmlSize={13}
                  placeholder={
                    game.hasPassword ? 'Change password' : 'No password'
                  }
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onBlur={() => {
                    const trimmed = passwordInput.trim();
                    if (!trimmed) return;
                    applySettings({ password: trimmed });
                    setPasswordInput('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                />
                {game.hasPassword && (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => applySettings({ password: null })}
                  >
                    Clear
                  </Button>
                )}
              </div>
            ) : (
              <span>
                {game.hasPassword ? 'Password protected' : 'No password'}
              </span>
            )}
          </div>

          {isHost && (
            <div className="col d-flex align-items-center gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
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
        </div>
      </details>
    </div>
  );
}

export default SettingsPanel;
