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
              "Click another player's row, then pick one of ten emojis.",
            ],
          ]}
        />
        <p>
          Bot details are in <WikiLink to="bots/difficulty" /> and{' '}
          <WikiLink to="bots/personalities" />.
        </p>
      </WikiSection>
      <WikiSection id="ready" title="Getting ready">
        <p>
          In online games every player except the host confirms with the Ready
          button on their own row. Everyone sees who is ready. The host does not
          need to, and spectators and bots have no button. Click Ready again to
          take it back.
        </p>
        <ul>
          <li>
            When the host changes a setting, the map or the bots, every player
            becomes not ready again and has to confirm the new game.
          </li>
          <li>
            When the host presses Start, players who are not ready become
            spectators and a bot takes their seat.
          </li>
          <li>
            If nobody else is ready, the game becomes an offline game against
            bots and all spectators are removed from the lobby.
          </li>
          <li>
            Leaving the lobby clears your ready state. If you take over as host
            and the original host returns, you are ready again if you were
            before.
          </li>
        </ul>
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
