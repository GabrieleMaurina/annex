import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Features() {
  return (
    <>
      <WikiSection id="continents" title="Continents and bonuses">
        <p>
          Every land territory belongs to a continent, and each continent has a
          bonus. The host can scale or reshuffle the bonuses (
          <WikiLink to="rules/continents" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="seas" title="Seas">
        <p>
          Neutral hexagons or water areas that hold ships. They are linked to
          land and each other (<WikiLink to="advanced/navy" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="timed" title="Timed links">
        <p>
          A link across water or void that is open or closed depending on the
          round. It is marked with an hourglass and the number of rounds until
          it changes. While open it works like a normal border for attacks,
          fortifying, vision and supply lines. While closed it does not exist,
          and its arrows stand still.
        </p>
      </WikiSection>
      <WikiSection id="directional" title="Directional links">
        <p>
          A one-way link. Moving arrows show the way you can attack, move and
          see. Some flip direction every few rounds, marked with an hourglass,
          while others never change. Maps keep every territory reachable by some
          route.
        </p>
      </WikiSection>
      <WikiSection id="switches" title="Switches">
        <p>
          A switch sits on the border between territories and is on or off.
          During your attack phase a territory next to it can flip it for 2
          troops, leaving at least 1 behind. A switched link ignores its
          schedule: a timed link is open while on, a directional link points one
          way while on and the other while off. Some links have two switches
          that act as OR (either on) or AND (both on). Hover or tap a switch to
          see what it controls.
        </p>
      </WikiSection>
      <WikiSection id="unlockable" title="Unlockable tiles">
        <p>
          Tile maps can remove all links across the void and instead leave the
          empty slots between tiles as locked tiles, marked with a dot. In your
          attack phase a territory next to one can unlock it for 5 troops with
          Constant or Off cards, or 25% of the next card set value otherwise,
          paid from that territory, which keeps at least 1. The tile becomes an
          empty territory you can move into at once or take later. Unlocking
          never earns a card.
        </p>
      </WikiSection>
      <WikiSection id="wraps" title="Wraps">
        <p>
          A link can wrap around the edge of the map. This only changes how the
          link is drawn. Adjacency is unchanged.
        </p>
      </WikiSection>
      <WikiSection id="terrain" title="Mountains, rivers and green areas">
        <p>
          Decorative gaps between territories. Mountains, rivers and green areas
          are not territories, and rivers separate the territories on their two
          sides.
        </p>
      </WikiSection>
      <WikiSection id="names" title="Names">
        <p>
          Maps may name territories, seas and continents. Names are unique
          across the map, up to 30 characters, and unnamed places show their
          number. They are display only.
        </p>
      </WikiSection>
      <SeeAlso pages={['maps/editor', 'maps/generated', 'settings/hazards']} />
    </>
  );
}

export default Features;
