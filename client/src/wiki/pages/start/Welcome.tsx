import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Welcome() {
  return (
    <>
      <WikiSection id="what" title="What is Annex">
        <p>
          Annex is a free, open source strategy game of conquest. Two or more
          players, humans or bots, share a map cut into territories. Each
          territory has an owner and a number of troops. You grow your army,
          attack your neighbors and try to be the last commander standing.
        </p>
        <p>
          There are no ads and no microtransactions. Everything is playable
          without paying and without an account.
        </p>
      </WikiSection>
      <WikiSection id="win" title="How you win">
        <p>
          It depends on the <WikiLink to="modes/overview">game mode</WikiLink>.
          The default, Supremacy, asks you to own every territory. Other modes
          ask for a share of the map, your enemies&apos; capitals, a hidden
          mission or a points race. In most modes the last player standing wins
          at once, whatever the objective.
        </p>
      </WikiSection>
      <WikiSection id="loop" title="The loop of a turn">
        <ol>
          <li>
            <strong>Deploy</strong> new troops on your territories (
            <WikiLink to="rules/deploy" />
            ).
          </li>
          <li>
            <strong>Attack</strong> neighboring enemies with dice (
            <WikiLink to="rules/attack" />
            ).
          </li>
          <li>
            <strong>Fortify</strong> by moving troops between your own
            territories (
            <WikiLink to="rules/fortify" />
            ).
          </li>
        </ol>
        <p>
          Conquer something during your turn and you also earn a card, which you
          can later trade for troops (<WikiLink to="rules/cards" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="ways" title="Ways to play">
        <ul>
          <li>
            <strong>Quick Play</strong> drops you into an open online lobby.
          </li>
          <li>
            <strong>Create Online</strong> hosts a game that others can join (
            <WikiLink to="play/create" />
            ).
          </li>
          <li>
            <strong>Create Offline</strong> plays against bots on your own
            device, or with friends on one screen (
            <WikiLink to="play/offline" />
            ).
          </li>
          <li>
            <strong>Tutorials</strong> teach each idea in a few minutes (
            <WikiLink to="start/tutorials" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="beyond" title="Beyond the game">
        <p>
          Accounts give you a rank, a profile, friends and saved settings (
          <WikiLink to="accounts/guests-and-accounts" />
          ). You can browse community maps, generate new ones or draw your own (
          <WikiLink to="maps/overview" />
          ), and watch every finished game again (
          <WikiLink to="history/replays" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['start/first-game', 'start/glossary', 'rules/turns']} />
    </>
  );
}

export default Welcome;
