import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Help from '../common/Help';
import type {
  Blitz,
  Bounties,
  CardsMode,
  DefenceDice,
  Entrenchment,
  Fortification,
  GameMode,
  GameSettingsInput,
  GameState,
  Placement,
  Portals,
  Starvation,
  TurnDuration,
  TurnTroops,
  Visibility,
} from '../lib/types';

const TURN_DURATIONS: TurnDuration[] = [60, 90, 120, 150, 180, 300];

const LABEL_STYLE = { minWidth: 130, flexShrink: 0 };

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

const PORTALS_HELP = (
  <>
    Whether the map has portals: pairs of territories linked as if they were
    neighbors, letting attacks and troop movements pass between any two
    territories that have one, no matter how far apart they are.
    <ul className="mb-0 ps-3">
      <li>Off: no portals.</li>
      <li>
        Static: a fixed number of portals (no two on adjacent territories) is
        placed at random when the game starts and never changes.
      </li>
      <li>
        Dynamic: the same number of portals is placed at the start, but they
        alternate every other round between active and disabled, moving to new
        random territories each time they go disabled.
      </li>
    </ul>
  </>
);

const STARVATION_HELP = (
  <>
    Whether players are penalized for stacking too many troops on one territory.
    Either way, a territory&apos;s troops are never removed below 1.
    <ul className="mb-0 ps-3">
      <li>Off: no penalty.</li>
      <li>
        Territory: each territory is capped at 30 troops (shown in the players
        panel). At the end of each player&apos;s turn, any territory over the
        cap has its excess troops removed.
      </li>
      <li>
        Total: each player&apos;s total troops across all territories are capped
        at 3 times the map&apos;s territory count (shown in the players panel).
        At the end of each player&apos;s turn, troops over the cap are removed
        one at a time from whichever territory currently has the most.
      </li>
      <li>
        Percent: at the end of each player&apos;s turn, their largest army (the
        territory with the most troops) loses 30% of its troops.
      </li>
    </ul>
  </>
);

const ENTRENCHMENT_HELP = (
  <>
    Adds an extra phase after fortifying where you can spend troops straight off
    a territory to entrench it: 1 troop buys 1 turn of entrenchment, and an
    entrenched territory always defends with 3 dice. Entrenchment decreases by 1
    at the start of your next turn, and is lost if the territory is conquered.
    Capitals can&apos;t be entrenched.
    <ul className="mb-0 ps-3">
      <li>Off: no entrench phase.</li>
      <li>
        On: only available when Defence Dice is 2 (otherwise entrenchment would
        be redundant, since defenders already always roll 3).
      </li>
    </ul>
  </>
);

const TURN_TROOPS_HELP = (
  <>
    Whether players get extra troops each turn on top of the normal deploy pool.
    <ul className="mb-0 ps-3">
      <li>Off: no extra troops.</li>
      <li>
        On: at the start of each turn, the player gets extra troops equal to the
        current turn number (1 on turn 1, 2 on turn 2, and so on).
      </li>
    </ul>
  </>
);

const BOUNTIES_HELP = (
  <>
    Whether eliminating another player pays off in troops.
    <ul className="mb-0 ps-3">
      <li>Off: no bounty.</li>
      <li>
        On: each player you&apos;ve eliminated is worth a permanent +10 troops
        at the start of every one of your turns from then on.
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

const DEFAULT_SETTINGS: Omit<GameSettingsInput, 'mapName'> = {
  gameMode: 'Supremacy',
  blitz: 'Balanced',
  defenceDice: 2,
  cards: 'Constant',
  placement: 'Random',
  fortification: 'Connected',
  entrenchment: 'off',
  portals: 'off',
  starvation: 'off',
  turnTroops: 'off',
  bounties: 'off',
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
              <option value="5-Turn">5-Turn</option>
              <option value="10-Turn">10-Turn</option>
              <option value="Assassin">Assassin</option>
              <option value="Mission">Mission</option>
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

      <details className="mb-3">
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
              Entrenchment
              <Help>{ENTRENCHMENT_HELP}</Help>
            </Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.entrenchment}
                disabled={game.defenceDice !== 2}
                onChange={(e) =>
                  applySettings({
                    entrenchment: e.target.value as Entrenchment,
                  })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </Form.Select>
            ) : (
              <span>{game.entrenchment === 'on' ? 'On' : 'Off'}</span>
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
