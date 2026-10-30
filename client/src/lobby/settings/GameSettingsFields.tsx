import {
  isBlitzOffAllowed,
  MAX_DICE,
  meetsMinAccountAge,
  meetsMinGames,
  meetsMinRank,
} from 'engine';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Help from '../../common/tooltips/Help';
import { connector } from '../../connector';
import { playSound } from '../../lib/sounds';
import type {
  Account,
  GameMeta,
  GameSettingsInput,
  GameState,
  Visibility,
} from '../../lib/types';
import {
  FIELD_LABEL_CLASS,
  SECTION_CLASS,
} from '../../ui/containers/panelStyle';
import Selector from '../../ui/forms/Selector';
import {
  defaultSettingValue,
  GAME_SETTING_SECTIONS,
  GAME_SETTINGS,
  type GameSettingDef,
  SEAT_REQUIREMENT_KEYS,
} from './gameSettings';
import { PASSWORD_HELP, VISIBILITY_HELP } from './settingsHelp';

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
  account: Account | null;
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
  account,
  applySettings,
}: Props) {
  const [passwordInput, setPasswordInput] = useState('');

  const disabledKeys = new Set<string>();
  if (game.defenceDice >= MAX_DICE) disabledKeys.add('entrenchments');
  if (game.gameMode === 'team deathmatch') disabledKeys.add('alliances');
  const blitzOffAllowed = isBlitzOffAllowed(game);

  function optionDisabled(def: GameSettingDef, option: string): boolean {
    const value = def.numeric ? Number(option) : option;
    if (def.key === 'blitz') return value === 'off' && !blitzOffAllowed;
    if (
      game.blitz === 'off' &&
      !isBlitzOffAllowed({ ...game, [def.key]: value })
    )
      return true;
    if (def.key === 'attackDice') return Number(value) < game.defenceDice;
    if (def.key === 'defenceDice')
      return (
        Number(value) > game.attackDice ||
        (Number(value) >= MAX_DICE && game.entrenchments === 'on')
      );
    if (def.key === 'minRank')
      return !meetsMinRank(option, account?.elo ?? null);
    if (def.key === 'minGames')
      return !meetsMinGames(value as number, account?.gamesPlayed ?? null);
    if (def.key === 'minAccountAge')
      return !meetsMinAccountAge(option, account?.createdAt ?? null);
    return false;
  }

  function field(def: GameSettingDef) {
    const value = game[def.key as keyof GameState];
    const changed =
      String(value) !== String(defaultSettingValue(def.key, game.gameMode));
    return (
      <div
        key={def.key}
        className="col d-flex flex-column"
        style={SHRINK_STYLE}
      >
        <Form.Label className={FIELD_LABEL_CLASS}>
          {def.label}
          <Help>{def.help}</Help>
        </Form.Label>
        {isHost ? (
          <Selector
            className={changed ? 'border-primary' : undefined}
            value={String(value)}
            disabled={disabledKeys.has(def.key)}
            onChange={(next) =>
              applySettings(
                settingUpdate(def.key, def.numeric ? Number(next) : next),
              )
            }
          >
            {def.options.map((o) => (
              <option
                key={o.value}
                value={o.value}
                disabled={optionDisabled(def, o.value)}
              >
                {o.label}
              </option>
            ))}
          </Selector>
        ) : (
          <span
            className={changed ? 'text-primary fw-semibold' : undefined}
            style={TRUNCATE_STYLE}
          >
            {optionLabel(def, value)}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      {GAME_SETTING_SECTIONS.map((section, index) => {
        const defs = GAME_SETTINGS.filter(
          (d) =>
            d.section === section &&
            (!d.modes || d.modes.includes(game.gameMode)) &&
            !(
              (d.key === 'anonymous' ||
                SEAT_REQUIREMENT_KEYS.includes(d.key)) &&
              connector.isOffline()
            ),
        );
        const last = index === GAME_SETTING_SECTIONS.length - 1;
        return (
          <div
            key={section}
            className={`${SECTION_CLASS} p-2${last ? '' : ' mb-2'}`}
          >
            <div className="fw-bold text-muted small mb-2">{section}</div>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
              {defs.map(field)}
              {section === 'Session' && gameMeta && (
                <>
                  <div className="col d-flex flex-column" style={SHRINK_STYLE}>
                    <Form.Label className={FIELD_LABEL_CLASS}>
                      Visibility
                      <Help>{VISIBILITY_HELP}</Help>
                    </Form.Label>
                    {isHost ? (
                      <Selector
                        className={
                          gameMeta.visibility === 'private'
                            ? 'border-primary'
                            : undefined
                        }
                        value={gameMeta.visibility}
                        onChange={(value) =>
                          applySettings({
                            visibility: value as Visibility,
                          })
                        }
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </Selector>
                    ) : (
                      <span
                        className={
                          gameMeta.visibility === 'private'
                            ? 'text-primary fw-semibold'
                            : undefined
                        }
                        style={TRUNCATE_STYLE}
                      >
                        {gameMeta.visibility === 'private'
                          ? 'Private'
                          : 'Public'}
                      </span>
                    )}
                  </div>

                  <div className="col d-flex flex-column" style={SHRINK_STYLE}>
                    <Form.Label className={FIELD_LABEL_CLASS}>
                      Password
                      <Help>{PASSWORD_HELP}</Help>
                    </Form.Label>
                    {isHost ? (
                      <div className="d-flex align-items-center gap-2">
                        <Form.Control
                          type="text"
                          className={
                            gameMeta.hasPassword ? 'border-primary' : undefined
                          }
                          style={SHRINK_STYLE}
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
                            if (e.key !== 'Enter') return;
                            playSound('click');
                            e.currentTarget.blur();
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
                      <span
                        className={
                          gameMeta.hasPassword
                            ? 'text-primary fw-semibold'
                            : undefined
                        }
                        style={TRUNCATE_STYLE}
                      >
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
