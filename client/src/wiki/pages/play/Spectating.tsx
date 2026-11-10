import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Spectating() {
  return (
    <>
      <WikiSection id="watch" title="Watching a game">
        <p>
          Anyone can open a game that is running or full and watch from the map.
          You can chat but cannot act or send emojis. You still receive emojis
          sent to everyone.
        </p>
      </WikiSection>
      <WikiSection id="find" title="Finding something to watch">
        <ul>
          <li>Open a game from the home list.</li>
          <li>
            Press Watch on the profile of a friend or any player who is online:
            you jump into the game they are in, or to their profile if they are
            between games.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="limits" title="What spectators see">
        <ul>
          <li>
            With fog of war on, spectators see no territories until the game
            ends (<WikiLink to="advanced/fog" />
            ).
          </li>
          <li>
            In anonymous games names and flags stay hidden until the end (
            <WikiLink to="settings/players" />
            ).
          </li>
          <li>
            Hosts can require a reputation to even watch (
            <WikiLink to="settings/session#requirements" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="queue" title="Spectating for a seat">
        <p>
          In a lobby, spectators queue for open slots, and a connected spectator
          may stand in for a player who disconnects (<WikiLink to="play/join" />
          ). Eliminated and surrendered players keep watching with the full
          board visible.
        </p>
      </WikiSection>
      <WikiSection id="after" title="After the game">
        <p>
          Once it ends, everyone can watch the replay in full detail (
          <WikiLink to="history/replays" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['play/games-list', 'accounts/profiles']} />
    </>
  );
}

export default Spectating;
