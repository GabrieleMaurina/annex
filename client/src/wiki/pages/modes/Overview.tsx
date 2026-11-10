import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Overview() {
  return (
    <>
      <WikiSection id="how" title="How modes work">
        <p>
          The host picks the game mode in the lobby. It sets the main way to
          win. In every mode except Player Kills and Troop Kills, if all other
          players are eliminated or have surrendered, the last one standing (or
          the last team) wins immediately. Hover the help icon next to Game Mode
          in the lobby for the same list as below.
        </p>
      </WikiSection>
      <WikiSection id="table" title="All modes">
        <WikiTable
          head={['Mode', 'You win by', 'Page']}
          rows={[
            [
              'Supremacy',
              'Owning every territory.',
              <WikiLink key="a" to="modes/conquest" />,
            ],
            [
              'Supremacy 3/4',
              'Owning at least 3/4 of the territories.',
              <WikiLink key="a" to="modes/conquest" />,
            ],
            [
              'Supremacy 2/3',
              'Owning at least 2/3 of the territories.',
              <WikiLink key="a" to="modes/conquest" />,
            ],
            [
              'Continent',
              'Owning every territory of one chosen continent from round 4.',
              <WikiLink key="a" to="modes/conquest" />,
            ],
            [
              'Team Deathmatch',
              'Your team owning every territory.',
              <WikiLink key="a" to="modes/teams" />,
            ],
            [
              'Capitals',
              'Owning every territory, or every capital from round 4.',
              <WikiLink key="a" to="modes/capitals" />,
            ],
            [
              '5-Round, 10-Round',
              'Holding the most territories after 5 or 10 rounds.',
              <WikiLink key="a" to="modes/rounds" />,
            ],
            [
              'Assassin',
              'Eliminating your secret target.',
              <WikiLink key="a" to="modes/secret-goals" />,
            ],
            [
              'Mission',
              'Completing your secret mission.',
              <WikiLink key="a" to="modes/secret-goals" />,
            ],
            [
              'Player Kills',
              'Eliminating the most opponents.',
              <WikiLink key="a" to="modes/scoring" />,
            ],
            [
              'Troop Kills',
              'Destroying the most enemy troops.',
              <WikiLink key="a" to="modes/scoring" />,
            ],
            [
              'King of the Hill',
              'Reaching Max Points by holding hills.',
              <WikiLink key="a" to="modes/scoring" />,
            ],
            [
              'Empire',
              'Reaching Max Points from territories and continents.',
              <WikiLink key="a" to="modes/scoring" />,
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="choose" title="Choosing a mode">
        <ul>
          <li>
            <strong>Learning:</strong> Supremacy 2/3 for shorter games, or the
            default Supremacy.
          </li>
          <li>
            <strong>Short sessions:</strong> 5-Round, 10-Round or a points mode.
          </li>
          <li>
            <strong>Groups of friends:</strong> Team Deathmatch.
          </li>
          <li>
            <strong>Mind games:</strong> Assassin or Mission, with fog of war (
            <WikiLink to="advanced/fog" />
            ).
          </li>
        </ul>
        <p>
          Some settings only appear in certain modes, and some combinations are
          refused (<WikiLink to="settings/overview#conflicts" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['rules/winning', 'settings/overview', 'play/create']} />
    </>
  );
}

export default Overview;
