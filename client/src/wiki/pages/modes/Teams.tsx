import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Teams() {
  return (
    <>
      <WikiSection id="goal" title="The goal">
        <p>
          Players are split into teams. Your team wins when every territory is
          owned by its members. The rules do not stop teammates from attacking
          each other, but doing so only helps the other teams.
        </p>
      </WikiSection>
      <WikiSection id="lobby" title="Setting up teams">
        <ul>
          <li>
            In the lobby the roster is grouped by team. The host adds or removes
            teams and the slots of each one.
          </li>
          <li>
            At least two different teams must have players or the game will not
            start.
          </li>
          <li>
            Team numbers are compacted at the start, so empty teams disappear.
          </li>
          <li>
            The turn order alternates between teams, so teammates avoid playing
            back to back.
          </li>
        </ul>
        <p>
          See <WikiLink to="play/lobby" /> for the lobby controls.
        </p>
      </WikiSection>
      <WikiSection id="perks" title="Team perks">
        <ul>
          <li>Teammates share vision with fog of war on.</li>
          <li>They can send each other direct emojis.</li>
          <li>
            No formal alliances exist or can be switched on in this mode (
            <WikiLink to="advanced/alliances" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="results" title="Results and rating">
        <p>
          Teams are ranked by when they were eliminated: the last team standing
          wins and the rest follow in reverse order of elimination. Inside a
          team, survivors rank above the dead, then by players killed,
          territories, troops killed and troops gained.
        </p>
        <p>
          For Elo, teammates are not counted as opponents. A win or loss is
          measured only against players on other teams (
          <WikiLink to="ranking/elo" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['modes/conquest', 'advanced/fog', 'strategy/basics']} />
    </>
  );
}

export default Teams;
