import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Capitals() {
  return (
    <>
      <WikiSection id="goal" title="The goal">
        <p>
          Win by owning every territory, or by owning every capital from round 4
          onward. The second path is the point of the mode: protect yours and
          hunt the others.
        </p>
      </WikiSection>
      <WikiSection id="placing" title="Placing capitals">
        <p>
          Before the first turn each player places their capitals, one at a time
          and in turn order, until everyone has placed all of them. Each capital
          gets 3 extra troops. The number per player is Starting Capitals, from
          1 to 10 (<WikiLink to="settings/setup#capitals" />
          ). With Single placement, you pick the capital among the empty
          territories.
        </p>
      </WikiSection>
      <WikiSection id="rules" title="What makes a capital special">
        <WikiTable
          head={['Rule', 'Effect']}
          rows={[
            ['Defence', 'A capital rolls one extra defence die, up to 10.'],
            ['Entrenchment', 'Cannot be entrenched.'],
            ['Hazards', 'Cannot be toxined or radiated.'],
            [
              'Income',
              'You receive 2 extra troops every turn for each capital you hold.',
            ],
            [
              'Supply hub',
              'With supply lines on, capitals are your supply hubs.',
            ],
            [
              'Refund',
              'With Capital Refund on, taking a capital returns the troops it held at the start of your turn, added to it.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="standoff" title="Standoffs">
        <p>
          If no capital changes owner for Capital Standoff rounds (50 by
          default, 5 at least), the game ends in a draw. Warnings appear when 3,
          2 and 1 rounds remain. The count restarts whenever a capital is taken
          (<WikiLink to="settings/stalemate" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="stats" title="Stats">
        <p>
          Capitals conquered and lost are counted in the results table, and
          capitals conquered shows on your profile (
          <WikiLink to="accounts/profiles" />
          ).
        </p>
      </WikiSection>
      <SeeAlso
        pages={['start/tutorials', 'modes/overview', 'settings/setup']}
      />
    </>
  );
}

export default Capitals;
