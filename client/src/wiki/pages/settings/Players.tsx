import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Players() {
  return (
    <>
      <WikiSection id="fog" title="Fog of War">
        <p>
          When on, each player only sees their own territories and the ones next
          to them. The rest is gray, and hidden as ? in the players table.
          Spectators see no territories until the game ends (
          <WikiLink to="advanced/fog" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="alliances" title="Alliances">
        <p>
          When on, players can offer, accept and end private alliances. Allies
          can send each other direct emojis, and with fog of war share vision.
          Off by default, and not available in Team Deathmatch where teammates
          already get these benefits (<WikiLink to="advanced/alliances" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="anonymous" title="Anonymous">
        <p>
          When on, names, ranks and flags are hidden in the lobby and during the
          game. Each player is only a color, and colors are shuffled at the
          start. Everything is revealed when the game ends. Turning it on
          renames a default &quot;Game with host&quot; game to &quot;Game with
          number&quot;.
        </p>
        <ul>
          <li>Bot speed stays slow so bots do not stand out.</li>
          <li>
            Blocking is hidden until the end, but muting by a block still works
            (<WikiLink to="ranking/reports" />
            ).
          </li>
          <li>Reports stay possible against any other seat.</li>
          <li>Offline games do not show this setting.</li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['settings/session', 'bots/takeover', 'settings/overview']}
      />
    </>
  );
}

export default Players;
