import SeeAlso from '../../parts/SeeAlso';
import WikiSection from '../../parts/WikiSection';

function Install() {
  return (
    <>
      <WikiSection id="what" title="Annex as an app">
        <p>
          Annex is a web app you can install on a phone, tablet or computer. An
          installed copy opens in its own window, without browser bars, and
          starts from your home screen or app list. It is the same game and
          updates itself.
        </p>
      </WikiSection>
      <WikiSection id="how" title="How to install">
        <ul>
          <li>
            When your browser supports it, an Install button appears on the home
            page. Press it and confirm.
          </li>
          <li>
            If the button is missing, use your browser menu and choose Install
            or Add to Home Screen.
          </li>
          <li>Once installed or opened as an app, the button stays hidden.</li>
        </ul>
      </WikiSection>
      <WikiSection id="tips" title="Good to know">
        <ul>
          <li>
            The game is designed for landscape. A phone asks you to rotate.
          </li>
          <li>
            Fullscreen is also available from the client settings without
            installing.
          </li>
          <li>You still need a connection for online games.</li>
        </ul>
      </WikiSection>
      <SeeAlso pages={['tools/client-settings', 'start/first-game']} />
    </>
  );
}

export default Install;
