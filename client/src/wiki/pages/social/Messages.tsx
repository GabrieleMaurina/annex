import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Messages() {
  return (
    <>
      <WikiSection id="what" title="Private messages">
        <p>
          Accounts can exchange private messages on the{' '}
          <WikiLink app="/messages">Messages page</WikiLink>. Conversations are
          listed with the most recent first. Open a profile and press Send
          message to start one. Guests cannot send or receive messages.
        </p>
      </WikiSection>
      <WikiSection id="unread" title="Unread messages">
        <p>
          A red badge on the menu button and on the Messages entry counts unread
          messages. It updates while you browse, but not during a game.
        </p>
      </WikiSection>
      <WikiSection id="writing" title="Writing">
        <ul>
          <li>Up to 1000 characters. The counter shows how many are left.</li>
          <li>Enter sends. Shift + Enter starts a new line.</li>
          <li>Profanity is rejected.</li>
          <li>There is a short delay between messages and a daily limit.</li>
        </ul>
      </WikiSection>
      <WikiSection id="blocked" title="Blocked players">
        <p>
          If you block someone, their conversation disappears from your list and
          you cannot message them. It all comes back if you unblock them. They
          are never told (<WikiLink to="ranking/reports#blocks" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['social/friends', 'social/chat', 'ranking/reports']} />
    </>
  );
}

export default Messages;
