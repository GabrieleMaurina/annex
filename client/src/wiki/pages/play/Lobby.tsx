import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Lobby() {
  return (
    <>
      <p>
        The lobby is the waiting room before a game. Everyone sees the settings,
        the roster and the spectators. Only the host can change them.
      </p>
      <WikiSection id="roster" title="The roster">
        <p>
          One row per slot: the player&apos;s color, flag, name and a Host
          badge, plus the personality and difficulty of bots. Ranks stay hidden
          until a game ends. Empty slots show Empty to guests and Add Bot to the
          host.
        </p>
        <WikiTable
          head={['Action', 'Who', 'How']}
          rows={[
            [
              'Change your color',
              'You',
              'Click your row to cycle through colors.',
            ],
            ['Add a bot', 'Host', 'Add Bot in an empty slot (see Bots).'],
            [
              'Change a bot',
              'Host',
              'Pick its difficulty and personality in the row. Random hides the choice until the game ends.',
            ],
            ['Change a bot color', 'Host', 'Click the bot row.'],
            [
              'Add or remove a slot',
              'Host',
              'The add slot button and the x on an empty row. Games have 2 to 20 slots.',
            ],
            ['Remove a bot', 'Host', 'The x on its row.'],
            [
              'Kick and ban a player',
              'Host',
              'The x on their row. A banned player cannot return until unbanned.',
            ],
            [
              'Send an emoji',
              'Players',
              "Click another player's row, then pick one of nine emojis.",
            ],
          ]}
        />
        <p>
          Bot details are in <WikiLink to="bots/difficulty" /> and{' '}
          <WikiLink to="bots/personalities" />.
        </p>
      </WikiSection>
      <WikiSection id="teams" title="Teams">
        <p>
          In Team Deathmatch the roster is grouped by team. The host adds and
          removes teams and sets how many slots each has (
          <WikiLink to="modes/teams" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="lists" title="Spectators and bans">
        <ul>
          <li>
            The Spectators list shows who is watching and waiting for a slot.
            The host can ban from it too.
          </li>
          <li>
            The Banned Players list shows who is barred. The host can unban.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="start" title="Starting and running the game">
        <ul>
          <li>
            The host presses Start (<WikiLink to="play/create#start" />
            ).
          </li>
          <li>
            During the game the host can pause and change the speed of bots in
            the players panel. Online, pause works once and ends by itself after
            60 seconds.
          </li>
          <li>
            Bot speed is not adjustable in anonymous games, so bots do not stand
            out.
          </li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['play/create', 'settings/overview', 'bots/difficulty']}
      />
    </>
  );
}

export default Lobby;
