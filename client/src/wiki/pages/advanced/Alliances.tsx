import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Alliances() {
  return (
    <>
      <WikiSection id="what" title="What an alliance is">
        <p>
          A private pact between two players, only in games with Alliances on.
          Nobody else is told. Two benefits, nothing more:
        </p>
        <ul>
          <li>You can send each other direct emojis, and nobody else can.</li>
          <li>With fog of war on, you share vision.</li>
        </ul>
        <Callout kind="warning">
          An alliance does not stop allies attacking each other and does not
          change victory conditions. Trust is up to you.
        </Callout>
      </WikiSection>
      <WikiSection id="use" title="Using alliances">
        <ol>
          <li>
            Click the alliance cell in another player&apos;s row of the players
            panel to offer a pact.
          </li>
          <li>
            They see a request. Accept or decline from the small popup.
            Unanswered offers expire after 60 seconds.
          </li>
          <li>Either side can end the alliance later.</li>
        </ol>
        <p>
          Cancelling your own offer, or being declined, starts a 60 second wait
          before you can offer to that player again. They can still offer to you
          right away. You cannot ally with bots.
        </p>
      </WikiSection>
      <WikiSection id="without" title="Without alliances">
        <p>
          When Alliances are off you can send direct emojis to anyone (
          <WikiLink to="social/chat" />
          ). In Team Deathmatch teammates get both benefits automatically and
          alliances cannot be switched on (<WikiLink to="modes/teams" />
          ).
        </p>
      </WikiSection>
      <SeeAlso
        pages={['settings/players', 'advanced/fog', 'accounts/achievements']}
      />
    </>
  );
}

export default Alliances;
