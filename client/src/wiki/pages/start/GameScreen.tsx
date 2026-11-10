import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function GameScreen() {
  return (
    <>
      <WikiSection id="map" title="The map">
        <p>
          Every territory shows its owner&apos;s color and a number: the troops
          stationed there. A capital carries a marker. Seas, portals, toxins,
          radiation and other special features are drawn on the map and
          explained in their own pages. Pan and zoom to look around, and press H
          to hide the interface for a clear view.
        </p>
        <p>
          Click one of your territories to select it, then click a target. The
          action panel for the current phase appears next to the map and shows
          what you can do.
        </p>
      </WikiSection>
      <WikiSection id="bars" title="Turn bar and timer">
        <p>
          The bar at the bottom shows whose turn it is and the current phase (
          <WikiLink to="rules/turns" />
          ). A line along the top of the screen shows the time left in the turn.
          Press Tab to move to the next phase.
        </p>
      </WikiSection>
      <WikiSection id="panels" title="Panels">
        <p>Panels open from the buttons on the map or from a key.</p>
        <WikiTable
          head={['Panel', 'Key', 'Shows']}
          rows={[
            [
              'Players',
              'P',
              'Every player with territories, troops, cards and status. Host controls live here.',
            ],
            ['Chat', 'C', 'Messages from players and spectators.'],
            ['Bonuses', 'B', 'The value of each continent and who holds it.'],
            [
              'Territory Cards',
              'T',
              'Your hand and the value of the next set.',
            ],
            ['Logs', 'L', 'Everything that happened, turn by turn.'],
            ['Game settings', 'S', 'The rules this game uses.'],
            [
              'Nukes',
              'N',
              'Your arsenal and construction, only when nukes are on.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="players" title="The players panel">
        <ul>
          <li>
            Each row shows the color, rank icon, flag and status icons: bot,
            muted, eliminated, surrendered, disconnected.
          </li>
          <li>
            Click a row to expand it for the name and actions such as emoji,
            report, block and add friend (
            <WikiLink to="ranking/reports" />
            ).
          </li>
          <li>
            With alliances on, the alliance cell offers, accepts or ends a pact
            (<WikiLink to="advanced/alliances" />
            ).
          </li>
          <li>
            Surrender gives up your seat for good. Draw appears once a draw can
            be agreed (<WikiLink to="rules/winning" />
            ).
          </li>
          <li>
            The host can pause the game and change how fast bots act (
            <WikiLink to="play/lobby" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="mouse" title="Mouse shortcuts">
        <p>
          Right-click performs the common action in one step: deploy all your
          troops, blitz a target and move everyone in, fortify everything to the
          target. Middle-click does the same with the minimum. The full list is
          on <WikiLink to="tools/shortcuts" />.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['tools/shortcuts', 'tools/client-settings', 'rules/turns']}
      />
    </>
  );
}

export default GameScreen;
