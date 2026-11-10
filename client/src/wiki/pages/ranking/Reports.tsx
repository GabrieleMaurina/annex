import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Reports() {
  return (
    <>
      <WikiSection id="reasons" title="Report reasons">
        <WikiTable
          head={['Reason', 'Meaning']}
          rows={[
            [
              'Collusion',
              'Secretly teaming up with another player, or playing several accounts in one game.',
            ],
            [
              'Stream sniping',
              "Watching another player's stream to see hidden information.",
            ],
            [
              'Verbal abuse',
              'Insults, harassment, hate speech or threats in chat.',
            ],
            [
              'Fake botting',
              'Pretending to be idle or disconnected so others ignore you, then coming back to play.',
            ],
            [
              'Stalling',
              'Wasting time on purpose: using the full timer or dragging out a decided game.',
            ],
            [
              'Offensive picture',
              'A sexual, violent, hateful or otherwise inappropriate profile picture.',
            ],
            ['Offensive text', 'The same, for profile text.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="where" title="Where to report">
        <ul>
          <li>
            <strong>During a game:</strong> expand the player&apos;s row in the
            players panel and press Report. Only accounts that held a seat at
            the start can report, against another such account.
          </li>
          <li>
            <strong>After a game:</strong> from the results table row menu or
            the replay, for 24 hours after the game ended, and only if you
            played in it.
          </li>
          <li>
            <strong>On a profile:</strong> any time. Right-click a picture or
            profile text to report it directly.
          </li>
        </ul>
        <p>
          Offline games, guests, bots and yourself cannot be reported. In
          anonymous games reporting stays available for every seat.
        </p>
      </WikiSection>
      <WikiSection id="limits" title="Limits">
        <ul>
          <li>You can report a player once per game.</li>
          <li>
            Profile reports for the same reason can only be repeated after a
            long while.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="confirm" title="What happens to a report">
        <p>
          A report never punishes anyone by itself. Only when enough different
          players report the same thing does the target lose reputation (
          <WikiLink to="ranking/reputation" />
          ), and a reported picture is hidden or profile text is cleared.
        </p>
        <p>Reporting without good reason can cost you reputation.</p>
        <Callout kind="note">
          Report only real problems. One player reporting repeatedly never
          confirms anything.
        </Callout>
      </WikiSection>
      <WikiSection id="blocks" title="Blocking">
        <p>
          Accounts can block up to 100 other accounts, from a profile, a
          conversation, a results or replay row, or the players panel. In
          anonymous games the option appears after the game. Blocking:
        </p>
        <ul>
          <li>
            Removes any friendship or request and stops friend requests and
            messages from you to them.
          </li>
          <li>
            Hides their messages and friend requests from you. The conversation
            returns intact if you unblock.
          </li>
          <li>Mutes their chat and emojis for you in games you share.</li>
          <li>
            Keeps you from ever sitting in the same game: a game one of you is
            in appears unavailable to the other.
          </li>
        </ul>
        <p>
          The blocked player is never told. Manage the list on the{' '}
          <WikiLink app="/friends">Friends page</WikiLink>.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['ranking/reputation', 'social/messages', 'social/chat']}
      />
    </>
  );
}

export default Reports;
