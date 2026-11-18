import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Setup() {
  return (
    <>
      <WikiSection id="game-type" title="Game Type">
        <p>
          Ranked (the default) or Casual. A Casual game never changes
          anyone&apos;s Elo, abandon penalties included (
          <WikiLink to="ranking/elo" />
          ). It is marked with a Casual badge in the lobby, the games list, the
          players panel and the results. Everything else works exactly as in a
          Ranked game. The setting is hidden in offline games, and Randomize
          leaves it untouched.
        </p>
      </WikiSection>
      <WikiSection id="odds" title="Odds">
        <p>
          Off by default, and only available in Casual games (offline games are
          exempt). Odds handicap individual players so people of different skill
          can enjoy the same game. When on, the players table gains three
          columns the host sets for each player, bots included, and everyone
          sees them.
        </p>
        <ul>
          <li>
            <strong>Territories:</strong> a percentage, 100% by default. The map
            is split in proportion to everyone&apos;s percentage, so a player at
            200% starts with twice the territories of a player at 100%. Every
            player keeps at least one. It applies to Random, Semi and Custom
            placement; with Custom, a player who has claimed their share is
            skipped. Single placement gives everyone one territory.
          </li>
          <li>
            <strong>Initial Troops:</strong> the player&apos;s starting troops
            per territory, replacing Initial Troops for them.
          </li>
          <li>
            <strong>Min Troops:</strong> the player&apos;s minimum
            reinforcements per turn, replacing Min Troops for them.
          </li>
        </ul>
        <p>
          With Blitz Off, Initial Troops and Min Troops stop at 10. Turning Odds
          off resets every player to the normal settings, and Randomize leaves
          the setting untouched.
        </p>
      </WikiSection>
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
