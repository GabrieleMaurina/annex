import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Continents() {
  return (
    <>
      <WikiSection id="holding" title="Holding a continent">
        <p>
          The map groups territories into continents, each with a bonus. At the
          start of your turn you collect the bonus of every continent you hold.
          You hold a continent when you own more than half of its territories
          and no other player owns any of the rest.
        </p>
        <Callout kind="note">
          Unowned or empty territories do not stop you, so a continent can be
          held while some of it is still neutral. Toxined and radiated
          territories are ignored the same way.
        </Callout>
      </WikiSection>
      <WikiSection id="panel" title="The bonuses panel">
        <p>
          Press B to see every continent, its value and who holds it. Continents
          are also outlined on the map around their territories. With Continents
          set to Off the panel is hidden and nothing is paid.
        </p>
      </WikiSection>
      <WikiSection id="values" title="Bonus values">
        <p>
          The map defines a base bonus per continent, and the host can scale it
          (2x, 3x, 5x, 10x), shuffle the values between continents, randomize
          them, or make every continent worth the same and growing with each
          payout, either together or per continent. Details and numbers are in{' '}
          <WikiLink to="settings/reinforcements#continents" />.
        </p>
      </WikiSection>
      <WikiSection id="modes" title="Continents in game modes">
        <ul>
          <li>
            In Continent mode one continent is chosen for everyone to fight over
            (<WikiLink to="modes/conquest" />
            ).
          </li>
          <li>
            Empire mode adds the bonus of every continent you hold to your score
            (<WikiLink to="modes/scoring" />
            ).
          </li>
          <li>
            Mission games may ask you to hold specific continents (
            <WikiLink to="modes/secret-goals" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="tips" title="Using them">
        <p>
          Small continents with few entrances are cheap to hold. Breaking an
          opponent&apos;s continent also removes their income.
        </p>
      </WikiSection>
      <SeeAlso pages={['rules/deploy', 'maps/overview', 'strategy/basics']} />
    </>
  );
}

export default Continents;
