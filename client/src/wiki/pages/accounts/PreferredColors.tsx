import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function PreferredColors() {
  return (
    <>
      <p>
        Preferred colors are an ordered list of player colors saved on your
        account. Whenever you take a seat, the game gives you the first color on
        your list that is allowed and still free.
      </p>
      <WikiSection id="setting" title="Setting them">
        <p>
          On your account page, drag colors into Preferred and put them in the
          order you want, or click a color to add or remove it (
          <WikiLink to="accounts/account-page" />
          ). Colors left under Available have no preference.
        </p>
      </WikiSection>
      <WikiSection id="allowed" title="Which colors are allowed">
        <p>
          A game only uses as many colors as it has players plus 3, up to 20.
          With 4 players in the lobby, the first 7 colors are allowed. A
          preferred color outside that range is skipped until enough players
          have joined.
        </p>
      </WikiSection>
      <WikiSection id="picking" title="How you get one">
        <ul>
          <li>
            The host sits in the first seat, so they get their first preferred
            color when it is allowed.
          </li>
          <li>
            Everyone who joins later gets the first preferred color that is
            allowed and not taken by another player.
          </li>
          <li>
            If none qualifies, you get a random free color. You can still click
            your row in the lobby to cycle to another one.
          </li>
          <li>
            In an offline game the host gets their preferred colors when the
            account can be reached. Without a connection, or as a guest, the
            color is random.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="profile" title="On profiles">
        <p>
          Your preferred colors are shown, numbered in order, on your profile
          for everyone to see. Only you can change them, from your account page
          (<WikiLink to="accounts/profiles" />
          ).
        </p>
      </WikiSection>
      <Callout kind="note">
        Changing your colors never recolors a started game. In an offline lobby
        they are applied when your account loads, and the bots are given new
        random colors.
      </Callout>
      <SeeAlso pages={['accounts/account-page', 'play/lobby']} />
    </>
  );
}

export default PreferredColors;
