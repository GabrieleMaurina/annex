import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function AccountPage() {
  return (
    <>
      <p>
        Open it from your name at the top of the menu. It is only for accounts.
        Press View Profile to see the page other players see (
        <WikiLink to="accounts/profiles" />
        ).
      </p>
      <WikiSection id="picture" title="Profile picture">
        <ul>
          <li>Choose a PNG, JPEG or WebP image, then crop it to a square.</li>
          <li>
            Every picture is checked by automatic moderation. A flagged image is
            refused and nothing is saved.
          </li>
          <li>Remove it at any time. A replacement is optional.</li>
        </ul>
      </WikiSection>
      <WikiSection id="text" title="Profile text">
        <p>
          A short bio of up to 200 characters, shown on your profile. It is
          checked for profanity. You can edit it here or on your own profile.
        </p>
      </WikiSection>
      <WikiSection id="country" title="Country">
        <p>
          Your flag appears next to your name in lobbies, results and lists.
          Hosts of anonymous games hide it until the game ends (
          <WikiLink to="settings/players" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="preferred-colors" title="Preferred colors">
        <p>
          Drag colors into Preferred and put them in the order you want. Joining
          or creating a game gives you the first one still free; if none are
          free, you get a random color as before. Colors left under Available
          have no preference. A change only applies after your next page refresh
          (
          <WikiLink to="accounts/preferred-colors" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="password" title="Password">
        <p>
          Enter the current password and the new one twice. The new one must
          follow the same rules as at signup and differ from the old one. Your
          other devices stay signed in.
        </p>
      </WikiSection>
      <WikiSection id="fixed" title="What cannot change">
        <p>
          Username and email are permanent. Pick them with care (
          <WikiLink to="accounts/create-account" />
          ).
        </p>
      </WikiSection>
      <Callout kind="warning">
        A picture or text that other players report as offensive, once enough of
        them agree, is hidden and costs reputation (
        <WikiLink to="ranking/reports" />
        ).
      </Callout>
      <SeeAlso pages={['accounts/profiles', 'ranking/reputation']} />
    </>
  );
}

export default AccountPage;
