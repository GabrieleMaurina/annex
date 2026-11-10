import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Conquest() {
  return (
    <>
      <WikiSection id="supremacy" title="Supremacy and its variants">
        <p>
          The classic goal: conquer the map. The game ends the moment one player
          meets the target.
        </p>
        <WikiTable
          head={['Mode', 'Target']}
          rows={[
            ['Supremacy', 'Every territory on the map.'],
            [
              'Supremacy 3/4',
              'At least three quarters of the territories, rounded up.',
            ],
            [
              'Supremacy 2/3',
              'At least two thirds of the territories, rounded up.',
            ],
          ]}
        />
        <p>
          The quicker variants end games sooner and make a runaway leader
          decisive. Territory counts exclude radiated and permanently toxined
          territories (<WikiLink to="settings/hazards" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="continent" title="Continent">
        <p>
          The game picks one continent for everyone to fight over: one with at
          least 7 territories if the map has any, otherwise its largest. Own
          every territory of it, ignoring any that are currently toxined or
          radiated, from round 4 onward, and you win.
        </p>
        <p>
          Everyone knows the target from the start, so the fight concentrates
          there. Holding it also pays the usual continent bonus (
          <WikiLink to="rules/continents" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="all" title="In all conquest modes">
        <ul>
          <li>
            Surrender or elimination of everyone else wins at once, whatever the
            target.
          </li>
          <li>
            Stalemate rules end an endless game in a draw (
            <WikiLink to="settings/stalemate" />
            ).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso pages={['modes/overview', 'modes/teams', 'modes/capitals']} />
    </>
  );
}

export default Conquest;
