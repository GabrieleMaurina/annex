import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Help from '../common/Help';
import type {
  Blitz,
  CardsMode,
  DefenceDice,
  Fortification,
  GameMode,
  GameSettingsInput,
  GameState,
  Placement,
  TurnDuration,
  Visibility,
} from '../lib/types';

const TURN_DURATIONS: TurnDuration[] = [60, 90, 120, 150, 180, 300];

const GAME_MODE_HELP = (
  <>
    How the game is won. In every mode, if everyone else surrenders or is
    eliminated, the last player (or team) standing wins immediately, regardless
    of the mode.
    <ul className="mb-0 ps-3">
      <li>Supremacy: own every territory on the map.</li>
      <li>
        Supremacy 3/4: control at least 3/4 of the map&apos;s territories.
      </li>
      <li>
        Supremacy 2/3: control at least 2/3 of the map&apos;s territories.
      </li>
      <li>
        Capitals: everyone places a capital at the start; win by owning every
        territory, or every capital for 2 full rounds or more.
      </li>
      <li>
        Team Deathmatch: players are split into teams; your team wins by owning
        every territory.
      </li>
      <li>
        5-Turn: the game ends after 5 full rounds, whoever holds the most
        territories then wins.
      </li>
      <li>
        10-Turn: the game ends after 10 full rounds, whoever holds the most
        territories then wins.
      </li>
      <li>
        Assassin: everyone is secretly assigned another player to eliminate.
        Kill your target to win; if someone else eliminates them first, win
        instead by controlling 3/4 of the map.
      </li>
      <li>
        Mission: everyone secretly draws one hidden mission at the start.
        Complete your mission to win.
      </li>
    </ul>
  </>
);

const MAP_HELP = 'Which territory layout the game is played on.';

const BLITZ_HELP = (
  <>
    How an all-out attack (&quot;blitz&quot;) resolves a battle instantly
    instead of one exchange at a time.
    <ul className="mb-0 ps-3">
      <li>
        Balanced: outcomes are smoothed, so a much stronger army isn&apos;t
        guaranteed a clean, lossless win; the underdog keeps a fighting chance.
      </li>
      <li>
        True: uses the exact same odds as fighting it out exchange by exchange,
        so a much stronger army will crush a weaker one almost every time.
      </li>
    </ul>
  </>
);

const DEFENCE_DICE_HELP = (
  <>
    How many dice a defending territory rolls per attack exchange (capped by its
    own troop count). More dice means better odds for the defender.
    <ul className="mb-0 ps-3">
      <li>2: defenders roll at most 2 dice.</li>
      <li>3: defenders roll at most 3 dice (stronger defense).</li>
    </ul>
  </>
);

const CARDS_HELP = (
  <>
    How much a set of 3 territory cards is worth in troops when played.
    <ul className="mb-0 ps-3">
      <li>
        Constant: always worth the same: 4 for three Soldiers, 6 for three
        Humvees, 8 for three Tanks, 10 for a mixed set.
      </li>
      <li>
        Linear: each set played, by anyone, raises the value of the next set for
        everyone: 4, 6, 8, 10, 12, 15, 20, 25, 30, then +5 per further set.
      </li>
      <li>
        Exponential: each set played, by anyone, sharply raises the next
        set&apos;s value: starts at 5, then ×1.3 (rounded up) after every set.
      </li>
      <li>
        Linear Per Player: same as Linear, but each player has their own
        progression: playing a set only raises the value of your own next set.
      </li>
      <li>
        Exponential Per Player: same as Exponential, but each player has their
        own progression: playing a set only raises the value of your own next
        set.
      </li>
    </ul>
  </>
);

const PLACEMENT_HELP = (
  <>
    How territories and starting troops are handed out at the start of the game.
    <ul className="mb-0 ps-3">
      <li>
        Random: territories and starting troops are both assigned randomly.
      </li>
      <li>
        Semi: territories are assigned randomly, but each player takes turns
        choosing where to place their starting troops.
      </li>
      <li>
        Custom: players take turns claiming territories one at a time, then take
        turns placing their starting troops. If there aren&apos;t enough
        territories for everyone, players who never get one are eliminated.
      </li>
    </ul>
  </>
);

const FORTIFICATION_HELP = (
  <>
    Which territories troops can be moved between during the fortify phase.
    <ul className="mb-0 ps-3">
      <li>
        Connected: any two of your territories joined by a path of territories
        you own.
      </li>
      <li>Neighboring: only territories directly adjacent to each other.</li>
      <li>
        Unrestricted: any two of your territories, regardless of adjacency.
      </li>
    </ul>
  </>
);

const TURN_DURATION_HELP =
  "How long each player's turn can last. If time runs out, the game finishes it for them: leftover troops are dropped on random territories, any pending move is resolved automatically, and the turn ends.";

const PASSWORD_HELP =
  'If set, players must enter this password to join. Players already in the game are unaffected by changing it, and it is never sent to any client.';

const VISIBILITY_HELP = (
  <>
    Whether this game is listed in the home page.
    <ul className="mb-0 ps-3">
      <li>Public: shown in the home page&apos;s game list.</li>
      <li>
        Private: hidden from the home page&apos;s game list; still joinable by
        anyone with a direct link.
      </li>
    </ul>
  </>
);

interface Props {
  game: GameState;
  isHost: boolean;
  mapNames: string[];
  applySettings: (settings: GameSettingsInput) => void;
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} sec`;
}

function SettingsPanel({ game, isHost, mapNames, applySettings }: Props) {
  const [passwordInput, setPasswordInput] = useState('');

  return (
    <div style={{ maxWidth: 400 }}>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
        <Form.Label className="mb-0 d-flex align-items-center gap-1">
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
            <option value="5-Turn">5-Turn</option>
            <option value="10-Turn">10-Turn</option>
            <option value="Assassin">Assassin</option>
            <option value="Mission">Mission</option>
          </Form.Select>
        ) : (
          <span>{game.gameMode}</span>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
        <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

      <details className="mb-3">
        <summary>Settings</summary>
        <div className="mt-2">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0 d-flex align-items-center gap-1">
              Password
              <Help>{PASSWORD_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  type="text"
                  className="w-auto"
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
        </div>
      </details>
    </div>
  );
}

export default SettingsPanel;
