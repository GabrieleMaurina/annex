import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Friends() {
  return (
    <>
      <p>
        Friends are an account feature. The{' '}
        <WikiLink app="/friends">Friends page</WikiLink> is hidden from guests.
      </p>
      <WikiSection id="add" title="Adding friends">
        <ul>
          <li>
            Use Find players on the Friends page: search by username and press
            Add friend.
          </li>
          <li>
            Or press Add friend on a profile, in a replay row or in the end
            screen menu.
          </li>
          <li>
            If they had already asked you, adding them accepts their request.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="lists" title="The lists">
        <ul>
          <li>
            <strong>Requests:</strong> people who asked you. Accept or reject.
          </li>
          <li>
            <strong>Sent requests:</strong> your pending asks. Cancel any.
          </li>
          <li>
            <strong>Your friends:</strong> accepted friends. Remove anyone.
          </li>
          <li>
            <strong>Blocked players:</strong> everyone you blocked, with an
            Unblock button (<WikiLink to="ranking/reports#blocks" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="uses" title="What friends give you">
        <ul>
          <li>A quick list of people to message and find.</li>
          <li>
            Their profile shows an online dot. Press Watch there to follow their
            game (<WikiLink to="play/spectating" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="rules" title="Rules">
        <ul>
          <li>You cannot befriend yourself or someone you blocked.</li>
          <li>If someone blocked you, they never see your request.</li>
          <li>Blocking someone ends an existing friendship.</li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['social/messages', 'accounts/profiles', 'ranking/reports']}
      />
    </>
  );
}

export default Friends;
