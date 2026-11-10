import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function GuestsAndAccounts() {
  return (
    <>
      <WikiSection id="guests" title="Playing as a guest">
        <p>
          Open the site and play. A guest gets a random name like Player4821,
          can join, host and finish online games, chat, spectate and play
          offline. Nothing about a guest is saved online, and a guest who clears
          their browser data becomes a new player.
        </p>
      </WikiSection>
      <WikiSection id="compare" title="Guest or account">
        <WikiTable
          head={['Feature', 'Guest', 'Account']}
          rows={[
            ['Play online and offline', 'Yes', 'Yes'],
            ['Name', 'Random, cannot change', 'Your username, permanent'],
            ['Elo and rank', 'None', 'Rated after every game'],
            ['Reputation', 'None', 'Tracked'],
            ['Profile with picture, text, country and stats', 'No', 'Yes'],
            ['Friends and messages', 'No', 'Yes'],
            ['Achievements', 'No', 'Yes'],
            ['Saved settings, filters and presets', 'No', 'Yes, on any device'],
            ['Tutorial progress', 'This browser only', 'Saved to the account'],
            ['Publish and like maps', 'No', 'Yes'],
            ['Report and block players', 'No', 'Yes'],
            [
              'Seats in games with requirements',
              'Only if there are none',
              'If you meet them',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="rated" title="Rated games need accounts">
        <p>
          Elo changes only count players who held a seat with an account when
          the game started. Guests are ignored by the rating, and a game with a
          single account rates nobody.
        </p>
        <Callout kind="note">
          Hosts can require a minimum rank, number of games, account age or
          reputation to sit down. A guest meets none of these, so such games
          only accept them as spectators (<WikiLink to="settings/session" />
          ).
        </Callout>
      </WikiSection>
      <WikiSection id="next" title="Ready for an account?">
        <p>
          Creating one is free and takes a minute. See{' '}
          <WikiLink to="accounts/create-account" />.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['accounts/create-account', 'accounts/profiles', 'ranking/elo']}
      />
    </>
  );
}

export default GuestsAndAccounts;
