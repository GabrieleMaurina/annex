import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Setup() {
  return (
    <>
      <WikiSection id="placement" title="Placement">
        <p>
          Random, Semi, Custom or Single decides how territories and starting
          troops are handed out. Each value is explained in{' '}
          <WikiLink to="rules/setup#placement" />.
        </p>
      </WikiSection>
      <WikiSection id="initial-troops" title="Initial Troops">
        <p>
          Average starting troops per territory, 1 to 100 (3 by default). Each
          player gets this many for every territory they own, at least 1 on
          each. With Single placement it is the troops on your one territory.
        </p>
      </WikiSection>
      <WikiSection id="fortification" title="Fortification">
        <p>
          Connected, Neighboring or Unrestricted decides which pairs of
          territories qualify. See <WikiLink to="rules/fortify#reach" />.
        </p>
      </WikiSection>
      <WikiSection id="capitals" title="Capitals settings">
        <p>
          Only in Capitals mode (<WikiLink to="modes/capitals" />
          ).
        </p>
        <ul>
          <li>
            <strong>Starting Capitals:</strong> how many capitals each player
            places, 1 to 10. Each gets 3 extra troops.
          </li>
          <li>
            <strong>Capital Refund:</strong> when on, conquering an enemy
            capital gives back the troops it held at the start of your turn, put
            onto the capital.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="points" title="Points settings">
        <p>
          Only in King of the Hill and Empire (<WikiLink to="modes/scoring" />
          ).
        </p>
        <ul>
          <li>
            <strong>Max Points:</strong> points needed to win. Defaults to 20 in
            King of the Hill and 500 in Empire.
          </li>
          <li>
            <strong>Hills:</strong> how many random territories are hills in
            King of the Hill, 1 to 20 (3 by default).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['settings/overview', 'settings/combat', 'rules/setup']}
      />
    </>
  );
}

export default Setup;
