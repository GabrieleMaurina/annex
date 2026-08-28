import type { CSSProperties } from 'react';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Help from '../common/Help';
import type {
  Alliances,
  Blitz,
  BotDifficulty,
  BotPersonality,
  Bounties,
  CardsMode,
  DefenceDice,
  Entrenchments,
  FogOfWar,
  Fortification,
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
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABELS,
  BOT_PERSONALITIES,
  BOT_PERSONALITY_LABELS,
} from './botOptions';
import {
  ALLIANCES_HELP,
  BLITZ_HELP,
  BOUNTIES_HELP,
  CARDS_HELP,
  DEFENCE_DICE_HELP,
  DISCONNECT_BOT_DIFFICULTY_HELP,
  DISCONNECT_BOT_PERSONALITY_HELP,
  ENTRENCHMENTS_HELP,
  FOG_OF_WAR_HELP,
  FORTIFICATION_HELP,
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

const TURN_DURATIONS: TurnDuration[] = [60, 90, 120, 150, 180, 300];

const LABEL_STYLE = { minWidth: 130, flexShrink: 0 };
const SHRINK_STYLE = { minWidth: 0 };
const TRUNCATE_STYLE: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

interface Props {
  game: GameState;
  isHost: boolean;
  applySettings: (settings: GameSettingsInput) => void;
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} sec`;
}

function GameSettingsFields({ game, isHost, applySettings }: Props) {
  const [passwordInput, setPasswordInput] = useState('');

  return (
    <>
      <div className="border rounded p-2 mb-2">
        <div className="fw-bold text-muted small mb-2">Setup</div>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>{game.placement}</span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>{game.fortification}</span>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded p-2 mb-2">
        <div className="fw-bold text-muted small mb-2">Combat</div>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>{game.blitz}</span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>{game.defenceDice}</span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
                {game.entrenchments === 'on' ? 'On' : 'Off'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded p-2 mb-2">
        <div className="fw-bold text-muted small mb-2">Reinforcements</div>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>{game.cards}</span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
                {game.turnTroops === 'on' ? 'On' : 'Off'}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
                value={game.bounties}
                onChange={(e) =>
                  applySettings({ bounties: e.target.value as Bounties })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span style={TRUNCATE_STYLE}>
                {game.bounties === 'on' ? 'On' : 'Off'}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
                value={game.supplyLines}
                onChange={(e) =>
                  applySettings({ supplyLines: e.target.value as SupplyLines })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span style={TRUNCATE_STYLE}>
                {game.supplyLines === 'on' ? 'On' : 'Off'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded p-2 mb-2">
        <div className="fw-bold text-muted small mb-2">Hazards</div>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
                {game.portals === 'off'
                  ? 'Off'
                  : game.portals === 'static'
                    ? 'Static'
                    : 'Dynamic'}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
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

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
                {game.toxins === 'off'
                  ? 'Off'
                  : game.toxins === 'temporary'
                    ? 'Temporary'
                    : 'Permanent'}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
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
        </div>
      </div>

      <div className="border rounded p-2 mb-2">
        <div className="fw-bold text-muted small mb-2">Players</div>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
                value={game.fogOfWar}
                onChange={(e) =>
                  applySettings({ fogOfWar: e.target.value as FogOfWar })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span style={TRUNCATE_STYLE}>
                {game.fogOfWar === 'on' ? 'On' : 'Off'}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
                {game.alliances === 'on' ? 'On' : 'Off'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded p-2 mb-2">
        <div className="fw-bold text-muted small mb-2">Bots</div>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Disconnect Personality
              <Help>{DISCONNECT_BOT_PERSONALITY_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                style={SHRINK_STYLE}
                value={game.disconnectBotPersonality}
                onChange={(e) =>
                  applySettings({
                    disconnectBotPersonality: e.target.value as
                      BotPersonality | 'random',
                  })
                }
              >
                {BOT_PERSONALITIES.map((value) => (
                  <option key={value} value={value}>
                    {BOT_PERSONALITY_LABELS[value]}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <span style={TRUNCATE_STYLE}>
                {BOT_PERSONALITY_LABELS[game.disconnectBotPersonality]}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
            <Form.Label
              className="mb-0 d-flex align-items-center gap-1"
              style={LABEL_STYLE}
            >
              Disconnect Difficulty
              <Help>{DISCONNECT_BOT_DIFFICULTY_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                style={SHRINK_STYLE}
                value={game.disconnectBotDifficulty}
                onChange={(e) =>
                  applySettings({
                    disconnectBotDifficulty: e.target.value as
                      BotDifficulty | 'random',
                  })
                }
              >
                {BOT_DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>
                    {BOT_DIFFICULTY_LABELS[value]}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <span style={TRUNCATE_STYLE}>
                {BOT_DIFFICULTY_LABELS[game.disconnectBotDifficulty]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded p-2">
        <div className="fw-bold text-muted small mb-2">Session</div>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
                {formatDuration(game.turnDuration)}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                style={SHRINK_STYLE}
                value={game.visibility}
                onChange={(e) =>
                  applySettings({ visibility: e.target.value as Visibility })
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Form.Select>
            ) : (
              <span style={TRUNCATE_STYLE}>
                {game.visibility === 'private' ? 'Private' : 'Public'}
              </span>
            )}
          </div>

          <div
            className="col d-flex align-items-center gap-2"
            style={SHRINK_STYLE}
          >
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
                  style={SHRINK_STYLE}
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
              <span style={TRUNCATE_STYLE}>
                {game.hasPassword ? 'Password protected' : 'No password'}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default GameSettingsFields;
