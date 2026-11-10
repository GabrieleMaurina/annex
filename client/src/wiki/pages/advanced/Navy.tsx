import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Navy() {
  return (
    <>
      <WikiSection id="seas" title="Seas">
        <p>
          Some maps have seas: neutral areas nobody owns. They sit in the same
          network as land, so they link territories and other seas. A sea is
          drawn as a blue hexagon, or as the water area itself, with one
          triangle per fleet: the color is its owner and the number is how many
          ships they have there. There is no setting for ships: if the map has
          seas, ships exist.
        </p>
      </WikiSection>
      <WikiSection id="buy" title="Buying ships">
        <p>
          During Deploy a ship costs 3 troops. Pay from the troops you are about
          to deploy, or straight from a territory next to the sea (one troop
          always stays). The ship appears in a sea next to the paying territory.
        </p>
      </WikiSection>
      <WikiSection id="sail" title="Sailing">
        <p>
          A Sail phase follows Deploy when you own ships. Move any number of
          your ships once, from one sea to any connected sea. You may move the
          whole fleet.
        </p>
      </WikiSection>
      <WikiSection id="battle" title="Sea battles">
        <p>
          In the Attack phase, ships in a sea can fight another player&apos;s
          ships in that same sea. It uses the same dice, ties and blitz as land.
          You may commit every ship. There is no conquest, only the losses (
          <WikiLink to="rules/attack" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="cross" title="Crossing water">
        <ul>
          <li>
            You can attack a territory across a sea if the sea touches both
            territories, you have ships there and you have more than its owner.
            Only one sea counts per hop.
          </li>
          <li>
            With Connected fortification, a chain of your land may cross seas
            where you have ships, so ships also carry troops (
            <WikiLink to="rules/fortify" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="rules" title="Good to know">
        <ul>
          <li>Ships have no upkeep.</li>
          <li>
            Losing your last territory eliminates you, fleet and all. Ships
            never keep you alive.
          </li>
          <li>
            With fog of war you see seas where you have ships and the seas next
            to your land (<WikiLink to="advanced/fog" />
            ).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso pages={['maps/features', 'maps/generated', 'start/tutorials']} />
    </>
  );
}

export default Navy;
