import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function FirstGame() {
  return (
    <>
      <WikiSection id="steps" title="Three easy starts">
        <ol>
          <li>
            <strong>Learn by doing.</strong> Open the{' '}
            <WikiLink app="/tutorials">Tutorials page</WikiLink> and play the
            lessons in order. Each takes a few minutes. See{' '}
            <WikiLink to="start/tutorials" />.
          </li>
          <li>
            <strong>Practice against bots.</strong> Press Create Offline on the
            home page, add bots in the lobby and start. Nothing is rated, so you
            can experiment. See <WikiLink to="play/offline" />.
          </li>
          <li>
            <strong>Play real people.</strong> Press Quick Play. You join the
            fullest open lobby you are allowed to sit in. See{' '}
            <WikiLink to="play/games-list" />.
          </li>
        </ol>
      </WikiSection>
      <WikiSection id="before" title="Before the first online game">
        <ul>
          <li>
            You do not need an account, but without one you get no rank and
            cannot make friends or save settings (
            <WikiLink to="accounts/guests-and-accounts" />
            ).
          </li>
          <li>
            Leaving a game early costs Elo and reputation, so only join games
            you can finish (<WikiLink to="ranking/elo" />
            ).
          </li>
          <li>
            Read the settings shown in the lobby. Every game can use different
            rules (<WikiLink to="settings/overview" />
            ).
          </li>
        </ul>
        <Callout kind="tip">
          The game starts with deploying. Put your troops on territories that
          touch enemies, because that is where fights happen.
        </Callout>
      </WikiSection>
      <WikiSection id="then" title="After your first game">
        <p>
          The results screen shows how everyone did (
          <WikiLink to="history/results" />
          ). Every game is saved, so you can step through it again in a replay (
          <WikiLink to="history/replays" />) and see where it was decided.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['start/game-screen', 'rules/turns', 'strategy/basics']}
      />
    </>
  );
}

export default FirstGame;
