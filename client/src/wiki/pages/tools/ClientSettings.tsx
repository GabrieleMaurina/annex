import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function ClientSettings() {
  return (
    <>
      <p>
        Press O or click the gear in the top left corner to open the client
        settings. They only affect your own screen and are separate from game
        settings (<WikiLink to="settings/overview" />
        ).
      </p>
      <WikiSection id="buttons" title="The buttons">
        <WikiTable
          head={['Button', 'Does']}
          rows={[
            ['Sound', 'Mutes or unmutes all sound.'],
            ['Animations', 'Turns animations and interface effects on or off.'],
            ['Fullscreen', 'Enters or leaves fullscreen.'],
            ['Share', 'Shares the current page with friends.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="volume" title="Volume">
        <ul>
          <li>
            The master slider controls all sound. It snaps to the middle, and
            keyboard arrows move it freely.
          </li>
          <li>
            The mixer button reveals separate sliders for sound effects and
            music.
          </li>
          <li>
            When music plays, the current song is named, with buttons for
            previous and next.
          </li>
          <li>Each slider starts at the middle.</li>
        </ul>
      </WikiSection>
      <WikiSection id="troops" title="Troop inputs">
        <p>
          When a troop input can go above 100, press % to switch it to a
          percentage of the maximum. The choice is remembered.
        </p>
      </WikiSection>
      <WikiSection id="saved" title="Where settings are kept">
        <p>
          With an account they follow you across devices. Guests get defaults on
          each visit (<WikiLink to="accounts/guests-and-accounts" />
          ). Other personal convenience settings, like remembered filters and
          your last game setup, are saved the same way.
        </p>
      </WikiSection>
      <SeeAlso pages={['tools/shortcuts', 'tools/tanks', 'tools/install']} />
    </>
  );
}

export default ClientSettings;
