import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Basics() {
  return (
    <>
      <WikiSection id="troops" title="Troops">
        <ul>
          <li>
            Concentrate. More troops mean more dice and fewer losses in every
            exchange, and a big stack can finish a blitz (
            <WikiLink to="rules/attack" />
            ).
          </li>
          <li>
            Deploy where enemies are, not in safe interiors. A territory with no
            hostile neighbor does nothing for you.
          </li>
          <li>
            Fortify last: use the end of your turn to move spare troops from the
            back to the front (<WikiLink to="rules/fortify" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="map" title="Reading the map">
        <ul>
          <li>
            Count borders, not territories. A continent with few entrances is
            cheap to hold (<WikiLink to="rules/continents" />
            ).
          </li>
          <li>Break rivals&apos; continents. It cuts their income.</li>
          <li>
            Look for chokepoints, links, portals and seas that open attacks from
            unexpected places (<WikiLink to="maps/features" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="cards" title="Cards">
        <ul>
          <li>
            Attack every turn you can. One conquest from a player is one card (
            <WikiLink to="rules/cards" />
            ).
          </li>
          <li>
            Eliminating a player gives you their hand. Aim at the ones with many
            cards.
          </li>
          <li>
            In rising card modes, sets get bigger. Do not hold five cards, since
            you must then cash in.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="people" title="People">
        <ul>
          <li>
            Do not feed the leader. If one player pulls ahead, the others do
            best when they hurt that player.
          </li>
          <li>
            Revenge is expensive. Pick the weakest neighbor, not the one who
            annoyed you.
          </li>
          <li>
            With alliances on, use the shared vision, and remember that a
            partner can still attack you (<WikiLink to="advanced/alliances" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="modes" title="By mode">
        <ul>
          <li>
            <strong>Capitals:</strong> a well defended capital beats a big army.
            Place it away from rivals (<WikiLink to="modes/capitals" />
            ).
          </li>
          <li>
            <strong>Points modes:</strong> every turn counts, so hold hills or
            territory early (<WikiLink to="modes/scoring" />
            ).
          </li>
          <li>
            <strong>Fog of war:</strong> scouting is value. Keep a wide border
            so you see more (<WikiLink to="advanced/fog" />
            ).
          </li>
        </ul>
      </WikiSection>
      <Callout kind="tip">
        Watch your own replay after a loss. It shows exactly the turn that
        decided the game (<WikiLink to="history/replays" />
        ).
      </Callout>
      <SeeAlso
        pages={['start/tutorials', 'bots/personalities', 'ranking/elo']}
      />
    </>
  );
}

export default Basics;
