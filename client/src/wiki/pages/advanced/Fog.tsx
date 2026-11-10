import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Fog() {
  return (
    <>
      <WikiSection id="vision" title="What you can see">
        <p>
          With fog of war on, you see only your own territories and the ones
          directly next to them, including neighbors through active portals and
          open links. Everything else is drawn gray and listed as ? in the
          players table. Actions entirely outside your view are not shown to
          you.
        </p>
      </WikiSection>
      <WikiSection id="shared" title="Shared vision">
        <ul>
          <li>
            Allies see what each other sees, and their stats stay visible to you
            (<WikiLink to="advanced/alliances" />
            ).
          </li>
          <li>
            Teammates in Team Deathmatch share vision automatically (
            <WikiLink to="modes/teams" />
            ).
          </li>
          <li>
            Ships count as ownership of a sea, so you see seas where you have
            ships and the seas touching your land.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="timing" title="When it starts">
        <p>
          Everyone sees the whole map while territories are handed out. The fog
          begins once capitals are placed, or when turns begin. With Single
          placement it applies to the picks too, and picks are blind (
          <WikiLink to="rules/setup" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="exceptions" title="Who is not affected">
        <ul>
          <li>Spectators see no territories at all until the game ends.</li>
          <li>
            Eliminated and surrendered players see the board as if fog were off.
          </li>
          <li>
            Replays always show everything, and chat and emoji are not filtered.
          </li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['settings/players', 'start/tutorials', 'play/spectating']}
      />
    </>
  );
}

export default Fog;
