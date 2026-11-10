import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Elo() {
  return (
    <>
      <WikiSection id="what" title="What Elo is">
        <p>
          Elo measures how well you play. A new account starts at 0 and the
          rating stays between 0 and 3100. It changes after every rated game and
          sets your rank. It says nothing about conduct, which is{' '}
          <WikiLink to="ranking/reputation" />.
        </p>
      </WikiSection>
      <WikiSection id="who" title="Which games count">
        <ul>
          <li>
            Every account that held a seat when the host pressed Start is rated,
            whatever it does afterward. Leaving, surrendering or being
            eliminated still counts.
          </li>
          <li>
            Guests, bots, spectators and anyone who left in the lobby are
            ignored.
          </li>
          <li>
            At least two rated accounts are needed, and in Team Deathmatch on
            different teams. Otherwise nothing changes.
          </li>
          <li>
            A game abandoned early still counts if it started, even in round 1.
            An agreed abort does not (<WikiLink to="settings/stalemate#abort" />
            ).
          </li>
          <li>Offline games and tutorials never change Elo.</li>
        </ul>
      </WikiSection>
      <WikiSection id="how" title="How it changes">
        <p>
          The final ranking is read as a set of duels. You beat everyone who
          finished below you and lose to everyone above. As in standard Elo,
          beating a higher rated player earns more, and losing to a lower rated
          one costs more. Your change is the average over all your opponents.
        </p>
        <ul>
          <li>
            <strong>Draws:</strong> players in the draw score half a point
            against each other and still beat everyone outside it.
          </li>
          <li>
            <strong>Teams:</strong> teammates do not duel each other.
          </li>
          <li>
            <strong>Low ratings:</strong> losses are softened for lower rated
            players, so beginners fall slowly. Gains are never reduced.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="penalties" title="Abandon penalties">
        <p>
          On top of the normal change, abandoning costs a flat amount, never
          scaled down. Two cannot stack.
        </p>
        <WikiTable
          head={['Abandon', 'Elo penalty']}
          rows={[
            [
              'Disconnected: auto-surrendered, still disconnected at the end, or eliminated while away after your own turn began',
              '8',
            ],
            ['Surrender during setup or round 1', '8'],
            ['Surrender in round 2', '6'],
            ['Surrender in round 3', '4'],
            ['Surrender in round 4', '2'],
            ['Surrender in round 5 or later', '0'],
          ]}
        />
        <p>
          Abandoning also costs reputation. A short refresh that ends before
          your turn does not count as a disconnect.
        </p>
      </WikiSection>
      <WikiSection id="ranks" title="Ranks">
        <WikiTable
          head={['Rank', 'From Elo']}
          rows={[
            ['Private', '0'],
            ['Specialist', '400'],
            ['Corporal', '600'],
            ['Sergeant', '800'],
            ['Lieutenant', '1000'],
            ['Captain', '1200'],
            ['Major', '1400'],
            ['Commander', '1600'],
            ['Colonel', '1800'],
            ['Brigadier', '2000'],
            ['Commodore', '2300'],
            ['Admiral', '2600'],
            ['General', '3000'],
          ]}
        />
        <p>
          The rank icon shows next to your flag, but only after a game ends, so
          nobody is judged on their rank during play. Hosts can require a
          minimum rank to sit (<WikiLink to="settings/session#requirements" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="where" title="Where you see it">
        <ul>
          <li>
            Your profile shows rank, Elo and percentile, the share of accounts
            you beat (<WikiLink to="accounts/profiles" />
            ).
          </li>
          <li>
            The results table shows each player&apos;s Elo and what the game
            changed (<WikiLink to="history/results" />
            ).
          </li>
          <li>The player list can sort and filter by Elo.</li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['play/leaving', 'ranking/reputation', 'strategy/basics']}
      />
    </>
  );
}

export default Elo;
