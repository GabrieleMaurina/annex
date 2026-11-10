import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Deploy() {
  return (
    <>
      <WikiSection id="income" title="Your income">
        <p>
          At the start of each turn you receive new troops to place. The total
          adds up from these parts:
        </p>
        <WikiTable
          head={['Part', 'Amount', 'Setting']}
          rows={[
            [
              'Territories',
              'One troop per three territories, rounded down, but never below 3',
              <WikiLink key="a" to="settings/reinforcements#territory-income">
                Troops per Territory, Min Troops
              </WikiLink>,
            ],
            [
              'Continents',
              'The bonus of every continent you hold',
              <WikiLink key="a" to="rules/continents" />,
            ],
            [
              'Card sets',
              'Added when you play a set',
              <WikiLink key="a" to="rules/cards" />,
            ],
            [
              'Capitals',
              '2 per capital you hold, in Capitals mode',
              <WikiLink key="a" to="modes/capitals" />,
            ],
            [
              'Turn order',
              'In round 1 only, a small bonus for players who move late, none for the first three. With Custom placement it joins your starting troops instead, and in Capitals mode it goes on your first capital',
              <WikiLink key="a" to="rules/turns" />,
            ],
            [
              'Round troops',
              'The current round number, if switched on',
              <WikiLink key="a" to="settings/reinforcements#round-troops">
                Round Troops
              </WikiLink>,
            ],
            [
              'Bounties',
              '10 per player you eliminated, every turn, if switched on',
              <WikiLink key="a" to="settings/reinforcements#bounties">
                Bounties
              </WikiLink>,
            ],
          ]}
        />
        <p>
          Defaults are shown. Most amounts are settings the host can change.
        </p>
      </WikiSection>
      <WikiSection id="placing" title="Placing troops">
        <p>
          Click a territory you own and choose how many troops to put there, or
          right-click to put everything on it. You must place all your troops
          before the phase ends. If time runs out, the rest are dropped on
          random territories.
        </p>
        <p>Troop inputs above 100 can switch to percentages with the % key.</p>
      </WikiSection>
      <WikiSection id="supply" title="Supply lines">
        <p>
          With supply lines on, you may only place troops on territories
          connected through your own land to a supply hub. Your capitals are
          your hubs. Without one, the hub is the biggest stack in your strongest
          connected group of territories. The bonus troops a card set drops on
          its territories ignore this (
          <WikiLink to="settings/reinforcements#supply-lines" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="extras" title="Other things to do while deploying">
        <ul>
          <li>
            Play a card set for more troops (<WikiLink to="rules/cards" />
            ).
          </li>
          <li>
            Buy ships at the coast (<WikiLink to="advanced/navy" />
            ).
          </li>
          <li>
            Build nukes (<WikiLink to="settings/hazards#nukes" />
            ).
          </li>
        </ul>
        <Callout kind="note">
          If you hold a set you can still play, the phase waits for you instead
          of moving on once your troops are placed.
        </Callout>
      </WikiSection>
      <SeeAlso
        pages={['rules/attack', 'settings/reinforcements', 'rules/continents']}
      />
    </>
  );
}

export default Deploy;
