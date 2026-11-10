import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function FindPlayers() {
  return (
    <>
      <WikiSection id="list" title="The Players page">
        <p>
          Open <WikiLink app="/players">Players</WikiLink> from the menu. It
          lists every account with its rank icon, flag, name, rank, Elo and
          number of games, 20 per page. Click a row to open the profile (
          <WikiLink to="accounts/profiles" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="sort" title="Sorting">
        <p>
          Highest or lowest Elo, name A to Z or Z to A, most or fewest games.
          The default is highest Elo.
        </p>
      </WikiSection>
      <WikiSection id="filters" title="Filters">
        <WikiTable
          head={['Filter', 'Does']}
          rows={[
            ['Username', 'Matches names that contain the text.'],
            ['Elo', 'Keeps players between the two values, 0 to 3100.'],
            ['Games played', 'Keeps players between the two values.'],
          ]}
        />
        <p>
          A badge on the filter button counts the active filters. Clear resets
          them all.
        </p>
      </WikiSection>
      <WikiSection id="elsewhere" title="Other ways to find someone">
        <ul>
          <li>
            Add a player name to the home page filter to find games they are in
            (<WikiLink to="play/games-list" />
            ).
          </li>
          <li>
            The game history has the same player filter (
            <WikiLink to="history/games" />
            ).
          </li>
          <li>
            The friends page searches accounts to send requests (
            <WikiLink to="social/friends" />
            ).
          </li>
          <li>
            Results tables and replays link to every player&apos;s profile.
          </li>
        </ul>
      </WikiSection>
      <SeeAlso pages={['ranking/elo', 'social/friends']} />
    </>
  );
}

export default FindPlayers;
