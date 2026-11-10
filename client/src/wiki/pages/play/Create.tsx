import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Create() {
  return (
    <>
      <WikiSection id="steps" title="Hosting a game">
        <ol>
          <li>Press Create Online on the home page.</li>
          <li>
            You land in a new lobby as host, with your remembered setup (or the
            defaults), two slots and no map.
          </li>
          <li>
            Choose a map (<WikiLink to="maps/overview" />
            ), set the mode and rules (<WikiLink to="settings/overview" />
            ), add slots or bots (<WikiLink to="play/lobby" />
            ).
          </li>
          <li>Share the game link or wait for players.</li>
          <li>Press Start once there are at least two players.</li>
        </ol>
        <p>
          Every game has its own link, so sharing it is enough to invite
          someone. Names are up to 20 characters. The host can rename the game
          by clicking its title.
        </p>
      </WikiSection>
      <WikiSection id="start" title="Requirements to start">
        <ul>
          <li>A map must be selected.</li>
          <li>
            At least two players. Online, at least two of them must be human.
          </li>
          <li>
            Team Deathmatch needs two teams with players and no alliances.
          </li>
          <li>Blitz Off needs a settings combination that allows it.</li>
        </ul>
        <p>
          If you are the only human, the game quietly becomes an offline game
          with the same map, settings and bots (<WikiLink to="play/offline" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="visibility" title="Visibility and password">
        <WikiTable
          head={['Setting', 'Effect']}
          rows={[
            ['Public', 'Listed on the home page.'],
            [
              'Private',
              'Hidden from the list but joinable by anyone with the link.',
            ],
            [
              'Password',
              'Up to 50 characters. Newcomers must enter it. People already in the game are never asked again, even if you change it.',
            ],
          ]}
        />
        <p>Quick Play never joins a game with a password.</p>
      </WikiSection>
      <WikiSection id="host" title="Host powers">
        <ul>
          <li>Edit every setting while in the lobby.</li>
          <li>Add, change and remove bots, and remove or ban humans.</li>
          <li>
            Pause a running game once (<WikiLink to="start/game-screen" />
            ).
          </li>
          <li>Change the speed of bots while the game runs.</li>
        </ul>
        <p>If the host leaves the lobby, hosting passes to another player.</p>
      </WikiSection>
      <WikiSection id="presets" title="Reusing setups">
        <p>
          Your last setup is remembered, and accounts have five preset slots (
          <WikiLink to="settings/overview#presets" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['play/lobby', 'play/join', 'settings/session']} />
    </>
  );
}

export default Create;
