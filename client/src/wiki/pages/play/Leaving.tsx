import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Leaving() {
  return (
    <>
      <WikiSection id="states" title="What leaving does">
        <p>
          You hold one seat at a time. What happens when you close the tab, go
          to another page or lose your connection depends on the game&apos;s
          state.
        </p>
        <WikiTable
          head={['State', 'Result']}
          rows={[
            [
              'Lobby',
              'A connected spectator stands in for you. With none waiting, your slot is freed. Come back before the start to reclaim a slot.',
            ],
            [
              'Playing',
              'Your seat, territories and troops stay. A bot takes over at once. Return and you get control back instantly.',
            ],
            [
              'Ended',
              'You are released and can join another game. Return to see the results again.',
            ],
          ]}
        />
        <p>
          The takeover bot uses the game&apos;s Disconnect settings (
          <WikiLink to="bots/takeover" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="reconnect" title="Coming back">
        <p>
          Open the game again from any device with the same login (or the same
          browser as a guest). While you hold a seat in a running game you
          cannot open or create another one, and logging in or out is refused.
          The home page shows a Resume button.
        </p>
        <p>
          Annex works in one tab or window at a time. Opening it in a second one
          disconnects the first, which counts as leaving.
        </p>
      </WikiSection>
      <WikiSection id="auto" title="Automatic surrender">
        <p>
          If you stay disconnected through more than two of your own turns in an
          online game, you are surrendered automatically. A short refresh or
          dropped connection that ends before your turn comes does not count.
        </p>
      </WikiSection>
      <WikiSection id="surrender" title="Surrender">
        <p>
          Surrender is the deliberate way out. You stop acting for good but stay
          in the results and can keep watching. Afterward you are free to join
          another game. Cost depends on how early you give up (
          <WikiLink to="ranking/elo#penalties" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="abort" title="Aborting a game">
        <p>
          During round 1 of an online game, all remaining humans can agree to
          abort. Nothing is recorded (<WikiLink to="settings/stalemate#abort" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="empty" title="When nobody is left">
        <p>
          An online game with no human left ends. If every human has
          disconnected or surrendered, it closes shortly after unless someone
          returns. A lobby of only bots closes too.
        </p>
      </WikiSection>
      <Callout kind="warning">
        Leaving early costs Elo and reputation (
        <WikiLink to="ranking/elo#penalties" />
        ). If you must leave, do it as late as you can.
      </Callout>
      <SeeAlso pages={['ranking/elo', 'ranking/reputation', 'bots/takeover']} />
    </>
  );
}

export default Leaving;
