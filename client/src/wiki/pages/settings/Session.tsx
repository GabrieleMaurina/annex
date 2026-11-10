import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Session() {
  return (
    <>
      <WikiSection id="turn-duration" title="Turn Duration">
        <p>
          How long each turn can last: 30 seconds, 1, 1.5, 2 (default), 2.5, 3
          or 5 minutes. When time runs out the game finishes the turn for you:
          spare troops land on random territories and any pending move is
          resolved (<WikiLink to="rules/turns" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="attack-increment" title="Attack Increment">
        <p>
          Seconds added to your remaining time each time you conquer a
          territory, once your troops have moved in. 0 to 15 seconds, 0 by
          default. Remaining time never exceeds 3 minutes this way.
        </p>
      </WikiSection>
      <WikiSection id="requirements" title="Seat requirements">
        <p>
          The host can limit who sits at the table. Anyone may still watch,
          except the reputation limit, which also blocks spectating.
        </p>
        <WikiTable
          head={['Setting', 'Rule']}
          rows={[
            [
              'Min Rank',
              'Lowest rank allowed to take a seat. Guests have no rank, so only Private lets them sit.',
            ],
            [
              'Min Games',
              'Fewest recorded games needed. Only games that completed a round count. Guests have none.',
            ],
            [
              'Min Account Age',
              'How old the account must be, from none up to a year. Guests only sit with None.',
            ],
            [
              'Min Reputation',
              'Players below this reputation cannot join or spectate. Default -50.',
            ],
          ]}
        />
        <ul>
          <li>
            Seated players below a requirement the host later raises are moved
            to the spectators.
          </li>
          <li>A host cannot set a requirement they do not meet themselves.</li>
          <li>
            Reputation checks use your reputation plus the new account allowance
            (<WikiLink to="ranking/reputation" />
            ).
          </li>
          <li>Offline games do not show these.</li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['play/join', 'accounts/guests-and-accounts', 'ranking/elo']}
      />
    </>
  );
}

export default Session;
