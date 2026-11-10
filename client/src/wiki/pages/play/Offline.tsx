import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Offline() {
  return (
    <>
      <WikiSection id="what" title="What offline means">
        <p>
          Create Offline plays the whole game on your own device against bots.
          It works without an account and even when you cannot reach the online
          service. Offline games are never saved, so they do not appear in any
          game history.
        </p>
      </WikiSection>
      <WikiSection id="setup" title="Setting up">
        <ul>
          <li>
            The lobby works like an online one, with the same settings and maps
            (<WikiLink to="play/lobby" />
            ).
          </li>
          <li>
            Settings that only make sense online are hidden: anonymous games and
            seat requirements.
          </li>
          <li>
            Your last setup is remembered, so Create Offline starts from it.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="local" title="Several people on one device">
        <p>
          The host can press Add Player to seat extra humans on the same screen.
          Give each a name and a color. When the turn changes between humans, a
          full screen colored with the next player&apos;s color asks you to pass
          the device and tap to continue, so nobody sees the previous
          player&apos;s cards.
        </p>
      </WikiSection>
      <WikiSection id="after" title="When the humans are out">
        <p>
          If every human is eliminated or surrenders, the bots play on. A
          Restart button appears, including on the end screen, that starts a
          fresh game with the same settings, seats, colors, teams and map. Roles
          that were Random are rolled again.
        </p>
      </WikiSection>
      <WikiSection id="differences" title="Differences from online">
        <WikiTable
          head={['Aspect', 'Offline', 'Online']}
          rows={[
            [
              'Elo and reputation',
              'Never change',
              'Rated against other accounts',
            ],
            [
              'Achievements',
              'Only First Offline and Offline Victory',
              'The full list',
            ],
            ['Game history', 'Not saved', 'Saved'],
            ['Pause', 'Unlimited', 'Once, up to 60 seconds'],
          ]}
        />
      </WikiSection>
      <SeeAlso
        pages={['start/first-game', 'bots/difficulty', 'accounts/achievements']}
      />
    </>
  );
}

export default Offline;
