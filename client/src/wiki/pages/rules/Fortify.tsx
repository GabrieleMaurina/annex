import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Fortify() {
  return (
    <>
      <WikiSection id="move" title="Making a move">
        <p>
          In the Fortify phase you move troops from one of your territories to
          another one of yours. Select the start, select the destination, choose
          how many troops and confirm. The start territory always keeps at least
          one troop. You get one move, and finishing it moves you on to the next
          phase or ends your turn. You can also skip it.
        </p>
        <p>
          Right-click a destination to move everything you can. Middle-click
          moves the minimum.
        </p>
      </WikiSection>
      <WikiSection id="reach" title="How far troops can travel">
        <p>
          The Fortification setting decides which pairs of territories qualify.
        </p>
        <WikiTable
          head={['Setting', 'Allowed moves']}
          rows={[
            [
              'Connected (default)',
              'Between any two of your territories joined by a chain of your own territories.',
            ],
            ['Neighboring', 'Only between territories that touch.'],
            ['Unrestricted', 'Between any two of your territories.'],
          ]}
        />
        <p>
          Portals and open links count as touching. With Connected, a chain may
          also cross seas where you have ships (<WikiLink to="advanced/navy" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="why" title="Why fortify">
        <ul>
          <li>Pull troops from a quiet interior onto a threatened border.</li>
          <li>Build a stack for next turn&apos;s attack.</li>
          <li>
            Guard a capital or a continent you hold (
            <WikiLink to="rules/continents" />
            ).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso pages={['settings/setup', 'rules/turns', 'strategy/basics']} />
    </>
  );
}

export default Fortify;
