import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Tutorials() {
  return (
    <>
      <WikiSection id="lessons" title="The eleven lessons">
        <p>
          Each lesson starts mid-turn on a tiny map with one task. Attacks
          always win and there is no turn timer, so you can take your time. Play
          them in any order.
        </p>
        <WikiTable
          head={['Lesson', 'You learn', 'Read more']}
          rows={[
            [
              'Deploying troops',
              'Reinforce your territories at the start of your turn.',
              <WikiLink key="a" to="rules/deploy" />,
            ],
            [
              'Conquering a territory',
              'Attack an enemy territory and take it over.',
              <WikiLink key="a" to="rules/attack" />,
            ],
            [
              'Fortifying troops',
              'Move troops between your own territories to end your turn.',
              <WikiLink key="a" to="rules/fortify" />,
            ],
            [
              'Playing a set',
              'Trade three cards for extra troops.',
              <WikiLink key="a" to="rules/cards" />,
            ],
            [
              'Taking a bonus',
              'Complete a continent to earn extra troops every turn.',
              <WikiLink key="a" to="rules/continents" />,
            ],
            [
              'Eliminating a player',
              'Knock a rival out and take their cards.',
              <WikiLink key="a" to="rules/winning" />,
            ],
            [
              'Placing a capital',
              'Choose the territory that will be your capital.',
              <WikiLink key="a" to="modes/capitals" />,
            ],
            [
              'Conquering a capital',
              'Capture an enemy capital.',
              <WikiLink key="a" to="modes/capitals" />,
            ],
            [
              'Fog of war',
              'Push through the fog to find a weak enemy capital.',
              <WikiLink key="a" to="advanced/fog" />,
            ],
            [
              'Naval combat',
              'Buy ships, win a sea battle and invade an island.',
              <WikiLink key="a" to="advanced/navy" />,
            ],
            [
              'Special links',
              'Cross the water with one-way, switched and timed links.',
              <WikiLink key="a" to="maps/features" />,
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="progress" title="Progress and rewards">
        <p>
          With an account, finished lessons are remembered and the page offers
          to continue where you stopped. Guests keep their progress in the
          browser only. Completing all eleven earns the Nerd achievement (
          <WikiLink to="accounts/achievements" />
          ).
        </p>
        <p>
          Tutorials are not rated and never touch your Elo or reputation. New
          players are offered the tutorials before their first game.
        </p>
      </WikiSection>
      <SeeAlso pages={['start/first-game', 'start/glossary']} />
    </>
  );
}

export default Tutorials;
