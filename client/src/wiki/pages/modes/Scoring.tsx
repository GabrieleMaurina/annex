import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Scoring() {
  return (
    <>
      <WikiSection id="kills" title="Player Kills and Troop Kills">
        <p>
          The game runs until only one player is left. Then the winner is not
          necessarily the survivor:
        </p>
        <ul>
          <li>
            <strong>Player Kills:</strong> whoever eliminated the most opponents
            wins.
          </li>
          <li>
            <strong>Troop Kills:</strong> whoever destroyed the most enemy
            troops wins.
          </li>
        </ul>
        <p>
          Ties go to whoever died last, so the survivor wins ties. Everyone gets
          a reason to fight, even when they cannot win the map.
        </p>
      </WikiSection>
      <WikiSection id="points" title="Points modes">
        <p>
          In King of the Hill and Empire you score at the start of each of your
          turns from round 2 on. The first to reach Max Points at the start of
          their turn wins.
        </p>
        <ul>
          <li>
            <strong>King of the Hill:</strong> a few random territories are
            hills. You score 1 point per hill you hold. Hills is 3 by default,
            from 1 to 20, and Max Points is 20.
          </li>
          <li>
            <strong>Empire:</strong> you score 1 point per territory plus the
            bonus of every continent you hold, when Continents are on. Max
            Points is 500.
          </li>
        </ul>
        <p>
          Max Points can be 20 to 100 in steps of 5, or 150 to 2000 in steps of
          50 (<WikiLink to="settings/setup#points" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="hills" title="Hill details">
        <ul>
          <li>Hills are marked on the map, so everyone knows what to take.</li>
          <li>
            A permanent toxin can never be released on a hill, and expanding
            radiation never swallows one (<WikiLink to="settings/hazards" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="results" title="Results">
        <p>
          Points appear as a column in the results table and in the replay
          charts (<WikiLink to="history/results" />
          ). Bots play for points in these modes.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['modes/overview', 'settings/setup', 'rules/continents']}
      />
    </>
  );
}

export default Scoring;
