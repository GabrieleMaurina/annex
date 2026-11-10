import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Games() {
  return (
    <>
      <WikiSection id="page" title="The Games page">
        <p>
          Open <WikiLink app="/games/replay">Games</WikiLink> from the menu. It
          lists every finished online game, 20 per page. Click a row to open its
          results and replay (<WikiLink to="history/replays" />
          ). Aborted games and offline games are never saved.
        </p>
        <WikiTable
          head={['Column', 'Shows']}
          rows={[
            ['Date, Time', 'When the game ended.'],
            ['Game, Map, Mode', 'Its name, map and game mode.'],
            [
              'Players',
              'Everyone who took part, colored, with a bot icon on bots.',
            ],
            ['Winner', 'The winner or winners, or Draw.'],
            ['Rounds', 'How many rounds were played.'],
            ['Position', 'Your finishing place when you took part.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="sort" title="Sorting">
        <p>
          Newest, oldest, most or fewest rounds. Accounts can also sort by best
          or worst position. A switch limits the list to My games only.
        </p>
      </WikiSection>
      <WikiSection id="filters" title="Filters">
        <WikiTable
          head={['Filter', 'Does']}
          rows={[
            ['Players', 'Keeps games that include the chosen players.'],
            [
              'Name, Mode, Bots',
              'By game name, game mode and whether bots took part.',
            ],
            ['Started, Ended, Duration', 'By date range and minutes played.'],
            ['Player count, Rounds', 'By ranges.'],
            [
              'Position, Result',
              'Your finishing place, and whether you won, drew or lost. Accounts only.',
            ],
            ['Map', 'The same map and generation options as the home list.'],
            ['Settings', 'Any game rule.'],
          ]}
        />
        <p>
          Filters work like on the home page (
          <WikiLink to="play/games-list#filters" />
          ). Profiles show the same table for one player (
          <WikiLink to="accounts/profiles" />
          ).
        </p>
      </WikiSection>
      <SeeAlso
        pages={['history/results', 'history/replays', 'accounts/find-players']}
      />
    </>
  );
}

export default Games;
