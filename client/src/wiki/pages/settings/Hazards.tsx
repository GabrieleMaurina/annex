import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Hazards() {
  return (
    <>
      <p>Hazards change the map as the game goes on. All are off by default.</p>
      <WikiSection id="portals" title="Portals">
        <p>
          Portals link territories as if they were neighbors: every portal is
          connected to every other portal, so attacks and troop moves can pass
          between them however far apart they are. There are at most 6, never on
          adjacent territories or in the same continent.
        </p>
        <WikiTable
          head={['Value', 'Effect']}
          rows={[
            ['Static', 'Placed once at the start and never move.'],
            [
              'Dynamic',
              'Alternate every other round between active and disabled. They move to new random territories each time they are disabled.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="radiation" title="Radiations">
        <p>
          Radiated territories have no owner and no troops and nobody can
          attack, fortify or select them. They are placed before territories are
          dealt, so nobody starts on one. Troops caught by radiation are
          destroyed, and losing your last territory this way eliminates you.
          Radiation never reaches a capital or a territory whose loss would
          split the map.
        </p>
        <WikiTable
          head={['Value', 'Effect']}
          rows={[
            [
              'Static',
              '1 territory per 10 on the map, at most 8, fixed for the whole game.',
            ],
            [
              'Dynamic',
              '1 territory per 12 on the map, at most 6. Every 2 rounds each moves to a neighbor. The move is shown a round ahead.',
            ],
            [
              'Expanding',
              'One territory at the start. Every 2 rounds it permanently swallows one more neighbor, shown a round ahead. It never swallows a hill.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="nukes" title="Nukes">
        <p>
          Players can build nukes and anti-nukes in the Deploy phase by spending
          deploy troops on construction instead of placing them.
        </p>
        <WikiTable
          head={['Device', 'Cost', 'Use']}
          rows={[
            [
              'Nuke',
              '5 troops per turn for 5 turns',
              'Launched in the Attack phase at any territory that is not yours. Removes its owner and troops. A capital marker stays.',
            ],
            [
              'Anti-nuke',
              '3 troops per turn for 5 turns',
              'Placed on one of your territories. It intercepts the first nuke aimed at anything it is connected to. It stays with the territory if captured.',
            ],
          ]}
        />
        <p>
          Construction is advanced by hand each turn and can be paused, but
          never rushed. Finished devices wait in a private arsenal, shown in the
          Nukes panel (N).
        </p>
      </WikiSection>
      <WikiSection id="toxins" title="Toxins">
        <p>
          Adds a phase after fortifying where you spend troops from a territory
          you own to release a toxin on it. It loses its owner and every troop,
          and nobody can enter it until the toxin clears. A toxin is refused if
          it would split the map, and capitals cannot be toxined.
        </p>
        <WikiTable
          head={['Value', 'Cost', 'Duration']}
          rows={[
            [
              'Temporary',
              '5 troops with Constant or Off cards, otherwise 25% of the next card set value',
              '3 rounds. After that anyone can take the territory with no dice. That never earns a card.',
            ],
            [
              'Permanent',
              '10 troops with Constant or Off cards, otherwise 50% of the next card set value',
              'The rest of the game. Never on a hill.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="starvation" title="Starvation">
        <p>
          Punishes giant stacks. A territory is never reduced below 1 troop.
        </p>
        <WikiTable
          head={['Value', 'Effect at the end of each turn']}
          rows={[
            ['Territory', 'Any territory above 30 troops loses the excess.'],
            [
              'Total',
              'Your total troops are capped at 3 times the number of territories on the map. Excess is removed from the biggest stack, one troop at a time.',
            ],
            ['Percent', 'Your biggest army loses 30% of its troops.'],
          ]}
        />
      </WikiSection>
      <Callout kind="note">
        Hazards are drawn on the map. Radiation moves and growth are shown one
        round in advance.
      </Callout>
      <SeeAlso pages={['maps/features', 'settings/combat', 'modes/scoring']} />
    </>
  );
}

export default Hazards;
