import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function GamesList() {
  return (
    <>
      <WikiSection id="buttons" title="The home page buttons">
        <WikiTable
          head={['Button', 'Does']}
          rows={[
            [
              'Quick Play',
              'Joins an open lobby for you. Press Cancel to stop searching.',
            ],
            ['Create Online', 'Hosts a new game others can join.'],
            ['Create Offline', 'Starts a game against bots on this device.'],
            [
              'Tutorials',
              'Opens the lessons. Shown to guests and to accounts with lessons left.',
            ],
            ['Resume', 'Appears when you still hold a seat in a running game.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="quick-play" title="Quick Play">
        <p>
          Quick Play picks the public lobby with the fewest empty slots, so the
          one closest to starting, and breaks ties by age. It only considers
          lobbies without a password that you may sit in: you meet the seat
          requirements, you are not banned, and none of your block peers is
          there. If nothing fits, it keeps searching and joins as soon as
          something appears.
        </p>
      </WikiSection>
      <WikiSection id="list" title="The Open games list">
        <p>
          Every public game is listed with its name, map, mode, host, players
          and state: Lobby, Playing or Ended. The players column shows one dot
          per seat, a bot icon for each seat held by a bot, and a binoculars
          icon for each spectator. Click a row to open it. Private games are
          never listed (<WikiLink to="play/create#visibility" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="sort" title="Sorting">
        <p>
          Almost full (the default: lobbies with the fewest open slots come
          first, and among those the ones with the most players; full games and
          games already in play go last), newest, oldest, most or fewest
          players, most or fewest rounds, and name A to Z or Z to A.
        </p>
      </WikiSection>
      <WikiSection id="filters" title="Filters">
        <WikiTable
          head={['Group', 'Filters']}
          rows={[
            [
              'Match',
              'Players in the game, game name, mode, state, password, bots, player count range and rounds range.',
            ],
            [
              'Map',
              'Map kind (Generated, Library or Earth) and, for generated maps, size, type, fill, tile, shape, seas, timed links, directional links, switches, unlockable tiles, mountains and rivers.',
            ],
            ['Settings', 'Any game rule, such as blitz, cards or fog of war.'],
          ]}
        />
        <p>
          A badge counts the active filters, and Clear removes them and restores
          the default sorting. With an account, your filters are remembered
          across visits and devices.
        </p>
      </WikiSection>
      <Callout kind="note">
        If the online service cannot be reached, only Create Offline is shown,
        so you can still play (<WikiLink to="play/offline" />
        ).
      </Callout>
      <SeeAlso pages={['play/join', 'play/create', 'history/games']} />
    </>
  );
}

export default GamesList;
