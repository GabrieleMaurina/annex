import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Reinforcements() {
  return (
    <>
      <WikiSection
        id="territory-income"
        title="Troops per Territory and Min Troops"
      >
        <ul>
          <li>
            <strong>Troops per Territory:</strong> troops each territory you own
            gives at the start of your turn, rounded down. Choose 1/5, 1/4, 1/3
            (default), 1/2, or a whole number up to 100. With 1/3 you get 1
            troop for every 3 territories, with 2 you get 2 per territory.
          </li>
          <li>
            <strong>Min Troops:</strong> the fewest troops your territories give
            you, however few you own. 0 to 100, default 3. Other bonuses are
            added on top.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="continents" title="Continents">
        <p>
          How much holding a continent pays each turn. You hold one when you own
          more than half of it and no rival owns any of the rest (
          <WikiLink to="rules/continents" />
          ).
        </p>
        <WikiTable
          head={['Value', 'Effect']}
          rows={[
            ['1x (default)', 'The bonus set by the map.'],
            ['2x, 3x, 5x, 10x', 'The map bonus multiplied.'],
            [
              'Shuffle',
              'The map bonuses are shuffled among continents at the start.',
            ],
            [
              'Random',
              'Each continent gets a random bonus from 1 to 10 at the start.',
            ],
            [
              'Linear',
              'All continents are worth the same, starting at 1. Every bonus paid, to anyone, raises all of them by 1.',
            ],
            [
              'Exponential',
              'All continents are worth the same, starting at 3. Every bonus paid multiplies all of them by 1.1, rounded.',
            ],
            [
              'Linear or Exponential per Continent',
              'Same curves, but a continent only grows when it pays out itself.',
            ],
            ['Off', 'No bonuses, and the bonuses panel is hidden.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="cards" title="Cards">
        <p>
          How much a set of three cards is worth (<WikiLink to="rules/cards" />
          ).
        </p>
        <WikiTable
          head={['Value', 'Effect']}
          rows={[
            [
              'Constant (default)',
              '4 for three Soldiers, 6 for Humvees, 8 for Tanks, 10 for a mixed set.',
            ],
            [
              'Linear',
              '4, 6, 8, 10, 12, 15, 20, 25, 30, then +5. Every set played by anyone raises the next one for everyone.',
            ],
            [
              'Exponential',
              'Starts at 5, then grows by 30 percent, rounded up, after every set.',
            ],
            [
              'Linear or Exponential per Player',
              'Each player has their own progression.',
            ],
            ['Off', 'No cards are earned and the panel is hidden.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="round-troops" title="Round Troops">
        <p>
          When on, you receive extra troops at the start of each turn equal to
          the round number: 1 in round 1, 2 in round 2, and so on. It speeds up
          long games.
        </p>
      </WikiSection>
      <WikiSection id="bounties" title="Bounties">
        <p>
          When on, each player you eliminate is worth a permanent +10 troops at
          the start of every one of your turns from then on.
        </p>
      </WikiSection>
      <WikiSection id="supply-lines" title="Supply Lines">
        <p>
          When on, you can only place troops on territories connected through
          your own territories to a supply hub. Capitals are your hubs. Without
          one, the hub is the biggest stack in your strongest connected group of
          territories. Troops dropped by a card set ignore this.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['rules/deploy', 'settings/combat', 'settings/hazards']}
      />
    </>
  );
}

export default Reinforcements;
