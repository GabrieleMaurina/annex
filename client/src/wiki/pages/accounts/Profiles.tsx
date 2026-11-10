import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Profiles() {
  return (
    <>
      <p>
        Every account has a public profile. Open it from the player list, a
        results table, a replay, or by clicking a name. Guests have none.
      </p>
      <WikiSection id="header" title="The header">
        <WikiTable
          head={['Item', 'Meaning']}
          rows={[
            [
              'Picture and online dot',
              'The profile picture, with a green dot while the player is online. Nobody appears online to someone who blocked them.',
            ],
            ['Flag and username', 'Country and permanent name.'],
            ['Profile text', 'The short bio, up to 200 characters.'],
            ['Member since', 'The date the account was created.'],
            [
              'Rank, Elo, Percentile',
              'The rating and the share of other accounts it beats (see Elo).',
            ],
            [
              'Reputation',
              'The conduct score, from -100 to 100. Visible only here.',
            ],
          ]}
        />
        <p>
          Viewing another player you also get buttons to add them as a friend,
          message, report or block them, watch their live game, and share the
          page (<WikiLink to="social/friends" />,{' '}
          <WikiLink to="ranking/reports" />
          ). On your own profile you can edit the picture and text.
        </p>
      </WikiSection>
      <WikiSection id="bonus" title="New account bonus">
        <p>
          For the first 30 days your reputation counts for more when you join
          games with a reputation requirement. Your own profile shows the bonus
          while it lasts (<WikiLink to="ranking/reputation" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="stats" title="Career statistics">
        <p>Totals across every game the account played.</p>
        <WikiTable
          head={['Stat', 'Meaning']}
          rows={[
            ['Games', 'Games played that reached at least one round.'],
            ['Wins', 'Games finished first, not counting draws.'],
            ['Win rate', 'Wins divided by games.'],
            ['Average placing', 'Mean finishing position, 1 being the winner.'],
            [
              'Troops gained',
              'Troops received at the start of turns and from card sets.',
            ],
            ['Troops killed', 'Enemy troops destroyed.'],
            ['Troops lost', 'Your troops destroyed.'],
            ['Territories conquered', 'Territories taken from other players.'],
            ['Players eliminated', 'Opponents whose last territory you took.'],
            ['Capitals conquered', 'Enemy capitals captured.'],
            ['Sets played', 'Card sets traded in.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="chart" title="Stats over time">
        <p>
          A chart draws the career totals game by game. Use the buttons above it
          to switch between Elo and each statistic.
        </p>
      </WikiSection>
      <WikiSection id="achievements" title="Achievements, games and maps">
        <ul>
          <li>
            A badge grid shows every achievement, with the ones not yet earned
            greyed out (<WikiLink to="accounts/achievements" />
            ).
          </li>
          <li>
            The Games table lists that player&apos;s matches, newest first, with
            map, mode, players, winner, rounds and their finishing position.
            Click a row to open the replay (<WikiLink to="history/replays" />
            ).
          </li>
          <li>
            The Maps table lists the maps they published (
            <WikiLink to="maps/library" />
            ).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['accounts/find-players', 'ranking/elo', 'ranking/reputation']}
      />
    </>
  );
}

export default Profiles;
