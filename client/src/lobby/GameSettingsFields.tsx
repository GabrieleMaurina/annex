import type { CSSProperties } from 'react';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Help from '../common/Help';
import type {
  GameMeta,
  GameSettingsInput,
  GameState,
  Visibility,
} from '../lib/types';
import {
  GAME_SETTING_SECTIONS,
  GAME_SETTINGS,
  type GameSettingDef,
} from './gameSettings';
import { PASSWORD_HELP, VISIBILITY_HELP } from './settingsHelp';

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
  gameMeta?: GameMeta | null;
  isHost: boolean;
  applySettings: (settings: GameSettingsInput) => void;
}

function settingUpdate(key: string, value: string | number): GameSettingsInput {
  return { [key]: value } as GameSettingsInput;
}

function optionLabel(def: GameSettingDef, value: unknown): string {
  const match = def.options.find((o) => o.value === String(value));
  return match ? match.label : String(value);
}

function GameSettingsFields({
  game,
  gameMeta = null,
  isHost,
  applySettings,
}: Props) {
  const [passwordInput, setPasswordInput] = useState('');

  const disabledKeys = new Set<string>();
  if (game.defenceDice !== 2) disabledKeys.add('entrenchments');
  if (game.gameMode === 'Team Deathmatch') disabledKeys.add('alliances');

  function field(def: GameSettingDef) {
    const value = game[def.key as keyof GameState];
    return (
      <div
        key={def.key}
        className="col d-flex align-items-center gap-2"
        style={SHRINK_STYLE}
      >
        <Form.Label
          className="mb-0 d-flex align-items-center gap-1"
          style={LABEL_STYLE}
        >
          {def.label}
          <Help>{def.help}</Help>
        </Form.Label>
        {isHost ? (
          <Form.Select
            className="w-auto"
            style={SHRINK_STYLE}
            value={String(value)}
            disabled={disabledKeys.has(def.key)}
            onChange={(e) =>
              applySettings(
                settingUpdate(
                  def.key,
                  def.numeric ? Number(e.target.value) : e.target.value,
                ),
              )
            }
          >
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
        ) : (
          <span style={TRUNCATE_STYLE}>{optionLabel(def, value)}</span>
        )}
      </div>
    );
  }

  return (
    <>
      {GAME_SETTING_SECTIONS.map((section, index) => {
        const defs = GAME_SETTINGS.filter((d) => d.section === section);
        const last = index === GAME_SETTING_SECTIONS.length - 1;
        return (
          <div
            key={section}
            className={`border rounded p-2${last ? '' : ' mb-2'}`}
          >
            <div className="fw-bold text-muted small mb-2">{section}</div>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
              {defs.map(field)}
              {section === 'Session' && gameMeta && (
                <>
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
                        value={gameMeta.visibility}
                        onChange={(e) =>
                          applySettings({
                            visibility: e.target.value as Visibility,
                          })
                        }
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </Form.Select>
                    ) : (
                      <span style={TRUNCATE_STYLE}>
                        {gameMeta.visibility === 'private'
                          ? 'Private'
                          : 'Public'}
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
                            gameMeta.hasPassword
                              ? 'Change password'
                              : 'No password'
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
                        {gameMeta.hasPassword && (
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
                        {gameMeta.hasPassword
                          ? 'Password protected'
                          : 'No password'}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default GameSettingsFields;
